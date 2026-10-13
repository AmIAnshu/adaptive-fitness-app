import type { Page } from '@playwright/test';
import { getQAPersona, type QAPersonaId } from '../fixtures/personas';
import { WORKOUT_HISTORY_STORAGE_KEY } from '../../src/features/workout-history/localRepository';

export interface TestErrorTracker {
  consoleErrors: string[];
  pageErrors: Error[];
  failedRequests: string[];
}

/**
 * Attaches console error and exception listeners to page to catch uncaught failures.
 */
export function setupErrorTracking(page: Page): TestErrorTracker {
  const tracker: TestErrorTracker = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out benign React Native Web / font warnings if any
      if (!text.includes('downloadable font') && !text.includes('favicon.ico')) {
        tracker.consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    tracker.pageErrors.push(err);
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    if (!url.includes('favicon.ico')) {
      tracker.failedRequests.push(`${req.method()} ${url} - ${req.failure()?.errorText}`);
    }
  });

  return tracker;
}

/**
 * Cleanly clears all client-side test state.
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

/**
 * Injects a deterministic test persona and navigates to the real Plan Generation screen.
 * This completely bypasses the 10-screen onboarding manual entry while executing the
 * real production normalization, domain validation, and strategy pipeline.
 */
export async function bootstrapPersona(
  page: Page,
  personaId: QAPersonaId = 'PERSONA_A_BASELINE'
): Promise<void> {
  const personaData = getQAPersona(personaId);

  // Seed session storage before any script runs
  await page.addInitScript((data) => {
    try {
      sessionStorage.setItem('__E2E_ONBOARDING_DATA__', JSON.stringify(data));
    } catch {
      // ignore
    }
  }, personaData);

  // Navigate through safe test-only bootstrap route which sets state and forwards to /plan-generation
  await page.goto(`/e2e-bootstrap?persona=${personaId}`, { waitUntil: 'domcontentloaded' });

  // Wait for the plan generation card or prescribed sessions to render
  await page.waitForSelector('text=Your adaptive plan is ready', { timeout: 25000 });
}

/**
 * Seed historical workout plan and execution evidence into persistent storage.
 */
export async function seedWorkoutHistory(
  page: Page,
  payload: { activePlan?: any; executions?: any[] }
): Promise<void> {
  const store = {
    schemaVersion: 1,
    activePlan: payload.activePlan ?? null,
    executions: payload.executions ?? [],
    lastUpdatedTimestamp: Date.now(),
  };

  await page.evaluate(
    ({ key, data }) => {
      localStorage.setItem(key, JSON.stringify(data));
    },
    { key: WORKOUT_HISTORY_STORAGE_KEY, data: store }
  );
}

/**
 * Completes all exercises in the active workout session using real UI interactions.
 */
export async function completeAllExercisesInSession(page: Page): Promise<void> {
  // Read total exercises from header e.g. "Exercise 1 of 5"
  const counterLocator = page.locator('text=/Exercise \\d+ of \\d+/');
  await counterLocator.waitFor({ state: 'visible', timeout: 5000 });
  const counterText = await counterLocator.textContent();
  const match = counterText?.match(/Exercise (\d+) of (\d+)/);
  const total = match ? parseInt(match[2], 10) : 1;

  for (let i = 0; i < total; i++) {
    // Log active set if button is available
    const logSetBtn = page.locator('text=/Log Set \\d+ ✓/');
    if (await logSetBtn.isVisible()) {
      await logSetBtn.click();
      await page.waitForTimeout(150);
    }

    // Complete exercise with recorded set
    const completeBtn = page.locator('text=Complete Exercise ✓');
    const skipBtn = page.locator('text=Skip Exercise');
    if (await completeBtn.isVisible()) {
      await completeBtn.click();
    } else if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }
    await page.waitForTimeout(200);
  }
}

/**
 * Reads persistent workout history store directly from browser localStorage.
 */
export async function readWorkoutHistory(page: Page): Promise<any> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, WORKOUT_HISTORY_STORAGE_KEY);
}
