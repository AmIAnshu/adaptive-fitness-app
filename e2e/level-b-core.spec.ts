import { test, expect } from '@playwright/test';
import {
  bootstrapPersona,
  setupErrorTracking,
  clearAllStorage,
  readWorkoutHistory,
  completeAllExercisesInSession,
} from './helpers/bootstrap';

test.describe('LEVEL B — Core Product Flow Suite', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test('Core Product Flow: Bootstrap -> Real Plan -> Overview -> Start -> Detailed Sets -> Complete -> Persist -> Reload -> Session 2', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // 1. Bootstrap valid profile
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible();

    // 2. Open plan overview
    await page.getByRole('button', { name: 'View Plan Overview' }).click();
    await expect(page.locator('text=Your Training Plan')).toBeVisible();
    await expect(page.locator('text=Cycle Sessions (3)')).toBeVisible();

    // 3. Start Session 1
    await page.click('text=Start Session 1');
    await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
    await page.getByRole('button', { name: 'Start Workout' }).click();

    // 4. Verify prescribed values on Exercise 1
    await expect(page.locator('text=Prescribed Reps')).toBeVisible();
    await expect(page.locator('text=Target RIR')).toBeVisible();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();

    // Record Set 1 with explicit factual values
    const repsInput = page.locator('input[placeholder="e.g. 10"]');
    const loadInput = page.locator('input[placeholder="e.g. 60"]');
    const rirInput = page.locator('input[placeholder="e.g. 2"]');

    await repsInput.fill('10');
    await loadInput.fill('60');
    await rirInput.fill('2');
    await page.click('text=Log Set 1 ✓');

    // Verify Set 1 row displays recorded values
    await expect(page.locator('text=10r @ 60kg')).toBeVisible();

    // Record Set 2 with distinct values
    if (await page.locator('text=Log Set 2 ✓').isVisible()) {
      await repsInput.fill('8');
      await loadInput.fill('65');
      await rirInput.fill('1');
      await page.click('text=Log Set 2 ✓');
      await expect(page.locator('text=8r @ 65kg')).toBeVisible();
    }

    // Complete Exercise 1
    await page.click('text=Complete Exercise ✓');
    await page.waitForTimeout(200);

    // Complete all remaining exercises in Session 1
    await completeAllExercisesInSession(page);

    // 5. Finish workout
    await expect(page.getByRole('button', { name: 'Finish Workout' })).toBeVisible();
    await page.getByRole('button', { name: 'Finish Workout' }).click();

    // Fill subjective check-in (RPE 8, Energy 4, Soreness mild)
    await expect(page.locator('text=Session Check-in')).toBeVisible();
    const rpe8 = page.getByText('8', { exact: true });
    if (await rpe8.isVisible()) {
      await rpe8.click();
    }
    await page.getByRole('button', { name: 'Submit & Complete Workout' }).click();

    // 6. Verify completion state & T7 snapshot
    await expect(page.locator('text=✓ WORKOUT COMPLETE')).toBeVisible();
    await expect(page.locator('text=Session Evidence Summary')).toBeVisible();
    await expect(page.locator('text=T7 Progression Handoff Snapshot')).toBeVisible();

    // 7. Verify persistent storage
    let history = await readWorkoutHistory(page);
    expect(history.executions.length).toBe(1);
    const session1Exec = history.executions[0];
    expect(session1Exec.status).toBe('completed');
    expect(session1Exec.sessionSequenceIndex).toBe(1);

    // Verify recorded sets inside exercise 1
    const ex1Sets = session1Exec.exerciseExecutions[0]?.setExecutions;
    expect(ex1Sets.length).toBeGreaterThanOrEqual(1);
    expect(ex1Sets[0].actualReps).toBe(10);
    expect(ex1Sets[0].actualLoad).toBe(60);

    // 8. Reload application and verify historical execution remains
    await page.goto('/plan-overview', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=✓ COMPLETED')).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=✓ COMPLETED')).toBeVisible();

    // 9. Start another session (Session 2)
    await page.click('text=Start Session 2');
    await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
    await page.getByRole('button', { name: 'Start Workout' }).click();
    await expect(page.locator('text=Log Set 1 ✓')).toBeVisible();

    // 10. Verify that new execution is created while previous execution remains historical
    history = await readWorkoutHistory(page);
    expect(history.executions.length).toBe(2);

    const prevExecution = history.executions.find((e: any) => e.sessionSequenceIndex === 1);
    const currentExecution = history.executions.find((e: any) => e.sessionSequenceIndex === 2);

    expect(prevExecution.status).toBe('completed');
    expect(currentExecution.status).toBe('in_progress');

    // Check for errors
    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });
});
