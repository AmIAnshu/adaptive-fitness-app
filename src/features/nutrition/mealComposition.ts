/**
 * Deterministic Meal Composition Engine (Stage W7.5)
 *
 * Selects compatible foods from the authoritative food catalog and constructs
 * bounded, practical meal candidates for a given meal slot.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Pure, deterministic, zero randomness, zero external dependencies.
 * 2. Food catalog is authoritative for nutrient data.
 * 3. Daily NutritionTargets and W7.4 meal targets remain authoritative;
 *    the composition engine fits foods to those targets without mutating daily totals.
 * 4. Hard restrictions MUST win: any food matching a user restriction or incompatible
 *    with the user's diet is strictly excluded.
 * 5. Disliked foods MUST NOT be selected.
 * 6. Liked foods receive deterministic scoring priority, never overriding restrictions.
 * 7. When quantitative targets are pending, qualitative meal candidates are constructed
 *    without fabricated calories or macros.
 * 8. Outside-friendly orientation prioritizes foods flagged `isOutsideFriendly`.
 */

import type {
  FoodDefinition,
  FoodMealRole,
  FoodPortionSelection,
  MealCompositionCandidate,
  CompositionFitLevel,
} from './foodCatalogTypes';
import { AUTHORITATIVE_FOOD_CATALOG } from './foodCatalog';
import type { NutritionStrategy } from './types';
import type { MealSlot, NutritionPlan } from './nutritionPlanTypes';
import { deepFreeze } from './nutritionTargetEngine';

/**
 * Evaluates whether a food is strictly compatible with the trainee's diet and restrictions.
 */
export function isFoodCompatible(
  food: FoodDefinition,
  strategy: NutritionStrategy
): { compatible: boolean; reason?: string } {
  const { dietType, restrictions } = strategy.dietCompatibility;
  const dislikedFoods = strategy.foodPreferences.dislikedFoodIds;

  // 1. Disliked food exclusion
  if (dislikedFoods.includes(food.id)) {
    return { compatible: false, reason: `Food '${food.name}' is in trainee disliked foods` };
  }

  // 2. Diet type compatibility
  if (!food.compatibleDietTypes.includes(dietType)) {
    return { compatible: false, reason: `Incompatible with ${dietType} diet` };
  }

  // 3. Dietary restrictions hard exclusions
  for (const restriction of restrictions) {
    if (restriction === 'none') continue;
    if (food.excludedByRestrictions.includes(restriction)) {
      return { compatible: false, reason: `Excluded by dietary restriction '${restriction}'` };
    }
  }

  return { compatible: true };
}

/**
 * Scores a food for a specific meal slot role.
 * Deterministic ranking:
 * +100 for matching primary role
 * +50 for liked food preference
 * +20 if outside-friendly when slot orientation is outside_convenience
 * Tie-break: alphabetical by food ID.
 */
export function scoreFoodForSlot(
  food: FoodDefinition,
  role: FoodMealRole,
  likedFoodIds: string[],
  isOutsideContext: boolean,
  learnedPreferenceIds: readonly string[] = []
): number {
  let score = 0;

  if (food.mealRoles.includes(role)) {
    score += 100;
  }

  if (likedFoodIds.includes(food.id)) {
    score += 50;
  } else if (learnedPreferenceIds.includes(food.id)) {
    score += 35;
  }

  if (isOutsideContext && food.isOutsideFriendly) {
    score += 20;
  }

  return score;
}

/**
 * Creates a formatted serving description.
 */
function formatServingDescription(food: FoodDefinition, portions: number): string {
  const totalAmount = Math.round(food.referenceAmount * portions);
  if (food.referenceUnit === 'piece') {
    return `${portions} ${portions === 1 ? 'piece' : 'pieces'}`;
  }
  if (food.referenceUnit === 'tbsp') {
    return `${portions} ${portions === 1 ? 'tbsp' : 'tbsp'}`;
  }
  return `${totalAmount} ${food.referenceUnit}`;
}

/**
 * Computes nutritional values for a selected portion of a food.
 */
function createPortionSelection(food: FoodDefinition, portions: number): FoodPortionSelection {
  const calculatedCalories = Math.round(food.caloriesPerReference * portions);
  const calculatedProteinG = Math.round(food.proteinPerReference * portions);
  const calculatedFatG = Math.round(food.fatPerReference * portions);
  const calculatedCarbohydratesG = Math.round(food.carbohydratesPerReference * portions);

  return {
    food,
    portionUnits: portions,
    servingDescription: formatServingDescription(food, portions),
    calculatedCalories,
    calculatedProteinG,
    calculatedFatG,
    calculatedCarbohydratesG,
  };
}

/**
 * Composes a deterministic meal candidate for a given slot.
 *
 * @param slot - Authoritative MealSlot from NutritionPlan
 * @param strategy - Authoritative NutritionStrategy
 * @param plan - Authoritative NutritionPlan
 * @param catalog - Food catalog (defaults to AUTHORITATIVE_FOOD_CATALOG)
 */
export function composeMealCandidate(
  slot: MealSlot,
  strategy: NutritionStrategy,
  plan: NutritionPlan,
  catalog: readonly FoodDefinition[] = AUTHORITATIVE_FOOD_CATALOG,
  learnedPreferenceIds: readonly string[] = []
): MealCompositionCandidate {
  const decisionTrace: string[] = [
    `Composing meal candidate for slot "${slot.name}" (${slot.slotId})`,
  ];

  // 1. Filter compatible catalog items
  const compatibleFoods = catalog.filter((food) => {
    const { compatible, reason } = isFoodCompatible(food, strategy);
    if (!compatible && reason) {
      decisionTrace.push(`Food "${food.id}" excluded: ${reason}`);
    }
    return compatible;
  });

  const isOutside = slot.sourceContext === 'outside_convenience';
  const likedFoods = strategy.foodPreferences.likedFoodIds;

  // Sorting helper: score descending, tie-break by ID ascending
  const rankFoods = (role: FoodMealRole) => {
    return [...compatibleFoods]
      .filter((f) => f.mealRoles.includes(role))
      .sort((a, b) => {
        const scoreA = scoreFoodForSlot(a, role, likedFoods, isOutside, learnedPreferenceIds);
        const scoreB = scoreFoodForSlot(b, role, likedFoods, isOutside, learnedPreferenceIds);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.id.localeCompare(b.id);
      });
  };

  // 2. Determine required meal roles based on slot type
  const targetRoles: FoodMealRole[] = [];
  if (slot.slotType === 'breakfast') {
    targetRoles.push('protein_anchor', 'carbohydrate_fuel');
  } else if (slot.slotType === 'lunch' || slot.slotType === 'dinner' || slot.slotType.startsWith('meal_')) {
    targetRoles.push('protein_anchor', 'carbohydrate_fuel', 'vegetable_fiber');
  } else {
    // snack
    targetRoles.push('supportive_snack');
  }

  // 3. Candidate Selection
  const selectedFoods: FoodPortionSelection[] = [];
  const compatibilityReasons: string[] = [];

  const isQuantitative = slot.targets !== undefined;

  if (!isQuantitative) {
    // QUALITATIVE MODE (e.g. pending targets)
    // Select default practical portions without manufacturing numbers
    for (const role of targetRoles) {
      const candidates = rankFoods(role);
      const topFood = candidates.find((c) => !selectedFoods.some((s) => s.food.id === c.id));
      if (topFood) {
        selectedFoods.push(createPortionSelection(topFood, topFood.defaultPortionUnits));
        const prefTag = likedFoods.includes(topFood.id)
          ? ' (liked preference)'
          : learnedPreferenceIds.includes(topFood.id)
          ? ' (learned substitution)'
          : '';
        compatibilityReasons.push(
          `${topFood.name} selected as ${role.replace(/_/g, ' ')}${prefTag}`
        );
      }
    }

    const candidate: MealCompositionCandidate = deepFreeze({
      slotId: slot.slotId,
      slotName: slot.name,
      slotType: slot.slotType,
      isQuantitative: false,
      selectedFoods,
      totalEstimatedCalories: 0,
      totalEstimatedProteinG: 0,
      totalEstimatedFatG: 0,
      totalEstimatedCarbohydratesG: 0,
      fitLevel: 'qualitative_guideline',
      compatibilityReasons,
      decisionTrace,
    });

    return candidate;
  }

  // QUANTITATIVE MODE (targets exist)
  const targetCal = slot.targets!.targetEnergyKcal;
  const targetProtein = slot.targets!.targetProteinG;
  const targetCarbs = slot.targets!.targetCarbohydratesG;
  const targetFat = slot.targets!.targetFatG;

  // 3a. Select Protein Anchor
  const proteinCandidates = rankFoods('protein_anchor');
  let chosenProtein = proteinCandidates[0];
  if (!chosenProtein && slot.slotType === 'snack') {
    chosenProtein = rankFoods('supportive_snack')[0];
  }

  if (chosenProtein) {
    // Estimate protein portion to cover ~50-70% of meal protein target
    const targetProteinGrams = targetProtein * 0.7;
    const rawUnits = targetProteinGrams / (chosenProtein.proteinPerReference || 1);
    const steppedUnits = Math.max(
      chosenProtein.minPortionUnits,
      Math.min(
        chosenProtein.maxPortionUnits,
        Math.round(rawUnits / chosenProtein.portionStepUnits) * chosenProtein.portionStepUnits
      )
    );
    selectedFoods.push(createPortionSelection(chosenProtein, steppedUnits || chosenProtein.defaultPortionUnits));
    const prefTag = likedFoods.includes(chosenProtein.id)
      ? ' (liked preference)'
      : learnedPreferenceIds.includes(chosenProtein.id)
      ? ' (learned substitution)'
      : '';
    compatibilityReasons.push(
      `${chosenProtein.name} selected for primary protein target (${targetProtein}g)${prefTag}`
    );
  }

  // 3b. Select Carbohydrate Fuel (if role applies)
  if (targetRoles.includes('carbohydrate_fuel')) {
    const carbCandidates = rankFoods('carbohydrate_fuel').filter(
      (c) => !selectedFoods.some((s) => s.food.id === c.id)
    );
    const chosenCarb = carbCandidates[0];
    if (chosenCarb) {
      const currentCarbs = selectedFoods.reduce((acc, s) => acc + s.calculatedCarbohydratesG, 0);
      const remainingCarbs = Math.max(10, targetCarbs - currentCarbs);
      const rawUnits = remainingCarbs / (chosenCarb.carbohydratesPerReference || 1);
      const steppedUnits = Math.max(
        chosenCarb.minPortionUnits,
        Math.min(
          chosenCarb.maxPortionUnits,
          Math.round(rawUnits / chosenCarb.portionStepUnits) * chosenCarb.portionStepUnits
        )
      );
      selectedFoods.push(createPortionSelection(chosenCarb, steppedUnits || chosenCarb.defaultPortionUnits));
      compatibilityReasons.push(`${chosenCarb.name} selected for carbohydrate target (${targetCarbs}g)`);
    }
  }

  // 3c. Select Vegetable / Fiber
  if (targetRoles.includes('vegetable_fiber')) {
    const vegCandidates = rankFoods('vegetable_fiber').filter(
      (c) => !selectedFoods.some((s) => s.food.id === c.id)
    );
    const chosenVeg = vegCandidates[0];
    if (chosenVeg) {
      selectedFoods.push(createPortionSelection(chosenVeg, chosenVeg.defaultPortionUnits));
      compatibilityReasons.push(`${chosenVeg.name} selected for micronutrient and fiber balance`);
    }
  }

  // 3d. Check Fat target: if fat is substantially low (< 60% of target), add an essential fat
  const currentFat = selectedFoods.reduce((acc, s) => acc + s.calculatedFatG, 0);
  if (currentFat < targetFat * 0.5) {
    const fatCandidates = rankFoods('essential_fat').filter(
      (c) => !selectedFoods.some((s) => s.food.id === c.id)
    );
    const chosenFat = fatCandidates[0];
    if (chosenFat) {
      selectedFoods.push(createPortionSelection(chosenFat, chosenFat.minPortionUnits));
      compatibilityReasons.push(`${chosenFat.name} added to support hormonal fat baseline`);
    }
  }

  // 4. Calculate Aggregate Totals
  const totalCalories = selectedFoods.reduce((acc, s) => acc + s.calculatedCalories, 0);
  const totalProteinG = selectedFoods.reduce((acc, s) => acc + s.calculatedProteinG, 0);
  const totalFatG = selectedFoods.reduce((acc, s) => acc + s.calculatedFatG, 0);
  const totalCarbsG = selectedFoods.reduce((acc, s) => acc + s.calculatedCarbohydratesG, 0);

  const deltaCal = totalCalories - targetCal;
  const pctDelta = Math.abs(deltaCal) / targetCal;
  const fitLevel: CompositionFitLevel = pctDelta <= 0.15 ? 'tight_fit' : 'moderate_fit';

  decisionTrace.push(
    `Composed ${selectedFoods.length} items: ${totalCalories} kcal (${deltaCal >= 0 ? '+' : ''}${deltaCal} kcal vs target ${targetCal} kcal, fit: ${fitLevel})`
  );

  return deepFreeze({
    slotId: slot.slotId,
    slotName: slot.name,
    slotType: slot.slotType,
    isQuantitative: true,
    selectedFoods,
    totalEstimatedCalories: totalCalories,
    totalEstimatedProteinG: totalProteinG,
    totalEstimatedFatG: totalFatG,
    totalEstimatedCarbohydratesG: totalCarbsG,
    fitLevel,
    calorieDeltaFromTarget: deltaCal,
    compatibilityReasons,
    decisionTrace,
  });
}

/**
 * Composes meal candidates for all slots in a NutritionPlan.
 */
export function composeAllMealCandidates(
  plan: NutritionPlan,
  strategy: NutritionStrategy,
  catalog: readonly FoodDefinition[] = AUTHORITATIVE_FOOD_CATALOG,
  learnedPreferenceIds: readonly string[] = []
): MealCompositionCandidate[] {
  return plan.dailyPlan.slots.map((slot) =>
    composeMealCandidate(slot, strategy, plan, catalog, learnedPreferenceIds)
  );
}
