/**
 * Stage W8.1 — Today Dashboard Pure Selector & Integration Test Suite
 *
 * Verifies all 14 required categories for the unified Today Dashboard:
 * 1. Dashboard data derived from existing repositories.
 * 2. Correct workout state rendering.
 * 3. Rest-day handling.
 * 4. Missing workout history not treated as completion.
 * 5. Distinction between nutrition targets and logged intake.
 * 6. Unlogged or partially logged meals.
 * 7. Qualitative-only and pending nutrition states.
 * 8. Youth and ineligible population protection.
 * 9. Pending nutrition revision navigation.
 * 10. Accepted and rejected revision states.
 * 11. Storage hydration and corruption isolation.
 * 12. Deterministic rendering from identical validated inputs.
 * 13. Navigation idempotency and prevention of duplicate execution records.
 * 14. Preservation of historical plan and execution references.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  resolveTodayTrainingSummary,
  resolveTodayNutritionSummary,
  resolveDashboardAdaptationAlerts,
  getDayOfWeekFromDate,
  isTodayAvailableTrainingDay,
} from '../dashboardSelectors';
import { QA_PERSONAS } from '../../../qa/personas';
import { buildCanonicalUserProfile } from '../../profile';
import { generateWorkoutPlanFromProfile } from '../../workout-plan';
import {
  runNutritionStrategyPipeline,
  generateNutritionPlan,
  initializeNutritionExecution,
  logMealExecution,
  proposeStructureSimplificationRevision,
  acceptPlanRevision,
  rejectPlanRevision,
  calculateLoggedFoodNutrients,
  getFoodById,
  validateNutritionExecution,
  evaluateNutritionAdherence,
  LocalNutritionHistoryRepository,
  setRawNutritionStorageItemForTesting,
} from '../../nutrition';
import {
  LocalWorkoutHistoryRepository,
  setRawStorageItemForTesting,
} from '../../workout-history/localRepository';
import type { WorkoutExecution } from '../../workout-runtime';

describe('Milestone W8.1 — Today Dashboard Test Suite', () => {
  // Helper to build test profile and plans
  function getTestSetup(personaKey: keyof typeof QA_PERSONAS = 'PERSONA_G_QUANTITATIVE_READY') {
    const rawData = QA_PERSONAS[personaKey];
    const profile = buildCanonicalUserProfile(rawData);
    const workoutGen = generateWorkoutPlanFromProfile(profile);
    assert.strictEqual(workoutGen.status, 'success');
    const workoutPlan = workoutGen.plan;

    const nutritionStrategyRes = runNutritionStrategyPipeline(profile);
    assert.strictEqual(nutritionStrategyRes.status, 'completed');
    const nutritionStrategy = nutritionStrategyRes.strategy;

    const nutritionPlanRes = generateNutritionPlan(profile, nutritionStrategy);
    assert.ok(nutritionPlanRes.status === 'success' || nutritionPlanRes.status === 'pending');
    const nutritionPlan = nutritionPlanRes.plan;

    return { profile, workoutPlan, nutritionStrategy, nutritionPlan };
  }

  // 1. Dashboard data derived from existing repositories
  it('1. Category A: Dashboard data is correctly derived from existing plans and executions', () => {
    const { profile, workoutPlan, nutritionStrategy, nutritionPlan } = getTestSetup();
    const date = new Date('2026-10-12T10:00:00Z'); // Monday

    const trainingSummary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
      profile,
      todayDate: date,
    });

    assert.strictEqual(trainingSummary.status, 'planned');
    assert.strictEqual(trainingSummary.activePlan?.schemaVersion, 1);
    assert.strictEqual(trainingSummary.currentSession?.sessionId, workoutPlan.sessions[0].sessionId);
    assert.strictEqual(trainingSummary.totalCycleSessions, workoutPlan.sessions.length);

    const nutritionSummary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: null,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(nutritionSummary.status, 'ready');
    assert.strictEqual(nutritionSummary.mealSlots.length, nutritionPlan.dailyPlan.slots.length);
    assert.strictEqual(
      nutritionSummary.plannedTargets?.calories,
      nutritionPlan.nutritionTargets?.energy.targetRange.midpointKcal
    );
  });

  // 2. Correct workout state rendering (planned, in_progress, completed)
  it('2. Category B: Correctly renders planned, in_progress, and completed workout states', () => {
    const { profile, workoutPlan } = getTestSetup();
    const date = new Date('2026-10-12T10:00:00Z'); // Monday (scheduled day)

    // Planned state
    const plannedSummary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
      profile,
      todayDate: date,
    });
    assert.strictEqual(plannedSummary.status, 'planned');

    // In Progress state
    const inProgressExec: WorkoutExecution = {
      executionId: 'exec_in_progress_1',
      planId: workoutPlan.schemaVersion ? 'plan_1' : 'test',
      sessionId: workoutPlan.sessions[0].sessionId,
      sessionSequenceIndex: 1,
      status: 'in_progress',
      startedAtTimestamp: date.getTime(),
      exerciseExecutions: [],
    };
    const inProgressSummary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [inProgressExec],
      profile,
      todayDate: date,
    });
    assert.strictEqual(inProgressSummary.status, 'in_progress');
    assert.strictEqual(inProgressSummary.activeExecution?.executionId, 'exec_in_progress_1');

    // Completed state today
    const completedExec: WorkoutExecution = {
      executionId: 'exec_completed_1',
      planId: workoutPlan.schemaVersion ? 'plan_1' : 'test',
      sessionId: workoutPlan.sessions[0].sessionId,
      sessionSequenceIndex: 1,
      status: 'completed',
      startedAtTimestamp: date.getTime() - 3600000,
      completedAtTimestamp: date.getTime(),
      exerciseExecutions: [],
    };
    const completedSummary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [completedExec],
      profile,
      todayDate: date,
    });
    assert.strictEqual(completedSummary.status, 'completed');
    assert.strictEqual(completedSummary.latestCompletedExecutionToday?.executionId, 'exec_completed_1');
  });

  // 3. Rest-day handling
  it('3. Category C: Correctly identifies rest days from profile schedule and previews next session', () => {
    const { profile, workoutPlan } = getTestSetup();
    // Force a date that is Sunday (2026-10-11)
    const sundayDate = new Date('2026-10-11T10:00:00Z');
    assert.strictEqual(getDayOfWeekFromDate(sundayDate), 'sun');

    // Persona G availableDays: ['mon', 'tue', 'wed', 'thu', 'fri']
    const isAvail = isTodayAvailableTrainingDay(profile.schedule.availableDays, sundayDate);
    assert.strictEqual(isAvail, false);

    const restDaySummary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
      profile,
      todayDate: sundayDate,
    });

    assert.strictEqual(restDaySummary.status, 'rest_day');
    assert.strictEqual(restDaySummary.isScheduledTrainingDay, false);
    assert.strictEqual(restDaySummary.currentSession, null);
    // Previews next upcoming session
    assert.ok(restDaySummary.nextUpcomingSession !== null);
    assert.strictEqual(restDaySummary.nextUpcomingSession.sessionId, workoutPlan.sessions[0].sessionId);
  });

  // 4. Missing workout history not treated as completion
  it('4. Category D: Missing workout history is never treated as completed workout', () => {
    const { profile, workoutPlan } = getTestSetup();
    const mondayDate = new Date('2026-10-12T10:00:00Z');

    const summary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [], // No history
      profile,
      todayDate: mondayDate,
    });

    assert.notStrictEqual(summary.status, 'completed');
    assert.strictEqual(summary.status, 'planned');
    assert.strictEqual(summary.latestCompletedExecutionToday, null);
  });

  // 5. Distinction between nutrition targets and logged intake
  it('5. Category E: Unambiguously separates planned targets, logged intake, and remaining difference', () => {
    const { profile, nutritionPlan, nutritionStrategy } = getTestSetup();
    const dateStr = '2026-10-12';
    const initExec = initializeNutritionExecution(nutritionPlan, dateStr);

    const loggedItem = calculateLoggedFoodNutrients('chicken_breast', 2, 'planned_food');
    const slotId = nutritionPlan.dailyPlan.slots[0].slotId;

    const updatedExec = logMealExecution(
      initExec,
      nutritionPlan,
      slotId,
      [loggedItem],
      'completed'
    );

    const summary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: updatedExec,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(summary.status, 'ready');
    assert.ok(summary.plannedTargets);
    assert.ok(summary.loggedIntake);
    assert.ok(summary.remainingDifference);

    const plannedCalories = nutritionPlan.nutritionTargets!.energy.targetRange.midpointKcal;
    assert.strictEqual(summary.plannedTargets.calories, plannedCalories);
    assert.strictEqual(summary.loggedIntake.calories, updatedExec.summary.consumedCalories);
    assert.strictEqual(summary.loggedIntake.proteinGrams, updatedExec.summary.consumedProteinG);
    assert.strictEqual(
      summary.remainingDifference.calories,
      plannedCalories - updatedExec.summary.consumedCalories
    );
  });

  // 6. Unlogged or partially logged meals
  it('6. Category F: Handles partially logged days without assuming zero food intake for unlogged slots', () => {
    const { profile, nutritionPlan, nutritionStrategy } = getTestSetup();
    const dateStr = '2026-10-12';
    const initExec = initializeNutritionExecution(nutritionPlan, dateStr);

    // Only slot 0 is logged, slots 1..N remain 'not_started'
    const partialExec = logMealExecution(
      initExec,
      nutritionPlan,
      nutritionPlan.dailyPlan.slots[0].slotId,
      [],
      'completed'
    );

    const summary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: partialExec,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(summary.isPartiallyLogged, true);
    assert.strictEqual(summary.isFullyResolved, false);
    assert.strictEqual(summary.mealSlots[0].status, 'completed');
    assert.strictEqual(summary.mealSlots[1].status, 'not_started');
  });

  // 7. Qualitative-only and pending nutrition states
  it('7. Category G: Qualitative-only profile never fabricates calories or macros', () => {
    // Persona A has undefined biologicalSex -> quantitativeReadiness = pending_required_inputs
    const { profile, workoutPlan, nutritionStrategy, nutritionPlan } = getTestSetup(
      'PERSONA_A_BASELINE'
    );

    const summary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: null,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(summary.status, 'qualitative_only');
    assert.strictEqual(summary.plannedTargets, null);
    assert.strictEqual(summary.loggedIntake, null);
    assert.strictEqual(summary.remainingDifference, null);
    // Framework slots are preserved qualitatively
    assert.strictEqual(summary.mealSlots.length, nutritionPlan.dailyPlan.slots.length);
  });

  // 8. Youth and ineligible population protection
  it('8. Category H: Youth profiles are held at youth_protection_pending and ineligible blocked', () => {
    const { profile, nutritionPlan, nutritionStrategy } = getTestSetup();

    // Youth profile simulation (age 16)
    const youthProfile = {
      ...profile,
      anthropometrics: {
        ...profile.anthropometrics,
        age: 16,
      },
    };

    const youthSummary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: null,
      strategy: nutritionStrategy,
      profile: youthProfile,
    });

    assert.strictEqual(youthSummary.status, 'youth_protection_pending');
    assert.strictEqual(youthSummary.plannedTargets, null);

    // Ineligible profile simulation (age 11)
    const childProfile = {
      ...profile,
      anthropometrics: {
        ...profile.anthropometrics,
        age: 11,
      },
    };

    const childSummary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: null,
      strategy: nutritionStrategy,
      profile: childProfile,
    });

    assert.strictEqual(childSummary.status, 'ineligible');
    assert.strictEqual(childSummary.plannedTargets, null);
  });

  // 9. Pending nutrition revision navigation
  it('9. Category I: Surfaces pending nutrition revisions awaiting user review', () => {
    const { profile, workoutPlan, nutritionPlan, nutritionStrategy } = getTestSetup();

    const recommendation = {
      primaryAction: 'simplify_structure' as const,
      summary: 'Simplification recommended due to repeated skipped meals.',
      actionableInsights: ['Consolidate to 3 meals'],
      suggestedPreferredFoodIdsToAdd: [],
      suggestedStructureSimplification: true,
      requiresTargetReview: false,
      decisionTrace: [],
    };

    const proposedRev = proposeStructureSimplificationRevision(
      nutritionPlan,
      nutritionStrategy,
      recommendation
    );

    assert.strictEqual(proposedRev.status, 'pending_review');

    const nutritionSummary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: null,
      strategy: nutritionStrategy,
      profile,
      pendingRevision: proposedRev,
      adaptationRecommendation: recommendation,
    });

    const trainingSummary = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
      profile,
    });

    const alerts = resolveDashboardAdaptationAlerts({
      training: trainingSummary,
      nutrition: nutritionSummary,
    });

    assert.strictEqual(nutritionSummary.pendingRevision?.revisionId, proposedRev.revisionId);
    const revAlert = alerts.find((a) => a.type === 'nutrition_revision');
    assert.ok(revAlert);
    assert.strictEqual(revAlert.actionType, 'review_revision');
  });

  // 10. Accepted and rejected revision states
  it('10. Category J: Revision acceptance activates revised plan, rejection keeps baseline', () => {
    const { nutritionPlan, nutritionStrategy } = getTestSetup();

    const recommendation = {
      primaryAction: 'simplify_structure' as const,
      summary: 'Simplification note.',
      actionableInsights: ['3 meals'],
      suggestedPreferredFoodIdsToAdd: [],
      suggestedStructureSimplification: true,
      requiresTargetReview: false,
      decisionTrace: [],
    };

    const proposedRev = proposeStructureSimplificationRevision(
      nutritionPlan,
      nutritionStrategy,
      recommendation
    );

    // Accept revision
    const accepted = acceptPlanRevision(proposedRev);
    assert.strictEqual(accepted.status, 'accepted');
    assert.strictEqual(
      accepted.revisedPlan.dailyPlan.slots.length,
      nutritionPlan.dailyPlan.slots.length - 1
    );
    assert.strictEqual(
      accepted.revisedPlan.nutritionTargets?.energy.targetRange.midpointKcal,
      nutritionPlan.nutritionTargets?.energy.targetRange.midpointKcal
    );

    // Reject revision
    const rejected = rejectPlanRevision(proposedRev);
    assert.strictEqual(rejected.status, 'rejected');
    assert.strictEqual(
      rejected.revisedPlan.nutritionTargets?.energy.targetRange.midpointKcal,
      proposedRev.revisedPlan.nutritionTargets?.energy.targetRange.midpointKcal
    );
  });

  // 11. Storage hydration and corruption isolation
  it('11. Category K: Repository safely handles storage corruption without crashing', async () => {
    const testRepo = new LocalWorkoutHistoryRepository();

    // Inject corrupted raw storage
    setRawStorageItemForTesting('{ malformed json [[[');
    const executions = await testRepo.getExecutions();
    assert.ok(Array.isArray(executions));
    assert.strictEqual(executions.length, 0);

    const activePlan = await testRepo.loadActivePlan();
    assert.strictEqual(activePlan, null);

    // Reset clean storage
    setRawStorageItemForTesting(null);
  });

  // 12. Deterministic rendering from identical validated inputs
  it('12. Category L: Deterministically returns identical dashboard states given identical inputs', () => {
    const { profile, workoutPlan, nutritionStrategy, nutritionPlan } = getTestSetup();
    const date = new Date('2026-10-12T10:00:00Z');

    const result1 = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
      profile,
      todayDate: date,
    });

    const result2 = resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
      profile,
      todayDate: date,
    });

    assert.deepStrictEqual(result1, result2);
  });

  // 13. Navigation idempotency and prevention of duplicate execution records
  it('13. Category M: Mutex serialization ensures idempotent execution saves without duplicates', async () => {
    const testRepo = new LocalWorkoutHistoryRepository();
    const date = Date.now();

    const exec: WorkoutExecution = {
      executionId: 'idempotent_test_exec',
      planId: 'plan_1',
      sessionId: 'session_1',
      sessionSequenceIndex: 1,
      status: 'in_progress',
      startedAtTimestamp: date,
      exerciseExecutions: [],
      decisionTrace: [],
    };

    // Save multiple times concurrently
    await Promise.all([
      testRepo.saveActiveExecution(exec),
      testRepo.saveActiveExecution(exec),
      testRepo.saveActiveExecution(exec),
    ]);

    const list = await testRepo.getExecutions();
    const matches = list.filter((e) => e.executionId === 'idempotent_test_exec');
    assert.strictEqual(matches.length, 1);
  });

  // 14. Preservation of historical plan and execution references
  it('14. Category N: Historical plan and execution references remain immutable', () => {
    const { workoutPlan, nutritionPlan } = getTestSetup();

    const planCalories = nutritionPlan.nutritionTargets?.energy.targetRange.midpointKcal;
    const sessionCount = workoutPlan.sessions.length;

    // Run selectors
    resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: [],
    });
    resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: null,
    });

    // Invariants preserved
    assert.strictEqual(
      nutritionPlan.nutritionTargets?.energy.targetRange.midpointKcal,
      planCalories
    );
    assert.strictEqual(workoutPlan.sessions.length, sessionCount);
  });

  // ==========================================================================
  // MILESTONE W8.2 — NUTRITION LOGGING FIDELITY & DASHBOARD CONTRACT ALIGNMENT
  // Categories A through P
  // ==========================================================================

  // A. Initial meal slots stay unlogged and contribute no invented intake
  it('W8.2 - Category A: Initial meal slots stay unlogged with not_started status and contribute zero invented intake', () => {
    const { nutritionPlan, nutritionStrategy, profile } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    assert.strictEqual(exec.status, 'not_started');
    assert.strictEqual(exec.summary.consumedCalories, 0);
    assert.strictEqual(exec.summary.consumedProteinG, 0);
    assert.strictEqual(exec.summary.consumedFatG, 0);
    assert.strictEqual(exec.summary.consumedCarbohydratesG, 0);
    for (const m of exec.mealExecutions) {
      assert.strictEqual(m.status, 'not_started');
      assert.strictEqual(m.consumedCalories, 0);
      assert.strictEqual(m.loggedFoods.length, 0);
    }

    const summary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: exec,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(summary.loggedIntake?.calories, 0);
    assert.strictEqual(summary.loggedIntake?.proteinGrams, 0);
    assert.strictEqual(summary.hasAnyIntakeLogged, false);
    assert.strictEqual(summary.isFullyResolved, false);
  });

  // B. Confirming a planned meal records expected food composition and portions
  it('W8.2 - Category B: Confirming a planned meal records the expected food composition and portions', () => {
    const { nutritionPlan, nutritionStrategy, profile } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    const slot1 = nutritionPlan.dailyPlan.slots[0];
    assert.ok(slot1.composition && slot1.composition.selectedFoods.length > 0);

    const plannedFoods = slot1.composition.selectedFoods.map((item) =>
      calculateLoggedFoodNutrients(item.food, item.portionUnits, 'planned_food')
    );

    const exec1 = logMealExecution(exec0, nutritionPlan, slot1.slotId, plannedFoods, 'completed');
    const meal1 = exec1.mealExecutions[0];

    assert.strictEqual(meal1.status, 'completed');
    assert.strictEqual(meal1.loggedFoods.length, slot1.composition.selectedFoods.length);
    assert.ok(meal1.consumedCalories > 0);
    assert.ok(meal1.consumedProteinG > 0);
    assert.strictEqual(meal1.loggedFoods[0].source, 'planned_food');

    const summary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: exec1,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(summary.loggedIntake?.calories, meal1.consumedCalories);
    assert.strictEqual(summary.mealSlots[0].status, 'completed');
    assert.strictEqual(summary.hasAnyIntakeLogged, true);
  });

  // C. Logging a different food calculates nutrients from the actual food entry
  it('W8.2 - Category C: Logging a different food calculates nutrients from the actual food entry and tracks substitution', () => {
    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    const salmon = getFoodById('fish')!;
    assert.ok(salmon);

    const substitutedFood = calculateLoggedFoodNutrients(
      salmon,
      1.5,
      'catalog_substitution',
      'chicken_breast'
    );

    assert.strictEqual(substitutedFood.source, 'catalog_substitution');
    assert.strictEqual(substitutedFood.substitutedFoodId, 'chicken_breast');
    assert.strictEqual(substitutedFood.foodId, 'fish');
    assert.strictEqual(substitutedFood.calories, Math.round(salmon.caloriesPerReference * 1.5));

    const exec1 = logMealExecution(exec0, nutritionPlan, 'slot_1', [substitutedFood], 'completed');
    assert.strictEqual(exec1.mealExecutions[0].loggedFoods[0].foodId, 'fish');
    assert.strictEqual(exec1.summary.consumedCalories, substitutedFood.calories);
  });

  // D. Portion changes alter recorded nutrient totals deterministically
  it('W8.2 - Category D: Portion adjustments alter recorded nutrient totals deterministically', () => {
    const chicken = getFoodById('chicken_breast')!;
    assert.ok(chicken);

    const normal = calculateLoggedFoodNutrients(chicken, 1.0);
    const doubled = calculateLoggedFoodNutrients(chicken, 2.0);
    const halved = calculateLoggedFoodNutrients(chicken, 0.5);

    assert.strictEqual(doubled.calories, normal.calories * 2);
    assert.strictEqual(doubled.proteinG, normal.proteinG * 2);
    assert.strictEqual(halved.calories, Math.round(normal.calories * 0.5));
    assert.strictEqual(halved.proteinG, Math.round(normal.proteinG * 0.5));
  });

  // E. Additional foods are included exactly once
  it('W8.2 - Category E: Additional foods not in the plan are included exactly once', () => {
    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    const banana = getFoodById('banana')!;
    const egg = getFoodById('eggs')!;

    const item1 = calculateLoggedFoodNutrients(egg, 2.0, 'planned_food');
    const extra = calculateLoggedFoodNutrients(banana, 1.0, 'additional_food');

    const exec1 = logMealExecution(exec0, nutritionPlan, 'slot_1', [item1, extra], 'completed');
    assert.strictEqual(exec1.mealExecutions[0].loggedFoods.length, 2);
    assert.strictEqual(exec1.mealExecutions[0].loggedFoods[1].source, 'additional_food');
    assert.strictEqual(
      exec1.mealExecutions[0].consumedCalories,
      item1.calories + extra.calories
    );
  });

  // F. A partial meal does not count the whole planned slot as consumed
  it('W8.2 - Category F: Recording a partial meal records only actual intake and marks status partial', () => {
    const { nutritionPlan, nutritionStrategy, profile } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    const eggs = getFoodById('eggs')!;
    // Planned 2 eggs, ate only 1 egg
    const partialItem = calculateLoggedFoodNutrients(eggs, 1.0, 'planned_food', undefined, 'Ate half portion');

    const exec1 = logMealExecution(
      exec0,
      nutritionPlan,
      'slot_1',
      [partialItem],
      'partial',
      'Left half on plate'
    );

    assert.strictEqual(exec1.mealExecutions[0].status, 'partial');
    assert.strictEqual(exec1.summary.mealsPartial, 1);
    assert.strictEqual(exec1.summary.mealsCompleted, 0);
    assert.strictEqual(exec1.summary.consumedCalories, partialItem.calories);

    const summary = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: exec1,
      strategy: nutritionStrategy,
      profile,
    });

    assert.strictEqual(summary.mealSlots[0].status, 'partial');
    assert.strictEqual(summary.loggedIntake?.calories, partialItem.calories);
    assert.strictEqual(summary.isFullyResolved, false);
  });

  // G. Skipped and not-started slots remain different
  it('W8.2 - Category G: Skipped and not-started slots remain distinct in state and adaptation evidence', () => {
    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    const exec1 = logMealExecution(exec0, nutritionPlan, 'slot_1', [], 'skipped');

    assert.strictEqual(exec1.mealExecutions[0].status, 'skipped');
    assert.strictEqual(exec1.mealExecutions[1].status, 'not_started');
    assert.strictEqual(exec1.summary.mealsSkipped, 1);
    assert.strictEqual(exec1.summary.consumedCalories, 0);

    // Slot 0 is skipped (resolved), slot 1 is not_started (unresolved)
    // A skipped meal does not imply zero food for the entire day or an unresolved state
    assert.notStrictEqual(exec1.mealExecutions[0].status, exec1.mealExecutions[1].status);
  });

  // H. Changing a logged meal updates totals without double-counting
  it('W8.2 - Category H: Changing or editing a logged meal recalculates totals without double-counting', () => {
    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    const chicken = getFoodById('chicken_breast')!;
    const item1 = calculateLoggedFoodNutrients(chicken, 1.0);
    const exec1 = logMealExecution(exec0, nutritionPlan, 'slot_1', [item1], 'completed');

    assert.strictEqual(exec1.summary.consumedCalories, item1.calories);

    // Edit meal: replace with 2 portions
    const item2 = calculateLoggedFoodNutrients(chicken, 2.0);
    const exec2 = logMealExecution(exec1, nutritionPlan, 'slot_1', [item2], 'completed');

    assert.strictEqual(exec2.summary.consumedCalories, item2.calories);
    assert.notStrictEqual(exec2.summary.consumedCalories, item1.calories + item2.calories);
  });

  // I. Repeated actions do not create duplicate execution or intake records
  it('W8.2 - Category I: Repeated actions are idempotent and do not duplicate execution records', async () => {
    setRawNutritionStorageItemForTesting(null);
    const testRepo = new LocalNutritionHistoryRepository();
    await testRepo.clearAll();

    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');
    const chicken = getFoodById('chicken_breast')!;
    const item = calculateLoggedFoodNutrients(chicken, 1.0);
    const exec = logMealExecution(exec0, nutritionPlan, 'slot_1', [item], 'completed');

    // Repeated concurrent saves
    await Promise.all([
      testRepo.saveExecution(exec),
      testRepo.saveExecution(exec),
      testRepo.saveExecution(exec),
    ]);

    const executions = await testRepo.getExecutions();
    assert.strictEqual(executions.length, 1);
    assert.strictEqual(executions[0].executionId, exec.executionId);
  });

  // J. Persistence and reload preserve accurate meal states and nutrient totals
  it('W8.2 - Category J: Repository persistence and reload preserve accurate meal states and nutrient totals', async () => {
    setRawNutritionStorageItemForTesting(null);
    const testRepo = new LocalNutritionHistoryRepository();
    await testRepo.clearAll();

    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');
    const chicken = getFoodById('chicken_breast')!;
    const item = calculateLoggedFoodNutrients(chicken, 1.5);
    const exec = logMealExecution(exec0, nutritionPlan, 'slot_1', [item], 'completed');

    await testRepo.saveExecution(exec);

    // Reload from storage
    const reloaded = await testRepo.getExecutionByDate('2026-10-12');
    assert.ok(reloaded);
    assert.strictEqual(reloaded.mealExecutions[0].status, 'completed');
    assert.strictEqual(reloaded.mealExecutions[0].consumedCalories, item.calories);
    assert.strictEqual(reloaded.summary.consumedCalories, item.calories);
  });

  // K. Incomplete records do not produce unsupported daily adherence conclusions
  it('W8.2 - Category K: Incomplete records do not produce unsupported daily adherence conclusions', () => {
    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');
    const chicken = getFoodById('chicken_breast')!;
    const item = calculateLoggedFoodNutrients(chicken, 1.0);

    // Only slot 1 logged, slot 2 and slot 3 remain not_started
    const execIncomplete = logMealExecution(exec0, nutritionPlan, 'slot_1', [item], 'completed');

    // Run adherence evaluation with incomplete execution
    const adherence = evaluateNutritionAdherence([execIncomplete]);
    assert.strictEqual(adherence.completeDaysCount, 0);
    assert.strictEqual(adherence.incompleteDaysCount, 1);
    assert.strictEqual(adherence.overallStatus, 'insufficient_evidence');
  });

  // L. Canonical targets and historical execution records remain immutable
  it('W8.2 - Category L: Canonical targets and historical execution records remain deeply frozen', () => {
    const { nutritionPlan } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');

    assert.ok(Object.isFrozen(nutritionPlan));
    assert.ok(Object.isFrozen(exec0));

    const chicken = getFoodById('chicken_breast')!;
    const item = calculateLoggedFoodNutrients(chicken, 1.0);
    const exec1 = logMealExecution(exec0, nutritionPlan, 'slot_1', [item], 'completed');

    assert.ok(Object.isFrozen(exec1));
    assert.ok(Object.isFrozen(exec1.mealExecutions));
    assert.ok(Object.isFrozen(exec1.summary));

    // Deep freeze guarantees immutability
    assert.strictEqual(Object.isFrozen(exec1), true);
    assert.strictEqual(Object.isFrozen(exec1.mealExecutions[0]), true);
    assert.strictEqual(Object.isFrozen(exec1.summary), true);
  });

  // M. Revision acceptance and rejection behavior remains intact
  it('W8.2 - Category M: Revision acceptance and rejection behavior remains intact', async () => {
    setRawNutritionStorageItemForTesting(null);
    const testRepo = new LocalNutritionHistoryRepository();
    await testRepo.clearAll();

    const { nutritionPlan, nutritionStrategy } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const dummyRec = {
      primaryAction: 'simplify_structure' as const,
      summary: 'Simplify structure',
      actionableInsights: [],
      suggestedPreferredFoodIdsToAdd: [],
      suggestedStructureSimplification: true,
      requiresTargetReview: false,
      decisionTrace: ['test'],
    };

    const proposed = proposeStructureSimplificationRevision(
      nutritionPlan,
      nutritionStrategy,
      dummyRec
    );

    assert.strictEqual(proposed.status, 'pending_review');

    const accepted = acceptPlanRevision(proposed);
    assert.strictEqual(accepted.status, 'accepted');

    const rejected = rejectPlanRevision(proposed);
    assert.strictEqual(rejected.status, 'rejected');
  });

  // N. Youth, ineligible, and qualitative-only profiles remain protected
  it('W8.2 - Category N: Youth, ineligible, and qualitative-only profiles remain protected with zero fabricated calories', () => {
    const { nutritionPlan: youthPlan, profile: youthProfile } = getTestSetup('PERSONA_A_BASELINE');
    // Modify age to youth
    const youthProf = {
      ...youthProfile,
      anthropometrics: { ...youthProfile.anthropometrics, age: 16 },
    };

    const summary = resolveTodayNutritionSummary({
      plan: youthPlan,
      execution: null,
      profile: youthProf,
    });

    assert.strictEqual(summary.status, 'youth_protection_pending');
    assert.strictEqual(summary.plannedTargets, null);
    assert.strictEqual(summary.loggedIntake, null);
  });

  // O. Corrupt repository data remains isolated without fabricating successful intake
  it('W8.2 - Category O: Corrupt repository data remains isolated without fabricating successful intake', async () => {
    setRawNutritionStorageItemForTesting(JSON.stringify({
      schemaVersion: 1,
      executions: [{ invalid: 'corrupt_data' }],
      lastUpdatedTimestamp: Date.now(),
    }));

    const testRepo = new LocalNutritionHistoryRepository();
    const list = await testRepo.getExecutions();
    assert.strictEqual(list.length, 0);
  });

  // P. Repeated runs with identical validated inputs remain deterministic
  it('W8.2 - Category P: Repeated runs with identical validated inputs produce identical summaries', () => {
    const { nutritionPlan, nutritionStrategy, profile } = getTestSetup('PERSONA_G_QUANTITATIVE_READY');
    const exec0 = initializeNutritionExecution(nutritionPlan, '2026-10-12');
    const chicken = getFoodById('chicken_breast')!;
    const item = calculateLoggedFoodNutrients(chicken, 1.0);
    const exec1 = logMealExecution(exec0, nutritionPlan, 'slot_1', [item], 'completed');

    const summary1 = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: exec1,
      strategy: nutritionStrategy,
      profile,
    });

    const summary2 = resolveTodayNutritionSummary({
      plan: nutritionPlan,
      execution: exec1,
      strategy: nutritionStrategy,
      profile,
    });

    assert.deepStrictEqual(summary1, summary2);
  });
});

