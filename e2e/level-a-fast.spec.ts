import { test, expect } from '@playwright/test';
import {
  bootstrapPersona,
  setupErrorTracking,
  clearAllStorage,
  readWorkoutHistory,
  completeAllExercisesInSession,
} from './helpers/bootstrap';

test.describe('LEVEL A — Fast Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test('Fast Regression: Bootstrap -> Plan Gen -> Overview -> Player -> Set -> Complete -> Persist -> Reload', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // 1 & 2. App starts successfully and test profile bootstraps
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');

    // 3. Real plan generates and renders with sessions
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();
    await expect(page.locator('text=Prescribed Sessions')).toBeVisible();

    // 3b. Verify Nutrition Strategy renders and attaches v1 strategy contract
    await expect(page.locator('text=Nutrition Strategy')).toBeVisible();
    await expect(page.locator('text=v1 Validated')).toBeVisible();
    const nutritionStrategy = await page.evaluate(() => (window as any).__LAST_NUTRITION_STRATEGY__);
    expect(nutritionStrategy).not.toBeNull();
    expect(nutritionStrategy.schemaVersion).toBe(1);
    expect(nutritionStrategy.population).toBe('adult');
    expect(nutritionStrategy.quantitativeReadiness.status).toBe('pending_required_inputs');
    expect(nutritionStrategy.quantitativeReadiness.canCalculateCalories).toBe(false);

    // 4. Plan overview renders
    await page.getByRole('button', { name: 'View Plan Overview' }).click();
    await expect(page.locator('text=Your Training Plan')).toBeVisible();
    await expect(page.locator('text=Cycle Sessions')).toBeVisible();

    // 5 & 6. At least one session opens and workout player renders
    await page.click('text=Start Session 1');
    await expect(page.locator('text=Ready to begin?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();

    // Start workout
    await page.getByRole('button', { name: 'Start Workout' }).click();
    // 7. Record sets and complete all exercises cleanly
    await completeAllExercisesInSession(page);

    // 8. Session can be completed
    await expect(page.getByRole('button', { name: 'Finish Workout' })).toBeVisible();
    await page.getByRole('button', { name: 'Finish Workout' }).click();

    // Session check-in modal
    await expect(page.locator('text=Session Check-in')).toBeVisible();
    await page.getByRole('button', { name: 'Submit & Complete Workout' }).click();

    // Completion banner appears
    await expect(page.locator('text=✓ WORKOUT COMPLETE')).toBeVisible();

    // 9. History persists in local storage
    const history = await readWorkoutHistory(page);
    expect(history).not.toBeNull();
    expect(history.executions.length).toBeGreaterThanOrEqual(1);
    const lastExecution = history.executions[history.executions.length - 1];
    expect(lastExecution.status).toBe('completed');
    expect(lastExecution.sessionSequenceIndex).toBe(1);

    // 10. Navigate back to plan overview and verify completed badge
    await page.goto('/plan-overview');
    await expect(page.locator('text=✓ COMPLETED')).toBeVisible();

    // Reload page to verify persistence across restarts
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Your Training Plan')).toBeVisible();
    await expect(page.locator('text=✓ COMPLETED')).toBeVisible();

    // 11 & 12. No fatal console errors or uncaught exceptions
    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });
});
