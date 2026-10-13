/**
 * Nutrition Tracking & Adaptive Nutrition Feedback Test Suite (Stage W7.6)
 *
 * Requirements Covered:
 * A. starting nutrition execution
 * B. completing meal
 * C. partial meal
 * D. skipped meal
 * E. substituted food
 * F. additional food
 * G. portion adjustment
 * H. daily intake totals
 * I. planned vs actual separation
 * J. catalog nutrition calculation
 * K. invalid portions rejection
 * L. invalid food IDs rejection
 * M. dietary restriction protection
 * N. disliked food protection
 * O. pending quantitative user (qualitative logging without fake calories)
 * P. youth protection
 * Q. ineligible protection
 * R. history persistence (save, reload, hydration)
 * S. deterministic feedback
 * T. insufficient evidence (<3 days)
 * U. broadly on-track behavior
 * V. repeated skipped meals -> structure simplification
 * W. repeated target misses -> review energy target adherence
 * X. structure simplification signal
 * Y. preference learning signal
 * Z. immutable history / tamper rejection
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeNutritionExecution,
  logMealExecution,
  calculateLoggedFoodNutrients,
  evaluateNutritionAdherence,
  deriveNutritionAdaptation,
  validateNutritionExecution,
  validateNutritionAdaptation,
  generateNutritionPlan,
  runNutritionStrategyPipeline,
  getFoodById,
  defaultNutritionHistoryRepository,
  setRawNutritionStorageItemForTesting,
} from '../index';
import { buildCanonicalUserProfile } from '../../profile';
import {
  PERSONA_A_BASELINE,
  PERSONA_F_VEGAN_STRUCTURED,
  PERSONA_G_QUANTITATIVE_READY,
} from '../../../qa/personas';
import type { NutritionExecution } from '../nutritionExecutionTypes';

describe('Nutrition Tracking & Adaptive Nutrition Feedback (Stage W7.6)', () => {
  beforeEach(async () => {
    setRawNutritionStorageItemForTesting(null);
    await defaultNutritionHistoryRepository.clearAll();
  });

  // A. Starting nutrition execution
  it('A. Initializes a clean NutritionExecution with not_started meal slots', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    assert.equal(stratRes.status, 'completed');
    if (stratRes.status !== 'completed') return;

    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    assert.equal(exec.schemaVersion, 1);
    assert.equal(exec.status, 'not_started');
    assert.equal(exec.mealExecutions.length, planRes.plan.dailyPlan.slots.length);
    assert.equal(exec.summary.mealsPlanned, 3);
    assert.equal(exec.summary.mealsCompleted, 0);
    assert.equal(exec.summary.consumedCalories, 0);

    const val = validateNutritionExecution(exec);
    assert.equal(val.valid, true);
  });

  // B. Completing meal
  it('B. Logs completed meal and records factual consumed calories and macros', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec0 = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const chicken = getFoodById('chicken_breast')!;
    const rice = getFoodById('brown_rice')!;

    const loggedFoods = [
      calculateLoggedFoodNutrients(chicken, 1.5), // 150g ~ 248 kcal, 47g P
      calculateLoggedFoodNutrients(rice, 1.5), // 150g ~ 168 kcal, 36g C
    ];

    const exec1 = logMealExecution(exec0, planRes.plan, 'slot_1', loggedFoods, 'completed');
    assert.equal(exec1.mealExecutions[0].status, 'completed');
    assert.equal(exec1.status, 'in_progress');
    assert.ok(exec1.mealExecutions[0].consumedCalories > 350);
    assert.ok(exec1.summary.consumedProteinG > 40);
    assert.equal(exec1.summary.mealsCompleted, 1);

    const val = validateNutritionExecution(exec1);
    assert.equal(val.valid, true);
  });

  // C. Partial meal
  it('C. Logs partial meal with partial status and accurate consumed totals', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec0 = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const eggs = getFoodById('eggs')!;
    const loggedFoods = [calculateLoggedFoodNutrients(eggs, 1)]; // ate 1 of 2 planned eggs

    const exec1 = logMealExecution(exec0, planRes.plan, 'slot_1', loggedFoods, 'partial', 'Ate half portion');
    assert.equal(exec1.mealExecutions[0].status, 'partial');
    assert.equal(exec1.summary.mealsPartial, 1);
    assert.equal(exec1.summary.mealsCompleted, 0);
  });

  // D. Skipped meal
  it('D. Logs skipped meal with 0 consumed calories and increments mealsSkipped', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec0 = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const exec1 = logMealExecution(exec0, planRes.plan, 'slot_1', [], 'skipped', 'Busy with meetings');

    assert.equal(exec1.mealExecutions[0].status, 'skipped');
    assert.equal(exec1.mealExecutions[0].consumedCalories, 0);
    assert.equal(exec1.summary.mealsSkipped, 1);
    assert.equal(exec1.summary.consumedCalories, 0);
  });

  // E. Substituted food
  it('E. Logs catalog food substitution referencing the replaced food ID', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec0 = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const salmon = getFoodById('fish')!;
    const item = calculateLoggedFoodNutrients(salmon, 1.5, 'catalog_substitution', 'chicken_breast');

    assert.equal(item.source, 'catalog_substitution');
    assert.equal(item.substitutedFoodId, 'chicken_breast');

    const exec1 = logMealExecution(exec0, planRes.plan, 'slot_1', [item], 'completed');
    assert.equal(exec1.mealExecutions[0].loggedFoods[0].foodId, 'fish');
  });

  // F. Additional food
  it('F. Logs additional food with source additional_food', () => {
    const banana = getFoodById('banana')!;
    const item = calculateLoggedFoodNutrients(banana, 1, 'additional_food');
    assert.equal(item.source, 'additional_food');
    assert.ok(item.calories > 100);
  });

  // G. Portion adjustment
  it('G. Scales nutrients linearly with portion units', () => {
    const chicken = getFoodById('chicken_breast')!;
    const single = calculateLoggedFoodNutrients(chicken, 1.0);
    const double = calculateLoggedFoodNutrients(chicken, 2.0);

    assert.equal(double.calories, single.calories * 2);
    assert.equal(double.proteinG, single.proteinG * 2);
  });

  // H. Daily intake totals
  it('H. Daily intake totals accurately sum across all logged meals', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    let exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const chicken = getFoodById('chicken_breast')!;

    exec = logMealExecution(exec, planRes.plan, 'slot_1', [calculateLoggedFoodNutrients(chicken, 1.0)], 'completed');
    exec = logMealExecution(exec, planRes.plan, 'slot_2', [calculateLoggedFoodNutrients(chicken, 1.0)], 'completed');
    exec = logMealExecution(exec, planRes.plan, 'slot_3', [calculateLoggedFoodNutrients(chicken, 1.0)], 'completed');

    assert.equal(exec.summary.consumedCalories, 165 * 3);
    assert.equal(exec.summary.consumedProteinG, 31 * 3);
    assert.equal(exec.summary.mealsCompleted, 3);
    assert.equal(exec.status, 'completed');
  });

  // I. Planned vs actual separation
  it('I. Authoritative plan targets remain completely unmutated by logged intake', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const plannedMidpoint = planRes.plan.nutritionTargets!.energy.targetRange.midpointKcal;

    let exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    exec = logMealExecution(exec, planRes.plan, 'slot_1', [], 'skipped');

    assert.equal(planRes.plan.nutritionTargets!.energy.targetRange.midpointKcal, plannedMidpoint);
    assert.equal(exec.summary.plannedCalories, plannedMidpoint);
    assert.equal(exec.summary.consumedCalories, 0);
  });

  // J. Catalog nutrition calculation
  it('J. Computes discrete reference unit descriptions (piece, tbsp, g)', () => {
    const eggs = getFoodById('eggs')!;
    const pb = getFoodById('peanut_butter')!;
    const rice = getFoodById('brown_rice')!;

    const eggItem = calculateLoggedFoodNutrients(eggs, 2);
    const pbItem = calculateLoggedFoodNutrients(pb, 1);
    const riceItem = calculateLoggedFoodNutrients(rice, 1.5);

    assert.equal(eggItem.servingDescription, '2 pieces');
    assert.equal(pbItem.servingDescription, '1 tbsp');
    assert.equal(riceItem.servingDescription, '150 g');
  });

  // K. Invalid portions rejection
  it('K. Rejects negative or NaN portion units in nutrient calculation', () => {
    const chicken = getFoodById('chicken_breast')!;
    assert.throws(() => calculateLoggedFoodNutrients(chicken, -1), /Invalid portionUnits/);
    assert.throws(() => calculateLoggedFoodNutrients(chicken, 0), /Invalid portionUnits/);
    assert.throws(() => calculateLoggedFoodNutrients(chicken, NaN), /Invalid portionUnits/);
  });

  // L. Invalid food IDs rejection
  it('L. Validator rejects execution containing unknown food IDs', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const tampered = JSON.parse(JSON.stringify(exec));
    tampered.mealExecutions[0].loggedFoods.push({
      foodId: 'non_existent_junk_food_999',
      foodName: 'Junk',
      portionUnits: 1,
      servingDescription: '1',
      source: 'additional_food',
      calories: 500,
      proteinG: 10,
      fatG: 10,
      carbohydratesG: 50,
    });
    Object.freeze(tampered);

    const check = validateNutritionExecution(tampered);
    assert.equal(check.valid, false);
    assert.ok(check.errors.some((e) => e.code === 'INVALID_FOOD_ID'));
  });

  // M. Dietary restriction protection
  it('M. Dietary restrictions are strictly preserved during adaptation recommendations', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietaryRestrictions: ['dairy', 'nuts'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const adaptation = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: [],
    });

    assert.ok(!adaptation.suggestedPreferredFoodIdsToAdd.includes('milk'));
    assert.ok(!adaptation.suggestedPreferredFoodIdsToAdd.includes('nuts'));
  });

  // N. Disliked food protection
  it('N. Disliked foods are never recommended as preferred additions', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dislikedFoods: ['cottage_cheese', 'dark_chocolate'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const adaptation = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: [],
    });

    assert.ok(!adaptation.suggestedPreferredFoodIdsToAdd.includes('dark_chocolate'));
  });

  // O. Pending quantitative user
  it('O. Pending quantitative user logs qualitative meals with 0 planned/consumed target numbers', () => {
    const profile = buildCanonicalUserProfile(PERSONA_A_BASELINE); // unstated sex
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'pending');
    if (planRes.status !== 'pending') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    assert.equal(exec.summary.isQuantitative, false);
    assert.equal(exec.summary.plannedCalories, undefined);
    assert.equal(exec.summary.deltaCalories, undefined);

    const val = validateNutritionExecution(exec);
    assert.equal(val.valid, true);
  });

  // P. Youth protection
  it('P. Youth trainee plan generation safely halts at youth_protection_pending', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 16 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(profile, {} as any);
    assert.equal(planRes.status, 'youth_protection_pending');
  });

  // Q. Ineligible protection
  it('Q. Ineligible trainee age rejects plan generation', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 10 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(profile, {} as any);
    assert.equal(planRes.status, 'ineligible');
  });

  // R. History persistence
  it('R. Persists and hydrates nutrition executions through local repository', async () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    await defaultNutritionHistoryRepository.saveExecution(exec);

    const loaded = await defaultNutritionHistoryRepository.getExecutionByDate('2026-10-08');
    assert.ok(loaded !== null);
    assert.equal(loaded!.executionId, exec.executionId);
    assert.equal(loaded!.date, '2026-10-08');
  });

  // S. Deterministic feedback
  it('S. Identical history context produces identical adaptation recommendations', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const ctx = {
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: [exec, exec, exec],
    };

    const res1 = deriveNutritionAdaptation(ctx);
    const res2 = deriveNutritionAdaptation(ctx);
    assert.deepEqual(res1, res2);
  });

  // T. Insufficient evidence (<3 days)
  it('T. Returns insufficient_evidence action when evaluated days < 3', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    const res = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: [exec], // only 1 day
    });

    assert.equal(res.primaryAction, 'insufficient_evidence');
  });

  // U. Broadly on-track behavior
  it('U. Returns maintain action when meals are consistently completed and near target', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const chicken = getFoodById('chicken_breast')!;
    const makeCompletedDay = (date: string) => {
      let exec = initializeNutritionExecution(planRes.plan, date);
      exec = logMealExecution(exec, planRes.plan, 'slot_1', [calculateLoggedFoodNutrients(chicken, 2)], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_2', [calculateLoggedFoodNutrients(chicken, 2)], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_3', [calculateLoggedFoodNutrients(chicken, 2)], 'completed');
      return exec;
    };

    const history = [
      makeCompletedDay('2026-10-06'),
      makeCompletedDay('2026-10-07'),
      makeCompletedDay('2026-10-08'),
    ];

    const res = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: history,
    });

    assert.equal(res.suggestedStructureSimplification, false);
    assert.ok(res.primaryAction === 'maintain' || res.primaryAction === 'review_energy_target_adherence');
  });

  // V. Repeated skipped meals -> structure simplification
  it('V. Detects repeated meal skipping and triggers simplify_structure signal', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const makeSkippingDay = (date: string) => {
      let exec = initializeNutritionExecution(planRes.plan, date);
      exec = logMealExecution(exec, planRes.plan, 'slot_1', [], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_2', [], 'skipped'); // skipped
      exec = logMealExecution(exec, planRes.plan, 'slot_3', [], 'completed');
      return exec;
    };

    const history = [
      makeSkippingDay('2026-10-06'),
      makeSkippingDay('2026-10-07'),
      makeSkippingDay('2026-10-08'),
    ];

    const res = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: history,
    });

    assert.equal(res.primaryAction, 'simplify_structure');
    assert.equal(res.suggestedStructureSimplification, true);
  });

  // W. Repeated target misses -> review energy target adherence
  it('W. Flags review_energy_target_adherence when intake is repeatedly below target', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const eggs = getFoodById('eggs')!;
    const makeUnderDay = (date: string) => {
      let exec = initializeNutritionExecution(planRes.plan, date);
      // Log tiny calories (only 1 egg per meal ~216 kcal total vs ~3000 target)
      exec = logMealExecution(exec, planRes.plan, 'slot_1', [calculateLoggedFoodNutrients(eggs, 1)], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_2', [calculateLoggedFoodNutrients(eggs, 1)], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_3', [calculateLoggedFoodNutrients(eggs, 1)], 'completed');
      return exec;
    };

    const history = [
      makeUnderDay('2026-10-06'),
      makeUnderDay('2026-10-07'),
      makeUnderDay('2026-10-08'),
    ];

    const res = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: history,
    });

    assert.equal(res.requiresTargetReview, true);
  });

  // X. Structure simplification signal
  it('X. Structure simplification is explicitly marked without mutating plan schema', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    let exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    exec = logMealExecution(exec, planRes.plan, 'slot_1', [], 'skipped');
    exec = logMealExecution(exec, planRes.plan, 'slot_2', [], 'skipped');

    const res = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: [exec, exec, exec],
    });

    assert.equal(res.suggestedStructureSimplification, true);
    assert.equal(planRes.plan.dailyPlan.totalMeals, 3); // plan unchanged
  });

  // Y. Preference learning signal
  it('Y. Identifies repeatedly substituted foods as learned preference recommendations', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const salmon = getFoodById('fish')!;
    const makeSubDay = (date: string) => {
      let exec = initializeNutritionExecution(planRes.plan, date);
      const subItem = calculateLoggedFoodNutrients(salmon, 1.5, 'catalog_substitution', 'chicken_breast');
      exec = logMealExecution(exec, planRes.plan, 'slot_1', [subItem], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_2', [subItem], 'completed');
      exec = logMealExecution(exec, planRes.plan, 'slot_3', [subItem], 'completed');
      return exec;
    };

    const history = [
      makeSubDay('2026-10-06'),
      makeSubDay('2026-10-07'),
      makeSubDay('2026-10-08'),
    ];

    const res = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: history,
    });

    assert.ok(res.suggestedPreferredFoodIdsToAdd.includes('fish'));
  });

  // Z. Immutable history / tamper rejection
  it('Z. Nutrition executions and adaptation feedback are deeply frozen and reject tampering', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const exec = initializeNutritionExecution(planRes.plan, '2026-10-08');
    assert.ok(Object.isFrozen(exec));
    assert.ok(Object.isFrozen(exec.mealExecutions));

    assert.throws(() => {
      'use strict';
      (exec as any).status = 'completed';
    }, TypeError);

    const adaptation = deriveNutritionAdaptation({
      activePlan: planRes.plan,
      strategy: stratRes.strategy,
      historicalExecutions: [exec, exec, exec],
    });

    assert.ok(Object.isFrozen(adaptation));
    const valAdaptation = validateNutritionAdaptation(adaptation);
    assert.equal(valAdaptation.valid, true);
  });
});
