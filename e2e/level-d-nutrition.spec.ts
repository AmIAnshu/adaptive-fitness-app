import { test, expect } from '@playwright/test';
import {
  bootstrapPersona,
  setupErrorTracking,
  clearAllStorage,
} from './helpers/bootstrap';

test.describe('LEVEL D — Nutrition Strategy E2E Suite (Stage W7.1)', () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test('Nutrition Strategy: Bootstrap Baseline Persona -> Verify Nutrition Strategy & Invariants', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona A (Non-vegetarian, muscle gain)
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');

    // UI displays nutrition summary card
    await expect(page.locator('text=Nutrition Strategy')).toBeVisible();
    await expect(page.locator('text=v1 Validated')).toBeVisible();
    await expect(page.locator('text=Diet: non_vegetarian')).toBeVisible();

    // Verify attached NutritionStrategy object
    const strategy = await page.evaluate(() => (window as any).__LAST_NUTRITION_STRATEGY__);
    expect(strategy).not.toBeNull();
    expect(strategy.schemaVersion).toBe(1);
    expect(strategy.population).toBe('adult');
    expect(strategy.objective.primary).toBe('muscle_gain_support');
    expect(strategy.dietCompatibility.dietType).toBe('non_vegetarian');
    expect(strategy.quantitativeReadiness.status).toBe('pending_required_inputs');
    expect(strategy.quantitativeReadiness.canCalculateCalories).toBe(false);
    expect(strategy.quantitativeReadiness.missingInputs).toContain('biological_sex');

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Strategy: Bootstrap Vegan Persona F -> Strict Exclusions & Structure Invariants', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona F (Vegan, nuts restriction, structured)
    await bootstrapPersona(page, 'PERSONA_F_VEGAN_STRUCTURED');

    // UI displays nutrition summary card
    await expect(page.locator('text=Nutrition Strategy')).toBeVisible();
    await expect(page.locator('text=Diet: vegan')).toBeVisible();
    await expect(page.locator('text=Mode: structured meal plan')).toBeVisible();
    await expect(page.locator('text=Meals: 4/day')).toBeVisible();

    // Verify attached NutritionStrategy object
    const strategy = await page.evaluate(() => (window as any).__LAST_NUTRITION_STRATEGY__);
    expect(strategy).not.toBeNull();
    expect(strategy.dietCompatibility.dietType).toBe('vegan');
    expect(strategy.dietCompatibility.restrictions).toEqual(['nuts']);
    expect(strategy.dietCompatibility.hardExcludedFoodGroups).toContain('meat');
    expect(strategy.dietCompatibility.hardExcludedFoodGroups).toContain('dairy');
    expect(strategy.dietCompatibility.hardExcludedFoodGroups).toContain('nuts');
    expect(strategy.foodPreferences.likedFoodIds).toEqual(['tofu', 'oats', 'quinoa']);
    expect(strategy.foodPreferences.dislikedFoodIds).toEqual(['dark_chocolate']);
    expect(strategy.planningMode).toBe('structured_meal_plan');

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Targeting: Bootstrap Quantitative-Ready Persona G -> Verify Complete Targets & Invariants', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona G (Adult male, 80kg, 180cm, 28yo, explicit biological sex: 'male')
    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // UI displays quantitative target elements
    await expect(page.locator('text=Nutrition Strategy')).toBeVisible();
    await expect(page.locator('text=Daily Energy')).toBeVisible();
    await expect(page.getByText('Protein', { exact: true })).toBeVisible();
    await expect(page.getByText('Fat', { exact: true })).toBeVisible();
    await expect(page.getByText('Carbohydrates', { exact: true })).toBeVisible();

    // Verify attached NutritionTargets object
    const targets = await page.evaluate(() => (window as any).__LAST_NUTRITION_TARGETS__);
    expect(targets).not.toBeNull();
    expect(targets.schemaVersion).toBe(1);
    expect(targets.population).toBe('adult');
    expect(targets.status).toBe('ready');

    // Verify calculated energy values
    expect(targets.energy.bmrKcal).toBe(1790); // 10*80 + 6.25*180 - 5*28 + 5 = 1790
    expect(targets.energy.activityMultiplier).toBe(1.55); // moderate base
    expect(targets.energy.tdeeKcal).toBe(2775); // round(1790 * 1.55) = 2775
    expect(targets.energy.targetRange.minKcal).toBeLessThan(targets.energy.targetRange.maxKcal);
    expect(targets.energy.targetRange.midpointKcal).toBe(3050); // 2775 + 275 = 3050

    // Verify macro targets rounded to 5g increments
    expect(targets.macronutrients.protein.targetGrams).toBeGreaterThanOrEqual(160);
    expect(targets.macronutrients.fat.targetGrams).toBeGreaterThanOrEqual(45);
    expect(targets.macronutrients.carbohydrates.targetGrams).toBeGreaterThan(0);
    expect(targets.macronutrients.protein.targetGrams % 5).toBe(0);
    expect(targets.macronutrients.fat.targetGrams % 5).toBe(0);
    expect(targets.macronutrients.carbohydrates.targetGrams % 5).toBe(0);

    // Macro energy balance within 5% of target midpoint
    const diff = Math.abs(targets.macronutrients.totalCalculatedCalories - targets.energy.targetRange.midpointKcal);
    expect(diff).toBeLessThanOrEqual(targets.energy.targetRange.midpointKcal * 0.05);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Targeting: Unstated Biological Sex Persona A -> Explicit Pending Notice & Zero Fabricated Metrics', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona A (No biological sex)
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');

    // UI displays pending notice
    await expect(page.locator('text=Nutrition targets are not ready yet.')).toBeVisible();
    await expect(
      page.locator('text=Add the optional information used for energy estimation to unlock estimated calorie and macro targets.')
    ).toBeVisible();

    // Verify no targets fabricated
    const targets = await page.evaluate(() => (window as any).__LAST_NUTRITION_TARGETS__);
    expect(targets).toBeNull();

    const strategy = await page.evaluate(() => (window as any).__LAST_NUTRITION_STRATEGY__);
    expect(strategy.quantitativeReadiness.status).toBe('pending_required_inputs');
    expect(strategy.quantitativeReadiness.canCalculateCalories).toBe(false);
    expect(strategy.quantitativeReadiness.canCalculateMacros).toBe(false);
    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Targeting: Bootstrap Female Persona H -> Complete Female Targets & Invariants', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona H (Adult female, 60kg, 165cm, 26yo, biologicalSex: 'female')
    await bootstrapPersona(page, 'PERSONA_H_FEMALE_READY');

    // UI displays quantitative target elements
    await expect(page.locator('text=Nutrition Strategy')).toBeVisible();
    await expect(page.locator('text=Daily Energy')).toBeVisible();
    await expect(page.getByText('Protein', { exact: true })).toBeVisible();
    await expect(page.getByText('Fat', { exact: true })).toBeVisible();
    await expect(page.getByText('Carbohydrates', { exact: true })).toBeVisible();

    // Verify attached NutritionTargets object
    const targets = await page.evaluate(() => (window as any).__LAST_NUTRITION_TARGETS__);
    expect(targets).not.toBeNull();
    expect(targets.schemaVersion).toBe(1);
    expect(targets.population).toBe('adult');
    expect(targets.status).toBe('ready');

    // Verify female BMR calculation for Persona H (65kg, 168cm, 26yo):
    // 10*65 + 6.25*168 - 5*26 - 161 = 650 + 1050 - 130 - 161 = 1409
    expect(targets.energy.bmrKcal).toBe(1409);
    expect(targets.energy.activityMultiplier).toBe(1.55); // moderate base
    expect(targets.energy.tdeeKcal).toBe(2184); // round(1409 * 1.55) = 2183.95 -> 2184
    expect(targets.energy.targetRange.minKcal).toBeLessThan(targets.energy.targetRange.maxKcal);

    // Macro targets rounded to 5g increments
    expect(targets.macronutrients.protein.targetGrams % 5).toBe(0);
    expect(targets.macronutrients.fat.targetGrams % 5).toBe(0);
    expect(targets.macronutrients.carbohydrates.targetGrams % 5).toBe(0);

    // No raw technical jargon in UI
    await expect(page.locator('text=Mifflin-St Jeor')).toHaveCount(0);
    await expect(page.locator('text=TDEE')).toHaveCount(0);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Targeting: Bootstrap Prefer-Not-To-Say Persona I -> Clean Pending UX & Zero Targets', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona I (biologicalSex: 'prefer_not_to_say')
    await bootstrapPersona(page, 'PERSONA_I_PREFER_NOT_TO_SAY');

    // UI displays exact pending notice
    await expect(page.locator('text=Nutrition targets are not ready yet.')).toBeVisible();
    await expect(
      page.locator('text=Add the optional information used for energy estimation to unlock estimated calorie and macro targets.')
    ).toBeVisible();

    // Verify direct link to about-you
    await expect(page.locator('text=Add details in About You →')).toBeVisible();

    // Verify no targets fabricated
    const targets = await page.evaluate(() => (window as any).__LAST_NUTRITION_TARGETS__);
    expect(targets).toBeNull();

    const strategy = await page.evaluate(() => (window as any).__LAST_NUTRITION_STRATEGY__);
    expect(strategy.quantitativeReadiness.status).toBe('pending_required_inputs');
    expect(strategy.quantitativeReadiness.missingInputs).toContain('biological_sex');

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Plan Generator: Bootstrap Quantitative-Ready Persona G -> Verify Meal Framework & Slots E2E', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona G (Adult male, 80kg, 180cm, 28yo, 3 meals/day, mostly_cook)
    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // UI displays Meal Framework card and slots
    await expect(page.getByText('Meal Framework', { exact: true })).toBeVisible();
    await expect(page.getByText('Breakfast', { exact: true })).toBeVisible();
    await expect(page.getByText('Lunch', { exact: true })).toBeVisible();
    await expect(page.getByText('Dinner', { exact: true })).toBeVisible();

    // Verify attached NutritionPlan object on window
    const plan = await page.evaluate(() => (window as any).__LAST_NUTRITION_PLAN__);
    expect(plan).not.toBeNull();
    expect(plan.schemaVersion).toBe(1);
    expect(plan.population).toBe('adult');
    expect(plan.readinessStatus).toBe('ready');
    expect(plan.dailyPlan.totalMeals).toBe(3);
    expect(plan.dailyPlan.slots.length).toBe(3);

    // Verify daily total preservation across meal slots
    const expectedCalories = plan.nutritionTargets.energy.targetRange.midpointKcal;
    const expectedProtein = plan.nutritionTargets.macronutrients.protein.targetGrams;
    const expectedFat = plan.nutritionTargets.macronutrients.fat.targetGrams;
    const expectedCarbs = plan.nutritionTargets.macronutrients.carbohydrates.targetGrams;

    const sumCalories = plan.dailyPlan.slots.reduce((acc: number, s: any) => acc + s.targets.targetEnergyKcal, 0);
    const sumProtein = plan.dailyPlan.slots.reduce((acc: number, s: any) => acc + s.targets.targetProteinG, 0);
    const sumFat = plan.dailyPlan.slots.reduce((acc: number, s: any) => acc + s.targets.targetFatG, 0);
    const sumCarbs = plan.dailyPlan.slots.reduce((acc: number, s: any) => acc + s.targets.targetCarbohydratesG, 0);

    expect(sumCalories).toBe(expectedCalories);
    expect(sumProtein).toBe(expectedProtein);
    expect(sumFat).toBe(expectedFat);
    expect(sumCarbs).toBe(expectedCarbs);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Plan Generator: Bootstrap Pending Persona A -> Qualitative Framework with Zero Fabricated Slot Targets', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona A (unstated biological sex -> pending quantitative targets)
    await bootstrapPersona(page, 'PERSONA_A_BASELINE');

    // UI displays Meal Framework
    await expect(page.getByText('Meal Framework', { exact: true })).toBeVisible();
    await expect(page.locator('text=Nutrition targets are not ready yet.')).toBeVisible();

    // Verify attached NutritionPlan object on window
    const plan = await page.evaluate(() => (window as any).__LAST_NUTRITION_PLAN__);
    expect(plan).not.toBeNull();
    expect(plan.schemaVersion).toBe(1);
    expect(plan.population).toBe('adult');
    expect(plan.readinessStatus).toBe('pending_required_inputs');
    expect(plan.nutritionTargets).toBeUndefined();

    // Verify slots exist qualitatively without fabricated target calories/macros
    expect(plan.dailyPlan.slots.length).toBe(3);
    for (const slot of plan.dailyPlan.slots) {
      expect(slot.targets).toBeUndefined();
      expect(slot.name).toBeTruthy();
      expect(slot.guidance).toBeTruthy();
    }

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Food Composition: Bootstrap Ready Persona G -> Real Composed Food Candidates & Non-Empty Portions', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona G (Adult male, 80kg, 180cm, ready quantitative targets)
    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // UI displays Suggested Foods section under meal slots
    await expect(page.locator('text=Suggested Foods:').first()).toBeVisible();

    // Verify attached NutritionPlan object on window
    const plan = await page.evaluate(() => (window as any).__LAST_NUTRITION_PLAN__);
    expect(plan).not.toBeNull();
    expect(plan.dailyPlan.slots[0].composition).not.toBeNull();
    expect(plan.dailyPlan.slots[0].composition.selectedFoods.length).toBeGreaterThanOrEqual(2);
    expect(plan.dailyPlan.slots[0].composition.totalEstimatedCalories).toBeGreaterThan(0);

    // Verify portion description text exists on screen
    const firstFoodName = plan.dailyPlan.slots[0].composition.selectedFoods[0].food.name;
    await expect(page.getByText(firstFoodName, { exact: false }).first()).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Food Composition: Bootstrap Vegan Persona F -> Strict Vegan Composition & Zero Animal Foods', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona F (Vegan, nuts restriction, structured)
    await bootstrapPersona(page, 'PERSONA_F_VEGAN_STRUCTURED');

    // UI displays Suggested Foods section
    await expect(page.locator('text=Suggested Foods:').first()).toBeVisible();

    const plan = await page.evaluate(() => (window as any).__LAST_NUTRITION_PLAN__);
    expect(plan).not.toBeNull();

    // Every slot's composed foods must be 100% vegan and exclude nuts & animal products
    for (const slot of plan.dailyPlan.slots) {
      if (slot.composition) {
        for (const item of slot.composition.selectedFoods) {
          expect(item.food.compatibleDietTypes).toContain('vegan');
          expect(item.food.foodGroups).not.toContain('meat');
          expect(item.food.foodGroups).not.toContain('poultry');
          expect(item.food.foodGroups).not.toContain('dairy');
          expect(item.food.foodGroups).not.toContain('nuts');
        }
      }
    }

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Tracking: Bootstrap Quantitative Persona G -> Log Meal -> Verify Real-time Summary Update', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona G
    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // Verify meal framework is rendered
    await expect(page.getByText('Meal Framework', { exact: true })).toBeVisible();

    // Verify initial "Today's Nutrition Summary"
    await expect(page.locator("text=Today's Nutrition Summary")).toBeVisible();
    await expect(page.getByText('Meals: 0 / 3 completed', { exact: true })).toBeVisible();

    // Find first meal slot and click "Log Meal"
    const logButton = page.getByText('Log Meal').first();
    await expect(logButton).toBeVisible();
    await logButton.click();

    // Verify state updates to "✓ Eaten"
    await expect(page.getByText('✓ Eaten').first()).toBeVisible();

    // Verify summary updates
    await expect(page.getByText('Meals: 1 / 3 completed', { exact: true })).toBeVisible();

    // Verify __LAST_NUTRITION_EXECUTION__ updated in window
    const execution = await page.evaluate(() => (window as any).__LAST_NUTRITION_EXECUTION__);
    expect(execution).not.toBeNull();
    expect(execution.summary.mealsCompleted).toBe(1);
    expect(execution.summary.consumedCalories).toBeGreaterThan(0);
    expect(execution.summary.consumedProteinG).toBeGreaterThan(0);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Persistence: Logged Meal Survives Page Reload', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    // Bootstrap Persona G
    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // Click "Log Meal" on first slot
    const logButton = page.getByText('Log Meal').first();
    await expect(logButton).toBeVisible();
    await logButton.click();
    await expect(page.getByText('✓ Eaten').first()).toBeVisible();

    // Reload page
    await page.reload();

    // Verify meal remains marked as eaten after hydration
    await expect(page.getByText('✓ Eaten').first()).toBeVisible();
    await expect(page.getByText('Meals: 1 / 3 completed', { exact: true })).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Adaptation: Initial render displays Building Tracking Evidence when history is empty', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    await expect(page.locator('text=Building Tracking Evidence')).toBeVisible();
    await expect(page.getByText('ADAPTIVE', { exact: true })).toBeVisible();

    const adaptation = await page.evaluate(() => (window as any).__LAST_NUTRITION_ADAPTATION__);
    expect(adaptation).not.toBeNull();
    expect(adaptation.primaryAction).toBe('insufficient_evidence');

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Adaptation: Repeated meal skipping triggers structure simplification recommendation', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // Seed 3 days of nutrition history where lunch was repeatedly skipped
    await page.evaluate(() => {
      const makeExec = (date: string) => ({
        schemaVersion: 1,
        executionId: `exec_${date}`,
        planId: 'plan_v1',
        date,
        status: 'completed',
        mealExecutions: [
          {
            mealSlotId: 'slot_1',
            mealName: 'Breakfast',
            slotType: 'breakfast',
            status: 'completed',
            loggedFoods: [
              {
                foodId: 'eggs',
                foodName: 'Whole Eggs',
                portionUnits: 2,
                servingDescription: '2 pieces',
                source: 'planned_food',
                calories: 144,
                proteinG: 12,
                fatG: 10,
                carbohydratesG: 1,
              },
            ],
            consumedCalories: 144,
            consumedProteinG: 12,
            consumedFatG: 10,
            consumedCarbohydratesG: 1,
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
            loggedFoods: [
              {
                foodId: 'chicken_breast',
                foodName: 'Grilled Chicken Breast',
                portionUnits: 2,
                servingDescription: '200 g',
                source: 'planned_food',
                calories: 330,
                proteinG: 62,
                fatG: 7,
                carbohydratesG: 0,
              },
            ],
            consumedCalories: 330,
            consumedProteinG: 62,
            consumedFatG: 7,
            consumedCarbohydratesG: 0,
          },
        ],
        summary: {
          date,
          isQuantitative: true,
          plannedCalories: 3050,
          plannedProteinG: 160,
          plannedFatG: 65,
          plannedCarbohydratesG: 455,
          consumedCalories: 474,
          consumedProteinG: 74,
          consumedFatG: 17,
          consumedCarbohydratesG: 1,
          mealsPlanned: 3,
          mealsCompleted: 2,
          mealsPartial: 0,
          mealsSkipped: 1,
        },
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      });

      const store = {
        schemaVersion: 1,
        executions: [
          makeExec('2026-10-05'),
          makeExec('2026-10-06'),
          makeExec('2026-10-07'),
        ],
        lastUpdatedTimestamp: Date.now(),
      };
      localStorage.setItem('@adaptive_fitness:nutrition_history_v1', JSON.stringify(store));
    });

    await page.reload();

    // Verify Simplify Meal Structure card appears
    await expect(page.locator('text=Simplify Meal Structure')).toBeVisible();
    await expect(page.locator('text=RECOMMENDED')).toBeVisible();
    await expect(page.locator('text=Review Simpler 2-Meal Structure →')).toBeVisible();

    const adaptation = await page.evaluate(() => (window as any).__LAST_NUTRITION_ADAPTATION__);
    expect(adaptation.primaryAction).toBe('simplify_structure');
    expect(adaptation.suggestedStructureSimplification).toBe(true);

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Adaptation: Preview, Accept, and Persist Simpler Plan Revision', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // Seed repeated meal skipping
    await page.evaluate(() => {
      const makeExec = (date: string) => ({
        schemaVersion: 1,
        executionId: `exec_${date}`,
        planId: 'plan_v1',
        date,
        status: 'completed',
        mealExecutions: [
          {
            mealSlotId: 'slot_1',
            mealName: 'Breakfast',
            slotType: 'breakfast',
            status: 'completed',
            loggedFoods: [{ foodId: 'eggs', foodName: 'Eggs', portionUnits: 2, servingDescription: '2', source: 'planned_food', calories: 144, proteinG: 12, fatG: 10, carbohydratesG: 1 }],
            consumedCalories: 144,
            consumedProteinG: 12,
            consumedFatG: 10,
            consumedCarbohydratesG: 1,
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
            loggedFoods: [{ foodId: 'chicken_breast', foodName: 'Chicken', portionUnits: 2, servingDescription: '200g', source: 'planned_food', calories: 330, proteinG: 62, fatG: 7, carbohydratesG: 0 }],
            consumedCalories: 330,
            consumedProteinG: 62,
            consumedFatG: 7,
            consumedCarbohydratesG: 0,
          },
        ],
        summary: {
          date,
          isQuantitative: true,
          plannedCalories: 3050,
          plannedProteinG: 160,
          plannedFatG: 65,
          plannedCarbohydratesG: 455,
          consumedCalories: 474,
          consumedProteinG: 74,
          consumedFatG: 17,
          consumedCarbohydratesG: 1,
          mealsPlanned: 3,
          mealsCompleted: 2,
          mealsPartial: 0,
          mealsSkipped: 1,
        },
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      });

      const store = {
        schemaVersion: 1,
        executions: [makeExec('2026-10-05'), makeExec('2026-10-06'), makeExec('2026-10-07')],
        lastUpdatedTimestamp: Date.now(),
      };
      localStorage.setItem('@adaptive_fitness:nutrition_history_v1', JSON.stringify(store));
    });

    await page.reload();

    // Click Review Simpler 2-Meal Structure
    await page.locator('text=Review Simpler 2-Meal Structure →').click();

    // Preview card appears
    await expect(page.locator('text=Proposed Plan Revision (2 Meals)')).toBeVisible();
    await expect(page.locator('text=PENDING REVIEW')).toBeVisible();
    await expect(page.locator('text=Daily energy target')).toBeVisible();

    // Click "Accept & Activate"
    await page.locator('text=Accept & Activate').click();

    // Active Revision banner appears
    await expect(page.locator('text=✓ Active Revised Structure: 2 Consolidated Meals')).toBeVisible();
    await expect(page.getByText('2 Meals ·')).toBeVisible();

    // Verify __LAST_PLAN_REVISION__ is accepted
    const revision = await page.evaluate(() => (window as any).__LAST_PLAN_REVISION__);
    expect(revision).not.toBeNull();
    expect(revision.status).toBe('accepted');
    expect(revision.revisedPlan.dailyPlan.totalMeals).toBe(2);

    // Reload page to verify persistence
    await page.reload();
    await expect(page.locator('text=✓ Active Revised Structure: 2 Consolidated Meals')).toBeVisible();
    await expect(page.getByText('2 Meals ·')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });

  test('Nutrition Adaptation: Reject Proposed Revision Keeps Original Plan', async ({
    page,
  }) => {
    const tracker = setupErrorTracking(page);

    await bootstrapPersona(page, 'PERSONA_G_QUANTITATIVE_READY');

    // Seed repeated meal skipping
    await page.evaluate(() => {
      const makeExec = (date: string) => ({
        schemaVersion: 1,
        executionId: `exec_${date}`,
        planId: 'plan_v1',
        date,
        status: 'completed',
        mealExecutions: [
          { mealSlotId: 'slot_1', mealName: 'B', slotType: 'breakfast', status: 'completed', loggedFoods: [], consumedCalories: 0, consumedProteinG: 0, consumedFatG: 0, consumedCarbohydratesG: 0 },
          { mealSlotId: 'slot_2', mealName: 'L', slotType: 'lunch', status: 'skipped', loggedFoods: [], consumedCalories: 0, consumedProteinG: 0, consumedFatG: 0, consumedCarbohydratesG: 0 },
          { mealSlotId: 'slot_3', mealName: 'D', slotType: 'dinner', status: 'completed', loggedFoods: [], consumedCalories: 0, consumedProteinG: 0, consumedFatG: 0, consumedCarbohydratesG: 0 },
        ],
        summary: { date, isQuantitative: false, consumedCalories: 0, consumedProteinG: 0, consumedFatG: 0, consumedCarbohydratesG: 0, mealsPlanned: 3, mealsCompleted: 2, mealsPartial: 0, mealsSkipped: 1 },
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      });
      const store = {
        schemaVersion: 1,
        executions: [makeExec('2026-10-05'), makeExec('2026-10-06'), makeExec('2026-10-07')],
        lastUpdatedTimestamp: Date.now(),
      };
      localStorage.setItem('@adaptive_fitness:nutrition_history_v1', JSON.stringify(store));
    });

    await page.reload();

    // Open preview
    await page.locator('text=Review Simpler 2-Meal Structure →').click();
    await expect(page.locator('text=Proposed Plan Revision (2 Meals)')).toBeVisible();

    // Click Keep Current Plan
    await page.locator('text=Keep Current Plan').click();

    // Preview closes, original 3 meals remain
    await expect(page.locator('text=Proposed Plan Revision (2 Meals)')).not.toBeVisible();
    await expect(page.getByText('3 Meals ·')).toBeVisible();

    expect(tracker.pageErrors).toEqual([]);
    expect(tracker.consoleErrors).toEqual([]);
  });
});
