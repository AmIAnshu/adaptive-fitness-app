/**
 * Nutrition Strategy Engine Comprehensive Tests (Stage W7.1)
 *
 * Exhaustive domain testing covering requirements A through AE.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  runNutritionStrategyPipeline,
  resolveNutritionObjective,
  resolveDietCompatibility,
  resolveMealStructure,
  resolveFoodPreferences,
} from '../nutritionStrategy';
import { validateNutritionStrategy } from '../nutritionValidation';
import { buildCanonicalUserProfile } from '../../profile';
import { QA_PERSONAS } from '../../../qa/personas';
import type { CanonicalUserProfile } from '../../profile';

describe('Nutrition Strategy Engine (Stage W7.1)', () => {
  const getProfile = (overrides: Partial<any> = {}): CanonicalUserProfile => {
    return buildCanonicalUserProfile({
      ...QA_PERSONAS.PERSONA_A_BASELINE,
      ...overrides,
    });
  };

  // A. Adult baseline profile
  it('A. processes adult baseline profile into completed NutritionStrategy', () => {
    const profile = getProfile();
    const result = runNutritionStrategyPipeline(profile);
    assert.strictEqual(result.status, 'completed');
    if (result.status === 'completed') {
      assert.strictEqual(result.population, 'adult');
      assert.strictEqual(result.strategy.schemaVersion, 1);
      const val = validateNutritionStrategy(result.strategy);
      assert.strictEqual(val.valid, true);
    }
  });

  // B. Hypertrophy nutrition objective
  it('B. maps build_muscle goal to muscle_gain_support objective', () => {
    const profile = getProfile({ goal: 'build_muscle' });
    const obj = resolveNutritionObjective(profile);
    assert.strictEqual(obj.primary, 'muscle_gain_support');
    assert.strictEqual(obj.source, 'derived_from_training_goal');
  });

  // C. Fat-loss nutrition objective
  it('C. maps lose_fat goal to fat_loss_support objective', () => {
    const profile = getProfile({ goal: 'lose_fat' });
    const obj = resolveNutritionObjective(profile);
    assert.strictEqual(obj.primary, 'fat_loss_support');
  });

  // D. Body-composition objective
  it('D. maps build_muscle_lose_fat goal to body_composition_support objective', () => {
    const profile = getProfile({ goal: 'build_muscle_lose_fat' });
    const obj = resolveNutritionObjective(profile);
    assert.strictEqual(obj.primary, 'body_composition_support');
  });

  // E. Strength objective
  it('E. maps get_stronger goal to performance_support objective', () => {
    const profile = getProfile({ goal: 'get_stronger' });
    const obj = resolveNutritionObjective(profile);
    assert.strictEqual(obj.primary, 'performance_support');
  });

  // F. General-fitness objective
  it('F. maps improve_fitness goal to general_health_support objective', () => {
    const profile = getProfile({ goal: 'improve_fitness' });
    const obj = resolveNutritionObjective(profile);
    assert.strictEqual(obj.primary, 'general_health_support');
  });

  // G. Vegetarian compatibility
  it('G. vegetarian diet hard-excludes meat, poultry, fish, and seafood', () => {
    const profile = getProfile({ dietType: 'vegetarian' });
    const comp = resolveDietCompatibility(profile);
    assert.strictEqual(comp.dietType, 'vegetarian');
    assert.ok(comp.hardExcludedFoodGroups.includes('meat'));
    assert.ok(comp.hardExcludedFoodGroups.includes('fish'));
    assert.ok(comp.hardExcludedFoodGroups.includes('seafood'));
  });

  // H. Vegan compatibility
  it('H. vegan diet hard-excludes all animal products including dairy and eggs', () => {
    const profile = getProfile({ dietType: 'vegan' });
    const comp = resolveDietCompatibility(profile);
    assert.strictEqual(comp.dietType, 'vegan');
    assert.ok(comp.hardExcludedFoodGroups.includes('dairy'));
    assert.ok(comp.hardExcludedFoodGroups.includes('eggs'));
    assert.ok(comp.hardExcludedFoodGroups.includes('meat'));
  });

  // I. Eggetarian compatibility
  it('I. eggetarian diet excludes meat/fish while permitting eggs', () => {
    const profile = getProfile({ dietType: 'eggetarian' });
    const comp = resolveDietCompatibility(profile);
    assert.strictEqual(comp.dietType, 'eggetarian');
    assert.ok(comp.hardExcludedFoodGroups.includes('meat'));
    assert.ok(!comp.hardExcludedFoodGroups.includes('eggs'));
  });

  // J. Restriction 'none' exclusivity
  it('J. restriction none is preserved as single restriction without conflicts', () => {
    const profile = getProfile({ dietaryRestrictions: ['none'] });
    const comp = resolveDietCompatibility(profile);
    assert.deepStrictEqual(comp.restrictions, ['none']);
  });

  // K. Multiple restrictions
  it('K. handles multiple hard restrictions (dairy, nuts, gluten)', () => {
    const profile = getProfile({ dietaryRestrictions: ['dairy', 'nuts', 'gluten'] });
    const comp = resolveDietCompatibility(profile);
    assert.ok(comp.hardExcludedFoodGroups.includes('dairy'));
    assert.ok(comp.hardExcludedFoodGroups.includes('nuts'));
    assert.ok(comp.hardExcludedFoodGroups.includes('gluten'));
  });

  // L. Liked food preservation
  it('L. preserves liked food IDs for future recommendation prioritization', () => {
    const profile = getProfile({ likedFoods: ['chicken_breast', 'oats', 'banana'] });
    const prefs = resolveFoodPreferences(profile);
    assert.deepStrictEqual(prefs.likedFoodIds, ['chicken_breast', 'oats', 'banana']);
  });

  // M. Disliked food exclusion
  it('M. preserves disliked food IDs for strict exclusion', () => {
    const profile = getProfile({ dislikedFoods: ['broccoli', 'tofu'] });
    const prefs = resolveFoodPreferences(profile);
    assert.deepStrictEqual(prefs.dislikedFoodIds, ['broccoli', 'tofu']);
  });

  // N. Empty food preferences
  it('N. handles empty food preferences cleanly', () => {
    const profile = getProfile({ likedFoods: [], dislikedFoods: [] });
    const prefs = resolveFoodPreferences(profile);
    assert.deepStrictEqual(prefs.likedFoodIds, []);
    assert.deepStrictEqual(prefs.dislikedFoodIds, []);
  });

  // O. Mostly cook
  it('O. mostly_cook sets high preparation burden', () => {
    const profile = getProfile({ mealSource: 'mostly_cook' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.preparationBurden, 'high_prep_burden');
  });

  // P. Family prepared
  it('P. family_prepares sets moderate shared preparation burden', () => {
    const profile = getProfile({ mealSource: 'family_prepares' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.preparationBurden, 'moderate_shared_burden');
  });

  // Q. Mixed meal source
  it('Q. mixed meal source sets mixed burden', () => {
    const profile = getProfile({ mealSource: 'mixed' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.preparationBurden, 'mixed_burden');
  });

  // R. Mostly outside
  it('R. mostly_outside sets low prep burden with convenience focus', () => {
    const profile = getProfile({ mealSource: 'mostly_outside' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.preparationBurden, 'low_burden');
  });

  // S. Rare eating out
  it('S. rarely eating out sets rare_dine_out outside food strategy', () => {
    const profile = getProfile({ eatingOutFrequency: 'rarely' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.outsideFoodStrategy, 'rare_dine_out');
  });

  // T. Frequent eating out
  it('T. almost_daily eating out sets convenience_first_ordering strategy', () => {
    const profile = getProfile({ eatingOutFrequency: 'almost_daily' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.outsideFoodStrategy, 'convenience_first_ordering');
  });

  // U. Very structured nutrition preference
  it('U. very_structured preference resolves strict_meal_plan level', () => {
    const profile = getProfile({ nutritionStructure: 'very_structured' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.structureLevel, 'strict_meal_plan');
    assert.strictEqual(meal.flexibilityLevel, 'low');
  });

  // V. Flexible nutrition preference
  it('V. flexible preference resolves flexible_options level', () => {
    const profile = getProfile({ nutritionStructure: 'flexible' });
    const meal = resolveMealStructure(profile);
    assert.strictEqual(meal.structureLevel, 'flexible_options');
    assert.strictEqual(meal.flexibilityLevel, 'high');
  });

  // W. Coach-decides nutrition preference
  it('W. coach_decides chooses realistic baseline matching lifestyle signals', () => {
    // Normal cook -> structured_framework
    const p1 = getProfile({ nutritionStructure: 'coach_decides', mealSource: 'mostly_cook' });
    const m1 = resolveMealStructure(p1);
    assert.strictEqual(m1.structureLevel, 'structured_framework');

    // Outside eater -> flexible_options
    const p2 = getProfile({ nutritionStructure: 'coach_decides', mealSource: 'mostly_outside' });
    const m2 = resolveMealStructure(p2);
    assert.strictEqual(m2.structureLevel, 'flexible_options');
  });

  // X. Insufficient quantitative inputs
  it('X. quantitative readiness is strictly pending with zero fabricated calories/macros', () => {
    const profile = getProfile();
    const result = runNutritionStrategyPipeline(profile);
    assert.strictEqual(result.status, 'completed');
    if (result.status === 'completed') {
      const q = result.strategy.quantitativeReadiness;
      assert.strictEqual(q.status, 'pending_required_inputs');
      assert.strictEqual(q.canCalculateCalories, false);
      assert.strictEqual(q.canCalculateMacros, false);
      assert.strictEqual(q.canCalculateTDEE, false);
      assert.ok(q.missingInputs.includes('biological_sex'));
    }
  });

  // Y. No fabricated sex
  it('Y. verifies biological sex is nowhere present in canonical profile or strategy', () => {
    const profile = getProfile();
    assert.strictEqual((profile as any).sex, undefined);
    assert.strictEqual((profile as any).biologicalSex, undefined);
    const result = runNutritionStrategyPipeline(profile);
    if (result.status === 'completed') {
      assert.strictEqual((result.strategy as any).sex, undefined);
    }
  });

  // Z. Youth boundary
  it('Z. youth trainees (13-17) are safely held at youth_nutrition_strategy_pending', () => {
    const profile = getProfile({ age: 15 });
    const result = runNutritionStrategyPipeline(profile);
    assert.strictEqual(result.status, 'pending');
    assert.strictEqual((result as any).path, 'youth_nutrition_strategy_pending');
  });

  // AA. Ineligible boundary
  it('AA. ineligible trainees (<13 or >100) are blocked at the boundary', () => {
    const pYoung = getProfile({ age: 10 });
    const rYoung = runNutritionStrategyPipeline(pYoung);
    assert.strictEqual(rYoung.status, 'ineligible');

    const pOld = getProfile({ age: 105 });
    const rOld = runNutritionStrategyPipeline(pOld);
    assert.strictEqual(rOld.status, 'ineligible');
  });

  // AB. Immutability
  it('AB. returned NutritionStrategy is frozen and input profile is never mutated', () => {
    const profile = getProfile();
    const originalSnapshot = JSON.stringify(profile);
    const result = runNutritionStrategyPipeline(profile);
    assert.strictEqual(JSON.stringify(profile), originalSnapshot);
    if (result.status === 'completed') {
      assert.ok(Object.isFrozen(result.strategy));
    }
  });

  // AC. Deterministic repeated resolution
  it('AC. identical inputs produce deeply identical nutrition strategies', () => {
    const profile = getProfile();
    const res1 = runNutritionStrategyPipeline(profile);
    const res2 = runNutritionStrategyPipeline(profile);
    assert.deepStrictEqual(res1, res2);
  });

  // AD. Invalid strategy rejection
  it('AD. validateNutritionStrategy detects and rejects damaged strategies', () => {
    const profile = getProfile();
    const result = runNutritionStrategyPipeline(profile);
    if (result.status === 'completed') {
      const corrupted: any = { ...result.strategy, schemaVersion: 99 };
      const val = validateNutritionStrategy(corrupted);
      assert.strictEqual(val.valid, false);
      assert.ok(val.errors.length > 0);
    }
  });

  // AE. Decision trace correctness
  it('AE. strategy maintains a transparent and auditable decision trace', () => {
    const profile = getProfile();
    const result = runNutritionStrategyPipeline(profile);
    if (result.status === 'completed') {
      assert.ok(result.strategy.decisionTrace.length >= 5);
      assert.ok(result.strategy.objective.decisionTrace.length >= 1);
      assert.ok(result.strategy.dietCompatibility.decisionTrace.length >= 1);
    }
  });
});
