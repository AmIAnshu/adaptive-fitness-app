/**
 * Nutrition Plan Generator (Stage W7.4)
 *
 * Deterministically constructs an immutable, validated NutritionPlan (v1)
 * from a CanonicalUserProfile, NutritionStrategy, and optional NutritionTargets.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Pure, deterministic, side-effect free, zero randomness, zero external dependencies.
 * 2. Consumes existing NutritionStrategy and NutritionTargets rather than duplicating rules.
 * 3. Exact Daily Target Preservation:
 *    - Does NOT recalculate daily calories or macros from food choices.
 *    - Daily NutritionTargets remain the authoritative source of truth.
 *    - Sum of meal targets strictly equals authoritative daily targets.
 * 4. Pending & Population Guardrails:
 *    - Adult with pending targets: produces qualitative framework with zero fabricated calories/macros.
 *    - Youth (13–17): stops safely at youth_protection_pending.
 *    - Ineligible (<13 or >100): rejected at boundary.
 * 5. Diet & Restrictions Boundary:
 *    - Hard exclusions (vegan, dairy, gluten, nuts, etc.) and food dislikes are strictly enforced.
 *    - Liked foods are prioritized recommendations, not mandatory items.
 * 6. Meal Preparation / Source Context:
 *    - mostly_cook, family_prepares, mixed, mostly_outside are explicitly translated into
 *      planning metadata (home_focused, mixed_source, outside_friendly).
 */

import type { CanonicalUserProfile, PreferredMeals, MealSource, EatingOutFrequency } from '../profile';
import { resolveStrategyPopulation } from '../training-strategy/strategyPopulation';
import type {
  NutritionStrategy,
  FoodPlanningMode,
} from './types';
import type { NutritionTargets } from './quantitativeTypes';
import { deepFreeze } from './nutritionTargetEngine';
import type {
  NutritionPlan,
  NutritionPlanGenerationResult,
  MealSlot,
  DailyPlanFramework,
  MealStructureDefinition,
  MealStructureType,
  PreparationOrientation,
  MealSourceContext,
  NutritionPlanBoundaries,
} from './nutritionPlanTypes';
import { allocateDailyTargetsToMeals } from './mealAllocator';
import { composeMealCandidate } from './mealComposition';

/**
 * Resolves the numeric count of meal slots from PreferredMeals signal.
 * - '2' -> 2
 * - '3' -> 3
 * - '4' -> 4
 * - '5_plus' -> 5 (standard 5-meal pattern: 3 main meals + 2 supportive snacks)
 * - 'flexible' -> 3 (default balanced baseline with high interchangeability)
 */
export function resolveMealSlotCount(preferredMeals: PreferredMeals): number {
  switch (preferredMeals) {
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '5_plus':
      return 5;
    case 'flexible':
      return 3;
    default:
      return 3;
  }
}

/**
 * Maps the user's meal source and dining-out frequency into a preparation orientation.
 */
export function resolvePreparationOrientation(
  mealSource: MealSource,
  eatingOutFrequency: EatingOutFrequency
): {
  orientation: PreparationOrientation;
  explanation: string;
} {
  if (mealSource === 'mostly_outside' || eatingOutFrequency === 'almost_daily') {
    return {
      orientation: 'outside_friendly',
      explanation: 'Trainee relies predominantly on outside dining; prioritizing ordering guidance and restaurant flexibility.',
    };
  }

  if (mealSource === 'mostly_cook' && (eatingOutFrequency === 'rarely' || eatingOutFrequency === '1_2_week')) {
    return {
      orientation: 'home_focused',
      explanation: 'Home cooking dominant; prioritizing batch preparation, whole foods, and kitchen structure.',
    };
  }

  return {
    orientation: 'mixed_source',
    explanation: 'Mixed dining lifestyle; accommodating combination of home preparation and convenience/outside options.',
  };
}

/**
 * Resolves the meal structure definition based on planning mode and structure preferences.
 */
export function resolveMealStructureDefinition(
  planningMode: FoodPlanningMode,
  preferredMeals: PreferredMeals,
  orientation: PreparationOrientation
): MealStructureDefinition {
  switch (planningMode) {
    case 'structured_meal_plan':
      return {
        structureType: 'structured_meal_slots',
        planningMode,
        flexibilityLevel: 'low',
        isInterchangeable: false,
        structureExplanation:
          'Structured sequential meal schedule with fixed slots and explicit meal targets.',
      };

    case 'food_options_based':
      return {
        structureType: 'food_options_framework',
        planningMode,
        flexibilityLevel: 'high',
        isInterchangeable: true,
        structureExplanation:
          'Interchangeable meal slots with broad food options suited for dynamic daily schedules.',
      };

    case 'coach_selected_structure':
      return {
        structureType: 'coach_selected_hybrid',
        planningMode,
        flexibilityLevel: orientation === 'outside_friendly' ? 'high' : 'moderate',
        isInterchangeable: orientation === 'outside_friendly',
        structureExplanation:
          'Coach-tailored hybrid framework balancing consistency with real-world lifestyle flexibility.',
      };

    case 'flexible_meal_framework':
    default:
      return {
        structureType: 'flexible_interchangeable_slots',
        planningMode,
        flexibilityLevel: preferredMeals === 'flexible' ? 'high' : 'moderate',
        isInterchangeable: true,
        structureExplanation:
          'Flexible meal framework with interchangeable meal windows and consistent target allocation.',
      };
  }
}

/**
 * Generates slot templates and guidance according to slot count and preparation orientation.
 */
export function generateMealSlots(
  mealCount: number,
  orientation: PreparationOrientation,
  targets?: NutritionTargets,
  likedFoods: string[] = [],
  dislikedFoods: string[] = []
): MealSlot[] {
  const allocatedTargets = targets ? allocateDailyTargetsToMeals(targets, mealCount) : [];

  const slots: MealSlot[] = [];

  const getSourceContext = (index: number): MealSourceContext => {
    if (orientation === 'outside_friendly') {
      return index === 0 ? 'home_prepared' : 'outside_convenience';
    }
    if (orientation === 'home_focused') {
      return 'home_prepared';
    }
    // Mixed
    return index === 1 ? 'outside_convenience' : 'home_prepared';
  };

  const getGuidance = (index: number, count: number): string => {
    if (count === 2) {
      return index === 0
        ? 'First substantial meal: prioritize high-protein anchor and sustained complex carbohydrates.'
        : 'Second substantial meal: emphasize lean protein, recovery micronutrients, and evening satiety.';
    }
    if (count === 3) {
      if (index === 0) return 'Morning meal: kickstart muscle protein synthesis with a balanced protein and carb anchor.';
      if (index === 1) return 'Midday meal: sustained energy for training availability and afternoon focus.';
      return 'Evening meal: complete protein, colorful fibrous vegetables, and restorative recovery balance.';
    }
    if (count === 4) {
      if (index === 0) return 'Meal 1 (Morning): protein anchor and sustained complex carbohydrates.';
      if (index === 1) return 'Meal 2 (Midday): balanced energetic foundation.';
      if (index === 2) return 'Meal 3 (Late afternoon/pre-training): easily digestible protein and carbohydrate fuel.';
      return 'Meal 4 (Evening): complete recovery dinner with fibrous vegetables and lean protein.';
    }
    // 5+ meals
    if (index === 0) return 'Meal 1: breakfast foundation with high-bioavailability protein.';
    if (index === 1) return 'Meal 2: supportive midday meal supporting steady blood glucose.';
    if (index === 2) return 'Meal 3: afternoon training support meal.';
    if (index === 3) return 'Meal 4: evening dinner meal emphasizing restorative micronutrients.';
    return 'Meal 5: targeted bedtime recovery snack supporting overnight muscle protein synthesis.';
  };

  const getSlotType = (index: number, count: number): MealSlot['slotType'] => {
    if (count === 2) return index === 0 ? 'meal_1' : 'meal_2';
    if (count === 3) return index === 0 ? 'breakfast' : index === 1 ? 'lunch' : 'dinner';
    if (count === 4) {
      if (index === 0) return 'breakfast';
      if (index === 1) return 'lunch';
      if (index === 2) return 'snack';
      return 'dinner';
    }
    // 5+
    if (index === 0) return 'breakfast';
    if (index === 1) return 'lunch';
    if (index === 2) return 'snack';
    if (index === 3) return 'dinner';
    return 'snack';
  };

  const getTiming = (index: number, count: number): string => {
    if (count === 2) return index === 0 ? 'Late Morning / Midday' : 'Evening';
    if (count === 3) return index === 0 ? 'Morning' : index === 1 ? 'Midday' : 'Evening';
    if (count === 4) return index === 0 ? 'Morning' : index === 1 ? 'Midday' : index === 2 ? 'Late Afternoon' : 'Evening';
    if (index === 0) return 'Morning';
    if (index === 1) return 'Midday';
    if (index === 2) return 'Mid-Afternoon';
    if (index === 3) return 'Evening';
    return 'Pre-Sleep';
  };

  const getName = (index: number, count: number): string => {
    if (count === 2) return `Meal ${index + 1}`;
    if (count === 3) return index === 0 ? 'Breakfast' : index === 1 ? 'Lunch' : 'Dinner';
    if (count === 4) return index === 0 ? 'Breakfast' : index === 1 ? 'Lunch' : index === 2 ? 'Supportive Snack' : 'Dinner';
    if (index === 0) return 'Breakfast';
    if (index === 1) return 'Lunch';
    if (index === 2) return 'Afternoon Snack';
    if (index === 3) return 'Dinner';
    return 'Evening Snack';
  };

  for (let i = 0; i < mealCount; i++) {
    const slotId = `slot_${i + 1}`;
    const slotType = getSlotType(i, mealCount);
    const sourceContext = getSourceContext(i);
    const guidance = getGuidance(i, mealCount);
    const suggestedTiming = getTiming(i, mealCount);
    const name = getName(i, mealCount);

    // Filter user liked foods that are not in dislikes
    const recommendedLikedFoods = likedFoods.filter((f) => !dislikedFoods.includes(f));

    slots.push({
      slotId,
      slotIndex: i + 1,
      name,
      slotType,
      suggestedTiming,
      sourceContext,
      guidance,
      ...(allocatedTargets[i] ? { targets: allocatedTargets[i] } : {}),
      compatibleFoodCategories: ['protein', 'carbohydrate', 'fat', 'vegetable_fiber'],
      recommendedLikedFoods,
    });
  }

  return slots;
}

/**
 * Pure generator constructing NutritionPlan (v1).
 *
 * @param profile Validated CanonicalUserProfile
 * @param strategy Validated NutritionStrategy (v1)
 * @param targets Optional validated NutritionTargets (v1)
 * @returns NutritionPlanGenerationResult
 */
export function generateNutritionPlan(
  profile: CanonicalUserProfile,
  strategy: NutritionStrategy,
  targets?: NutritionTargets
): NutritionPlanGenerationResult {
  const pop = resolveStrategyPopulation(profile);

  // 1. Ineligible Trainees
  if (pop.path === 'ineligible') {
    return deepFreeze({
      status: 'ineligible',
      reason: pop.reason,
      decisionTrace: [
        ...pop.decisionTrace,
        'Nutrition plan generation rejected: Trainee age falls outside supported adult boundaries.',
      ],
    });
  }

  // 2. Youth Trainees (13-17)
  if (pop.path === 'youth_strategy_pending') {
    return deepFreeze({
      status: 'youth_protection_pending',
      population: 'youth',
      reason:
        'Adult nutrition planning is held for youth trainees (ages 13–17) pending adolescent developmental guidelines.',
      decisionTrace: [
        ...pop.decisionTrace,
        'Youth protection active: adult meal plans and quantitative calorie formulas withheld.',
      ],
    });
  }

  // 3. Adult Pathway
  const decisionTrace: string[] = [
    'Nutrition Plan Generator v1 initialized for adult trainee',
    `Nutrition objective: ${strategy.objective.primary}`,
    `Diet type: ${strategy.dietCompatibility.dietType}`,
  ];

  const mealCount = resolveMealSlotCount(strategy.mealStructure.preferredMealCount);
  decisionTrace.push(
    `Meal slot count resolved: ${mealCount} slots from preferredMeals "${strategy.mealStructure.preferredMealCount}"`
  );

  const { orientation, explanation: prepExplanation } = resolvePreparationOrientation(
    profile.nutrition.mealSource,
    profile.nutrition.eatingOutFrequency
  );
  decisionTrace.push(`Preparation orientation: ${orientation} (${prepExplanation})`);

  const mealStructure = resolveMealStructureDefinition(
    strategy.planningMode,
    strategy.mealStructure.preferredMealCount,
    orientation
  );
  decisionTrace.push(
    `Meal structure resolved: ${mealStructure.structureType} (${mealStructure.structureExplanation})`
  );

  // Restrictions & Preferences boundaries
  const boundaries: NutritionPlanBoundaries = {
    dietType: strategy.dietCompatibility.dietType,
    hardRestrictions: [...strategy.dietCompatibility.restrictions],
    hardExcludedFoodGroups: [...strategy.dietCompatibility.hardExcludedFoodGroups],
    strictlyExcludedDislikedFoodIds: [...strategy.foodPreferences.dislikedFoodIds],
    prioritizedLikedFoodIds: [...strategy.foodPreferences.likedFoodIds],
  };

  decisionTrace.push(
    `Boundaries applied: ${boundaries.hardExcludedFoodGroups.length} food groups hard-excluded, ${boundaries.strictlyExcludedDislikedFoodIds.length} disliked foods strictly barred`
  );

  // Authoritative target check
  const authoritativeTargets = targets || strategy.targets;
  const isQuantitativeReady =
    strategy.quantitativeReadiness.status === 'ready' && !!authoritativeTargets;

  if (isQuantitativeReady && authoritativeTargets) {
    decisionTrace.push(
      `Quantitative targets ready: distributing ${authoritativeTargets.energy.targetRange.midpointKcal} kcal, ${authoritativeTargets.macronutrients.protein.targetGrams}g P, ${authoritativeTargets.macronutrients.fat.targetGrams}g F, ${authoritativeTargets.macronutrients.carbohydrates.targetGrams}g C across ${mealCount} slots`
    );
  } else {
    decisionTrace.push(
      'Quantitative targets pending_required_inputs: generating qualitative meal framework without fabricated calories or macros'
    );
  }

  const rawSlots = generateMealSlots(
    mealCount,
    orientation,
    isQuantitativeReady ? authoritativeTargets : undefined,
    strategy.foodPreferences.likedFoodIds,
    strategy.foodPreferences.dislikedFoodIds
  );

  // Construct draft plan for composition context
  const draftDailyPlan: DailyPlanFramework = {
    totalMeals: mealCount,
    preparationOrientation: orientation,
    frameworkSummary: `${mealCount} ${mealStructure.structureType.replace(/_/g, ' ')} framework tailored for ${orientation.replace(/_/g, ' ')} lifestyle.`,
    adherenceGuidelines: [
      `Maintain consistency across ${mealCount} designated meal windows.`,
      orientation === 'outside_friendly'
        ? 'Select lean grilled or baked proteins and control added dressings when ordering outside.'
        : 'Prepare anchor proteins in advance to support effortless daily adherence.',
      boundaries.hardRestrictions.length > 0 && !boundaries.hardRestrictions.includes('none')
        ? `Strictly exclude: ${boundaries.hardRestrictions.join(', ')}.`
        : 'Prioritize whole, minimally processed food sources.',
    ],
    slots: rawSlots,
  };

  const draftPlan: NutritionPlan = {
    schemaVersion: 1,
    population: 'adult',
    readinessStatus: isQuantitativeReady ? 'ready' : 'pending_required_inputs',
    nutritionStrategy: strategy,
    ...(isQuantitativeReady && authoritativeTargets ? { nutritionTargets: authoritativeTargets } : {}),
    mealStructure,
    boundaries,
    dailyPlan: draftDailyPlan,
    decisionTrace,
  };

  // Compose deterministic meal candidate for each slot (Stage W7.5)
  const composedSlots: MealSlot[] = rawSlots.map((slot) => {
    const composition = composeMealCandidate(slot, strategy, draftPlan);
    return {
      ...slot,
      composition,
    };
  });

  const dailyPlan: DailyPlanFramework = {
    ...draftDailyPlan,
    slots: composedSlots,
  };

  const plan: NutritionPlan = deepFreeze({
    schemaVersion: 1,
    population: 'adult',
    readinessStatus: isQuantitativeReady ? 'ready' : 'pending_required_inputs',
    nutritionStrategy: strategy,
    ...(isQuantitativeReady && authoritativeTargets ? { nutritionTargets: authoritativeTargets } : {}),
    mealStructure,
    boundaries,
    dailyPlan,
    decisionTrace,
  });

  if (isQuantitativeReady) {
    return deepFreeze({
      status: 'success',
      readinessStatus: 'ready',
      population: 'adult',
      plan,
      decisionTrace,
    });
  }

  return deepFreeze({
    status: 'pending',
    readinessStatus: 'pending_required_inputs',
    population: 'adult',
    reason:
      'Quantitative meal-level caloric and macronutrient targets are pending optional biological inputs. Qualitative framework is fully active.',
    missingInputs:
      strategy.quantitativeReadiness.status === 'pending_required_inputs'
        ? strategy.quantitativeReadiness.missingInputs
        : ['biological_sex'],
    plan,
    decisionTrace,
  });
}
