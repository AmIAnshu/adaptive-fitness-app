/**
 * Nutrition Execution State Machine & Intake Logging Engine (Stage W7.6)
 *
 * Implements pure state-transition functions to initialize nutrition executions,
 * log meal items, record substitutions, adjust portions, and compute factual daily totals.
 *
 * INVARIANTS:
 * 1. Pure, deterministic, side-effect free, immutable transitions.
 * 2. Planned vs. Actual Separation: Actual logged intake never alters planned targets.
 * 3. Authoritative Food Catalog: All intake calculations use catalog reference constants:
 *    calculated = reference_value × portion_units.
 * 4. Non-negative, finite numbers with discrete portion bounds.
 */

import type { FoodDefinition } from './foodCatalogTypes';
import { getFoodById, AUTHORITATIVE_FOOD_CATALOG } from './foodCatalog';
import type { NutritionPlan, MealSlot } from './nutritionPlanTypes';
import type {
  NutritionExecution,
  MealExecution,
  LoggedFoodItem,
  NutritionDailySummary,
  LoggedItemSource,
  MealIntakeCorrection,
  MealIntakeCorrectionReason,
} from './nutritionExecutionTypes';
import { deepFreeze } from './nutritionTargetEngine';

/**
 * Calculates logged food item nutrition deterministically from catalog constants.
 */
export function calculateLoggedFoodNutrients(
  food: FoodDefinition,
  portionUnits: number,
  source: LoggedItemSource = 'planned_food',
  substitutedFoodId?: string,
  notes?: string
): LoggedFoodItem {
  if (typeof portionUnits !== 'number' || isNaN(portionUnits) || !isFinite(portionUnits) || portionUnits <= 0) {
    throw new Error(`Invalid portionUnits: ${portionUnits}. Must be a positive finite number.`);
  }

  const calories = Math.round(food.caloriesPerReference * portionUnits);
  const proteinG = Math.round(food.proteinPerReference * portionUnits);
  const fatG = Math.round(food.fatPerReference * portionUnits);
  const carbohydratesG = Math.round(food.carbohydratesPerReference * portionUnits);

  const totalAmount = Math.round(food.referenceAmount * portionUnits);
  let servingDescription = `${totalAmount} ${food.referenceUnit}`;
  if (food.referenceUnit === 'piece' || food.referenceUnit === 'tbsp') {
    servingDescription = `${portionUnits} ${portionUnits === 1 ? food.referenceUnit : food.referenceUnit + 's'}`;
  }

  return {
    foodId: food.id,
    foodName: food.name,
    portionUnits,
    servingDescription,
    source,
    substitutedFoodId,
    notes,
    calories,
    proteinG,
    fatG,
    carbohydratesG,
  };
}

/**
 * Computes meal-level consumed nutrient totals from logged foods.
 */
export function computeMealNutrientTotals(loggedFoods: LoggedFoodItem[]): {
  consumedCalories: number;
  consumedProteinG: number;
  consumedFatG: number;
  consumedCarbohydratesG: number;
} {
  return loggedFoods.reduce(
    (acc, f) => ({
      consumedCalories: acc.consumedCalories + f.calories,
      consumedProteinG: acc.consumedProteinG + f.proteinG,
      consumedFatG: acc.consumedFatG + f.fatG,
      consumedCarbohydratesG: acc.consumedCarbohydratesG + f.carbohydratesG,
    }),
    { consumedCalories: 0, consumedProteinG: 0, consumedFatG: 0, consumedCarbohydratesG: 0 }
  );
}

/**
 * Computes daily summary comparing planned vs consumed values.
 */
export function computeDailySummary(
  plan: NutritionPlan,
  date: string,
  mealExecutions: MealExecution[]
): NutritionDailySummary {
  const isQuantitative = plan.readinessStatus === 'ready' && !!plan.nutritionTargets;

  const plannedCalories = isQuantitative ? plan.nutritionTargets!.energy.targetRange.midpointKcal : undefined;
  const plannedProteinG = isQuantitative ? plan.nutritionTargets!.macronutrients.protein.targetGrams : undefined;
  const plannedFatG = isQuantitative ? plan.nutritionTargets!.macronutrients.fat.targetGrams : undefined;
  const plannedCarbohydratesG = isQuantitative ? plan.nutritionTargets!.macronutrients.carbohydrates.targetGrams : undefined;

  let consumedCalories = 0;
  let consumedProteinG = 0;
  let consumedFatG = 0;
  let consumedCarbohydratesG = 0;

  let mealsCompleted = 0;
  let mealsPartial = 0;
  let mealsSkipped = 0;

  for (const m of mealExecutions) {
    consumedCalories += m.consumedCalories;
    consumedProteinG += m.consumedProteinG;
    consumedFatG += m.consumedFatG;
    consumedCarbohydratesG += m.consumedCarbohydratesG;

    if (m.status === 'completed') mealsCompleted++;
    else if (m.status === 'partial') mealsPartial++;
    else if (m.status === 'skipped') mealsSkipped++;
  }

  const deltaCalories = plannedCalories !== undefined ? consumedCalories - plannedCalories : undefined;
  const deltaProteinG = plannedProteinG !== undefined ? consumedProteinG - plannedProteinG : undefined;
  const deltaFatG = plannedFatG !== undefined ? consumedFatG - plannedFatG : undefined;
  const deltaCarbohydratesG = plannedCarbohydratesG !== undefined ? consumedCarbohydratesG - plannedCarbohydratesG : undefined;

  return {
    date,
    isQuantitative,
    plannedCalories,
    plannedProteinG,
    plannedFatG,
    plannedCarbohydratesG,
    consumedCalories,
    consumedProteinG,
    consumedFatG,
    consumedCarbohydratesG,
    deltaCalories,
    deltaProteinG,
    deltaFatG,
    deltaCarbohydratesG,
    mealsPlanned: plan.dailyPlan.totalMeals,
    mealsCompleted,
    mealsPartial,
    mealsSkipped,
  };
}

/**
 * Initializes a new NutritionExecution for a plan and date.
 */
export function initializeNutritionExecution(
  plan: NutritionPlan,
  date: string,
  timestamp: number = Date.now()
): NutritionExecution {
  const executionId = `nutr_exec_${date}_${plan.schemaVersion}`;

  const mealExecutions: MealExecution[] = plan.dailyPlan.slots.map((slot) => {
    return {
      mealSlotId: slot.slotId,
      mealName: slot.name,
      slotType: slot.slotType,
      status: 'not_started',
      loggedFoods: [],
      consumedCalories: 0,
      consumedProteinG: 0,
      consumedFatG: 0,
      consumedCarbohydratesG: 0,
    };
  });

  const summary = computeDailySummary(plan, date, mealExecutions);

  return deepFreeze({
    schemaVersion: 1,
    executionId,
    planId: `plan_v${plan.schemaVersion}`,
    date,
    status: 'not_started',
    mealExecutions,
    summary,
    createdAt: timestamp,
    lastUpdated: timestamp,
  });
}

/**
 * Transitions meal execution by logging food items and updating totals.
 * Stage W8.3: Records superseded corrections when editing or changing status of already-logged meals.
 * Guarantees idempotency when called with identical arguments.
 */
export function logMealExecution(
  prevExecution: NutritionExecution,
  plan: NutritionPlan,
  mealSlotId: string,
  loggedFoods: LoggedFoodItem[],
  status: 'completed' | 'partial' | 'skipped',
  notes?: string,
  timestamp: number = Date.now()
): NutritionExecution {
  const targetIndex = prevExecution.mealExecutions.findIndex((m) => m.mealSlotId === mealSlotId);
  if (targetIndex === -1) {
    throw new Error(`Meal slot ID "${mealSlotId}" not found in execution.`);
  }

  const currentMeal = prevExecution.mealExecutions[targetIndex];
  const actualLoggedFoods = status === 'skipped' ? [] : loggedFoods;
  const { consumedCalories, consumedProteinG, consumedFatG, consumedCarbohydratesG } =
    computeMealNutrientTotals(actualLoggedFoods);

  // Check idempotency: If status, notes, and logged foods are identical, return unchanged
  const isSameStatus = currentMeal.status === status;
  const isSameNotes = (currentMeal.notes ?? undefined) === (notes ?? undefined);
  const isSameFoodCount = currentMeal.loggedFoods.length === actualLoggedFoods.length;
  const isSameFoods =
    isSameFoodCount &&
    currentMeal.loggedFoods.every((f, idx) => {
      const other = actualLoggedFoods[idx];
      return (
        f.foodId === other.foodId &&
        f.portionUnits === other.portionUnits &&
        f.source === other.source &&
        f.substitutedFoodId === other.substitutedFoodId
      );
    });

  if (isSameStatus && isSameNotes && isSameFoods) {
    return prevExecution;
  }

  // Determine superseded history
  let supersededHistory = currentMeal.supersededHistory ? [...currentMeal.supersededHistory] : [];
  const hadPriorIntakeOrStatus =
    currentMeal.status !== 'not_started' ||
    currentMeal.loggedFoods.length > 0 ||
    currentMeal.consumedCalories > 0;

  if (hadPriorIntakeOrStatus) {
    const correctionReason: MealIntakeCorrectionReason =
      currentMeal.status === status ? 'correction' : 'status_change';
    const priorCorrection: MealIntakeCorrection = {
      correctionId: `corr_${currentMeal.mealSlotId}_${timestamp}`,
      supersededAt: timestamp,
      reason: correctionReason,
      previousStatus: currentMeal.status,
      previousLoggedFoods: [...currentMeal.loggedFoods],
      consumedCalories: currentMeal.consumedCalories,
      consumedProteinG: currentMeal.consumedProteinG,
      consumedFatG: currentMeal.consumedFatG,
      consumedCarbohydratesG: currentMeal.consumedCarbohydratesG,
      notes: currentMeal.notes,
    };
    supersededHistory.push(priorCorrection);
  }

  const updatedMeal: MealExecution = {
    ...currentMeal,
    status,
    loggedFoods: actualLoggedFoods,
    consumedCalories,
    consumedProteinG,
    consumedFatG,
    consumedCarbohydratesG,
    notes,
    completedAt: timestamp,
    supersededHistory: supersededHistory.length > 0 ? supersededHistory : undefined,
  };

  const updatedMeals = [...prevExecution.mealExecutions];
  updatedMeals[targetIndex] = updatedMeal;

  const summary = computeDailySummary(plan, prevExecution.date, updatedMeals);

  // Overall execution status
  const allResolved = updatedMeals.every(
    (m) => m.status === 'completed' || m.status === 'partial' || m.status === 'skipped'
  );
  const anyLogged = updatedMeals.some((m) => m.status !== 'not_started');

  let executionStatus: NutritionExecution['status'] = 'in_progress';
  if (allResolved) {
    if (updatedMeals.some((m) => m.status === 'completed' || m.status === 'partial')) {
      executionStatus = updatedMeals.some((m) => m.status === 'partial') ? 'partial' : 'completed';
    } else {
      executionStatus = 'abandoned';
    }
  } else if (!anyLogged) {
    executionStatus = 'not_started';
  }

  return deepFreeze({
    ...prevExecution,
    status: executionStatus,
    mealExecutions: updatedMeals,
    summary,
    lastUpdated: timestamp,
  });
}

/**
 * Safely resets a meal execution slot back to 'not_started' (Stage W8.3).
 *
 * Invariants:
 * - If the slot is already 'not_started' with zero intake, this is a NO-OP (does not fabricate fake records).
 * - If the slot had prior logged intake or status, the prior intake is safely archived in supersededHistory.
 * - Effective totals for this slot are zeroed out (0 kcal, 0 macros, status 'not_started', loggedFoods []).
 * - Daily summary is recalculated purely from effective slot values (preventing double counting).
 */
export function resetMealExecutionSlot(
  prevExecution: NutritionExecution,
  plan: NutritionPlan,
  mealSlotId: string,
  reason: MealIntakeCorrectionReason = 'reset',
  notes?: string,
  timestamp: number = Date.now()
): NutritionExecution {
  const targetIndex = prevExecution.mealExecutions.findIndex((m) => m.mealSlotId === mealSlotId);
  if (targetIndex === -1) {
    throw new Error(`Meal slot ID "${mealSlotId}" not found in execution.`);
  }

  const currentMeal = prevExecution.mealExecutions[targetIndex];

  // If slot is already not_started with no logged foods and 0 calories, reset is a no-op!
  if (
    currentMeal.status === 'not_started' &&
    currentMeal.loggedFoods.length === 0 &&
    currentMeal.consumedCalories === 0
  ) {
    return prevExecution;
  }

  let supersededHistory = currentMeal.supersededHistory ? [...currentMeal.supersededHistory] : [];
  const priorCorrection: MealIntakeCorrection = {
    correctionId: `corr_${currentMeal.mealSlotId}_${timestamp}`,
    supersededAt: timestamp,
    reason,
    previousStatus: currentMeal.status,
    previousLoggedFoods: [...currentMeal.loggedFoods],
    consumedCalories: currentMeal.consumedCalories,
    consumedProteinG: currentMeal.consumedProteinG,
    consumedFatG: currentMeal.consumedFatG,
    consumedCarbohydratesG: currentMeal.consumedCarbohydratesG,
    notes: currentMeal.notes,
  };
  supersededHistory.push(priorCorrection);

  const updatedMeal: MealExecution = {
    ...currentMeal,
    status: 'not_started',
    loggedFoods: [],
    consumedCalories: 0,
    consumedProteinG: 0,
    consumedFatG: 0,
    consumedCarbohydratesG: 0,
    notes,
    completedAt: undefined,
    supersededHistory,
  };

  const updatedMeals = [...prevExecution.mealExecutions];
  updatedMeals[targetIndex] = updatedMeal;

  const summary = computeDailySummary(plan, prevExecution.date, updatedMeals);

  const allResolved = updatedMeals.every(
    (m) => m.status === 'completed' || m.status === 'partial' || m.status === 'skipped'
  );
  const anyLogged = updatedMeals.some((m) => m.status !== 'not_started');

  let executionStatus: NutritionExecution['status'] = 'in_progress';
  if (allResolved) {
    if (updatedMeals.some((m) => m.status === 'completed' || m.status === 'partial')) {
      executionStatus = updatedMeals.some((m) => m.status === 'partial') ? 'partial' : 'completed';
    } else {
      executionStatus = 'abandoned';
    }
  } else if (!anyLogged) {
    executionStatus = 'not_started';
  }

  return deepFreeze({
    ...prevExecution,
    status: executionStatus,
    mealExecutions: updatedMeals,
    summary,
    lastUpdated: timestamp,
  });
}
