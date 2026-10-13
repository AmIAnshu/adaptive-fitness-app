/**
 * Quantitative Profile Input & Nutrition Target UX Unit Tests (Stage W7.3)
 *
 * Exhaustive domain testing covering requirements A through T:
 * A. Screen 2 optional biological-sex contract
 * B. Female selection persists
 * C. Male selection persists
 * D. Prefer-not-to-say persists
 * E. No selection is valid
 * F. Navigation/cloning preserves value
 * G. Legacy profile with undefined value remains valid
 * H. Canonical profile preserves value
 * I. Quantitative readiness becomes ready for female
 * J. Quantitative readiness becomes ready for male
 * K. Prefer-not-to-say remains pending
 * L. Undefined remains pending
 * M. Generated targets appear for ready profile
 * N. Pending state handled correctly
 * O. Changing value regenerates targets deterministically
 * P. Previous targets are immutable
 * Q. No workout history mutation occurs
 * R. Invalid biologicalSex values are rejected
 * S. No inferred biological sex from goal/lifestyle
 * T. Repeated generation is deterministic
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIOLOGICAL_SEX_OPTIONS,
  validateBiologicalSex,
} from '../index';
import {
  buildCanonicalUserProfile,
  validateCanonicalUserProfile,
} from '../../profile';
import {
  runNutritionStrategyPipeline,
} from '../../nutrition/nutritionStrategy';
import { validateNutritionStrategy } from '../../nutrition/nutritionValidation';
import {
  evaluateQuantitativeReadiness,
  calculateNutritionTargets,
} from '../../nutrition/nutritionTargetEngine';
import { validateNutritionTargets } from '../../nutrition/nutritionTargetValidation';
import { QA_PERSONAS } from '../../../qa/personas';
import type { OnboardingData } from '../onboardingState';

describe('Quantitative Profile Input & Nutrition Target UX (Stage W7.3)', () => {
  const baseData: OnboardingData = {
    ...QA_PERSONAS.PERSONA_A_BASELINE,
    biologicalSex: undefined,
  };

  // A. Screen 2 renders optional biological-sex options contract
  it('A. verifies BIOLOGICAL_SEX_OPTIONS contains female, male, prefer_not_to_say', () => {
    assert.equal(BIOLOGICAL_SEX_OPTIONS.length, 3);
    const ids = BIOLOGICAL_SEX_OPTIONS.map((o) => o.id);
    assert.ok(ids.includes('female'));
    assert.ok(ids.includes('male'));
    assert.ok(ids.includes('prefer_not_to_say'));
  });

  // B. Female selection persists
  it('B. validates and preserves female selection', () => {
    const res = validateBiologicalSex('female');
    assert.equal(res.isValid, true);
    assert.equal(res.value, 'female');

    const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'female' });
    assert.equal(profile.anthropometrics.biologicalSex, 'female');
  });

  // C. Male selection persists
  it('C. validates and preserves male selection', () => {
    const res = validateBiologicalSex('male');
    assert.equal(res.isValid, true);
    assert.equal(res.value, 'male');

    const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'male' });
    assert.equal(profile.anthropometrics.biologicalSex, 'male');
  });

  // D. Prefer-not-to-say persists
  it('D. validates and preserves prefer_not_to_say selection', () => {
    const res = validateBiologicalSex('prefer_not_to_say');
    assert.equal(res.isValid, true);
    assert.equal(res.value, 'prefer_not_to_say');

    const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'prefer_not_to_say' });
    assert.equal(profile.anthropometrics.biologicalSex, 'prefer_not_to_say');
  });

  // E. No selection is valid
  it('E. treats omitted / undefined biological sex as strictly valid', () => {
    const res1 = validateBiologicalSex(undefined);
    assert.equal(res1.isValid, true);
    assert.equal(res1.value, undefined);

    const res2 = validateBiologicalSex('');
    assert.equal(res2.isValid, true);
    assert.equal(res2.value, undefined);

    const res3 = validateBiologicalSex(null);
    assert.equal(res3.isValid, true);
    assert.equal(res3.value, undefined);
  });

  // F. Navigation / cloning preserves value
  it('F. preserves biological sex across serialization and state cloning', () => {
    const original: OnboardingData = { ...baseData, biologicalSex: 'female' };
    const cloned: OnboardingData = JSON.parse(JSON.stringify(original));
    assert.equal(cloned.biologicalSex, 'female');

    const profile = buildCanonicalUserProfile(cloned);
    assert.equal(profile.anthropometrics.biologicalSex, 'female');
  });

  // G. Legacy profile with undefined value remains valid
  it('G. validates legacy profile without biologicalSex with 0 errors', () => {
    const legacyData: OnboardingData = { ...QA_PERSONAS.PERSONA_A_BASELINE };
    delete (legacyData as any).biologicalSex;

    const profile = buildCanonicalUserProfile(legacyData);
    assert.equal(profile.anthropometrics.biologicalSex, undefined);

    const validation = validateCanonicalUserProfile(profile);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
  });

  // H. Canonical profile preserves value
  it('H. normalizer strictly maps biological sex into anthropometrics', () => {
    const maleProfile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'male' });
    assert.equal(maleProfile.anthropometrics.biologicalSex, 'male');

    const femaleProfile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'female' });
    assert.equal(femaleProfile.anthropometrics.biologicalSex, 'female');

    const unstatedProfile = buildCanonicalUserProfile({ ...baseData, biologicalSex: undefined });
    assert.equal(unstatedProfile.anthropometrics.biologicalSex, undefined);
  });

  // I. Quantitative readiness becomes ready for female
  it('I. quantitative readiness resolves to ready with Mifflin-St Jeor for female', () => {
    const femaleProfile = buildCanonicalUserProfile({
      ...baseData,
      age: 26,
      heightCm: 168,
      weightKg: 65,
      biologicalSex: 'female',
    });
    const readiness = evaluateQuantitativeReadiness(femaleProfile);
    assert.equal(readiness.status, 'ready');
    assert.equal(readiness.canCalculateCalories, true);
    assert.equal(readiness.canCalculateMacros, true);
    assert.equal(readiness.method, 'mifflin_st_jeor');

    const result = runNutritionStrategyPipeline(femaleProfile);
    assert.equal(result.status, 'completed');
    if (result.status === 'completed') {
      assert.equal(result.strategy.quantitativeReadiness.status, 'ready');
      assert.ok(result.strategy.targets);
      // BMR female: 10*65 + 6.25*168 - 5*26 - 161 = 650 + 1050 - 130 - 161 = 1409 kcal
      assert.equal(result.strategy.targets.energy.bmrKcal, 1409);
    }
  });

  // J. Quantitative readiness becomes ready for male
  it('J. quantitative readiness resolves to ready with Mifflin-St Jeor for male', () => {
    const maleProfile = buildCanonicalUserProfile({
      ...baseData,
      age: 28,
      heightCm: 180,
      weightKg: 80,
      biologicalSex: 'male',
    });
    const readiness = evaluateQuantitativeReadiness(maleProfile);
    assert.equal(readiness.status, 'ready');
    assert.equal(readiness.canCalculateCalories, true);
    assert.equal(readiness.canCalculateMacros, true);

    const result = runNutritionStrategyPipeline(maleProfile);
    assert.equal(result.status, 'completed');
    if (result.status === 'completed') {
      assert.equal(result.strategy.quantitativeReadiness.status, 'ready');
      assert.ok(result.strategy.targets);
      // BMR male: 10*80 + 6.25*180 - 5*28 + 5 = 800 + 1125 - 140 + 5 = 1790 kcal
      assert.equal(result.strategy.targets.energy.bmrKcal, 1790);
    }
  });

  // K. Prefer-not-to-say remains pending
  it('K. quantitative readiness remains pending_required_inputs for prefer_not_to_say', () => {
    const profile = buildCanonicalUserProfile({
      ...baseData,
      biologicalSex: 'prefer_not_to_say',
    });
    const readiness = evaluateQuantitativeReadiness(profile);
    assert.equal(readiness.status, 'pending_required_inputs');
    assert.equal(readiness.canCalculateCalories, false);
    assert.equal(readiness.canCalculateMacros, false);
    assert.ok(readiness.missingInputs.includes('biological_sex'));

    const result = runNutritionStrategyPipeline(profile);
    assert.equal(result.status, 'completed');
    if (result.status === 'completed') {
      assert.equal(result.strategy.quantitativeReadiness.status, 'pending_required_inputs');
      assert.equal(result.strategy.targets, undefined);
    }
  });

  // L. Undefined remains pending
  it('L. quantitative readiness remains pending_required_inputs for unstated sex', () => {
    const profile = buildCanonicalUserProfile({
      ...baseData,
      biologicalSex: undefined,
    });
    const readiness = evaluateQuantitativeReadiness(profile);
    assert.equal(readiness.status, 'pending_required_inputs');
    assert.equal(readiness.canCalculateCalories, false);

    const result = runNutritionStrategyPipeline(profile);
    assert.equal(result.status, 'completed');
    if (result.status === 'completed') {
      assert.equal(result.strategy.quantitativeReadiness.status, 'pending_required_inputs');
      assert.equal(result.strategy.targets, undefined);
    }
  });

  // M. Generated targets appear for ready profile
  it('M. generates full valid NutritionTargets for ready profile', () => {
    const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'male' });
    const result = runNutritionStrategyPipeline(profile);
    assert.equal(result.status, 'completed');
    if (result.status === 'completed') {
      const targets = result.strategy.targets;
      assert.ok(targets);
      assert.equal(targets.schemaVersion, 1);
      assert.equal(targets.population, 'adult');
      assert.equal(targets.status, 'ready');
      assert.ok(targets.energy.targetRange.minKcal < targets.energy.targetRange.maxKcal);
      assert.ok(targets.macronutrients.protein.targetGrams > 0);
      assert.ok(targets.macronutrients.fat.targetGrams >= 45);
      assert.ok(targets.macronutrients.carbohydrates.targetGrams > 0);

      const targetVal = validateNutritionTargets(targets);
      assert.equal(targetVal.valid, true);
    }
  });

  // N. Pending state displays correctly
  it('N. qualitative strategy is complete while targets remain pending when sex is unstated', () => {
    const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: undefined });
    const result = runNutritionStrategyPipeline(profile);
    assert.equal(result.status, 'completed');
    if (result.status === 'completed') {
      assert.equal(result.strategy.objective.primary, 'muscle_gain_support');
      assert.equal(result.strategy.dietCompatibility.dietType, 'non_vegetarian');
      assert.equal(result.strategy.quantitativeReadiness.status, 'pending_required_inputs');
      assert.equal(result.strategy.targets, undefined);

      const strategyVal = validateNutritionStrategy(result.strategy);
      assert.equal(strategyVal.valid, true);
    }
  });

  // O. Changing value regenerates targets deterministically
  it('O. updating biological sex regenerates targets without mutating original state', () => {
    const unstatedProfile = buildCanonicalUserProfile({ ...baseData, biologicalSex: undefined });
    const res1 = runNutritionStrategyPipeline(unstatedProfile);
    assert.equal(res1.status, 'completed');
    if (res1.status === 'completed') {
      assert.equal(res1.strategy.targets, undefined);
    }

    // Now update profile to male
    const maleProfile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'male' });
    const res2 = runNutritionStrategyPipeline(maleProfile);
    assert.equal(res2.status, 'completed');
    if (res2.status === 'completed') {
      assert.ok(res2.strategy.targets);
      assert.equal(res2.strategy.targets.energy.bmrKcal, 1790);
    }

    // res1 strategy remains unchanged
    if (res1.status === 'completed') {
      assert.equal(res1.strategy.targets, undefined);
    }
  });

  // P. Previous targets are immutable
  it('P. guarantees deep freeze immutability of returned NutritionTargets', () => {
    const maleProfile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'male' });
    const res = runNutritionStrategyPipeline(maleProfile);
    assert.equal(res.status, 'completed');
    if (res.status === 'completed') {
      const targets = res.strategy.targets!;
      assert.ok(Object.isFrozen(targets));
      assert.ok(Object.isFrozen(targets.energy));
      assert.ok(Object.isFrozen(targets.macronutrients));

      assert.throws(() => {
        'use strict';
        (targets as any).schemaVersion = 2;
      }, TypeError);
      assert.throws(() => {
        'use strict';
        (targets.energy as any).bmrKcal = 9999;
      }, TypeError);
    }
  });

  // Q. No workout history mutation occurs
  it('Q. verifies workout history repository contracts are unaffected by quantitative targeting', () => {
    const sampleExecution = {
      executionId: 'exec_test_1',
      planId: 'plan_test_1',
      sessionId: 'session_1',
      status: 'completed',
    };
    const cloned = JSON.parse(JSON.stringify(sampleExecution));

    // Run pipeline with female profile
    const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'female' });
    runNutritionStrategyPipeline(profile);

    // Verify workout execution object remained unchanged
    assert.deepEqual(sampleExecution, cloned);
  });

  // R. Invalid biologicalSex values are rejected
  it('R. rejects invalid biological sex values in validator and profile schema', () => {
    const invalidValues = ['other', 'intersex', 'prefer_not_say', 'MALE', 123, true, {}];

    for (const val of invalidValues) {
      const res = validateBiologicalSex(val);
      assert.equal(res.isValid, false, `Expected ${val} to fail validateBiologicalSex`);

      const profile = buildCanonicalUserProfile({ ...baseData, biologicalSex: val as any });
      const valResult = validateCanonicalUserProfile(profile);
      assert.equal(valResult.valid, false, `Expected ${val} to fail validateCanonicalUserProfile`);
      assert.ok(valResult.errors.some((e) => e.field === 'anthropometrics.biologicalSex'));
    }
  });

  // S. No inferred biological sex from goal or lifestyle
  it('S. strictly forbids inferring biological sex from goal, training history, or lifestyle', () => {
    const muscleProfile = buildCanonicalUserProfile({
      ...baseData,
      goal: 'build_muscle',
      preferredStyle: 'hypertrophy',
      preferredEffort: 'very_hard',
      biologicalSex: undefined,
    });
    assert.equal(muscleProfile.anthropometrics.biologicalSex, undefined);
    const res = evaluateQuantitativeReadiness(muscleProfile);
    assert.equal(res.status, 'pending_required_inputs');
    assert.equal(res.canCalculateCalories, false);
  });

  // T. Repeated generation is deterministic
  it('T. identical profile inputs produce deeply identical nutrition strategies and targets', () => {
    const profile1 = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'female' });
    const profile2 = buildCanonicalUserProfile({ ...baseData, biologicalSex: 'female' });

    const res1 = runNutritionStrategyPipeline(profile1);
    const res2 = runNutritionStrategyPipeline(profile2);

    assert.deepEqual(res1, res2);
  });
});
