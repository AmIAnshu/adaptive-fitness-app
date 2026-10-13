import { test, expect } from '@playwright/test';
import { clearAllStorage, setupErrorTracking } from './helpers/bootstrap';
import { QA_PERSONAS } from './fixtures/personas';

test.describe('Onboarding Domain Suite (Stage QA-1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  // TEST 1: Navigation, Validation & Back/Forward State Persistence
  test('Screen Navigation, Validation & Back/Forward Persistence', async ({ page }) => {
    const tracker = setupErrorTracking(page);

    // 1. Initial entry to Goal screen
    await page.goto('/onboarding/goal', { waitUntil: 'domcontentloaded' });
    await expect(page.locator("text=Let's build a plan")).toBeVisible();

    // 2. Validation check: Continue button must be disabled without selection
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();

    // Select goal
    await page.click('text=Build muscle');
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // 3. Screen 2: About You
    await expect(page.locator('text=Tell us about yourself')).toBeVisible();

    const ageInput = page.getByLabel('Enter your age');
    const heightInput = page.getByLabel('Enter your height in centimeters');
    const weightInput = page.getByLabel('Enter your weight in kg');

    await ageInput.fill('28');
    await heightInput.fill('180');
    await weightInput.fill('80');

    // 4. Test Back navigation & state persistence
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.locator("text=Let's build a plan")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();

    // Forward back to Screen 2
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('text=Tell us about yourself')).toBeVisible();

    // Verify inputs remained populated across back/forward navigation
    await expect(ageInput).toHaveValue('28');
    await expect(heightInput).toHaveValue('180');
    await expect(weightInput).toHaveValue('80');

    expect(tracker.pageErrors).toEqual([]);
  });

  // TEST 1B: Screen 2 Biological Sex Selection, Optionality & Persistence
  test('Screen 2: Biological Sex Optionality, Selection & Reload Persistence', async ({ page }) => {
    const tracker = setupErrorTracking(page);

    // Seed goal so we can enter Screen 2 directly
    const partialData = {
      primaryGoal: 'build_muscle',
    };
    await page.addInitScript((data) => {
      sessionStorage.setItem('__E2E_ONBOARDING_DATA__', JSON.stringify(data));
    }, partialData);

    await page.goto('/onboarding/about-you', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Tell us about yourself')).toBeVisible();

    // Verify biological sex chips are rendered with helper text
    await expect(page.locator('text=Biological sex')).toBeVisible();
    await expect(
      page.locator('text=This is optional. It helps improve some nutrition estimates.')
    ).toBeVisible();

    const femaleChip = page.getByRole('button', { name: 'Female', exact: true });
    const maleChip = page.getByRole('button', { name: 'Male', exact: true });
    const preferNotToSayChip = page.getByRole('button', { name: 'Prefer not to say', exact: true });
    const continueBtn = page.getByRole('button', { name: 'Continue' });

    await expect(femaleChip).toBeVisible();
    await expect(maleChip).toBeVisible();
    await expect(preferNotToSayChip).toBeVisible();

    // Fill required fields (age, height, weight) but leave biological sex unselected
    await page.getByLabel('Enter your age').fill('25');
    await page.getByLabel('Enter your height in centimeters').fill('170');
    await page.getByLabel('Enter your weight in kg').fill('65');

    // Continue button MUST be enabled even without biological sex selected (optionality)
    await expect(continueBtn).toBeEnabled();

    // Select 'Female'
    await femaleChip.click();

    // Click 'Continue' to advance to Screen 3 (training-experience)
    await continueBtn.click();
    await expect(page).toHaveURL(/.*training-experience/);

    // Navigate back to Screen 2
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/.*about-you/);

    // Verify 'Female' and inputs remain populated across back navigation
    await expect(page.getByLabel('Enter your age')).toHaveValue('25');
    await expect(page.getByLabel('Enter your height in centimeters')).toHaveValue('170');
    await expect(page.getByLabel('Enter your weight in kg')).toHaveValue('65');

    // Verify selection can be changed to 'Prefer not to say'
    await preferNotToSayChip.click();
    await continueBtn.click();
    await expect(page).toHaveURL(/.*training-experience/);

    expect(tracker.pageErrors).toEqual([]);
  });

  // TEST 2: Training Structure Preference (Screen 6)
  test('Screen 6: Structure Preference Selection & Persistence', async ({ page }) => {
    const tracker = setupErrorTracking(page);

    // Seed profile data where structure preference is not yet chosen
    const partialData = {
      ...QA_PERSONAS.PERSONA_A_BASELINE,
      structurePreference: undefined,
    };

    await page.addInitScript((data) => {
      sessionStorage.setItem('__E2E_ONBOARDING_DATA__', JSON.stringify(data));
    }, partialData);

    await page.goto('/onboarding/training-style', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=How do you like to train?')).toBeVisible();
    await expect(page.locator('text=How would you prefer to structure your workouts?')).toBeVisible();

    // Verify Continue is disabled without structure preference
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await expect(continueBtn).toBeDisabled();

    // Select explicit structure preference
    const pplOption = page.locator('text=Push / Pull / Legs');
    await pplOption.scrollIntoViewIfNeeded();
    await pplOption.click();

    // Continue is now enabled
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Arrives on Screen 7
    await expect(page).toHaveURL(/.*exercise-preferences/);
    await expect(page.locator('text=Know what you like?')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
  });

  // TEST 3: Final Completion & Plan Generation Entry (Screen 10 -> /plan-generation)
  test('Screen 10 Completion -> Plan Generation Entry', async ({ page }) => {
    const tracker = setupErrorTracking(page);

    // Seed valid profile data through Screen 9
    const preCoachData = {
      ...QA_PERSONAS.PERSONA_A_BASELINE,
      communicationStyle: undefined,
      decisionAutonomy: undefined,
      explanationDepth: undefined,
      accountability: undefined,
      isCompleted: false,
    };

    await page.addInitScript((data) => {
      sessionStorage.setItem('__E2E_ONBOARDING_DATA__', JSON.stringify(data));
    }, preCoachData);

    await page.goto('/onboarding/ai-coach', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=How should your coach work with you?')).toBeVisible();

    // Select coaching preferences
    await page.click('text=Educational');
    await page.click('text=Recommend changes');
    await page.click('text=Detailed explanation');
    await page.click('text=Gentle reminders');

    // Submit and enter Plan Generation
    const buildPlanBtn = page.getByRole('button', { name: 'Build My Plan' });
    await expect(buildPlanBtn).toBeEnabled();
    await buildPlanBtn.click();

    // Verify transition to Plan Generation screen
    await expect(page.locator('text=Your adaptive plan is ready')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Prescribed Sessions')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
  });
});
