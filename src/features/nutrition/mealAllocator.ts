/**
 * Meal Allocator & Distribution Engine (Stage W7.4)
 *
 * Deterministically distributes authoritative daily energy, protein, fat,
 * and carbohydrate targets across generated meal slots.
 *
 * INVARIANTS:
 * 1. Pure, deterministic, immutable, zero randomness.
 * 2. Daily NutritionTargets remain strictly authoritative:
 *    - Sum of allocated meal targets equals the daily totals exactly (with remainder assigned to largest/first meal).
 *    - All allocated macros are non-negative.
 *    - All values rounded to whole numbers.
 * 3. Proportions are deterministic according to resolved meal count and pattern:
 *    - 2 meals: 50% / 50%
 *    - 3 meals: 35% / 35% / 30%
 *    - 4 meals: 30% / 30% / 25% / 15% (3 main meals + 1 supportive meal/snack)
 *    - 5 meals: 25% / 25% / 25% / 15% / 10% (3 main meals + 2 snacks)
 *    - 6 meals (5_plus with 6): 20% / 20% / 20% / 15% / 15% / 10%
 * 4. Remainder balancing:
 *    - Any rounding difference between the sum of meal targets and the authoritative daily total
 *      is deterministically resolved on the primary meal (Meal 1 or largest slot), ensuring
 *      exact daily total preservation.
 */

import type { NutritionTargets } from './quantitativeTypes';
import type { MealQuantitativeTargets } from './nutritionPlanTypes';

/**
 * Returns baseline distribution percentages for given slot count.
 * All arrays sum to exactly 1.0 (100%).
 */
export function getMealDistributionPercentages(mealCount: number): number[] {
  switch (mealCount) {
    case 1:
      return [1.0];
    case 2:
      return [0.5, 0.5];
    case 3:
      return [0.35, 0.35, 0.3];
    case 4:
      return [0.3, 0.3, 0.25, 0.15];
    case 5:
      return [0.25, 0.25, 0.25, 0.15, 0.1];
    case 6:
      return [0.2, 0.2, 0.2, 0.15, 0.15, 0.1];
    default: {
      // General proportional distribution: first 3 get equal main shares, remaining split remainder
      if (mealCount <= 0) return [1.0];
      const equalShare = Number((1 / mealCount).toFixed(4));
      const shares = new Array(mealCount).fill(equalShare);
      const sum = shares.reduce((acc, curr) => acc + curr, 0);
      shares[0] += Number((1 - sum).toFixed(4));
      return shares;
    }
  }
}

/**
 * Distributes daily quantitative totals into meal-level targets.
 *
 * @param dailyTargets Authoritative NutritionTargets (v1)
 * @param mealCount Number of slots to allocate across
 * @returns Array of MealQuantitativeTargets matching mealCount
 */
export function allocateDailyTargetsToMeals(
  dailyTargets: NutritionTargets,
  mealCount: number
): MealQuantitativeTargets[] {
  const percentages = getMealDistributionPercentages(mealCount);

  const totalCalories = dailyTargets.energy.targetRange.midpointKcal;
  const totalProtein = dailyTargets.macronutrients.protein.targetGrams;
  const totalFat = dailyTargets.macronutrients.fat.targetGrams;
  const totalCarbs = dailyTargets.macronutrients.carbohydrates.targetGrams;

  // 1. Initial rounded allocations
  const allocated: MealQuantitativeTargets[] = percentages.map((pct) => {
    return {
      targetEnergyKcal: Math.round(totalCalories * pct),
      targetProteinG: Math.round(totalProtein * pct),
      targetFatG: Math.round(totalFat * pct),
      targetCarbohydratesG: Math.round(totalCarbs * pct),
      allocationPercentage: pct,
    };
  });

  // 2. Exact remainder preservation on the primary meal (index 0)
  const sumCalories = allocated.reduce((acc, m) => acc + m.targetEnergyKcal, 0);
  const sumProtein = allocated.reduce((acc, m) => acc + m.targetProteinG, 0);
  const sumFat = allocated.reduce((acc, m) => acc + m.targetFatG, 0);
  const sumCarbs = allocated.reduce((acc, m) => acc + m.targetCarbohydratesG, 0);

  allocated[0].targetEnergyKcal += totalCalories - sumCalories;
  allocated[0].targetProteinG += totalProtein - sumProtein;
  allocated[0].targetFatG += totalFat - sumFat;
  allocated[0].targetCarbohydratesG += totalCarbs - sumCarbs;

  // Sanity check floors
  for (const slot of allocated) {
    if (slot.targetEnergyKcal < 0) slot.targetEnergyKcal = 0;
    if (slot.targetProteinG < 0) slot.targetProteinG = 0;
    if (slot.targetFatG < 0) slot.targetFatG = 0;
    if (slot.targetCarbohydratesG < 0) slot.targetCarbohydratesG = 0;
  }

  return allocated;
}
