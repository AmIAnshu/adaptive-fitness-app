/**
 * Nutrition Strategy Engine (Stage W7.1)
 *
 * Deterministically transforms a validated CanonicalUserProfile into a strongly-typed
 * NutritionStrategy (v1) object.
 *
 * ARCHITECTURAL ROLE:
 * CanonicalUserProfile
 *         ↓
 * runNutritionStrategyPipeline()
 *         ↓
 * NutritionStrategy (v1)
 *
 * INVARIANTS:
 * 1. Pure, deterministic, side-effect free, free of randomness or system time.
 * 2. Adult trainees (18-100) receive valid adult NutritionStrategy.
 * 3. Youth trainees (13-17) stop safely at youth_nutrition_strategy_pending.
 * 4. Ineligible trainees (<13 or >100) are blocked at the boundary.
 * 5. NO FABRICATED CALORIES, MACROS, OR TDEE. Quantitative readiness is flagged pending.
 * 6. NO INVENTED BIOLOGICAL SEX. Biological sex is absent from profile and never fabricated.
 * 7. Hard restrictions & food dislike exclusions are strictly enforced.
 */

import type { CanonicalUserProfile } from '../profile';
import { resolveStrategyPopulation } from '../training-strategy/strategyPopulation';
import type {
  NutritionStrategy,
  NutritionObjective,
  ResolvedNutritionObjective,
  DietaryRestriction,
  DietCompatibilityProfile,
  MealStructureStrategy,
  FoodPreferenceStrategy,
  FoodPlanningMode,
  PlanningStructureLevel,
  OutsideFoodStrategy,
  PreparationBurdenLevel,
  NutritionStrategyPipelineResult,
  QuantitativeTargetingReadiness,
} from './types';
import {
  evaluateQuantitativeReadiness,
  calculateNutritionTargets,
  deepFreeze,
} from './nutritionTargetEngine';
import type { NutritionTargets } from './quantitativeTypes';

/**
 * Resolves the nutrition objective from the user's primary goal and training preferences.
 */
export function resolveNutritionObjective(
  profile: CanonicalUserProfile
): ResolvedNutritionObjective {
  const goal = profile.goal?.primary;
  const style = profile.trainingPreferences?.preferredStyle;

  switch (goal) {
    case 'build_muscle':
      return {
        primary: 'muscle_gain_support',
        source: 'derived_from_training_goal',
        focusSummary: 'Nutritional support focused on positive energy balance and muscle protein synthesis.',
        decisionTrace: [
          'Primary goal: build_muscle',
          'Resolved nutrition objective: muscle_gain_support',
        ],
      };

    case 'lose_fat':
      return {
        primary: 'fat_loss_support',
        source: 'derived_from_training_goal',
        focusSummary: 'Nutritional support focused on satiety, protein preservation, and controlled energy deficit.',
        decisionTrace: [
          'Primary goal: lose_fat',
          'Resolved nutrition objective: fat_loss_support',
        ],
      };

    case 'build_muscle_lose_fat':
      return {
        primary: 'body_composition_support',
        source: 'derived_from_training_goal',
        focusSummary: 'Nutritional support prioritizing lean mass retention alongside moderate fat loss modulation.',
        decisionTrace: [
          'Primary goal: build_muscle_lose_fat',
          'Resolved nutrition objective: body_composition_support',
        ],
      };

    case 'get_stronger':
      return {
        primary: 'performance_support',
        source: 'derived_from_training_goal',
        focusSummary: 'Nutritional support optimizing neuromuscular performance, recovery, and training availability.',
        decisionTrace: [
          'Primary goal: get_stronger',
          'Resolved nutrition objective: performance_support',
        ],
      };

    case 'improve_fitness':
      return {
        primary: 'general_health_support',
        source: 'derived_from_training_goal',
        focusSummary: 'Nutritional support focused on balanced vitality, micronutrient density, and consistent habits.',
        decisionTrace: [
          'Primary goal: improve_fitness',
          'Resolved nutrition objective: general_health_support',
        ],
      };

    default:
      break;
  }

  // Fallback: Infer from training style preference if goal was not_sure
  if (style === 'hypertrophy') {
    return {
      primary: 'muscle_gain_support',
      source: 'derived_from_training_style',
      focusSummary: 'Nutritional support aligned with hypertrophy training style preference.',
      decisionTrace: [
        'Primary goal unspecified (not_sure)',
        'Training style preference: hypertrophy',
        'Resolved nutrition objective: muscle_gain_support',
      ],
    };
  }

  if (style === 'strength') {
    return {
      primary: 'performance_support',
      source: 'derived_from_training_style',
      focusSummary: 'Nutritional support aligned with strength training style preference.',
      decisionTrace: [
        'Primary goal unspecified (not_sure)',
        'Training style preference: strength',
        'Resolved nutrition objective: performance_support',
      ],
    };
  }

  return {
    primary: 'general_health_support',
    source: 'safe_default',
    focusSummary: 'Balanced foundational nutrition supporting overall metabolic health and training baseline.',
    decisionTrace: [
      'Primary goal and style were non-specific',
      'Resolved default nutrition objective: general_health_support',
    ],
  };
}

/**
 * Resolves diet compatibility and hard exclusion food groups.
 */
export function resolveDietCompatibility(
  profile: CanonicalUserProfile
): DietCompatibilityProfile {
  const dietType = profile.nutrition.dietType;
  const rawRestrictions = (profile.nutrition.dietaryRestrictions || []) as DietaryRestriction[];

  const hardExcludedFoodGroups: string[] = [];
  const decisionTrace: string[] = [
    `Diet type: ${dietType}`,
    `Dietary restrictions: [${rawRestrictions.join(', ')}]`,
  ];

  // Map dietType hard exclusions
  if (dietType === 'vegan') {
    hardExcludedFoodGroups.push('meat', 'poultry', 'fish', 'seafood', 'dairy', 'eggs', 'honey');
    decisionTrace.push('Vegan diet: hard-excluding all animal products and byproducts');
  } else if (dietType === 'vegetarian') {
    hardExcludedFoodGroups.push('meat', 'poultry', 'fish', 'seafood');
    decisionTrace.push('Vegetarian diet: hard-excluding meat, poultry, fish, seafood');
  } else if (dietType === 'eggetarian') {
    hardExcludedFoodGroups.push('meat', 'poultry', 'fish', 'seafood');
    decisionTrace.push('Eggetarian diet: hard-excluding meat, poultry, fish, seafood (eggs permitted)');
  }

  // Map dietary restrictions
  for (const r of rawRestrictions) {
    if (r === 'dairy' && !hardExcludedFoodGroups.includes('dairy')) {
      hardExcludedFoodGroups.push('dairy');
      decisionTrace.push('Restriction dairy: hard-excluding dairy products');
    } else if (r === 'eggs' && !hardExcludedFoodGroups.includes('eggs')) {
      hardExcludedFoodGroups.push('eggs');
      decisionTrace.push('Restriction eggs: hard-excluding egg products');
    } else if (r === 'gluten' && !hardExcludedFoodGroups.includes('gluten')) {
      hardExcludedFoodGroups.push('gluten');
      decisionTrace.push('Restriction gluten: hard-excluding gluten-containing grains');
    } else if (r === 'nuts' && !hardExcludedFoodGroups.includes('nuts')) {
      hardExcludedFoodGroups.push('nuts');
      decisionTrace.push('Restriction nuts: hard-excluding tree nuts and peanuts');
    } else if (r === 'seafood' && !hardExcludedFoodGroups.includes('seafood')) {
      hardExcludedFoodGroups.push('seafood');
      decisionTrace.push('Restriction seafood: hard-excluding fish and shellfish');
    }
  }

  return {
    dietType,
    restrictions: [...rawRestrictions],
    hardExcludedFoodGroups,
    decisionTrace,
  };
}

/**
 * Resolves meal structure and lifestyle adherence fit.
 */
export function resolveMealStructure(
  profile: CanonicalUserProfile
): MealStructureStrategy {
  const meals = profile.nutrition.preferredMeals;
  const source = profile.nutrition.mealSource;
  const eatingOut = profile.nutrition.eatingOutFrequency;
  const structurePref = profile.nutrition.nutritionStructure;

  const decisionTrace: string[] = [
    `Preferred meals: ${meals}`,
    `Meal source: ${source}`,
    `Eating out frequency: ${eatingOut}`,
    `Nutrition structure preference: ${structurePref}`,
  ];

  // Meal pattern
  let mealPattern: MealStructureStrategy['mealPattern'] = 'three_meals';
  if (meals === '2') mealPattern = 'two_meals';
  else if (meals === '3') mealPattern = 'three_meals';
  else if (meals === '4') mealPattern = 'four_meals';
  else if (meals === '5_plus') mealPattern = 'five_plus_meals';
  else if (meals === 'flexible') mealPattern = 'flexible_meals';

  // Preparation burden
  let preparationBurden: PreparationBurdenLevel = 'mixed_burden';
  if (source === 'mostly_cook') {
    preparationBurden = 'high_prep_burden';
    decisionTrace.push('Home cooking dominant: high preparation burden acknowledged');
  } else if (source === 'family_prepares') {
    preparationBurden = 'moderate_shared_burden';
    decisionTrace.push('Family prepares meals: shared/external prep burden');
  } else if (source === 'mostly_outside') {
    preparationBurden = 'low_burden';
    decisionTrace.push('Mostly outside dining: low kitchen preparation burden');
  } else {
    preparationBurden = 'mixed_burden';
  }

  // Outside food strategy
  let outsideFoodStrategy: OutsideFoodStrategy = 'rare_dine_out';
  if (eatingOut === 'rarely') {
    outsideFoodStrategy = 'rare_dine_out';
  } else if (eatingOut === '1_2_week') {
    outsideFoodStrategy = 'occasional_social_fit';
    decisionTrace.push('1-2x/week dining out: occasional social meal integration');
  } else if (eatingOut === '3_5_week') {
    outsideFoodStrategy = 'regular_dining_integration';
    decisionTrace.push('3-5x/week dining out: regular outside dining guidance required');
  } else if (eatingOut === 'almost_daily') {
    outsideFoodStrategy = 'convenience_first_ordering';
    decisionTrace.push('Almost daily dining out: convenience-first menu selection strategy');
  }

  // Planning structure & flexibility level
  let structureLevel: PlanningStructureLevel = 'structured_framework';
  let flexibilityLevel: 'low' | 'moderate' | 'high' = 'moderate';

  if (structurePref === 'very_structured') {
    structureLevel = 'strict_meal_plan';
    flexibilityLevel = 'low';
    decisionTrace.push('Structure preference: very_structured -> strict meal-by-meal planning');
  } else if (structurePref === 'mostly_structured') {
    structureLevel = 'structured_framework';
    flexibilityLevel = 'moderate';
    decisionTrace.push('Structure preference: mostly_structured -> structured framework with options');
  } else if (structurePref === 'flexible') {
    structureLevel = 'flexible_options';
    flexibilityLevel = 'high';
    decisionTrace.push('Structure preference: flexible -> food options and high flexibility');
  } else {
    // coach_decides: Deterministically choose based on lifestyle fit
    if (source === 'mostly_outside' || eatingOut === 'almost_daily') {
      structureLevel = 'flexible_options';
      flexibilityLevel = 'high';
      decisionTrace.push('Coach decides: Trainee relies heavily on outside food; selecting flexible options');
    } else {
      structureLevel = 'structured_framework';
      flexibilityLevel = 'moderate';
      decisionTrace.push('Coach decides: Balanced lifestyle baseline; selecting structured framework');
    }
  }

  return {
    preferredMealCount: meals,
    mealPattern,
    structureLevel,
    flexibilityLevel,
    preparationBurden,
    outsideFoodStrategy,
    decisionTrace,
  };
}

/**
 * Resolves food planning mode.
 */
export function resolveFoodPlanningMode(
  structure: MealStructureStrategy
): FoodPlanningMode {
  if (structure.structureLevel === 'strict_meal_plan') {
    return 'structured_meal_plan';
  }
  if (structure.structureLevel === 'flexible_options') {
    return 'food_options_based';
  }
  return 'flexible_meal_framework';
}

/**
 * Resolves food preference strategy.
 */
export function resolveFoodPreferences(
  profile: CanonicalUserProfile
): FoodPreferenceStrategy {
  const likedFoodIds = [...(profile.nutrition.likedFoods || [])];
  const dislikedFoodIds = [...(profile.nutrition.dislikedFoods || [])];

  const decisionTrace: string[] = [
    `Liked foods count: ${likedFoodIds.length}`,
    `Disliked foods count: ${dislikedFoodIds.length}`,
  ];

  if (dislikedFoodIds.length > 0) {
    decisionTrace.push(`Disliked foods to strictly exclude: [${dislikedFoodIds.join(', ')}]`);
  }
  if (likedFoodIds.length > 0) {
    decisionTrace.push(`Liked foods to prioritize in future recommendations: [${likedFoodIds.join(', ')}]`);
  }

  return {
    likedFoodIds,
    dislikedFoodIds,
    preferencePriorityMode: 'boost_liked_exclude_disliked',
    decisionTrace,
  };
}

/**
 * Creates the explicit quantitative readiness contract.
 *
 * INVARIANT: If biological sex is absent, NO FAKE CALORIES / MACROS are fabricated.
 * If biological sex is present, readiness is 'ready'.
 */
export function resolveQuantitativeReadiness(
  profile?: CanonicalUserProfile
): QuantitativeTargetingReadiness {
  if (profile) {
    const evaluated = evaluateQuantitativeReadiness(profile);
    if (evaluated.status === 'ready') {
      return {
        status: 'ready',
        method: evaluated.method,
        canCalculateCalories: true,
        canCalculateMacros: true,
        canCalculateTDEE: true,
      };
    }
    if (evaluated.status === 'pending_required_inputs') {
      return {
        status: 'pending_required_inputs',
        reason: evaluated.reason,
        missingInputs: evaluated.missingInputs,
        canCalculateCalories: false,
        canCalculateMacros: false,
        canCalculateTDEE: false,
      };
    }
  }
  return {
    status: 'pending_required_inputs',
    reason:
      'Quantitative energy and macronutrient calculation requires biological sex for basal metabolic rate calculation. Precision is deliberately deferred to avoid fabricating physiological formulas.',
    missingInputs: ['biological_sex'],
    canCalculateCalories: false,
    canCalculateMacros: false,
    canCalculateTDEE: false,
  };
}

/**
 * Pure orchestration pipeline building NutritionStrategy (v1).
 *
 * @param profile - Validated CanonicalUserProfile
 * @returns NutritionStrategyPipelineResult
 */
export function runNutritionStrategyPipeline(
  profile: CanonicalUserProfile
): NutritionStrategyPipelineResult {
  const populationBoundary = resolveStrategyPopulation(profile);

  // 1. Ineligible Trainees (<13 or >100)
  if (populationBoundary.path === 'ineligible') {
    return {
      status: 'ineligible',
      path: 'ineligible',
      reason: populationBoundary.reason,
      decisionTrace: [
        ...populationBoundary.decisionTrace,
        'Nutrition strategy pipeline stopped: Trainee is ineligible.',
      ],
    };
  }

  // 2. Youth Trainees (13-17)
  if (populationBoundary.path === 'youth_strategy_pending') {
    return {
      status: 'pending',
      population: 'youth',
      path: 'youth_nutrition_strategy_pending',
      message:
        'Youth nutritional guidance pathway selected (ages 13–17). Adult nutrition strategy engine is held pending youth developmental nutrition guidelines.',
      decisionTrace: [
        ...populationBoundary.decisionTrace,
        'Nutrition strategy held for youth trainee (ages 13–17).',
      ],
    };
  }

  // 3. Adult Pipeline Execution
  const objective = resolveNutritionObjective(profile);
  const dietCompatibility = resolveDietCompatibility(profile);
  const mealStructure = resolveMealStructure(profile);
  const foodPreferences = resolveFoodPreferences(profile);
  const planningMode = resolveFoodPlanningMode(mealStructure);
  const quantitativeReadiness = resolveQuantitativeReadiness(profile);

  const coachingContext = {
    communicationStyle: profile.coachingPreferences.communicationStyle,
    decisionAutonomy: profile.coachingPreferences.decisionAutonomy,
    explanationDepth: profile.coachingPreferences.explanationDepth,
    accountability: profile.coachingPreferences.accountability,
  };

  let targets: NutritionTargets | undefined = undefined;
  if (quantitativeReadiness.status === 'ready') {
    const draftStrategy: NutritionStrategy = {
      schemaVersion: 1,
      population: 'adult',
      objective,
      dietCompatibility,
      mealStructure,
      foodPreferences,
      planningMode,
      quantitativeReadiness,
      coachingContext,
      decisionTrace: [],
    };
    const targetsResult = calculateNutritionTargets(profile, draftStrategy);
    if (targetsResult.status === 'ready') {
      targets = targetsResult.targets;
    }
  }

  const decisionTrace: string[] = [
    'Stage N1: Nutrition Objective resolved -> ' + objective.primary,
    'Stage N2: Diet Compatibility resolved -> ' + dietCompatibility.dietType,
    'Stage N3: Meal Structure resolved -> ' + mealStructure.structureLevel,
    'Stage N4: Food Preferences resolved -> ' + foodPreferences.preferencePriorityMode,
    'Stage N5: Planning Mode resolved -> ' + planningMode,
    'Stage N6: Quantitative Readiness -> ' +
      (quantitativeReadiness.status === 'ready'
        ? `ready (${quantitativeReadiness.method})`
        : 'pending_required_inputs (biological_sex absent)'),
    'Stage N7: Coaching Context mapped',
  ];

  const strategy: NutritionStrategy = deepFreeze({
    schemaVersion: 1,
    population: 'adult',
    objective,
    dietCompatibility,
    mealStructure,
    foodPreferences,
    planningMode,
    quantitativeReadiness,
    ...(targets ? { targets } : {}),
    coachingContext,
    decisionTrace,
  });

  return {
    status: 'completed',
    population: 'adult',
    strategy,
    decisionTrace,
  };
}
