/**
 * T1 — Goal Resolution Test Suite
 *
 * Verifies all required invariants:
 * 1. Build muscle maps to hypertrophy.
 * 2. Lose fat maps to fat_loss_support.
 * 3. Build muscle + lose fat maps to body_composition.
 * 4. Get stronger maps to strength.
 * 5. Improve fitness maps to general_fitness.
 * 6. Not sure + hypertrophy preference infers hypertrophy.
 * 7. Not sure + strength preference infers strength.
 * 8. Not sure + general fitness preference infers general_fitness.
 * 9. Not sure + high_intensity preference alone does NOT infer a special objective.
 * 10. Insufficient information falls back to general_fitness.
 * 11. Every result has a non-empty decisionTrace.
 * 12. Same input produces exactly the same result (determinism).
 * 13. The function does not mutate the profile.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingObjective } from '../goalResolution';

/**
 * Fixture factory: creates a validated CanonicalUserProfile with specific overrides.
 */
function createProfile(overrides: Partial<OnboardingData> = {}): CanonicalUserProfile {
  const baseData: OnboardingData = {
    goal: 'build_muscle',
    age: 28,
    heightCm: 180,
    weightKg: 78.5,
    trainingHistory: '1_to_2_years',
    consistency: 'mostly_consistent',
    exerciseConfidence: 4,
    programmingConfidence: 3,
    idealTrainingDays: 4,
    realisticMinimumDays: 3,
    availableDays: ['mon', 'wed', 'fri', 'sat'],
    scheduleFlexibility: 'sometimes_changes',
    sessionDuration: '45_60',
    preferredTrainingTime: 'evening',
    trainingLocation: 'commercial_gym',
    equipmentMode: 'most_gym_equipment',
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'repeat_key_exercises',
    favorites: ['bench_press'],
    dislikes: ['burpees'],
    avoid: ['behind_neck_press'],
    skippedBecauseUnsure: false,
    sleepDuration: '7_to_8',
    sleepQuality: 4,
    energyLevel: 4,
    stressLevel: 2,
    workoutRecovery: 'mostly_recovered',
    dailyActivity: 'moderate',
    averageSteps: 8500,
    dietType: 'non_vegetarian',
    dietaryRestrictions: ['none'],
    likedFoods: ['chicken_breast'],
    dislikedFoods: ['celery'],
    preferredMeals: '3',
    mealSource: 'mostly_cook',
    eatingOutFrequency: '1_2_week',
    nutritionStructure: 'mostly_structured',
    communicationStyle: 'educational',
    decisionAutonomy: 'recommend',
    explanationDepth: 'detailed',
    accountability: 'gentle',
    isCompleted: true,
    ...overrides,
  };

  return buildCanonicalUserProfile(baseData);
}

describe('T1 — Goal Resolution', () => {
  it('1. Build muscle maps to hypertrophy', () => {
    const profile = createProfile({ goal: 'build_muscle' });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'hypertrophy');
    assert.equal(result.source, 'explicit');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'low');
    assert.equal(result.performancePriority, 'moderate');
    assert.ok(result.decisionTrace.length >= 2);
  });

  it('2. Lose fat maps to fat_loss_support', () => {
    const profile = createProfile({ goal: 'lose_fat' });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'fat_loss_support');
    assert.equal(result.source, 'explicit');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'moderate');
    assert.equal(result.performancePriority, 'low');
    assert.ok(result.decisionTrace.length >= 2);
  });

  it('3. Build muscle + lose fat maps to body_composition', () => {
    const profile = createProfile({ goal: 'build_muscle_lose_fat' });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'body_composition');
    assert.equal(result.source, 'explicit');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'moderate');
    assert.equal(result.performancePriority, 'moderate');
    assert.ok(result.decisionTrace.length >= 2);
  });

  it('4. Get stronger maps to strength', () => {
    const profile = createProfile({ goal: 'get_stronger' });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'strength');
    assert.equal(result.source, 'explicit');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'low');
    assert.equal(result.performancePriority, 'high');
    assert.ok(result.decisionTrace.length >= 2);
  });

  it('5. Improve fitness maps to general_fitness', () => {
    const profile = createProfile({ goal: 'improve_fitness' });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'general_fitness');
    assert.equal(result.source, 'explicit');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'moderate');
    assert.equal(result.performancePriority, 'moderate');
    assert.ok(result.decisionTrace.length >= 2);
  });

  it('6. Not sure + hypertrophy preference infers hypertrophy', () => {
    const profile = createProfile({
      goal: 'not_sure',
      preferredStyle: 'hypertrophy',
    });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'hypertrophy');
    assert.equal(result.source, 'inferred_from_preferences');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'low');
    assert.equal(result.performancePriority, 'moderate');
    assert.ok(result.decisionTrace.some((t) => t.includes('hypertrophy')));
  });

  it('7. Not sure + strength preference infers strength', () => {
    const profile = createProfile({
      goal: 'not_sure',
      preferredStyle: 'strength',
    });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'strength');
    assert.equal(result.source, 'inferred_from_preferences');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'low');
    assert.equal(result.performancePriority, 'high');
    assert.ok(result.decisionTrace.some((t) => t.includes('strength')));
  });

  it('8. Not sure + general fitness preference infers general_fitness', () => {
    const profile = createProfile({
      goal: 'not_sure',
      preferredStyle: 'general_fitness',
    });
    const result = resolveTrainingObjective(profile);

    assert.equal(result.primary, 'general_fitness');
    assert.equal(result.source, 'inferred_from_preferences');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'moderate');
    assert.equal(result.performancePriority, 'moderate');
    assert.ok(result.decisionTrace.some((t) => t.includes('general_fitness')));
  });

  it('9. Not sure + high_intensity preference alone does NOT infer a special objective', () => {
    const profile = createProfile({
      goal: 'not_sure',
      preferredStyle: 'high_intensity',
    });
    const result = resolveTrainingObjective(profile);

    // Must NOT infer high_intensity as a primary objective; falls back to general_fitness as safe default
    assert.equal(result.primary, 'general_fitness');
    assert.equal(result.source, 'safe_default');
    assert.equal(result.resistancePriority, 'high');
    assert.equal(result.conditioningPriority, 'moderate');
    assert.equal(result.performancePriority, 'moderate');
  });

  it('10. Insufficient information falls back to general_fitness as safe default', () => {
    // Both goal and training style are "not_sure"
    const profileNotSure = createProfile({
      goal: 'not_sure',
      preferredStyle: 'not_sure',
    });
    const result1 = resolveTrainingObjective(profileNotSure);

    assert.equal(result1.primary, 'general_fitness');
    assert.equal(result1.source, 'safe_default');
    assert.equal(result1.resistancePriority, 'high');
    assert.equal(result1.conditioningPriority, 'moderate');
    assert.equal(result1.performancePriority, 'moderate');

    // Goal not_sure with balanced style
    const profileBalanced = createProfile({
      goal: 'not_sure',
      preferredStyle: 'balanced',
    });
    const result2 = resolveTrainingObjective(profileBalanced);

    assert.equal(result2.primary, 'general_fitness');
    assert.equal(result2.source, 'safe_default');
  });

  it('11. Every result has a non-empty decisionTrace', () => {
    const profiles = [
      createProfile({ goal: 'build_muscle' }),
      createProfile({ goal: 'lose_fat' }),
      createProfile({ goal: 'build_muscle_lose_fat' }),
      createProfile({ goal: 'get_stronger' }),
      createProfile({ goal: 'improve_fitness' }),
      createProfile({ goal: 'not_sure', preferredStyle: 'hypertrophy' }),
      createProfile({ goal: 'not_sure', preferredStyle: 'strength' }),
      createProfile({ goal: 'not_sure', preferredStyle: 'general_fitness' }),
      createProfile({ goal: 'not_sure', preferredStyle: 'high_intensity' }),
      createProfile({ goal: 'not_sure', preferredStyle: 'not_sure' }),
    ];

    for (const p of profiles) {
      const res = resolveTrainingObjective(p);
      assert.ok(Array.isArray(res.decisionTrace));
      assert.ok(res.decisionTrace.length > 0);
      for (const trace of res.decisionTrace) {
        assert.equal(typeof trace, 'string');
        assert.ok(trace.trim().length > 0);
      }
    }
  });

  it('12. Same input produces exactly the same result (determinism)', () => {
    const profile = createProfile({ goal: 'build_muscle' });
    const run1 = resolveTrainingObjective(profile);
    const run2 = resolveTrainingObjective(profile);
    const run3 = resolveTrainingObjective(profile);

    assert.deepEqual(run1, run2);
    assert.deepEqual(run2, run3);
  });

  it('13. The function does not mutate the profile', () => {
    const profile = createProfile({ goal: 'get_stronger' });
    const snapshot = JSON.parse(JSON.stringify(profile));

    resolveTrainingObjective(profile);

    assert.deepEqual(profile, snapshot);
  });
});
