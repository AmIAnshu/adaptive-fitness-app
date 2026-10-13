import { test, expect } from '@playwright/test';
import {
  bootstrapPersona,
  clearAllStorage,
  setupErrorTracking,
  completeAllExercisesInSession,
} from './helpers/bootstrap';

test.describe('LEVEL E — Unified Today Dashboard E2E Suite (Milestone W8.1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  // SCENARIO 1: Opening Today after onboarding and plan generation (Scheduled Workout Day)
  test('Scenario 1: Opening Today Dashboard after bootstrap renders Training & Nutrition sections', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Persona B trains Mon-Sat (including Saturday)
    await bootstrapPersona(page, 'PERSONA_B_ADVANCED_PPL');

    // Navigate to Today Dashboard
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Header & Brand
    await expect(page.locator('text=ADAPTIVE FITNESS')).toBeVisible();
    await expect(page.locator('text=TODAY ·')).toBeVisible();

    // Section A: Training
    await expect(page.locator("text=Today's Training")).toBeVisible();
    await expect(page.locator('text=/SESSION 1 OF \\d+/')).toBeVisible();
    await expect(page.locator('text=Start Workout')).toBeVisible();

    // Section B: Nutrition
    await expect(page.locator("text=Today's Nutrition")).toBeVisible();
    await expect(page.locator('text=Planned Meal Slots')).toBeVisible();

    // Section C: Adaptive Coaching
    await expect(page.locator('text=Adaptive Coaching')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 2: Starting and continuing a workout using the existing player
  test('Scenario 2: Starting a workout from Today transitions status to In Progress with Continue Workout CTA', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_B_ADVANCED_PPL');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Click Start Workout
    await page.click('text=Start Workout');
    await expect(page.locator('text=Ready to begin?')).toBeVisible();

    // Start workout in player
    await page.getByRole('button', { name: 'Start Workout' }).click();
    await expect(page.locator('text=Exercise 1 of')).toBeVisible();

    // Navigate back to /today
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Status is in progress
    await expect(page.locator('text=● IN PROGRESS')).toBeVisible();
    await expect(page.locator('text=Continue Workout ▶')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 3: Completed workout rendering
  test('Scenario 3: Completing a workout updates Today Dashboard to Completed Today status', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_B_ADVANCED_PPL');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    await page.click('text=Start Workout');
    await page.getByRole('button', { name: 'Start Workout' }).click();

    // Complete all exercises
    await completeAllExercisesInSession(page);
    await page.getByRole('button', { name: 'Finish Workout' }).click();
    await page.getByRole('button', { name: 'Submit & Complete Workout' }).click();
    await expect(page.locator('text=✓ WORKOUT COMPLETE')).toBeVisible();

    // Click Go to Today Dashboard
    await page.click('text=Go to Today Dashboard');

    // Completed today status appears
    await expect(page.locator('text=✓ COMPLETED TODAY')).toBeVisible();
    await expect(page.locator('text=View Workout Summary')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 3b: Scheduled Rest Day rendering
  test('Scenario 3b: Trainee with off-day schedule renders Scheduled Rest Day and next session preview', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Persona G trains Mon/Wed/Fri (today is Saturday -> rest day)
    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Scheduled Rest Day')).toBeVisible();
    await expect(page.locator('text=Active Recovery & Adaptation')).toBeVisible();
    await expect(page.locator('text=NEXT SCHEDULED WORKOUT:')).toBeVisible();
    await expect(page.locator('text=Preview Session Early')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 4: Nutrition logging and recording a meal
  test('Scenario 4: Logging a meal on Today updates intake, targets, and difference in real time', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Verify initial intake is 0 kcal logged using exact match
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    // Log the first meal slot
    const logMealBtn = page.locator('text=Log Meal').first();
    await logMealBtn.click();

    // Slot updates to Logged
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();

    // Mark Skipped becomes available
    await expect(page.locator('text=Mark Skipped').first()).toBeVisible();

    // Disclaimer is visible
    await expect(
      page.locator('text=* Difference based on recorded intake.')
    ).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 5: Nutrition revision preview, accept, and reject
  test('Scenario 5: Nutrition revision appears, can be previewed, accepted, or rejected', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // Seed repeated skipping history to trigger adaptation
    await page.evaluate(() => {
      const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
      const execs = dates.map((date) => ({
        schemaVersion: 1,
        executionId: `exec_${date}`,
        planId: 'plan_1',
        date,
        status: 'completed',
        mealExecutions: [
          {
            mealSlotId: 'slot_1',
            mealName: 'Breakfast',
            slotType: 'breakfast',
            status: 'completed',
            loggedFoods: [],
            consumedCalories: 500,
            consumedProteinG: 30,
            consumedFatG: 15,
            consumedCarbohydratesG: 60,
          },
          {
            mealSlotId: 'slot_2',
            mealName: 'Lunch',
            slotType: 'lunch',
            status: 'skipped',
            loggedFoods: [],
            consumedCalories: 0,
            consumedProteinG: 0,
            consumedFatG: 0,
            consumedCarbohydratesG: 0,
          },
          {
            mealSlotId: 'slot_3',
            mealName: 'Dinner',
            slotType: 'dinner',
            status: 'completed',
            loggedFoods: [],
            consumedCalories: 600,
            consumedProteinG: 40,
            consumedFatG: 20,
            consumedCarbohydratesG: 65,
          },
        ],
        summary: {
          date,
          isQuantitative: true,
          consumedCalories: 1100,
          consumedProteinG: 70,
          consumedFatG: 35,
          consumedCarbohydratesG: 125,
          mealsPlanned: 3,
          mealsCompleted: 2,
          mealsPartial: 0,
          mealsSkipped: 1,
        },
        createdAt: Date.now() - 86400000 * 4,
        lastUpdated: Date.now() - 86400000 * 4,
      }));

      const store = {
        schemaVersion: 1,
        executions: execs,
        lastUpdatedTimestamp: Date.now(),
      };
      localStorage.setItem('@adaptive_fitness:nutrition_history_v1', JSON.stringify(store));
    });

    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Optimization alert should appear
    await expect(page.locator('text=Meal Structure Optimization Available')).toBeVisible();
    await page.click('text=Review Recommendation');

    // Pending revision alert appears
    await expect(page.locator('text=REVISION AWAITING REVIEW')).toBeVisible();
    await page.click('text=Review Proposed Revision');

    // Modal opens with Target Preservation Guarantee
    await expect(page.locator('text=✓ Targets 100% Preserved')).toBeVisible();
    await expect(page.locator('text=Proposed Meal Slots:')).toBeVisible();

    // Rejection keeps current plan
    await page.click('text=Keep Current Plan');
    await expect(page.locator('text=✓ Targets 100% Preserved')).not.toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 6: Reload persistence
  test('Scenario 6: Logged meal state persists across browser page reload', async ({ page }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Log meal
    await page.locator('text=Log Meal').first().click();
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();

    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verifies persisted state
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();
    await expect(page.locator('text=Mark Skipped').first()).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 7: Population guards & qualitative-only handling
  test('Scenario 7: Population guards & qualitative-only states are respected on Today', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Persona A has unstated biological sex -> qualitative only
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Renders qualitative notice with zero fabricated calorie numbers
    await expect(page.locator('text=Qualitative Nutrition Framework')).toBeVisible();
    await expect(
      page.locator('text=Caloric and macronutrient numbers are withheld')
    ).toBeVisible();

    // No planned energy target box
    await expect(page.locator('text=Authoritative target benchmarks')).not.toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 8: Missing plan handling
  test('Scenario 8: Completely uninitialized state renders No Active Plan Found with clean CTAs', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await clearAllStorage(page);
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=No Active Plan Found')).toBeVisible();
    await expect(page.locator('text=Start Onboarding & Build Plan')).toBeVisible();
    await expect(page.locator('text=Go to Plan Generation')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 9: Mobile viewport verification (390x844 and 375x812)
  test('Scenario 9: Layout renders cleanly on 390x844 and 375x812 mobile viewports without clipping', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_B_ADVANCED_PPL');

    // 1. Test 390x844 viewport (iPhone 12/13/14)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=ADAPTIVE FITNESS')).toBeVisible();
    await expect(page.locator("text=Today's Training")).toBeVisible();
    await expect(page.locator('text=Start Workout')).toBeVisible();
    await expect(page.locator("text=Today's Nutrition")).toBeVisible();

    // 2. Test 375x812 viewport (iPhone X/XS/11 Pro)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=ADAPTIVE FITNESS')).toBeVisible();
    await expect(page.locator("text=Today's Training")).toBeVisible();
    await expect(page.locator('text=Start Workout')).toBeVisible();
    await expect(page.locator("text=Today's Nutrition")).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 10: Record custom intake with different food item and portion
  test('Scenario 10: Record custom intake with different food and adjusted portion updates nutrients deterministically', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Open custom intake modal on first slot
    await page.locator('text=Record Intake').first().click();

    // Verify modal elements
    await expect(page.locator('text=Record Actual Intake')).toBeVisible();
    await expect(page.locator('text=Full Meal (Completed)')).toBeVisible();

    // Select Whole Eggs
    await page.locator('text=Whole Eggs').click();

    // Select 2.0x portion
    await page.locator('text=2x').click();

    // Save record
    await page.locator('text=Save Intake Record').click();

    // Modal closes and slot shows ✓ Logged with Whole Eggs
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();
    await expect(page.locator('text=Logged: Whole Eggs (Boiled/Poached)').first()).toBeVisible();

    // Energy display updates to ~144 kcal (72 * 2)
    await expect(page.getByText('144 kcal', { exact: true })).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 11: Record partial meal intake
  test('Scenario 11: Recording partial intake marks status Partial and counts only actual consumed portion', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Open partial meal modal
    await page.locator('text=Mark Partial').first().click();

    await expect(page.locator('text=Log Partial Meal')).toBeVisible();

    // Select Banana using exact text
    await page.getByText('Banana', { exact: true }).click();

    // 0.5x portion
    await page.locator('text=0.5x').click();

    await page.locator('text=Save Intake Record').click();

    // Status is Partial
    await expect(page.locator('text=● Partial').first()).toBeVisible();
    await expect(page.locator('text=Logged: Banana').first()).toBeVisible();

    // Energy display reflects 53 kcal (105 * 0.5)
    await expect(page.getByText('53 kcal', { exact: true })).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 12: Mark skipped meal contributes 0 kcal to logged intake
  test('Scenario 12: Marking meal skipped records skipped status and contributes 0 kcal to logged intake', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Initial intake is 0 kcal
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    // Mark slot skipped
    await page.locator('text=Mark Skipped').first().click();

    // Slot updates to Skipped
    await expect(page.locator('text=— Skipped').first()).toBeVisible();

    // Logged intake remains 0 kcal (does not invent calories)
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 13: Reset slot reverts status to Not Started
  test('Scenario 13: Resetting a meal slot reverts status to Not Started and removes logged intake', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Log meal as planned
    await page.locator('text=Log Meal').first().click();
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();

    // Reset slot
    await page.locator('text=Reset Slot').first().click();

    // Reverts to Not Started
    await expect(page.locator('text=Not Started').first()).toBeVisible();
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 14: Safe Meal Reset Preserves Audit Evidence & Zeroes Out Effective Nutrients (Stage W8.3)
  test('Scenario 14: Resetting meal slot reverts effective nutrients to 0 while preserving supersededHistory in repository', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Log meal as planned
    await page.locator('text=Log Meal').first().click();
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();

    // Reset slot
    await page.locator('text=Reset Slot').first().click();
    await expect(page.locator('text=Not Started').first()).toBeVisible();
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    // Verify window bridge audit state
    const state = await page.evaluate(() => (window as any).__TODAY_DASHBOARD_STATE__);
    expect(state).toBeTruthy();
    const slot0Exec = state.nutrition.execution.mealExecutions[0];
    expect(slot0Exec.status).toBe('not_started');
    expect(slot0Exec.consumedCalories).toBe(0);
    expect(slot0Exec.supersededHistory).toBeDefined();
    expect(slot0Exec.supersededHistory.length).toBe(1);
    expect(slot0Exec.supersededHistory[0].reason).toBe('reset');
    expect(slot0Exec.supersededHistory[0].previousStatus).toBe('completed');
    expect(slot0Exec.supersededHistory[0].consumedCalories).toBeGreaterThan(0);

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Not Started').first()).toBeVisible();
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    const reloadedState = await page.evaluate(() => (window as any).__TODAY_DASHBOARD_STATE__);
    const reloadedSlot0 = reloadedState.nutrition.execution.mealExecutions[0];
    expect(reloadedSlot0.status).toBe('not_started');
    expect(reloadedSlot0.supersededHistory.length).toBe(1);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 15: Editing Completed Intake Correctly Supersedes Prior Value Without Double-Counting (Stage W8.3)
  test('Scenario 15: Editing completed intake supersedes previous intake and counts only newly entered foods', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Log planned meal first
    await page.locator('text=Log Meal').first().click();
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();

    // Click Edit Intake
    await page.locator('text=Edit Intake').first().click();
    await expect(page.locator('text=Record Actual Intake')).toBeVisible();

    // Select Grilled Chicken Breast (default portion 1x is already selected)
    await page.getByText('Grilled Chicken Breast', { exact: true }).click();
    await page.locator('text=Save Intake Record').click();

    // Now slot shows Grilled Chicken Breast
    await expect(page.locator('text=Logged: Grilled Chicken Breast').first()).toBeVisible();
    await expect(page.getByText('165 kcal', { exact: true })).toBeVisible();

    // Verify window bridge: supersededHistory contains planned meal, effective calories = 165
    const state = await page.evaluate(() => (window as any).__TODAY_DASHBOARD_STATE__);
    const slot0 = state.nutrition.execution.mealExecutions[0];
    expect(slot0.status).toBe('completed');
    expect(slot0.consumedCalories).toBe(165);
    expect(slot0.supersededHistory.length).toBe(1);
    expect(slot0.supersededHistory[0].reason).toBe('correction');

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 16: Skipped Meal Transitioned to Custom Intake Overwrites Skipped State (Stage W8.3)
  test('Scenario 16: Skipped meal transitioned to custom intake archives skipped state and computes effective intake', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // Mark skipped
    await page.locator('text=Mark Skipped').first().click();
    await expect(page.locator('text=— Skipped').first()).toBeVisible();

    // Now click Record Intake on skipped slot
    await page.locator('text=Record Intake').first().click();
    await page.getByText('Banana', { exact: true }).click();
    await page.locator('text=Save Intake Record').click();

    await expect(page.locator('text=✓ Logged').first()).toBeVisible();
    await expect(page.getByText('105 kcal', { exact: true })).toBeVisible();

    const state = await page.evaluate(() => (window as any).__TODAY_DASHBOARD_STATE__);
    const slot0 = state.nutrition.execution.mealExecutions[0];
    expect(slot0.status).toBe('completed');
    expect(slot0.consumedCalories).toBe(105);
    expect(slot0.supersededHistory.length).toBe(1);
    expect(slot0.supersededHistory[0].reason).toBe('status_change');
    expect(slot0.supersededHistory[0].previousStatus).toBe('skipped');

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  // SCENARIO 17: Multiple Correction Cycles Maintain Historical Trace and Strict Effective Totals (Stage W8.3)
  test('Scenario 17: Multi-cycle correction flow updates effective totals strictly with zero double-counting', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');
    await page.goto('/today', { waitUntil: 'domcontentloaded' });

    // 1. Log planned
    await page.locator('text=Log Meal').first().click();
    await expect(page.locator('text=✓ Logged').first()).toBeVisible();

    // 2. Edit to Banana
    await page.locator('text=Edit Intake').first().click();
    await page.getByText('Banana', { exact: true }).click();
    await page.locator('text=Save Intake Record').click();
    await expect(page.getByText('105 kcal', { exact: true })).toBeVisible();

    // 3. Reset slot
    await page.locator('text=Reset Slot').first().click();
    await expect(page.getByText('0 kcal', { exact: true })).toBeVisible();

    // 4. Mark Partial with Rolled Oats 0.5x
    await page.locator('text=Mark Partial').first().click();
    await page.getByText('Rolled Oats', { exact: true }).click();
    await page.locator('text=0.5x').click();
    await page.locator('text=Save Intake Record').click();

    // 190 * 0.5 = 95 kcal
    await expect(page.getByText('95 kcal', { exact: true })).toBeVisible();
    await expect(page.locator('text=● Partial').first()).toBeVisible();

    const state = await page.evaluate(() => (window as any).__TODAY_DASHBOARD_STATE__);
    const slot0 = state.nutrition.execution.mealExecutions[0];
    expect(slot0.consumedCalories).toBe(95);
    expect(slot0.status).toBe('partial');
    expect(slot0.supersededHistory.length).toBe(2);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });
});
