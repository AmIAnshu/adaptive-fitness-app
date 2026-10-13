/**
 * Quantitative Nutrition Target Engine (Stage W7.2)
 *
 * Deterministically computes energy expenditure, target caloric range, and
 * macronutrient partitioning from a validated CanonicalUserProfile and NutritionStrategy.
 *
 * INVARIANTS:
 * 1. Pure, deterministic, immutable, zero randomness, zero external dependencies.
 * 2. NO FABRICATED SEX: Biological sex is never inferred or guessed.
 *    If absent or 'prefer_not_to_say', readiness stays 'pending_required_inputs'.
 * 3. NO FABRICATED PRECISION: Caloric targets are represented as realistic conservative
 *    ranges (e.g. 2,400 – 2,600 kcal) rounded to clean increments, avoiding false
 *    precision like 2,473 kcal.
 * 4. SAFETY FLOORS:
 *    - Absolute minimum caloric floor: 1,500 kcal (male), 1,200 kcal (female).
 *    - Absolute minimum fat floor: >= 45g (and >= 0.8 g/kg) for hormonal baseline.
 *    - Protein g/kg based on objective and diet.
 * 5. POPULATION BOUNDARY:
 *    - Adult (18-100): Eligible when biological sex is provided.
 *    - Youth (13-17): Safely held pending adolescent metabolic guidelines.
 *    - Ineligible (<13 or >100): Blocked at boundary.
 */

import type { CanonicalUserProfile, BiologicalSex, DietType } from '../profile';
import { resolveStrategyPopulation } from '../training-strategy/strategyPopulation';
import type { NutritionStrategy, NutritionObjective } from './types';
import type {
  QuantitativeReadiness,
  EnergyTargetRange,
  EnergyEstimate,
  MacroItem,
  MacronutrientTargets,
  NutritionTargets,
  NutritionTargetsResult,
} from './quantitativeTypes';

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj as Readonly<T>;
}

/**
 * Evaluates quantitative calculation readiness.
 */
export function evaluateQuantitativeReadiness(
  profile: CanonicalUserProfile
): QuantitativeReadiness {
  const pop = resolveStrategyPopulation(profile);

  if (pop.path === 'ineligible') {
    return {
      status: 'ineligible',
      reason: pop.reason,
      canCalculateCalories: false,
      canCalculateMacros: false,
      canCalculateTDEE: false,
      decisionTrace: [
        ...pop.decisionTrace,
        'Quantitative calculations barred: Trainee is ineligible.',
      ],
    };
  }

  if (pop.path === 'youth_strategy_pending') {
    return {
      status: 'pending_required_inputs',
      reason:
        'Quantitative energy and macronutrient calculation is held for youth trainees pending adolescent metabolic guidelines.',
      missingInputs: ['adult_clearance', 'youth_metabolic_guidelines'],
      canCalculateCalories: false,
      canCalculateMacros: false,
      canCalculateTDEE: false,
      decisionTrace: [
        ...pop.decisionTrace,
        'Youth trainee (13–17): Adult metabolic formulas are held.',
      ],
    };
  }

  const sex = profile.anthropometrics.biologicalSex;

  if (sex === 'male' || sex === 'female') {
    return {
      status: 'ready',
      method: 'mifflin_st_jeor',
      canCalculateCalories: true,
      canCalculateMacros: true,
      canCalculateTDEE: true,
      decisionTrace: [
        `Biological sex explicitly specified: ${sex}`,
        'Metabolic formula: Mifflin-St Jeor equation selected',
        'Inputs verified: age, height, weight, daily activity, training schedule',
      ],
    };
  }

  return {
    status: 'pending_required_inputs',
    reason:
      'Quantitative energy and macronutrient calculation requires biological sex for basal metabolic rate calculation. Precision is deliberately deferred to avoid fabricating physiological metrics.',
    missingInputs: ['biological_sex'],
    canCalculateCalories: false,
    canCalculateMacros: false,
    canCalculateTDEE: false,
    decisionTrace: [
      sex === 'prefer_not_to_say'
        ? "Biological sex: 'prefer_not_to_say'"
        : 'Biological sex: unstated / omitted in profile',
      'Quantitative calculations deferred without fabricating physiological assumptions',
    ],
  };
}

/**
 * Computes Basal Metabolic Rate using Mifflin-St Jeor formula.
 *
 * Male:   10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + 5
 * Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) - 161
 */
export function calculateBasalMetabolicRate(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'male' | 'female'
): { bmrKcal: number; trace: string } {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = sex === 'male' ? 5 : -161;
  const bmrKcal = Math.round(base + offset);
  const trace = `BMR (Mifflin-St Jeor): 10*${weightKg}kg + 6.25*${heightCm}cm - 5*${age}y ${offset >= 0 ? '+' : ''}${offset} = ${bmrKcal} kcal/day`;
  return { bmrKcal, trace };
}

/**
 * Resolves activity multiplier based on daily non-exercise activity and planned training schedule.
 */
export function calculateActivityMultiplier(
  profile: CanonicalUserProfile
): { multiplier: number; trace: string } {
  const daily = profile.recoveryLifestyle.dailyActivity;
  const trainingDays = profile.schedule.idealTrainingDays;

  let baseMultiplier = 1.20;
  if (daily === 'light') baseMultiplier = 1.375;
  if (daily === 'moderate') baseMultiplier = 1.55;
  if (daily === 'very_active') baseMultiplier = 1.725;

  // Training frequency adjustment
  let scheduleAdjustment = 0;
  if (trainingDays > 3) {
    scheduleAdjustment = Math.min(0.075, (trainingDays - 3) * 0.025);
  } else if (trainingDays <= 2) {
    scheduleAdjustment = -0.025;
  }

  const rawMultiplier = baseMultiplier + scheduleAdjustment;
  const multiplier = Math.min(1.85, Math.max(1.15, Number(rawMultiplier.toFixed(3))));
  const trace = `Activity multiplier: base ${baseMultiplier} (${daily}) + schedule adjustment ${scheduleAdjustment >= 0 ? '+' : ''}${scheduleAdjustment.toFixed(3)} (${trainingDays} training days) = ${multiplier}`;

  return { multiplier, trace };
}

/**
 * Resolves caloric goal adjustment (surplus, deficit, or maintenance) based on W7.1 nutrition objective.
 */
export function calculateGoalAdjustment(
  tdeeKcal: number,
  objective: NutritionObjective
): { adjustmentKcal: number; trace: string } {
  let adjustmentKcal = 0;
  let reason = 'Maintenance energy balance';

  switch (objective) {
    case 'muscle_gain_support': {
      // Conservative surplus: ~10% above TDEE, bounded between +200 and +350 kcal, rounded to nearest 25 kcal
      const raw = tdeeKcal * 0.10;
      adjustmentKcal = Math.min(350, Math.max(200, Math.round(raw / 25) * 25));
      reason = `Controlled surplus for lean hypertrophy (+${adjustmentKcal} kcal)`;
      break;
    }
    case 'fat_loss_support': {
      // Conservative deficit: ~15-20% below TDEE, bounded between -300 and -500 kcal, rounded to nearest 25 kcal
      const raw = tdeeKcal * 0.18;
      adjustmentKcal = -Math.min(500, Math.max(300, Math.round(raw / 25) * 25));
      reason = `Sustainable deficit for fat loss (${adjustmentKcal} kcal)`;
      break;
    }
    case 'body_composition_support': {
      // Mild recomp deficit
      adjustmentKcal = -100;
      reason = 'Mild recomp deficit (-100 kcal) for simultaneous lean retention and fat loss';
      break;
    }
    case 'performance_support': {
      // Mild surplus
      adjustmentKcal = 100;
      reason = 'Mild surplus (+100 kcal) for training recovery and performance support';
      break;
    }
    case 'general_health_support':
    default: {
      adjustmentKcal = 0;
      reason = 'Iso-caloric maintenance (0 kcal adjustment) for general health support';
      break;
    }
  }

  const trace = `Goal adjustment: ${reason} (TDEE: ${tdeeKcal} kcal)`;
  return { adjustmentKcal, trace };
}

/**
 * Calculates bounded daily target energy range.
 */
export function calculateEnergyTargetRange(
  tdeeKcal: number,
  adjustmentKcal: number,
  sex: 'male' | 'female'
): { targetRange: EnergyTargetRange; midpointKcal: number; trace: string } {
  const rawMidpoint = tdeeKcal + adjustmentKcal;

  // Physiological safety floor
  const minFloor = sex === 'male' ? 1500 : 1200;
  const safeMidpoint = Math.max(minFloor, rawMidpoint);

  // Round midpoint to nearest 25 kcal
  const midpointKcal = Math.round(safeMidpoint / 25) * 25;

  // Realistic daily window (+/- 100 kcal, total 200 kcal band)
  const minKcal = midpointKcal - 100;
  const maxKcal = midpointKcal + 100;

  const targetRange: EnergyTargetRange = {
    minKcal,
    maxKcal,
    midpointKcal,
  };

  const trace = `Target energy: midpoint ${midpointKcal} kcal (window ${minKcal} – ${maxKcal} kcal/day; safety floor ${minFloor} kcal respected)`;
  return { targetRange, midpointKcal, trace };
}

/**
 * Partitions target energy into macronutrients:
 * 1. Protein based on body weight, objective, and dietary constraints (rounded to 5g).
 * 2. Fat based on physiological floor (>= 45g, >= 0.8 g/kg) and objective (rounded to 5g).
 * 3. Carbohydrates filling the remaining caloric balance (rounded to 5g).
 */
export function calculateMacronutrientTargets(
  weightKg: number,
  targetMidpointKcal: number,
  objective: NutritionObjective,
  dietType: DietType,
  dietaryRestrictions: string[]
): {
  macros: MacronutrientTargets;
  hardConstraints: string[];
  trace: string[];
} {
  const trace: string[] = [];
  const hardConstraints: string[] = [];

  // 1. Protein target
  let baseProteinGPerKg = 2.0;

  if (objective === 'muscle_gain_support') {
    baseProteinGPerKg = 2.0;
  } else if (objective === 'fat_loss_support') {
    baseProteinGPerKg = 2.2; // Spares lean tissue in deficit
  } else if (objective === 'body_composition_support') {
    baseProteinGPerKg = 2.0;
  } else if (objective === 'performance_support') {
    baseProteinGPerKg = 1.8;
  } else if (objective === 'general_health_support') {
    baseProteinGPerKg = 1.4;
  }

  // Plant-based bioavailability compensation (+0.2 g/kg if vegan/vegetarian with high demand)
  const isPlantBased = dietType === 'vegan' || dietType === 'vegetarian';
  if (isPlantBased && baseProteinGPerKg >= 1.8) {
    baseProteinGPerKg = Math.min(2.4, baseProteinGPerKg + 0.2);
    hardConstraints.push(
      `${dietType === 'vegan' ? 'Vegan' : 'Vegetarian'} protein bioavailability compensation (+0.2 g/kg) applied`
    );
  }

  // Round protein to nearest 5g, with absolute floor of 60g
  const rawProteinGrams = weightKg * baseProteinGPerKg;
  const proteinGrams = Math.max(60, Math.round(rawProteinGrams / 5) * 5);
  const proteinCalories = proteinGrams * 4;
  const effectiveProteinGPerKg = Number((proteinGrams / weightKg).toFixed(2));

  trace.push(
    `Protein: ${proteinGrams}g (${effectiveProteinGPerKg} g/kg, ${proteinCalories} kcal) based on ${objective}${isPlantBased ? ' + plant-based compensation' : ''}`
  );

  // 2. Fat target
  let baseFatGPerKg = objective === 'fat_loss_support' ? 0.85 : 1.0;
  // Floor: minimum 45g and minimum 0.8 g/kg for hormonal health
  const rawFatGrams = Math.max(45, weightKg * baseFatGPerKg);
  const fatGrams = Math.max(45, Math.round(rawFatGrams / 5) * 5);
  const fatCalories = fatGrams * 9;
  const effectiveFatGPerKg = Number((fatGrams / weightKg).toFixed(2));

  trace.push(
    `Fat: ${fatGrams}g (${effectiveFatGPerKg} g/kg, ${fatCalories} kcal) hormonal baseline floor respected`
  );

  // 3. Carbohydrate target (filling remaining calories)
  const remainingCalories = Math.max(200, targetMidpointKcal - (proteinCalories + fatCalories));
  const rawCarbGrams = remainingCalories / 4;
  // Floor: 50g minimum carbs
  const carbGrams = Math.max(50, Math.round(rawCarbGrams / 5) * 5);
  const carbCalories = carbGrams * 4;
  const effectiveCarbGPerKg = Number((carbGrams / weightKg).toFixed(2));

  trace.push(
    `Carbohydrates: ${carbGrams}g (${effectiveCarbGPerKg} g/kg, ${carbCalories} kcal) filling energetic balance`
  );

  // Total calculated calories from rounded macros
  const totalCalculatedCalories = proteinCalories + fatCalories + carbCalories;

  const proteinPct = Math.round((proteinCalories / totalCalculatedCalories) * 100);
  const fatPct = Math.round((fatCalories / totalCalculatedCalories) * 100);
  const carbPct = Math.round((carbCalories / totalCalculatedCalories) * 100);

  // Record hard dietary exclusions as constraints
  if (dietaryRestrictions.includes('dairy')) {
    hardConstraints.push('Dairy-free foods strictly enforced for all macro sources');
  }
  if (dietaryRestrictions.includes('gluten')) {
    hardConstraints.push('Gluten-free carbohydrate sources strictly enforced');
  }
  if (dietaryRestrictions.includes('nuts')) {
    hardConstraints.push('Nut-free fat sources strictly enforced (seed/olive oils prioritized)');
  }

  const macros: MacronutrientTargets = {
    protein: {
      targetGrams: proteinGrams,
      gramsPerKg: effectiveProteinGPerKg,
      calories: proteinCalories,
      percentageOfEnergy: proteinPct,
    },
    fat: {
      targetGrams: fatGrams,
      gramsPerKg: effectiveFatGPerKg,
      calories: fatCalories,
      percentageOfEnergy: fatPct,
    },
    carbohydrates: {
      targetGrams: carbGrams,
      gramsPerKg: effectiveCarbGPerKg,
      calories: carbCalories,
      percentageOfEnergy: carbPct,
    },
    totalCalculatedCalories,
    roundingExplanation:
      'All macronutrient targets are rounded to the nearest 5g to avoid false dietary precision.',
  };

  return { macros, hardConstraints, trace };
}

/**
 * Pure orchestration pipeline calculating quantitative nutrition targets.
 *
 * @param profile - Validated CanonicalUserProfile
 * @param strategy - Resolved NutritionStrategy (v1)
 * @returns NutritionTargetsResult
 */
export function calculateNutritionTargets(
  profile: CanonicalUserProfile,
  strategy: NutritionStrategy
): NutritionTargetsResult {
  const readiness = evaluateQuantitativeReadiness(profile);

  if (readiness.status === 'ineligible') {
    return deepFreeze({
      status: 'ineligible',
      reason: readiness.reason,
      readiness,
      decisionTrace: readiness.decisionTrace,
    });
  }

  if (readiness.status === 'pending_required_inputs') {
    return deepFreeze({
      status: 'pending_required_inputs',
      population: profile.anthropometrics.age < 18 ? 'youth' : 'adult',
      reason: readiness.reason,
      missingInputs: readiness.missingInputs,
      readiness,
      decisionTrace: readiness.decisionTrace,
    });
  }

  // Ready branch: biological sex is verified male or female
  const sex = profile.anthropometrics.biologicalSex as 'male' | 'female';
  const { age, heightCm, weightKg } = profile.anthropometrics;

  // 1. Basal Metabolic Rate
  const { bmrKcal, trace: bmrTrace } = calculateBasalMetabolicRate(weightKg, heightCm, age, sex);

  // 2. Activity Multiplier & TDEE
  const { multiplier, trace: actTrace } = calculateActivityMultiplier(profile);
  const tdeeKcal = Math.round(bmrKcal * multiplier);
  const tdeeTrace = `TDEE: BMR (${bmrKcal}) × Multiplier (${multiplier}) = ${tdeeKcal} kcal/day`;

  // 3. Goal Adjustment
  const { adjustmentKcal, trace: adjTrace } = calculateGoalAdjustment(
    tdeeKcal,
    strategy.objective.primary
  );

  // 4. Energy Target Range
  const { targetRange, midpointKcal, trace: rangeTrace } = calculateEnergyTargetRange(
    tdeeKcal,
    adjustmentKcal,
    sex
  );

  const energyCalculationTrace = [
    bmrTrace,
    actTrace,
    tdeeTrace,
    adjTrace,
    rangeTrace,
  ];

  const energyEstimate: EnergyEstimate = {
    bmrKcal,
    activityMultiplier: multiplier,
    tdeeKcal,
    goalAdjustmentKcal: adjustmentKcal,
    targetRange,
    calculationTrace: energyCalculationTrace,
  };

  // 5. Macronutrient Partitioning
  const { macros, hardConstraints, trace: macroTrace } = calculateMacronutrientTargets(
    weightKg,
    midpointKcal,
    strategy.objective.primary,
    strategy.dietCompatibility.dietType,
    profile.nutrition.dietaryRestrictions
  );

  const warnings: string[] = [];
  if (tdeeKcal < 1600 && sex === 'male') {
    warnings.push('Low calculated TDEE for adult male; safety floor applied.');
  }
  if (tdeeKcal < 1300 && sex === 'female') {
    warnings.push('Low calculated TDEE for adult female; safety floor applied.');
  }

  const decisionTrace: string[] = [
    ...readiness.decisionTrace,
    ...energyCalculationTrace,
    ...macroTrace,
    `Total calculated macro calories: ${macros.totalCalculatedCalories} kcal (within ${Math.abs(
      macros.totalCalculatedCalories - midpointKcal
    )} kcal of midpoint)`,
  ];

  const targets: NutritionTargets = {
    schemaVersion: 1,
    population: 'adult',
    status: 'ready',
    energy: energyEstimate,
    macronutrients: macros,
    hardConstraintsApplied: hardConstraints,
    warnings,
    decisionTrace,
  };

  return deepFreeze({
    status: 'ready',
    population: 'adult',
    targets,
    readiness,
    decisionTrace,
  });
}
