/**
 * Nutrition Strategy Validation Tests (Stage W7.1)
 *
 * Exhaustive domain testing for validateNutritionStrategy().
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateNutritionStrategy } from '../nutritionValidation';
import { runNutritionStrategyPipeline } from '../nutritionStrategy';
import { buildCanonicalUserProfile } from '../../profile';
import { QA_PERSONAS } from '../../../qa/personas';
import type { NutritionStrategy } from '../types';

describe('Nutrition Strategy Validation Tests (Stage W7.1)', () => {
  const baseProfile = buildCanonicalUserProfile(QA_PERSONAS.PERSONA_A_BASELINE);
  const pipelineResult = runNutritionStrategyPipeline(baseProfile);
  assert.strictEqual(pipelineResult.status, 'completed');
  const validStrategy: NutritionStrategy = (pipelineResult as any).strategy;

  it('validates a completely valid strategy with 0 errors', () => {
    const res = validateNutritionStrategy(validStrategy);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  it('rejects null or non-object strategy', () => {
    const res1 = validateNutritionStrategy(null);
    assert.strictEqual(res1.valid, false);
    assert.strictEqual(res1.errors[0].code, 'TYPE_ERROR');

    const res2 = validateNutritionStrategy('invalid');
    assert.strictEqual(res2.valid, false);
  });

  it('rejects schemaVersion other than 1', () => {
    const corrupted = { ...validStrategy, schemaVersion: 2 };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'INVALID_VERSION'));
  });

  it('rejects non-adult population', () => {
    const corrupted = { ...validStrategy, population: 'youth' };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'INVALID_POPULATION'));
  });

  it('rejects invalid or missing nutrition objective', () => {
    const corrupted1 = { ...validStrategy, objective: undefined };
    const res1 = validateNutritionStrategy(corrupted1);
    assert.strictEqual(res1.valid, false);
    assert.ok(res1.errors.some((e) => e.field === 'objective'));

    const corrupted2 = {
      ...validStrategy,
      objective: { ...validStrategy.objective, primary: 'ultra_keto_gain' as any },
    };
    const res2 = validateNutritionStrategy(corrupted2);
    assert.strictEqual(res2.valid, false);
    assert.ok(res2.errors.some((e) => e.code === 'INVALID_OBJECTIVE'));
  });

  it('rejects dietary restrictions combining none with specific items', () => {
    const corrupted = {
      ...validStrategy,
      dietCompatibility: {
        ...validStrategy.dietCompatibility,
        restrictions: ['none', 'dairy'] as any,
      },
    };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'MUTUAL_EXCLUSION_VIOLATION'));
  });

  it('rejects invalid dietary restrictions', () => {
    const corrupted = {
      ...validStrategy,
      dietCompatibility: {
        ...validStrategy.dietCompatibility,
        restrictions: ['space_dust'] as any,
      },
    };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'INVALID_RESTRICTION'));
  });

  it('rejects overlapping liked and disliked food items', () => {
    const corrupted = {
      ...validStrategy,
      foodPreferences: {
        ...validStrategy.foodPreferences,
        likedFoodIds: ['chicken_breast', 'banana'],
        dislikedFoodIds: ['spinach', 'banana'],
      },
    };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'PREFERENCE_CONFLICT'));
  });

  it('rejects fabricated quantitative precision', () => {
    const corrupted = {
      ...validStrategy,
      quantitativeReadiness: {
        ...validStrategy.quantitativeReadiness,
        canCalculateCalories: true as any,
      },
    };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'FABRICATED_PRECISION'));
  });

  it('rejects empty audit decision trace', () => {
    const corrupted = { ...validStrategy, decisionTrace: [] };
    const res = validateNutritionStrategy(corrupted);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.code === 'EMPTY_TRACE'));
  });
});
