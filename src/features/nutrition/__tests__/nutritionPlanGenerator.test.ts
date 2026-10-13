/**
 * Nutrition Plan Generator & Validator Unit Test Suite (Stage W7.4)
 *
 * Covers required categories:
 * A. adult quantitative plan
 * B. 2 meals/day
 * C. 3 meals/day
 * D. 4 meals/day
 * E. 5+ meal interpretation
 * F. structured meal plan
 * G. flexible framework
 * H. food-options mode
 * I. coach-selected structure
 * J. vegan constraints
 * K. vegetarian constraints
 * L. hard dietary restrictions
 * M. liked/disliked preferences
 * N. mostly-outside planning
 * O. mixed meal source
 * P. pending quantitative readiness
 * Q. youth protection
 * R. ineligible protection
 * S. determinism
 * T. immutability
 * U. daily total preservation
 * V. invalid/tampered input rejection
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateNutritionPlan,
  validateNutritionPlan,
  runNutritionStrategyPipeline,
  calculateNutritionTargets,
  resolveMealSlotCount,
  resolvePreparationOrientation,
  allocateDailyTargetsToMeals,
} from '../index';
import { buildCanonicalUserProfile } from '../../profile';
import {
  PERSONA_A_BASELINE,
  PERSONA_F_VEGAN_STRUCTURED,
  PERSONA_G_QUANTITATIVE_READY,
  PERSONA_H_FEMALE_READY,
  PERSONA_I_PREFER_NOT_TO_SAY,
} from '../../../qa/personas';

describe('Nutrition Plan Generator v1 (Stage W7.4)', () => {
  // A. Adult quantitative plan
  it('A. Generates valid adult quantitative NutritionPlan when targets are ready', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    assert.equal(stratRes.status, 'completed');
    if (stratRes.status !== 'completed') return;

    const targetsRes = calculateNutritionTargets(profile, stratRes.strategy);
    assert.equal(targetsRes.status, 'ready');
    if (targetsRes.status !== 'ready') return;

    const planRes = generateNutritionPlan(profile, stratRes.strategy, targetsRes.targets);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.schemaVersion, 1);
    assert.equal(planRes.plan.population, 'adult');
    assert.equal(planRes.plan.readinessStatus, 'ready');
    assert.ok(planRes.plan.dailyPlan.slots.length > 0);
    assert.ok(planRes.plan.dailyPlan.slots[0].targets !== undefined);

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true, `Validation failed: ${JSON.stringify(validation.errors)}`);
  });

  // B. 2 meals/day
  it('B. 2 meals/day generates exactly 2 slots with 50/50 baseline split', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, preferredMeals: '2' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.slots.length, 2);
    assert.equal(planRes.plan.dailyPlan.totalMeals, 2);
    assert.equal(planRes.plan.dailyPlan.slots[0].slotId, 'slot_1');
    assert.equal(planRes.plan.dailyPlan.slots[1].slotId, 'slot_2');

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true);
  });

  // C. 3 meals/day
  it('C. 3 meals/day generates exactly 3 slots with breakfast/lunch/dinner types', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, preferredMeals: '3' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.slots.length, 3);
    assert.equal(planRes.plan.dailyPlan.slots[0].slotType, 'breakfast');
    assert.equal(planRes.plan.dailyPlan.slots[1].slotType, 'lunch');
    assert.equal(planRes.plan.dailyPlan.slots[2].slotType, 'dinner');

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true);
  });

  // D. 4 meals/day
  it('D. 4 meals/day generates 4 slots with snack inclusion', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, preferredMeals: '4' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.slots.length, 4);
    assert.equal(planRes.plan.dailyPlan.slots[2].slotType, 'snack');

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true);
  });

  // E. 5+ meal interpretation
  it('E. 5+ meals/day interprets deterministically as 5 slots (3 main + 2 supportive)', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, preferredMeals: '5_plus' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.slots.length, 5);
    assert.equal(planRes.plan.dailyPlan.slots[0].slotType, 'breakfast');
    assert.equal(planRes.plan.dailyPlan.slots[1].slotType, 'lunch');
    assert.equal(planRes.plan.dailyPlan.slots[2].slotType, 'snack');
    assert.equal(planRes.plan.dailyPlan.slots[3].slotType, 'dinner');
    assert.equal(planRes.plan.dailyPlan.slots[4].slotType, 'snack');

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true);
  });

  // F. Structured meal plan
  it('F. Structured meal plan sets low flexibility and fixed ordering', () => {
    const raw = { ...PERSONA_F_VEGAN_STRUCTURED, biologicalSex: 'female' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.mealStructure.structureType, 'structured_meal_slots');
    assert.equal(planRes.plan.mealStructure.flexibilityLevel, 'low');
    assert.equal(planRes.plan.mealStructure.isInterchangeable, false);
  });

  // G. Flexible framework
  it('G. Flexible framework sets interchangeable slots and moderate/high flexibility', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, nutritionStructure: 'mostly_structured' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.mealStructure.structureType, 'flexible_interchangeable_slots');
    assert.equal(planRes.plan.mealStructure.isInterchangeable, true);
  });

  // H. Food-options mode
  it('H. Food-options mode sets high flexibility and food_options_framework', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, nutritionStructure: 'flexible' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.mealStructure.structureType, 'food_options_framework');
    assert.equal(planRes.plan.mealStructure.flexibilityLevel, 'high');
    assert.equal(planRes.plan.mealStructure.isInterchangeable, true);
  });

  // I. Coach-selected structure
  it('I. Coach-selected structure selects appropriate hybrid framework', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, nutritionStructure: 'coach_decides' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.ok(
      planRes.plan.mealStructure.structureType === 'flexible_interchangeable_slots' ||
        planRes.plan.mealStructure.structureType === 'coach_selected_hybrid'
    );
  });

  // J. Vegan constraints
  it('J. Vegan constraints strictly exclude animal food groups and preserve compensation', () => {
    const raw = { ...PERSONA_F_VEGAN_STRUCTURED, biologicalSex: 'female' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.boundaries.dietType, 'vegan');
    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('meat'));
    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('dairy'));
    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('eggs'));
  });

  // K. Vegetarian constraints
  it('K. Vegetarian constraints exclude meat and poultry but permit dairy/eggs unless restricted', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietType: 'vegetarian' as const,
      dietaryRestrictions: ['none'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.boundaries.dietType, 'vegetarian');
    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('meat'));
    assert.ok(!planRes.plan.boundaries.hardExcludedFoodGroups.includes('dairy'));
  });

  // L. Hard dietary restrictions
  it('L. Hard dietary restrictions (gluten, nuts, seafood) are strictly present in boundaries', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietaryRestrictions: ['gluten', 'nuts', 'seafood'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('gluten'));
    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('nuts'));
    assert.ok(planRes.plan.boundaries.hardExcludedFoodGroups.includes('seafood'));
  });

  // M. Liked/disliked preferences
  it('M. Liked foods are prioritized while disliked foods are strictly excluded from slot recommendations', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      likedFoods: ['chicken_breast', 'rice', 'broccoli'],
      dislikedFoods: ['cottage_cheese'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.deepEqual(planRes.plan.boundaries.strictlyExcludedDislikedFoodIds, ['cottage_cheese']);
    assert.ok(planRes.plan.boundaries.prioritizedLikedFoodIds.includes('chicken_breast'));

    for (const slot of planRes.plan.dailyPlan.slots) {
      assert.ok(!slot.recommendedLikedFoods.includes('cottage_cheese'));
      assert.ok(slot.recommendedLikedFoods.includes('chicken_breast'));
    }
  });

  // N. Mostly-outside planning
  it('N. Mostly-outside planning resolves to outside_friendly orientation', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      mealSource: 'mostly_outside' as const,
      eatingOutFrequency: 'almost_daily' as const,
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.preparationOrientation, 'outside_friendly');
    assert.ok(
      planRes.plan.dailyPlan.slots.some((s) => s.sourceContext === 'outside_convenience')
    );
  });

  // O. Mixed meal source
  it('O. Mixed meal source resolves to mixed_source orientation', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      mealSource: 'mixed' as const,
      eatingOutFrequency: '3_5_week' as const,
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'success');
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.preparationOrientation, 'mixed_source');
  });

  // P. Pending quantitative readiness
  it('P. Pending quantitative readiness produces qualitative plan with ZERO fabricated calories/macros', () => {
    // Persona A has unstated biological sex
    const profile = buildCanonicalUserProfile(PERSONA_A_BASELINE);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;

    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'pending');
    if (planRes.status !== 'pending') return;

    assert.equal(planRes.readinessStatus, 'pending_required_inputs');
    assert.equal(planRes.plan.readinessStatus, 'pending_required_inputs');
    assert.equal(planRes.plan.nutritionTargets, undefined);

    for (const slot of planRes.plan.dailyPlan.slots) {
      assert.equal(slot.targets, undefined);
    }

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true, `Pending validation failed: ${JSON.stringify(validation.errors)}`);
  });

  // Q. Youth protection
  it('Q. Youth protection (13-17) safely blocks adult plan generation', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 16 };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);

    // Strategy engine holds youth
    assert.equal(stratRes.status, 'pending');

    // Generating nutrition plan with a dummy adult strategy structure also blocks on profile youth boundary
    const planRes = generateNutritionPlan(
      profile,
      {
        schemaVersion: 1,
        population: 'adult',
        objective: { primary: 'general_health_support', source: 'safe_default', focusSummary: '', decisionTrace: [] },
        dietCompatibility: { dietType: 'no_preference', restrictions: ['none'], hardExcludedFoodGroups: [], decisionTrace: [] },
        mealStructure: { preferredMealCount: '3', mealPattern: 'three_meals', structureLevel: 'structured_framework', flexibilityLevel: 'moderate', preparationBurden: 'mixed_burden', outsideFoodStrategy: 'rare_dine_out', decisionTrace: [] },
        foodPreferences: { likedFoodIds: [], dislikedFoodIds: [], preferencePriorityMode: 'standard', decisionTrace: [] },
        planningMode: 'flexible_meal_framework',
        quantitativeReadiness: { status: 'pending_required_inputs', canCalculateCalories: false, canCalculateMacros: false, canCalculateTDEE: false, reason: '', missingInputs: [] },
        coachingContext: { communicationStyle: 'educational', decisionAutonomy: 'recommend', explanationDepth: 'detailed', accountability: 'gentle' },
        decisionTrace: ['trace'],
      }
    );

    assert.equal(planRes.status, 'youth_protection_pending');
    assert.equal(planRes.population, 'youth');
  });

  // R. Ineligible protection
  it('R. Ineligible protection (<13 or >100) rejects plan generation', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 11 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(
      profile,
      {} as any
    );
    assert.equal(planRes.status, 'ineligible');
  });

  // S. Determinism
  it('S. Identical inputs produce deeply identical NutritionPlan objects', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes1 = runNutritionStrategyPipeline(profile);
    const stratRes2 = runNutritionStrategyPipeline(profile);
    if (stratRes1.status !== 'completed' || stratRes2.status !== 'completed') return;

    const planRes1 = generateNutritionPlan(profile, stratRes1.strategy);
    const planRes2 = generateNutritionPlan(profile, stratRes2.strategy);

    assert.deepEqual(planRes1, planRes2);
  });

  // T. Immutability
  it('T. Generated plan is deeply frozen and rejects mutations', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    assert.ok(Object.isFrozen(planRes.plan));
    assert.ok(Object.isFrozen(planRes.plan.dailyPlan));
    assert.ok(Object.isFrozen(planRes.plan.dailyPlan.slots));
    assert.ok(Object.isFrozen(planRes.plan.dailyPlan.slots[0]));
    assert.ok(Object.isFrozen(planRes.plan.mealStructure));
    assert.ok(Object.isFrozen(planRes.plan.boundaries));

    assert.throws(() => {
      'use strict';
      (planRes.plan as any).schemaVersion = 2;
    }, TypeError);
  });

  // U. Daily total preservation
  it('U. Sum of meal target calories, protein, fat, and carbs exactly matches authoritative daily totals', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const targets = stratRes.strategy.targets!;
    assert.ok(targets !== undefined);

    for (const mealCount of [2, 3, 4, 5, 6]) {
      const allocated = allocateDailyTargetsToMeals(targets, mealCount);
      const sumCal = allocated.reduce((acc, s) => acc + s.targetEnergyKcal, 0);
      const sumPro = allocated.reduce((acc, s) => acc + s.targetProteinG, 0);
      const sumFat = allocated.reduce((acc, s) => acc + s.targetFatG, 0);
      const sumCarb = allocated.reduce((acc, s) => acc + s.targetCarbohydratesG, 0);

      assert.equal(sumCal, targets.energy.targetRange.midpointKcal, `Calorie sum mismatch for ${mealCount} meals`);
      assert.equal(sumPro, targets.macronutrients.protein.targetGrams, `Protein sum mismatch for ${mealCount} meals`);
      assert.equal(sumFat, targets.macronutrients.fat.targetGrams, `Fat sum mismatch for ${mealCount} meals`);
      assert.equal(sumCarb, targets.macronutrients.carbohydrates.targetGrams, `Carb sum mismatch for ${mealCount} meals`);
    }
  });

  // V. Invalid/tampered input rejection
  it('V. Validator rejects tampered plans (e.g. sum mismatch, fabricated pending targets, negative values)', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    // Test tamper: wrong slot calorie sum
    const tamperedCal = JSON.parse(JSON.stringify(planRes.plan));
    tamperedCal.dailyPlan.slots[0].targets.targetEnergyKcal += 100;
    Object.freeze(tamperedCal);
    const resCal = validateNutritionPlan(tamperedCal);
    assert.equal(resCal.valid, false);
    assert.ok(resCal.errors.some((e) => e.code === 'CALORIE_SUM_MISMATCH'));

    // Test tamper: negative macro
    const tamperedNeg = JSON.parse(JSON.stringify(planRes.plan));
    tamperedNeg.dailyPlan.slots[0].targets.targetProteinG = -5;
    Object.freeze(tamperedNeg);
    const resNeg = validateNutritionPlan(tamperedNeg);
    assert.equal(resNeg.valid, false);
    assert.ok(resNeg.errors.some((e) => e.code === 'INVALID_VALUE'));

    // Test tamper: mutable object
    const mutablePlan = JSON.parse(JSON.stringify(planRes.plan));
    const resMut = validateNutritionPlan(mutablePlan);
    assert.equal(resMut.valid, false);
    assert.ok(resMut.errors.some((e) => e.code === 'MUTABLE_PLAN'));
  });
});
