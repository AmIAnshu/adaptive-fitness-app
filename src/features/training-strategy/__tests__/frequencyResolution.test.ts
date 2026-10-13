/**
 * T2 — Frequency Resolution Test Suite
 *
 * Verifies all required invariants:
 * 1. Ideal frequency lower than available days preserves ideal frequency.
 * 2. Ideal frequency equal to available days is preserved.
 * 3. Ideal frequency greater than available days is capped at available-day count.
 * 4. Minimum frequency is never greater than target frequency.
 * 5. Fixed flexibility maps to fixed_split.
 * 6. Sometimes-changes maps to hybrid.
 * 7. Often-changes maps to flexible_sequence.
 * 8. Six ideal / four available / five minimum resolves to 4 target / 4 minimum.
 * 9. Four ideal / six available / two minimum resolves to 4 target / 2 minimum.
 * 10. Two ideal / two available / one minimum resolves to 2 target / 1 minimum.
 * 11. Six ideal / six available / six minimum resolves to 6 / 6.
 * 12. Same input produces exactly the same result (determinism).
 * 13. Function does not mutate the profile.
 * 14. decisionTrace is non-empty and deterministic.
 * 15. T2 does not create workout assignments or exercise data.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveFrequency } from '../frequencyResolution';

/**
 * Fixture factory: creates a validated CanonicalUserProfile with specific schedule overrides.
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

describe('T2 — Frequency Resolution', () => {
  it('1. Ideal frequency lower than available days preserves ideal frequency', () => {
    // 3 ideal, 5 available days
    const profile = createProfile({
      idealTrainingDays: 3,
      realisticMinimumDays: 2,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 3);
    assert.equal(result.minimumViableDays, 2);
    assert.equal(result.availableDayCount, 5);
  });

  it('2. Ideal frequency equal to available days is preserved', () => {
    // 4 ideal, 4 available days
    const profile = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'wed', 'fri', 'sat'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 4);
    assert.equal(result.minimumViableDays, 3);
    assert.equal(result.availableDayCount, 4);
  });

  it('3. Ideal frequency greater than available days is capped at available-day count', () => {
    // 5 ideal, 3 available days
    const profile = createProfile({
      idealTrainingDays: 5,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'wed', 'fri'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 3);
    assert.equal(result.availableDayCount, 3);
  });

  it('4. Minimum frequency is never greater than target frequency', () => {
    // 6 ideal, 3 available days, 5 minimum
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'wed', 'fri'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 3);
    assert.equal(result.minimumViableDays, 3);
    assert.ok(result.minimumViableDays <= result.targetDays);
  });

  it('5. Fixed flexibility maps to fixed_split', () => {
    const profile = createProfile({
      scheduleFlexibility: 'fixed',
    });

    const result = resolveFrequency(profile);

    assert.equal(result.structureMode, 'fixed_split');
    assert.ok(result.decisionTrace.some((t) => t.includes('fixed_split')));
  });

  it('6. Sometimes-changes maps to hybrid', () => {
    const profile = createProfile({
      scheduleFlexibility: 'sometimes_changes',
    });

    const result = resolveFrequency(profile);

    assert.equal(result.structureMode, 'hybrid');
    assert.ok(result.decisionTrace.some((t) => t.includes('hybrid')));
  });

  it('7. Often-changes maps to flexible_sequence', () => {
    const profile = createProfile({
      scheduleFlexibility: 'often_changes',
    });

    const result = resolveFrequency(profile);

    assert.equal(result.structureMode, 'flexible_sequence');
    assert.ok(result.decisionTrace.some((t) => t.includes('flexible_sequence')));
  });

  it('8. Six ideal / four available / five minimum resolves to 4 target / 4 minimum', () => {
    // Edge case 1 from spec
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'tue', 'thu', 'fri'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 4);
    assert.equal(result.minimumViableDays, 4);
    assert.equal(result.availableDayCount, 4);
  });

  it('9. Four ideal / six available / two minimum resolves to 4 target / 2 minimum', () => {
    // Edge case 2 from spec
    const profile = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 2,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 4);
    assert.equal(result.minimumViableDays, 2);
    assert.equal(result.availableDayCount, 6);
  });

  it('10. Two ideal / two available / one minimum resolves to 2 target / 1 minimum', () => {
    // Edge case 3 from spec
    const profile = createProfile({
      idealTrainingDays: 2,
      realisticMinimumDays: 1,
      availableDays: ['tue', 'sat'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 2);
    assert.equal(result.minimumViableDays, 1);
    assert.equal(result.availableDayCount, 2);
  });

  it('11. Six ideal / six available / six minimum resolves to 6 / 6', () => {
    // Edge case 4 from spec
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 6,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    });

    const result = resolveFrequency(profile);

    assert.equal(result.targetDays, 6);
    assert.equal(result.minimumViableDays, 6);
    assert.equal(result.availableDayCount, 6);
  });

  it('12. Same input produces exactly the same result (determinism)', () => {
    const profile = createProfile({
      idealTrainingDays: 5,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'wed', 'fri', 'sun'],
      scheduleFlexibility: 'often_changes',
    });

    const run1 = resolveFrequency(profile);
    const run2 = resolveFrequency(profile);
    const run3 = resolveFrequency(profile);

    assert.deepEqual(run1, run2);
    assert.deepEqual(run2, run3);
  });

  it('13. Function does not mutate the profile', () => {
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 4,
      availableDays: ['mon', 'wed', 'fri'],
    });
    const snapshot = JSON.parse(JSON.stringify(profile));

    resolveFrequency(profile);

    assert.deepEqual(profile, snapshot);
  });

  it('14. decisionTrace is non-empty and deterministic', () => {
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'wed', 'fri', 'sat'],
      scheduleFlexibility: 'often_changes',
    });

    const result = resolveFrequency(profile);

    assert.ok(Array.isArray(result.decisionTrace));
    assert.ok(result.decisionTrace.length >= 4);
    for (const trace of result.decisionTrace) {
      assert.equal(typeof trace, 'string');
      assert.ok(trace.trim().length > 0);
    }
    assert.ok(result.decisionTrace.some((t) => t.includes('reduced to 4')));
    assert.ok(result.decisionTrace.some((t) => t.includes('adjusted to 4')));
    assert.ok(result.decisionTrace.some((t) => t.includes('flexible_sequence')));
  });

  it('15. T2 does not create workout assignments or exercise data', () => {
    const profile = createProfile();
    const result = resolveFrequency(profile);
    const resultObj = result as Record<string, unknown>;

    assert.equal('workouts' in resultObj, false);
    assert.equal('exercises' in resultObj, false);
    assert.equal('sessions' in resultObj, false);
    assert.equal('split' in resultObj, false);
    assert.equal('schedule' in resultObj, false);
  });
});
