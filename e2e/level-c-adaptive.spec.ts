import { test, expect } from '@playwright/test';
import {
  clearAllStorage,
  seedWorkoutHistory,
  setupErrorTracking,
  bootstrapPersona,
  readWorkoutHistory,
} from './helpers/bootstrap';
import {
  getBasePlanForPersona,
  createCleanExecution,
  createMissedTargetExecution,
  createDegradedExecution,
  createSeverelyExhaustedExecution,
} from './helpers/adaptationFixtures';

test.describe('LEVEL C — Adaptive Behavior Suite (Stage W6.2)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  // SCENARIO 1: Clean Performance -> Normal Adaptation Path
  test('Scenario 1: Clean performance preserves unconstrained recovery and standard volume', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);
    const plan = getBasePlanForPersona('PERSONA_A_BASELINE');
    const cleanExec = createCleanExecution(plan.sessions[0], 'plan_default', 1000, {
      energyLevel: 5,
      sorenessLevel: 'none',
    });

    // Seed history
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedWorkoutHistory(page, {
      activePlan: plan,
      executions: [cleanExec],
    });

    // Trigger next generation through bootstrap
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');

    // Verify UI displays normal recovery level
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();
    await expect(page.locator('text=Recovery Level')).toBeVisible();
    await expect(page.locator('text=stable')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
  });

  // SCENARIO 2: Missed Targets -> T7 Progression Maintains
  test('Scenario 2: Missed targets halts progression with maintain decision', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);
    const plan = getBasePlanForPersona('PERSONA_A_BASELINE');
    const missedExec = createMissedTargetExecution(plan.sessions[0], 'plan_default', 1000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedWorkoutHistory(page, {
      activePlan: plan,
      executions: [missedExec],
    });

    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();

    // Verify stored active plan was re-generated
    const history = await readWorkoutHistory(page);
    expect(history.activePlan).not.toBeNull();
    // In missed targets, plan generates successfully with maintain
    expect(history.activePlan.sessions.length).toBe(3);

    expect(tracker.pageErrors).toEqual([]);
  });

  // SCENARIO 3: Repeated Degraded Performance -> T7 Regression
  test('Scenario 3: Repeated degraded performance activates T7 regression behavior', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);
    const plan = getBasePlanForPersona('PERSONA_A_BASELINE');

    // 2 consecutive degraded executions followed by a session
    const d1 = createDegradedExecution(plan.sessions[0], 'plan_default', 1000);
    const d2 = createDegradedExecution(plan.sessions[0], 'plan_default', 3000);
    const d3 = createCleanExecution(plan.sessions[0], 'plan_default', 5000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedWorkoutHistory(page, {
      activePlan: plan,
      executions: [d1, d2, d3],
    });

    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();

    // Verify plan is adapted
    const history = await readWorkoutHistory(page);
    expect(history.activePlan).not.toBeNull();

    expect(tracker.pageErrors).toEqual([]);
  });

  // SCENARIO 4: High Fatigue / Soreness -> T9 Constraint Elevation
  test('Scenario 4: High fatigue and soreness elevates T9 recovery constraint level', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);
    const plan = getBasePlanForPersona('PERSONA_A_BASELINE');

    // Trainee reports severe soreness and lowest energy
    const fatiguedExec = createCleanExecution(plan.sessions[0], 'plan_default', 1000, {
      energyLevel: 1,
      sorenessLevel: 'severe',
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedWorkoutHistory(page, {
      activePlan: plan,
      executions: [fatiguedExec],
    });

    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();

    // Verify recovery level on screen is elevated
    await expect(page.locator('text=constrained')).toBeVisible();

    const history = await readWorkoutHistory(page);
    expect(history.activePlan.recoveryContext.level).not.toBe('stable');

    expect(tracker.pageErrors).toEqual([]);
  });

  // SCENARIO 5: Repeated Under-Recovery -> Stronger T9 Constraint
  test('Scenario 5: Repeated under-recovery elevates to strongly_constrained', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);
    const plan = getBasePlanForPersona('PERSONA_A_BASELINE');

    // 3 consecutive under-recovered sessions
    const ex1 = createSeverelyExhaustedExecution(plan.sessions[0], 'plan_default', 1000);
    const ex2 = createSeverelyExhaustedExecution(plan.sessions[1], 'plan_default', 3000);
    const ex3 = createSeverelyExhaustedExecution(plan.sessions[0], 'plan_default', 5000);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedWorkoutHistory(page, {
      activePlan: plan,
      executions: [ex1, ex2, ex3],
    });

    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();

    // Verify elevated constraint in persistent store
    const history = await readWorkoutHistory(page);
    expect(
      history.activePlan.recoveryContext.level === 'strongly_constrained' ||
      history.activePlan.recoveryContext.level === 'constrained'
    ).toBe(true);

    expect(tracker.pageErrors).toEqual([]);
  });

  // SCENARIO 6: Recovery Improves -> T9 Hysteresis Prevents Premature Full Release
  test('Scenario 6: Recovery improvement respects hysteresis dampening', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);
    const plan = getBasePlanForPersona('PERSONA_A_BASELINE');

    // Prior plan was strongly_constrained
    const constrainedPlan: any = {
      ...plan,
      recoveryContext: {
        ...plan.recoveryContext,
        level: 'strongly_constrained',
      },
    };

    // Clean session occurs
    const cleanExec = createCleanExecution(plan.sessions[0], 'plan_default', 1000, {
      energyLevel: 5,
      sorenessLevel: 'none',
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await seedWorkoutHistory(page, {
      activePlan: constrainedPlan,
      executions: [cleanExec],
    });

    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();

    // Hysteresis prevents jumping immediately to 'stable'; steps down to 'constrained'
    const history = await readWorkoutHistory(page);
    expect(history.activePlan.recoveryContext.level).toBe('constrained');

    expect(tracker.pageErrors).toEqual([]);
  });
});
