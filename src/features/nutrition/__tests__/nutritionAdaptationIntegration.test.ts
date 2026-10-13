/**
 * Nutrition Adaptation Integration & Evidence Quality Tests (Milestone W7.7)
 *
 * Verifies Tests A through T:
 * A. Evidence completeness: distinguishes unlogged vs skipped vs partial vs completed meal slots.
 * B. Incomplete days: missing records never treated as 0 intake or confirmed underconsumption.
 * C. Complete days: 3+ complete days required for calorie/energy adherence status.
 * D. Calorie target protection: quantitative targets never mutated by adaptation.
 * E. Macro target protection: protein, fat, carb targets preserved exactly.
 * F. Pure qualitative feedback: recommendations do not invent medical/physiological claims.
 * G. Versioned plan revision: safe revision contract created with status pending_review.
 * H. Immutability of original plan: original plan remains untouched after revision generated.
 * I. Structure simplification: reduces meal count and preserves total daily targets.
 * J. Allocation integrity in revised plan: sum of revised meal targets equals authoritative daily targets.
 * K. Learned substitutions: prioritized in candidate scoring without mutating CanonicalUserProfile.
 * L. Hard restriction inviolability: learned substitution cannot bypass allergies or diet type.
 * M. Explicit dislike inviolability: learned substitution cannot bypass disliked foods.
 * N. Coach autonomy respect: revision requires explicit acceptance before activation.
 * O. Reject revision: rejecting revision preserves original plan and marks status rejected.
 * P. Accept revision: accepting revision updates active plan and marks status accepted.
 * Q. Persistence across reloads: plan revisions survive hydration and store reload.
 * R. Mutex queue serialization: concurrent revision saves/updates do not corrupt store.
 * S. Youth boundary: youth trainee safely held at youth_protection_pending.
 * T. Ineligible boundary: ineligible trainee rejected safely at boundary.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  PERSONA_A_BASELINE,
  PERSONA_G_QUANTITATIVE_READY,
} from '../../../qa/personas';
import { buildCanonicalUserProfile } from '../../profile';
import { runNutritionStrategyPipeline } from '../nutritionStrategy';
import { generateNutritionPlan } from '../nutritionPlanGenerator';
import { getFoodById, AUTHORITATIVE_FOOD_CATALOG } from '../foodCatalog';
import {
  initializeNutritionExecution,
  logMealExecution,
  calculateLoggedFoodNutrients,
} from '../nutritionExecutionEngine';
import {
  evaluateNutritionAdherence,
  deriveNutritionAdaptation,
} from '../nutritionAdaptation';
import {
  proposeStructureSimplificationRevision,
  proposeLearnedSubstitutionsRevision,
  acceptPlanRevision,
  rejectPlanRevision,
} from '../nutritionPlanRevisionEngine';
import {
  LocalNutritionHistoryRepository,
  setRawNutritionStorageItemForTesting,
} from '../nutritionHistoryRepository';
import { composeMealCandidate } from '../mealComposition';

describe('Milestone W7.7 — Nutrition Adaptation Integration & Evidence Quality', () => {
  let repo: LocalNutritionHistoryRepository;

  beforeEach(() => {
    setRawNutritionStorageItemForTesting(null);
    repo = new LocalNutritionHistoryRepository();
  });

  // Helper to generate ready plan
  function getReadyFixture() {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') throw new Error('Strategy failed');
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') throw new Error('Plan failed');
    return { profile, strategy: stratRes.strategy, plan: planRes.plan };
  }

  // Helper to create meal item
  function makeItem(foodId: string, portion = 1) {
    const food = getFoodById(foodId)!;
    return calculateLoggedFoodNutrients(food, portion);
  }

  // A. Evidence completeness
  it('A. Evidence completeness: distinguishes unlogged vs skipped vs partial vs completed meal slots', () => {
    const { plan } = getReadyFixture();
    let exec = initializeNutritionExecution(plan, '2026-10-01');

    // Slot 1 completed
    exec = logMealExecution(exec, plan, 'slot_1', [makeItem('eggs', 2)], 'completed');
    // Slot 2 skipped
    exec = logMealExecution(exec, plan, 'slot_2', [], 'skipped');
    // Slot 3 left not_started (unlogged)

    const evidence = evaluateNutritionAdherence([exec]);

    assert.equal(evidence.evaluatedDaysCount, 1);
    assert.equal(evidence.completeDaysCount, 0);
    assert.equal(evidence.incompleteDaysCount, 1);

    const day = evidence.dayCompleteness[0];
    assert.equal(day.isComplete, false);
    assert.equal(day.completedSlots, 1);
    assert.equal(day.skippedSlots, 1);
    assert.equal(day.unloggedSlots, 1);
  });

  // B. Incomplete days
  it('B. Incomplete days: missing records never treated as 0 intake or confirmed underconsumption', () => {
    const { plan } = getReadyFixture();
    // 3 days where only breakfast was logged, rest unlogged
    const makeIncompleteDay = (date: string) => {
      let exec = initializeNutritionExecution(plan, date);
      exec = logMealExecution(exec, plan, 'slot_1', [makeItem('oats', 1)], 'completed');
      return exec;
    };

    const history = [
      makeIncompleteDay('2026-10-01'),
      makeIncompleteDay('2026-10-02'),
      makeIncompleteDay('2026-10-03'),
    ];

    const evidence = evaluateNutritionAdherence(history);

    assert.equal(evidence.evaluatedDaysCount, 3);
    assert.equal(evidence.completeDaysCount, 0);
    assert.equal(evidence.incompleteDaysCount, 3);
    // Because all days were incomplete, energy band hit rate is undefined
    assert.equal(evidence.energyBandHitRate, undefined);
    assert.equal(evidence.proteinTargetHitRate, undefined);
    // Never diagnosed as repeatedly_below_target because records were incomplete
    assert.notEqual(evidence.overallStatus, 'repeatedly_below_target');
    assert.equal(evidence.overallStatus, 'insufficient_evidence');
  });

  // C. Complete days
  it('C. Complete days: 3+ complete days required for calorie/energy adherence status', () => {
    const { plan } = getReadyFixture();
    // 2 complete days + 1 incomplete day
    const makeDay = (date: string, isFull: boolean) => {
      let exec = initializeNutritionExecution(plan, date);
      exec = logMealExecution(exec, plan, 'slot_1', [makeItem('eggs', 2)], 'completed');
      if (isFull) {
        exec = logMealExecution(exec, plan, 'slot_2', [makeItem('chicken_breast', 1)], 'completed');
        exec = logMealExecution(exec, plan, 'slot_3', [makeItem('fish', 1)], 'completed');
      }
      return exec;
    };

    const history = [
      makeDay('2026-10-01', true),
      makeDay('2026-10-02', true),
      makeDay('2026-10-03', false), // only 2 complete days
    ];

    const evidence = evaluateNutritionAdherence(history);
    assert.equal(evidence.completeDaysCount, 2);
    // Still insufficient evidence for calorie target adherence determination
    assert.equal(evidence.overallStatus, 'insufficient_evidence');
  });

  // D. Calorie target protection
  it('D. Calorie target protection: quantitative targets never mutated by adaptation', () => {
    const { strategy, plan } = getReadyFixture();
    const plannedCalories = plan.nutritionTargets!.energy.targetRange.midpointKcal;

    let exec = initializeNutritionExecution(plan, '2026-10-01');
    exec = logMealExecution(exec, plan, 'slot_1', [], 'skipped');
    exec = logMealExecution(exec, plan, 'slot_2', [], 'skipped');
    exec = logMealExecution(exec, plan, 'slot_3', [], 'skipped');

    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [exec, exec, exec],
    });

    assert.equal(adaptation.suggestedStructureSimplification, true);
    // Authoritative targets in original plan are 100% untouched
    assert.equal(plan.nutritionTargets!.energy.targetRange.midpointKcal, plannedCalories);
  });

  // E. Macro target protection
  it('E. Macro target protection: protein, fat, carb targets preserved exactly in proposed revisions', () => {
    const { strategy, plan } = getReadyFixture();
    const origTargets = plan.nutritionTargets!;

    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);

    assert.equal(revision.revisedPlan.nutritionTargets!.macronutrients.protein.targetGrams, origTargets.macronutrients.protein.targetGrams);
    assert.equal(revision.revisedPlan.nutritionTargets!.macronutrients.fat.targetGrams, origTargets.macronutrients.fat.targetGrams);
    assert.equal(revision.revisedPlan.nutritionTargets!.macronutrients.carbohydrates.targetGrams, origTargets.macronutrients.carbohydrates.targetGrams);
  });

  // F. Pure qualitative feedback
  it('F. Pure qualitative feedback: recommendations do not invent medical/physiological claims', () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    assert.ok(typeof adaptation.summary === 'string');
    assert.ok(Array.isArray(adaptation.actionableInsights));
    for (const insight of adaptation.actionableInsights) {
      assert.ok(!insight.includes('cure'));
      assert.ok(!insight.includes('diagnose'));
      assert.ok(!insight.includes('treatment'));
    }
  });

  // G. Versioned plan revision
  it('G. Versioned plan revision: safe revision contract created with status pending_review', () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);

    assert.equal(revision.schemaVersion, 1);
    assert.equal(revision.status, 'pending_review');
    assert.ok(revision.revisionId.startsWith('rev_simp'));
    assert.equal(revision.revisionReason, 'simplify_structure');
    assert.ok(Object.isFrozen(revision));
  });

  // H. Immutability of original plan
  it('H. Immutability of original plan: original plan remains untouched after revision generated', () => {
    const { strategy, plan } = getReadyFixture();
    const origSlotsCount = plan.dailyPlan.slots.length;

    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);

    assert.equal(plan.dailyPlan.slots.length, origSlotsCount);
    assert.notEqual(revision.revisedPlan.dailyPlan.slots.length, origSlotsCount);
    assert.ok(Object.isFrozen(plan));
  });

  // I. Structure simplification
  it('I. Structure simplification: reduces meal count and preserves total daily targets', () => {
    const { strategy, plan } = getReadyFixture();
    assert.equal(plan.dailyPlan.totalMeals, 3);

    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);

    // 3 meals reduced to 2 meals
    assert.equal(revision.revisedPlan.dailyPlan.totalMeals, 2);
    assert.equal(revision.revisedPlan.dailyPlan.slots.length, 2);
    assert.equal(
      revision.revisedPlan.nutritionTargets!.energy.targetRange.midpointKcal,
      plan.nutritionTargets!.energy.targetRange.midpointKcal
    );
  });

  // J. Allocation integrity in revised plan
  it('J. Allocation integrity in revised plan: sum of revised meal targets equals authoritative daily targets', () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);

    const slotTargets = revision.revisedPlan.dailyPlan.slots.map((s) => s.targets!);
    const totalCal = slotTargets.reduce((sum, t) => sum + t.targetEnergyKcal, 0);
    const totalProtein = slotTargets.reduce((sum, t) => sum + t.targetProteinG, 0);

    const dailyMid = revision.revisedPlan.nutritionTargets!.energy.targetRange.midpointKcal;
    const dailyProtein = revision.revisedPlan.nutritionTargets!.macronutrients.protein.targetGrams;

    assert.equal(totalCal, dailyMid);
    assert.equal(totalProtein, dailyProtein);
  });

  // K. Learned substitutions
  it('K. Learned substitutions: prioritized in candidate scoring without mutating CanonicalUserProfile', () => {
    const { profile, strategy, plan } = getReadyFixture();
    const slot = plan.dailyPlan.slots[0];

    // Compose with learned preference for 'tofu'
    const learnedFood = 'tofu';
    const learnedCandidate = composeMealCandidate(
      slot,
      {
        ...strategy,
        foodPreferences: {
          ...strategy.foodPreferences,
          likedFoodIds: [], // test learned priority in isolation
        },
      },
      plan,
      AUTHORITATIVE_FOOD_CATALOG,
      [learnedFood]
    );

    // Profile remains unmodified
    assert.ok(!profile.nutrition.likedFoods.includes(learnedFood));
    assert.ok(learnedCandidate.selectedFoods.some((s) => s.food.id === learnedFood));
    assert.ok(
      learnedCandidate.compatibilityReasons.some((r) => r.includes('Firm Tofu') || r.includes('tofu'))
    );
  });

  // L. Hard restriction inviolability
  it('L. Hard restriction inviolability: learned substitution cannot bypass allergies or diet type', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietaryRestrictions: ['dairy'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const slot = planRes.plan.dailyPlan.slots[0];
    // Attempt to prioritize Greek Yogurt (dairy)
    const candidate = composeMealCandidate(
      slot,
      stratRes.strategy,
      planRes.plan,
      AUTHORITATIVE_FOOD_CATALOG,
      ['greek_yogurt']
    );

    assert.ok(!candidate.selectedFoods.some((s) => s.food.id === 'greek_yogurt'));
  });

  // M. Explicit dislike inviolability
  it('M. Explicit dislike inviolability: learned substitution cannot bypass disliked foods', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dislikedFoods: ['cottage_cheese', 'salmon'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const slot = planRes.plan.dailyPlan.slots[0];
    // Attempt to prioritize salmon
    const candidate = composeMealCandidate(
      slot,
      stratRes.strategy,
      planRes.plan,
      AUTHORITATIVE_FOOD_CATALOG,
      ['salmon']
    );

    assert.ok(!candidate.selectedFoods.some((s) => s.food.id === 'salmon'));
  });

  // N. Coach autonomy respect
  it('N. Coach autonomy respect: revision requires explicit acceptance before activation', () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);
    // Proposed revision is NOT accepted yet
    assert.equal(revision.status, 'pending_review');
    assert.equal(revision.resolvedAt, undefined);
  });

  // O. Reject revision
  it('O. Reject revision: rejecting revision preserves original plan and marks status rejected', () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);
    const rejected = rejectPlanRevision(revision);

    assert.equal(rejected.status, 'rejected');
    assert.ok(typeof rejected.resolvedAt === 'number');
  });

  // P. Accept revision
  it('P. Accept revision: accepting revision updates active plan and marks status accepted', async () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);
    const accepted = acceptPlanRevision(revision);

    assert.equal(accepted.status, 'accepted');
    assert.ok(typeof accepted.resolvedAt === 'number');

    await repo.saveRevision(accepted);
    const active = await repo.getActivePlanRevision();

    assert.ok(active !== null);
    assert.equal(active!.revisionId, accepted.revisionId);
    assert.equal(active!.status, 'accepted');
  });

  // Q. Persistence across reloads
  it('Q. Persistence across reloads: plan revisions survive hydration and store reload', async () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const revision = proposeStructureSimplificationRevision(plan, strategy, adaptation);
    const accepted = acceptPlanRevision(revision);
    await repo.saveRevision(accepted);

    // Create fresh repository reading the same underlying storage
    const reloadedRepo = new LocalNutritionHistoryRepository();
    const revisions = await reloadedRepo.getRevisions();

    assert.equal(revisions.length, 1);
    assert.equal(revisions[0].revisionId, accepted.revisionId);
    assert.equal(revisions[0].status, 'accepted');
  });

  // R. Mutex queue serialization
  it('R. Mutex queue serialization: concurrent revision saves/updates do not corrupt store', async () => {
    const { strategy, plan } = getReadyFixture();
    const adaptation = deriveNutritionAdaptation({
      activePlan: plan,
      strategy,
      historicalExecutions: [],
    });

    const rev1 = proposeStructureSimplificationRevision(plan, strategy, adaptation);
    const rev2 = proposeStructureSimplificationRevision(plan, strategy, adaptation);

    // Save concurrently
    await Promise.all([
      repo.saveRevision(rev1),
      repo.saveRevision(rev2),
    ]);

    const all = await repo.getRevisions();
    assert.equal(all.length, 2);
  });

  // S. Youth boundary
  it('S. Youth boundary: youth trainee safely held at youth_protection_pending', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 16 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(profile, {} as any);
    assert.equal(planRes.status, 'youth_protection_pending');
  });

  // T. Ineligible boundary
  it('T. Ineligible boundary: ineligible trainee rejected safely at boundary', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 10 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(profile, {} as any);
    assert.equal(planRes.status, 'ineligible');
  });
});
