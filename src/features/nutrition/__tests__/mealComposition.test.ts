/**
 * Food Catalog & Meal Composition Unit Test Suite (Stage W7.5)
 *
 * Requirements Covered:
 * A. food catalog schema
 * B. duplicate IDs rejection
 * C. invalid nutrient values rejection
 * D. invalid portions rejection
 * E. hard dietary exclusion
 * F. disliked food exclusion
 * G. liked-food preference ranking
 * H. vegan compatibility
 * I. vegetarian compatibility
 * J. eggetarian compatibility
 * K. outside-friendly foods prioritization
 * L. meal role compatibility
 * M. meal target fit
 * N. pending quantitative state (zero fabricated values)
 * O. youth protection
 * P. ineligible protection
 * Q. determinism
 * R. immutability
 * S. target preservation
 * T. 5+ meal resolution (explicit product rule: 5 slots)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORITATIVE_FOOD_CATALOG,
  getFoodById,
  validateFoodCatalog,
  isFoodCompatible,
  scoreFoodForSlot,
  composeMealCandidate,
  generateNutritionPlan,
  validateNutritionPlan,
  runNutritionStrategyPipeline,
  resolveMealSlotCount,
} from '../index';
import { buildCanonicalUserProfile } from '../../profile';
import {
  PERSONA_A_BASELINE,
  PERSONA_F_VEGAN_STRUCTURED,
  PERSONA_G_QUANTITATIVE_READY,
} from '../../../qa/personas';
import type { FoodDefinition } from '../foodCatalogTypes';

describe('Food Catalog & Deterministic Meal Composition (Stage W7.5)', () => {
  // A. Food catalog schema
  it('A. Authoritative food catalog conforms to schema with valid nutrient constants', () => {
    assert.ok(AUTHORITATIVE_FOOD_CATALOG.length >= 15);
    const validation = validateFoodCatalog(AUTHORITATIVE_FOOD_CATALOG);
    assert.equal(validation.valid, true, `Catalog validation failed: ${JSON.stringify(validation.errors)}`);
  });

  // B. Duplicate IDs rejection
  it('B. Validator rejects catalogs containing duplicate food IDs', () => {
    const invalidCatalog: FoodDefinition[] = [
      ...AUTHORITATIVE_FOOD_CATALOG,
      { ...AUTHORITATIVE_FOOD_CATALOG[0] }, // exact duplicate ID
    ];
    const validation = validateFoodCatalog(invalidCatalog);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((e) => e.code === 'DUPLICATE_ID'));
  });

  // C. Invalid nutrient values rejection
  it('C. Validator rejects catalogs containing negative, NaN, or infinite nutrient values', () => {
    const invalidCatalog: FoodDefinition[] = [
      {
        ...AUTHORITATIVE_FOOD_CATALOG[0],
        id: 'bad_nutrient_food',
        caloriesPerReference: -100,
      },
    ];
    const validation = validateFoodCatalog(invalidCatalog);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((e) => e.code === 'INVALID_NUTRIENT_VALUE'));
  });

  // D. Invalid portions rejection
  it('D. Validator rejects catalogs containing invalid portion bounds', () => {
    const invalidCatalog: FoodDefinition[] = [
      {
        ...AUTHORITATIVE_FOOD_CATALOG[0],
        id: 'bad_portion_food',
        minPortionUnits: 2.0,
        maxPortionUnits: 1.0, // max < min
      },
    ];
    const validation = validateFoodCatalog(invalidCatalog);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((e) => e.code === 'INVALID_PORTION_BOUNDS'));
  });

  // E. Hard dietary exclusion
  it('E. Foods containing excluded allergens (dairy, nuts, gluten, seafood) are strictly incompatible', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietaryRestrictions: ['dairy', 'nuts', 'seafood'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    assert.equal(stratRes.status, 'completed');
    if (stratRes.status !== 'completed') return;

    const paneer = getFoodById('paneer')!;
    const nuts = getFoodById('nuts')!;
    const fish = getFoodById('fish')!;
    const chicken = getFoodById('chicken_breast')!;

    assert.equal(isFoodCompatible(paneer, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(nuts, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(fish, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(chicken, stratRes.strategy).compatible, true);
  });

  // F. Disliked food exclusion
  it('F. Disliked foods are strictly barred from selection', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dislikedFoods: ['chicken_breast', 'broccoli'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;

    const chicken = getFoodById('chicken_breast')!;
    const broccoli = getFoodById('broccoli')!;
    assert.equal(isFoodCompatible(chicken, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(broccoli, stratRes.strategy).compatible, false);

    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    for (const slot of planRes.plan.dailyPlan.slots) {
      if (slot.composition) {
        assert.ok(!slot.composition.selectedFoods.some((f) => f.food.id === 'chicken_breast'));
        assert.ok(!slot.composition.selectedFoods.some((f) => f.food.id === 'broccoli'));
      }
    }
  });

  // G. Liked-food preference ranking
  it('G. Liked foods receive ranking preference without violating restrictions', () => {
    const salmon = getFoodById('fish')!;
    const scoreStandard = scoreFoodForSlot(salmon, 'protein_anchor', [], false);
    const scoreLiked = scoreFoodForSlot(salmon, 'protein_anchor', ['fish'], false);

    assert.ok(scoreLiked > scoreStandard);
  });

  // H. Vegan compatibility
  it('H. Vegan trainees only receive 100% plant-based foods', () => {
    const profile = buildCanonicalUserProfile(PERSONA_F_VEGAN_STRUCTURED);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;

    const chicken = getFoodById('chicken_breast')!;
    const eggs = getFoodById('eggs')!;
    const paneer = getFoodById('paneer')!;
    const tofu = getFoodById('tofu')!;
    const lentils = getFoodById('lentils_dal')!;

    assert.equal(isFoodCompatible(chicken, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(eggs, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(paneer, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(tofu, stratRes.strategy).compatible, true);
    assert.equal(isFoodCompatible(lentils, stratRes.strategy).compatible, true);

    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'pending'); // unstated biologicalSex
    if (planRes.status !== 'pending') return;

    for (const slot of planRes.plan.dailyPlan.slots) {
      if (slot.composition) {
        for (const item of slot.composition.selectedFoods) {
          assert.ok(item.food.compatibleDietTypes.includes('vegan'), `Non-vegan food selected: ${item.food.id}`);
        }
      }
    }
  });

  // I. Vegetarian compatibility
  it('I. Vegetarian trainees allow dairy and legumes but bar meats and fish', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietType: 'vegetarian' as const,
      dietaryRestrictions: ['none'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;

    const chicken = getFoodById('chicken_breast')!;
    const fish = getFoodById('fish')!;
    const paneer = getFoodById('paneer')!;
    const yogurt = getFoodById('yogurt_curd')!;

    assert.equal(isFoodCompatible(chicken, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(fish, stratRes.strategy).compatible, false);
    assert.equal(isFoodCompatible(paneer, stratRes.strategy).compatible, true);
    assert.equal(isFoodCompatible(yogurt, stratRes.strategy).compatible, true);
  });

  // J. Eggetarian compatibility
  it('J. Eggetarian trainees allow eggs and dairy but bar meats and fish', () => {
    const raw = {
      ...PERSONA_G_QUANTITATIVE_READY,
      dietType: 'eggetarian' as const,
      dietaryRestrictions: ['none'],
    };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;

    const eggs = getFoodById('eggs')!;
    const chicken = getFoodById('chicken_breast')!;
    assert.equal(isFoodCompatible(eggs, stratRes.strategy).compatible, true);
    assert.equal(isFoodCompatible(chicken, stratRes.strategy).compatible, false);
  });

  // K. Outside-friendly foods prioritization
  it('K. Outside-friendly foods receive bonus ranking in outside_convenience slots', () => {
    const chicken = getFoodById('chicken_breast')!;
    const oats = getFoodById('oats')!; // not outside friendly

    const scoreChickenOutside = scoreFoodForSlot(chicken, 'protein_anchor', [], true);
    const scoreChickenHome = scoreFoodForSlot(chicken, 'protein_anchor', [], false);
    assert.ok(scoreChickenOutside > scoreChickenHome);

    const scoreOatsOutside = scoreFoodForSlot(oats, 'carbohydrate_fuel', [], true);
    const scoreOatsHome = scoreFoodForSlot(oats, 'carbohydrate_fuel', [], false);
    assert.equal(scoreOatsOutside, scoreOatsHome);
  });

  // L. Meal role compatibility
  it('L. Food roles are respected (e.g. protein anchors, carbohydrate fuels, vegetable fibers)', () => {
    const chicken = getFoodById('chicken_breast')!;
    const rice = getFoodById('brown_rice')!;
    const broccoli = getFoodById('broccoli')!;

    assert.ok(chicken.mealRoles.includes('protein_anchor'));
    assert.ok(rice.mealRoles.includes('carbohydrate_fuel'));
    assert.ok(broccoli.mealRoles.includes('vegetable_fiber'));
  });

  // M. Meal target fit
  it('M. Meal composition fits near authoritative meal targets with bounded portions', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    for (const slot of planRes.plan.dailyPlan.slots) {
      assert.ok(slot.composition !== undefined);
      assert.ok(slot.composition!.isQuantitative === true);
      assert.ok(slot.composition!.selectedFoods.length >= 2);
      assert.ok(slot.composition!.totalEstimatedCalories > 0);
      assert.ok(slot.composition!.totalEstimatedProteinG > 0);
      assert.ok(slot.composition!.fitLevel === 'tight_fit' || slot.composition!.fitLevel === 'moderate_fit');
    }
  });

  // N. Pending quantitative state (zero fabricated values)
  it('N. Pending quantitative users receive qualitative meal candidates with ZERO fabricated calories/macros', () => {
    const profile = buildCanonicalUserProfile(PERSONA_A_BASELINE); // unstated biological sex
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    assert.equal(planRes.status, 'pending');
    if (planRes.status !== 'pending') return;

    for (const slot of planRes.plan.dailyPlan.slots) {
      assert.ok(slot.composition !== undefined);
      assert.equal(slot.composition!.isQuantitative, false);
      assert.equal(slot.composition!.totalEstimatedCalories, 0);
      assert.equal(slot.composition!.totalEstimatedProteinG, 0);
      assert.equal(slot.composition!.totalEstimatedFatG, 0);
      assert.equal(slot.composition!.totalEstimatedCarbohydratesG, 0);
      assert.equal(slot.composition!.fitLevel, 'qualitative_guideline');
      assert.ok(slot.composition!.selectedFoods.length > 0); // qualitative recommendations exist
    }

    const validation = validateNutritionPlan(planRes.plan);
    assert.equal(validation.valid, true);
  });

  // O. Youth protection
  it('O. Youth trainees (13-17) stop safely at youth_protection_pending', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 15 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(profile, {} as any);
    assert.equal(planRes.status, 'youth_protection_pending');
  });

  // P. Ineligible protection
  it('P. Ineligible trainees (<13 or >100) are rejected at the boundary', () => {
    const raw = { ...PERSONA_G_QUANTITATIVE_READY, age: 105 };
    const profile = buildCanonicalUserProfile(raw);
    const planRes = generateNutritionPlan(profile, {} as any);
    assert.equal(planRes.status, 'ineligible');
  });

  // Q. Determinism
  it('Q. Identical profile produces deeply identical meal compositions', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes1 = runNutritionStrategyPipeline(profile);
    const stratRes2 = runNutritionStrategyPipeline(profile);
    if (stratRes1.status !== 'completed' || stratRes2.status !== 'completed') return;

    const planRes1 = generateNutritionPlan(profile, stratRes1.strategy);
    const planRes2 = generateNutritionPlan(profile, stratRes2.strategy);
    assert.deepEqual(planRes1, planRes2);
  });

  // R. Immutability
  it('R. Catalog and composition candidates are deeply frozen', () => {
    assert.ok(Object.isFrozen(AUTHORITATIVE_FOOD_CATALOG));
    assert.ok(Object.isFrozen(AUTHORITATIVE_FOOD_CATALOG[0]));

    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    const comp = planRes.plan.dailyPlan.slots[0].composition!;
    assert.ok(Object.isFrozen(comp));
    assert.ok(Object.isFrozen(comp.selectedFoods));
    assert.ok(Object.isFrozen(comp.selectedFoods[0]));

    assert.throws(() => {
      'use strict';
      (comp as any).totalEstimatedCalories = 9999;
    }, TypeError);
  });

  // S. Target preservation
  it('S. Authoritative daily targets remain unchanged after meal composition', () => {
    const profile = buildCanonicalUserProfile(PERSONA_G_QUANTITATIVE_READY);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const origMidpoint = stratRes.strategy.targets!.energy.targetRange.midpointKcal;

    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.nutritionTargets!.energy.targetRange.midpointKcal, origMidpoint);
  });

  // T. 5+ meal resolution (explicit product rule: 5 slots)
  it('T. preferredMeals "5_plus" resolves deterministically to exactly 5 meal slots', () => {
    const slotCount = resolveMealSlotCount('5_plus');
    assert.equal(slotCount, 5, 'preferredMeals "5_plus" must resolve to exactly 5 meal slots');

    const raw = { ...PERSONA_G_QUANTITATIVE_READY, preferredMeals: '5_plus' as const };
    const profile = buildCanonicalUserProfile(raw);
    const stratRes = runNutritionStrategyPipeline(profile);
    if (stratRes.status !== 'completed') return;
    const planRes = generateNutritionPlan(profile, stratRes.strategy);
    if (planRes.status !== 'success') return;

    assert.equal(planRes.plan.dailyPlan.totalMeals, 5);
    assert.equal(planRes.plan.dailyPlan.slots.length, 5);
  });
});
