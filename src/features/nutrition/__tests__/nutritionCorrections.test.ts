/**
 * Nutrition History Integrity & Safe Corrections Test Suite (Stage W8.3)
 *
 * Requirements Covered (Categories A through T):
 * A: Unchanged Historical Records
 * B: Correct Effective Current State
 * C: Safe Reset Preserving Prior Logged Evidence in supersededHistory
 * D: Resetting Unlogged Slot Does Not Invent Fake Records
 * E: Editing Completed Meal Correctly Supersedes Prior Values
 * F: Completed to Partial Retains Partial Status and Portions
 * G: Skipped to Logged Intake Never Double-Counts
 * H: Reset and Re-log Calculates Only Effective Nutrients
 * I: Idempotent Repeat Actions
 * J: Concurrency & Serialized Write Order
 * K: Hydration & Validation of Correction Chains
 * L: Corrupt Correction Record Isolation
 * M: Updating Future Effective Summaries
 * N: Attribution of Adaptation Evidence
 * O: Incomplete Evidence vs Complete Day with Skipped Meals
 * P: Immutability of Targets and Plan Records
 * Q: Revision Acceptance/Rejection Preservation
 * R: Youth and Ineligible Protection
 * S: Deterministic Results
 * T: Zero Double-Counting Across Mixed Life Cycles
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeNutritionExecution,
  logMealExecution,
  resetMealExecutionSlot,
  calculateLoggedFoodNutrients,
  evaluateNutritionAdherence,
  deriveNutritionAdaptation,
  validateNutritionExecution,
  generateNutritionPlan,
  runNutritionStrategyPipeline,
  getFoodById,
  defaultNutritionHistoryRepository,
  setRawNutritionStorageItemForTesting,
  deepFreeze,
  type NutritionExecution,
  type MealExecution,
  type NutritionPlan,
} from '../index';
import { buildCanonicalUserProfile } from '../../profile';
import {
  PERSONA_A_BASELINE,
  PERSONA_G_QUANTITATIVE_READY,
  PERSONA_H_FEMALE_READY,
} from '../../../qa/personas';

describe('Nutrition History Integrity & Safe Corrections (Stage W8.3)', () => {
  let plan: NutritionPlan;
  let execution: NutritionExecution;

  beforeEach(async () => {
    setRawNutritionStorageItemForTesting(null);
    await defaultNutritionHistoryRepository.clearAll();

    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const strategyResult = runNutritionStrategyPipeline(profile);
    assert.strictEqual(strategyResult.status, 'completed');

    const planResult = generateNutritionPlan(profile, strategyResult.strategy);
    assert.strictEqual(planResult.status, 'success');
    plan = planResult.plan;

    execution = initializeNutritionExecution(plan, '2026-10-10', 1000000);
  });

  // ==========================================================================
  // Category A: Unchanged Historical Records
  // ==========================================================================
  describe('Category A: Unchanged Historical Records', () => {
    it('prior completed day execution remains immutable when today execution is modified', async () => {
      const yesterdayExec = initializeNutritionExecution(plan, '2026-10-09', 900000);
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.0);

      const yesterdayCompleted = logMealExecution(
        yesterdayExec,
        plan,
        plan.dailyPlan.slots[0].slotId,
        [food],
        'completed',
        'Yesterday lunch',
        905000
      );

      await defaultNutritionHistoryRepository.saveExecution(yesterdayCompleted);

      // Modify today
      const todaySlotId = plan.dailyPlan.slots[0].slotId;
      const todayFood = calculateLoggedFoodNutrients(chicken, 2.0);
      const todayLogged = logMealExecution(
        execution,
        plan,
        todaySlotId,
        [todayFood],
        'completed',
        'Today lunch',
        1005000
      );

      // Reset today
      const todayReset = resetMealExecutionSlot(todayLogged, plan, todaySlotId, 'reset', undefined, 1010000);
      await defaultNutritionHistoryRepository.saveExecution(todayReset);

      // Retrieve yesterday
      const reloadedYesterday = await defaultNutritionHistoryRepository.getExecutionByDate('2026-10-09');
      assert.ok(reloadedYesterday);
      assert.strictEqual(reloadedYesterday.mealExecutions[0].status, 'completed');
      assert.strictEqual(reloadedYesterday.mealExecutions[0].consumedCalories, food.calories);
      assert.strictEqual(reloadedYesterday.summary.consumedCalories, food.calories);
      assert.strictEqual(reloadedYesterday.mealExecutions[0].supersededHistory, undefined);
    });
  });

  // ==========================================================================
  // Category B: Correct Effective Current State
  // ==========================================================================
  describe('Category B: Correct Effective Current State', () => {
    it('accurately exposes latest effective state across status, foods, and nutrients', () => {
      const chicken = getFoodById('chicken_breast')!;
      const rice = getFoodById('brown_rice')!;
      const food1 = calculateLoggedFoodNutrients(chicken, 1.0);
      const food2 = calculateLoggedFoodNutrients(rice, 1.0);
      const slotId = plan.dailyPlan.slots[0].slotId;

      const logged = logMealExecution(
        execution,
        plan,
        slotId,
        [food1, food2],
        'completed',
        'Balanced lunch',
        1000
      );

      const meal = logged.mealExecutions[0];
      assert.strictEqual(meal.status, 'completed');
      assert.strictEqual(meal.loggedFoods.length, 2);
      assert.strictEqual(meal.consumedCalories, food1.calories + food2.calories);
      assert.strictEqual(meal.consumedProteinG, food1.proteinG + food2.proteinG);
      assert.strictEqual(meal.consumedFatG, food1.fatG + food2.fatG);
      assert.strictEqual(meal.consumedCarbohydratesG, food1.carbohydratesG + food2.carbohydratesG);
      assert.strictEqual(logged.summary.consumedCalories, food1.calories + food2.calories);
    });
  });

  // ==========================================================================
  // Category C: Safe Reset Preserving Prior Logged Evidence in supersededHistory
  // ==========================================================================
  describe('Category C: Safe Reset Preserving Prior Logged Evidence', () => {
    it('resets effective slot to not_started with 0 nutrients while archiving intake in supersededHistory', () => {
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.5);
      const slotId = plan.dailyPlan.slots[0].slotId;

      const logged = logMealExecution(execution, plan, slotId, [food], 'completed', 'First intake', 1000);
      assert.strictEqual(logged.summary.consumedCalories, food.calories);

      const reset = resetMealExecutionSlot(logged, plan, slotId, 'reset', 'User mistake', 2000);
      const meal = reset.mealExecutions[0];

      // Effective slot properties
      assert.strictEqual(meal.status, 'not_started');
      assert.strictEqual(meal.loggedFoods.length, 0);
      assert.strictEqual(meal.consumedCalories, 0);
      assert.strictEqual(meal.consumedProteinG, 0);
      assert.strictEqual(meal.consumedFatG, 0);
      assert.strictEqual(meal.consumedCarbohydratesG, 0);
      assert.strictEqual(meal.completedAt, undefined);

      // Effective daily summary properties
      assert.strictEqual(reset.summary.consumedCalories, 0);
      assert.strictEqual(reset.summary.mealsCompleted, 0);
      assert.strictEqual(reset.status, 'not_started');

      // Preserved superseded evidence
      assert.ok(meal.supersededHistory);
      assert.strictEqual(meal.supersededHistory.length, 1);
      const corr = meal.supersededHistory[0];
      assert.strictEqual(corr.reason, 'reset');
      assert.strictEqual(corr.supersededAt, 2000);
      assert.strictEqual(corr.previousStatus, 'completed');
      assert.strictEqual(corr.consumedCalories, food.calories);
      assert.strictEqual(corr.previousLoggedFoods.length, 1);
      assert.strictEqual(corr.previousLoggedFoods[0].foodId, 'chicken_breast');
      assert.strictEqual(corr.notes, 'First intake');
    });
  });

  // ==========================================================================
  // Category D: Resetting Unlogged Slot Does Not Invent Fake Records
  // ==========================================================================
  describe('Category D: Resetting Unlogged Slot Does Not Invent Fake Records', () => {
    it('returns original execution reference without creating supersededHistory when resetting untouched slot', () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      assert.strictEqual(execution.mealExecutions[0].status, 'not_started');

      const result = resetMealExecutionSlot(execution, plan, slotId, 'reset', undefined, 3000);

      // Exact same reference returned
      assert.strictEqual(result, execution);
      assert.strictEqual(result.mealExecutions[0].supersededHistory, undefined);
      assert.strictEqual(result.summary.consumedCalories, 0);
    });
  });

  // ==========================================================================
  // Category E: Editing Completed Meal Correctly Supersedes Prior Values
  // ==========================================================================
  describe('Category E: Editing Completed Meal Correctly Supersedes Prior Values', () => {
    it('records correction when portion is updated and updates effective nutrient values', () => {
      const chicken = getFoodById('chicken_breast')!;
      const slotId = plan.dailyPlan.slots[0].slotId;

      const foodV1 = calculateLoggedFoodNutrients(chicken, 1.0);
      const v1 = logMealExecution(execution, plan, slotId, [foodV1], 'completed', 'v1 notes', 1000);
      assert.strictEqual(v1.summary.consumedCalories, foodV1.calories);

      const foodV2 = calculateLoggedFoodNutrients(chicken, 2.0);
      const v2 = logMealExecution(v1, plan, slotId, [foodV2], 'completed', 'v2 notes', 2000);

      const meal = v2.mealExecutions[0];
      // Effective values reflect v2 only
      assert.strictEqual(meal.status, 'completed');
      assert.strictEqual(meal.consumedCalories, foodV2.calories);
      assert.strictEqual(meal.consumedProteinG, foodV2.proteinG);
      assert.strictEqual(v2.summary.consumedCalories, foodV2.calories);

      // Superseded history contains v1
      assert.ok(meal.supersededHistory);
      assert.strictEqual(meal.supersededHistory.length, 1);
      assert.strictEqual(meal.supersededHistory[0].reason, 'correction');
      assert.strictEqual(meal.supersededHistory[0].consumedCalories, foodV1.calories);
      assert.strictEqual(meal.supersededHistory[0].notes, 'v1 notes');
    });
  });

  // ==========================================================================
  // Category F: Completed to Partial Retains Partial Status and Portions
  // ==========================================================================
  describe('Category F: Completed to Partial Retains Partial Status and Portions', () => {
    it('changing completed meal to partial preserves partial status and archives completed state', () => {
      const oats = getFoodById('oats')!;
      const slotId = plan.dailyPlan.slots[0].slotId;

      const fullFood = calculateLoggedFoodNutrients(oats, 1.0);
      const full = logMealExecution(execution, plan, slotId, [fullFood], 'completed', undefined, 1000);

      const halfFood = calculateLoggedFoodNutrients(oats, 0.5);
      const partial = logMealExecution(full, plan, slotId, [halfFood], 'partial', 'Ate half', 2000);

      const meal = partial.mealExecutions[0];
      assert.strictEqual(meal.status, 'partial');
      assert.strictEqual(meal.consumedCalories, halfFood.calories);
      assert.strictEqual(meal.notes, 'Ate half');

      assert.strictEqual(partial.summary.mealsCompleted, 0);
      assert.strictEqual(partial.summary.mealsPartial, 1);

      assert.ok(meal.supersededHistory);
      assert.strictEqual(meal.supersededHistory.length, 1);
      assert.strictEqual(meal.supersededHistory[0].reason, 'status_change');
      assert.strictEqual(meal.supersededHistory[0].previousStatus, 'completed');
      assert.strictEqual(meal.supersededHistory[0].consumedCalories, fullFood.calories);
    });
  });

  // ==========================================================================
  // Category G: Skipped to Logged Intake Never Double-Counts
  // ==========================================================================
  describe('Category G: Skipped to Logged Intake Never Double-Counts', () => {
    it('transitions skipped meal to completed without double counting', () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      const skipped = logMealExecution(execution, plan, slotId, [], 'skipped', 'Not hungry', 1000);

      assert.strictEqual(skipped.mealExecutions[0].status, 'skipped');
      assert.strictEqual(skipped.summary.mealsSkipped, 1);
      assert.strictEqual(skipped.summary.consumedCalories, 0);

      const eggs = getFoodById('eggs')!;
      const eggFood = calculateLoggedFoodNutrients(eggs, 2.0);
      const logged = logMealExecution(skipped, plan, slotId, [eggFood], 'completed', 'Changed mind', 2000);

      const meal = logged.mealExecutions[0];
      assert.strictEqual(meal.status, 'completed');
      assert.strictEqual(meal.consumedCalories, eggFood.calories);
      assert.strictEqual(logged.summary.consumedCalories, eggFood.calories);
      assert.strictEqual(logged.summary.mealsSkipped, 0);
      assert.strictEqual(logged.summary.mealsCompleted, 1);

      assert.ok(meal.supersededHistory);
      assert.strictEqual(meal.supersededHistory.length, 1);
      assert.strictEqual(meal.supersededHistory[0].reason, 'status_change');
      assert.strictEqual(meal.supersededHistory[0].previousStatus, 'skipped');
      assert.strictEqual(meal.supersededHistory[0].consumedCalories, 0);
    });
  });

  // ==========================================================================
  // Category H: Reset and Re-log Calculates Only Effective Nutrients
  // ==========================================================================
  describe('Category H: Reset and Re-log Calculates Only Effective Nutrients', () => {
    it('slot logged then reset then re-logged with new food calculates only final intake', () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      const chicken = getFoodById('chicken_breast')!;
      const food1 = calculateLoggedFoodNutrients(chicken, 1.0);

      const step1 = logMealExecution(execution, plan, slotId, [food1], 'completed', undefined, 1000);
      const step2 = resetMealExecutionSlot(step1, plan, slotId, 'reset', undefined, 2000);

      const tofu = getFoodById('tofu')!;
      const food2 = calculateLoggedFoodNutrients(tofu, 1.5);
      const step3 = logMealExecution(step2, plan, slotId, [food2], 'completed', 'Actually ate tofu', 3000);

      const meal = step3.mealExecutions[0];
      assert.strictEqual(meal.status, 'completed');
      assert.strictEqual(meal.consumedCalories, food2.calories);
      assert.strictEqual(step3.summary.consumedCalories, food2.calories);

      // supersededHistory has 1 entry: food1 that was reset
      assert.ok(meal.supersededHistory);
      assert.strictEqual(meal.supersededHistory.length, 1);
      assert.strictEqual(meal.supersededHistory[0].consumedCalories, food1.calories);
      assert.strictEqual(meal.supersededHistory[0].reason, 'reset');
    });
  });

  // ==========================================================================
  // Category I: Idempotent Repeat Actions
  // ==========================================================================
  describe('Category I: Idempotent Repeat Actions', () => {
    it('calling logMealExecution or reset with identical arguments does not append duplicate corrections', () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.0);

      const logged1 = logMealExecution(execution, plan, slotId, [food], 'completed', 'Lunch', 1000);
      const logged2 = logMealExecution(logged1, plan, slotId, [food], 'completed', 'Lunch', 1000);

      // Identical call returns original execution
      assert.strictEqual(logged1, logged2);
      assert.strictEqual(logged2.mealExecutions[0].supersededHistory, undefined);

      // Now reset
      const reset1 = resetMealExecutionSlot(logged1, plan, slotId, 'reset', undefined, 2000);
      assert.strictEqual(reset1.mealExecutions[0].supersededHistory?.length, 1);

      // Resetting again
      const reset2 = resetMealExecutionSlot(reset1, plan, slotId, 'reset', undefined, 3000);
      assert.strictEqual(reset1, reset2);
      assert.strictEqual(reset2.mealExecutions[0].supersededHistory?.length, 1);
    });
  });

  // ==========================================================================
  // Category J: Concurrency & Serialized Write Order
  // ==========================================================================
  describe('Category J: Concurrency & Serialized Write Order', () => {
    it('serializes rapid consecutive repository writes through mutex without race conditions', async () => {
      const slot1 = plan.dailyPlan.slots[0].slotId;
      const slot2 = plan.dailyPlan.slots[1].slotId;
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.0);

      const exec1 = logMealExecution(execution, plan, slot1, [food], 'completed', undefined, 1000);
      const exec2 = logMealExecution(exec1, plan, slot2, [food], 'completed', undefined, 2000);
      const exec3 = resetMealExecutionSlot(exec2, plan, slot1, 'reset', undefined, 3000);

      // Fire saves simultaneously
      await Promise.all([
        defaultNutritionHistoryRepository.saveExecution(exec1),
        defaultNutritionHistoryRepository.saveExecution(exec2),
        defaultNutritionHistoryRepository.saveExecution(exec3),
      ]);

      const loaded = await defaultNutritionHistoryRepository.getExecutionByDate(execution.date);
      assert.ok(loaded);
      assert.strictEqual(loaded.mealExecutions[0].status, 'not_started');
      assert.strictEqual(loaded.mealExecutions[1].status, 'completed');
      assert.strictEqual(loaded.summary.consumedCalories, food.calories);
    });
  });

  // ==========================================================================
  // Category K: Hydration & Validation of Correction Chains
  // ==========================================================================
  describe('Category K: Hydration & Validation of Correction Chains', () => {
    it('validates and reloads executions containing multiple correction items', async () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      const chicken = getFoodById('chicken_breast')!;
      const food1 = calculateLoggedFoodNutrients(chicken, 1.0);
      const food2 = calculateLoggedFoodNutrients(chicken, 1.5);

      const s1 = logMealExecution(execution, plan, slotId, [food1], 'completed', undefined, 1000);
      const s2 = logMealExecution(s1, plan, slotId, [food2], 'completed', undefined, 2000);
      const s3 = resetMealExecutionSlot(s2, plan, slotId, 'reset', undefined, 3000);

      const val = validateNutritionExecution(s3);
      assert.strictEqual(val.valid, true);

      await defaultNutritionHistoryRepository.saveExecution(s3);
      const loaded = await defaultNutritionHistoryRepository.getExecutionByDate(execution.date);
      assert.ok(loaded);
      assert.strictEqual(loaded.mealExecutions[0].supersededHistory?.length, 2);
    });
  });

  // ==========================================================================
  // Category L: Corrupt Correction Record Isolation
  // ==========================================================================
  describe('Category L: Corrupt Correction Record Isolation', () => {
    it('rejects saving invalid correction object and isolates corrupted records in storage', async () => {
      const badExecution = {
        ...execution,
        mealExecutions: [
          {
            ...execution.mealExecutions[0],
            supersededHistory: [
              {
                correctionId: '', // invalid
                supersededAt: -10, // invalid
                reason: 'invalid_reason',
                previousStatus: 'invalid_status',
                consumedCalories: -50,
                previousLoggedFoods: [],
              },
            ],
          },
        ],
      };

      const val = validateNutritionExecution(deepFreeze(badExecution as any));
      assert.strictEqual(val.valid, false);
      assert.ok(val.errors.length >= 3);

      await assert.rejects(async () => {
        await defaultNutritionHistoryRepository.saveExecution(badExecution as any);
      });
    });
  });

  // ==========================================================================
  // Category M: Updating Future Effective Summaries
  // ==========================================================================
  describe('Category M: Updating Future Effective Summaries', () => {
    it('correctly updates deltaCalories and macro consumption when corrections are applied', () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      const chicken = getFoodById('chicken_breast')!;
      const rice = getFoodById('brown_rice')!;

      const food1 = calculateLoggedFoodNutrients(chicken, 1.0);
      const logged = logMealExecution(execution, plan, slotId, [food1], 'completed', undefined, 1000);

      const plannedMidpoint = plan.nutritionTargets!.energy.targetRange.midpointKcal;
      assert.strictEqual(logged.summary.deltaCalories, food1.calories - plannedMidpoint);

      const food2 = calculateLoggedFoodNutrients(rice, 2.0);
      const corrected = logMealExecution(logged, plan, slotId, [food2], 'completed', undefined, 2000);

      assert.strictEqual(corrected.summary.consumedCalories, food2.calories);
      assert.strictEqual(corrected.summary.deltaCalories, food2.calories - plannedMidpoint);
    });
  });

  // ==========================================================================
  // Category N: Attribution of Adaptation Evidence
  // ==========================================================================
  describe('Category N: Attribution of Adaptation Evidence', () => {
    it('does not tally substitutions from reset slots into adaptation repeatedSubstitutions', () => {
      const slotId = plan.dailyPlan.slots[0].slotId;
      const tofu = getFoodById('tofu')!;
      const subFood = calculateLoggedFoodNutrients(tofu, 1.0, 'catalog_substitution');

      // Log substitution
      const logged = logMealExecution(execution, plan, slotId, [subFood], 'completed', undefined, 1000);
      // Reset the slot
      const reset = resetMealExecutionSlot(logged, plan, slotId, 'reset', undefined, 2000);

      const evidence = evaluateNutritionAdherence([reset]);
      // Reset slot has empty effective loggedFoods, so substitution count must be 0
      assert.strictEqual(evidence.repeatedSubstitutions.length, 0);
    });
  });

  // ==========================================================================
  // Category O: Incomplete Evidence vs Complete Day with Skipped Meals
  // ==========================================================================
  describe('Category O: Incomplete Evidence vs Complete Day with Skipped Meals', () => {
    it('classifies day with a reset slot as incomplete, while a skipped meal is complete', () => {
      // 1. Resolve all slots except one which is reset
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.0);

      let exec1 = execution;
      for (let i = 0; i < plan.dailyPlan.slots.length; i++) {
        exec1 = logMealExecution(exec1, plan, plan.dailyPlan.slots[i].slotId, [food], 'completed', undefined, 1000 + i);
      }
      // Reset the last slot
      const lastSlotId = plan.dailyPlan.slots[plan.dailyPlan.slots.length - 1].slotId;
      exec1 = resetMealExecutionSlot(exec1, plan, lastSlotId, 'reset', undefined, 2000);

      const evidence1 = evaluateNutritionAdherence([exec1]);
      assert.strictEqual(evidence1.completeDaysCount, 0);
      assert.strictEqual(evidence1.incompleteDaysCount, 1);
      assert.strictEqual(evidence1.dayCompleteness[0].isComplete, false);

      // 2. Now mark the last slot as skipped
      let exec2 = execution;
      for (let i = 0; i < plan.dailyPlan.slots.length - 1; i++) {
        exec2 = logMealExecution(exec2, plan, plan.dailyPlan.slots[i].slotId, [food], 'completed', undefined, 1000 + i);
      }
      exec2 = logMealExecution(exec2, plan, lastSlotId, [], 'skipped', undefined, 2000);

      const evidence2 = evaluateNutritionAdherence([exec2]);
      assert.strictEqual(evidence2.completeDaysCount, 1);
      assert.strictEqual(evidence2.incompleteDaysCount, 0);
      assert.strictEqual(evidence2.dayCompleteness[0].isComplete, true);
    });
  });

  // ==========================================================================
  // Category P: Immutability of Targets and Plan Records
  // ==========================================================================
  describe('Category P: Immutability of Targets and Plan Records', () => {
    it('nutrition targets and plan slots remain deeply frozen and unmodified throughout corrections', () => {
      const originalMidpoint = plan.nutritionTargets!.energy.targetRange.midpointKcal;
      const originalProtein = plan.nutritionTargets!.macronutrients.protein.targetGrams;

      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 3.0);
      const slotId = plan.dailyPlan.slots[0].slotId;

      const logged = logMealExecution(execution, plan, slotId, [food], 'completed', undefined, 1000);
      const reset = resetMealExecutionSlot(logged, plan, slotId, 'reset', undefined, 2000);

      assert.strictEqual(plan.nutritionTargets!.energy.targetRange.midpointKcal, originalMidpoint);
      assert.strictEqual(plan.nutritionTargets!.macronutrients.protein.targetGrams, originalProtein);
      assert.ok(Object.isFrozen(plan));
      assert.ok(Object.isFrozen(reset));
    });
  });

  // ==========================================================================
  // Category Q: Revision Acceptance/Rejection Preservation
  // ==========================================================================
  describe('Category Q: Revision Acceptance/Rejection Preservation', () => {
    it('maintains repository revision status when meal corrections occur', async () => {
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.0);
      const slotId = plan.dailyPlan.slots[0].slotId;

      const logged = logMealExecution(execution, plan, slotId, [food], 'completed', undefined, 1000);
      await defaultNutritionHistoryRepository.saveExecution(logged);

      // Create a mock revision
      const revision = deepFreeze({
        schemaVersion: 1 as const,
        revisionId: 'rev_test_1',
        originalPlanId: plan.schemaVersion.toString(),
        parentPlanId: plan.schemaVersion.toString(),
        revisedPlan: plan,
        revisionReason: 'simplify_structure' as const,
        appliedRecommendations: [],
        status: 'accepted' as const,
        createdAt: 5000,
      });

      await defaultNutritionHistoryRepository.saveRevision(revision);

      // Reset meal
      const reset = resetMealExecutionSlot(logged, plan, slotId, 'reset', undefined, 6000);
      await defaultNutritionHistoryRepository.saveExecution(reset);

      const activeRev = await defaultNutritionHistoryRepository.getActivePlanRevision();
      assert.ok(activeRev);
      assert.strictEqual(activeRev.revisionId, 'rev_test_1');
      assert.strictEqual(activeRev.status, 'accepted');
    });
  });

  // ==========================================================================
  // Category R: Youth and Ineligible Protection
  // ==========================================================================
  describe('Category R: Youth and Ineligible Protection', () => {
    it('youth and ineligible profiles cannot fabricate quantitative targets', () => {
      const youthProfile = buildCanonicalUserProfile({
        ...PERSONA_A_BASELINE,
        age: 15,
      });

      const youthStrategy = runNutritionStrategyPipeline(youthProfile);
      assert.strictEqual(youthStrategy.status, 'pending');
      assert.strictEqual(youthStrategy.population, 'youth');

      const ineligibleProfile = buildCanonicalUserProfile({
        ...PERSONA_A_BASELINE,
        age: 11,
      });
      const ineligibleStrategy = runNutritionStrategyPipeline(ineligibleProfile);
      assert.strictEqual(ineligibleStrategy.status, 'ineligible');
    });
  });

  // ==========================================================================
  // Category S: Deterministic Results
  // ==========================================================================
  describe('Category S: Deterministic Results', () => {
    it('re-executing identical correction sequence produces deeply identical state objects', () => {
      const chicken = getFoodById('chicken_breast')!;
      const food = calculateLoggedFoodNutrients(chicken, 1.0);
      const slotId = plan.dailyPlan.slots[0].slotId;

      const run1_log = logMealExecution(execution, plan, slotId, [food], 'completed', undefined, 1000);
      const run1_reset = resetMealExecutionSlot(run1_log, plan, slotId, 'reset', undefined, 2000);

      const run2_log = logMealExecution(execution, plan, slotId, [food], 'completed', undefined, 1000);
      const run2_reset = resetMealExecutionSlot(run2_log, plan, slotId, 'reset', undefined, 2000);

      assert.deepStrictEqual(run1_reset, run2_reset);
    });
  });

  // ==========================================================================
  // Category T: Zero Double-Counting Across Mixed Life Cycles
  // ==========================================================================
  describe('Category T: Zero Double-Counting Across Mixed Life Cycles', () => {
    it('total consumed calories and macros strictly match effective meals after complex cycle', () => {
      const slot1 = plan.dailyPlan.slots[0].slotId;
      const slot2 = plan.dailyPlan.slots[1].slotId;
      const chicken = getFoodById('chicken_breast')!;
      const rice = getFoodById('brown_rice')!;
      const oats = getFoodById('oats')!;

      const cFood = calculateLoggedFoodNutrients(chicken, 1.0);
      const rFood = calculateLoggedFoodNutrients(rice, 1.0);
      const oFood = calculateLoggedFoodNutrients(oats, 1.0);

      // Cycle:
      // 1. Log slot1 (chicken)
      let state = logMealExecution(execution, plan, slot1, [cFood], 'completed', undefined, 1000);
      // 2. Edit slot1 to rice
      state = logMealExecution(state, plan, slot1, [rFood], 'completed', undefined, 2000);
      // 3. Reset slot1
      state = resetMealExecutionSlot(state, plan, slot1, 'reset', undefined, 3000);
      // 4. Log slot1 as partial oats
      state = logMealExecution(state, plan, slot1, [oFood], 'partial', undefined, 4000);
      // 5. Skip slot2
      state = logMealExecution(state, plan, slot2, [], 'skipped', undefined, 5000);
      // 6. Log slot2 as chicken
      state = logMealExecution(state, plan, slot2, [cFood], 'completed', undefined, 6000);

      // Effective sum: slot1 has oats, slot2 has chicken
      const expectedCalories = oFood.calories + cFood.calories;
      const expectedProtein = oFood.proteinG + cFood.proteinG;
      const expectedFat = oFood.fatG + cFood.fatG;
      const expectedCarbs = oFood.carbohydratesG + cFood.carbohydratesG;

      assert.strictEqual(state.summary.consumedCalories, expectedCalories);
      assert.strictEqual(state.summary.consumedProteinG, expectedProtein);
      assert.strictEqual(state.summary.consumedFatG, expectedFat);
      assert.strictEqual(state.summary.consumedCarbohydratesG, expectedCarbs);

      // Ensure each slot matches
      assert.strictEqual(state.mealExecutions[0].consumedCalories, oFood.calories);
      assert.strictEqual(state.mealExecutions[1].consumedCalories, cFood.calories);

      // Verify validation passes
      const val = validateNutritionExecution(state);
      assert.strictEqual(val.valid, true);
    });
  });
});
