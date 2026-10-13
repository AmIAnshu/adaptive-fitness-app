/**
 * Population Eligibility Guard Test Suite
 *
 * Verifies all 13 required invariants:
 * 1. Age 13 -> youth.
 * 2. Age 14 -> youth.
 * 3. Age 17 -> youth.
 * 4. Age 18 -> adult.
 * 5. Age 25 -> adult.
 * 6. Age 100 -> adult.
 * 7. Out-of-range low age -> not allowed.
 * 8. Out-of-range high age -> not allowed.
 * 9. Same input is deterministic.
 * 10. Function does not mutate profile.
 * 11. decisionTrace is non-empty.
 * 12. No training prescription is produced.
 * 13. No medical score is produced.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingPopulation } from '../populationGuard';

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
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'machines'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'some_variety',
    favorites: ['bench_press'],
    dislikes: ['burpees'],
    avoid: ['deadlift'],
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

describe('Population Eligibility Guard', () => {
  it('1. Age 13 -> youth', () => {
    const profile = createProfile({ age: 13 });
    const result = resolveTrainingPopulation(profile);

    assert.equal(result.allowed, true);
    assert.equal(result.population, 'youth');
  });

  it('2. Age 14 -> youth', () => {
    const profile = createProfile({ age: 14 });
    const result = resolveTrainingPopulation(profile);

    assert.equal(result.allowed, true);
    assert.equal(result.population, 'youth');
  });

  it('3. Age 17 -> youth', () => {
    const profile = createProfile({ age: 17 });
    const result = resolveTrainingPopulation(profile);

    assert.equal(result.allowed, true);
    assert.equal(result.population, 'youth');
  });

  it('4. Age 18 -> adult', () => {
    const profile = createProfile({ age: 18 });
    const result = resolveTrainingPopulation(profile);

    assert.equal(result.allowed, true);
    assert.equal(result.population, 'adult');
  });

  it('5. Age 25 -> adult', () => {
    const profile = createProfile({ age: 25 });
    const result = resolveTrainingPopulation(profile);

    assert.equal(result.allowed, true);
    assert.equal(result.population, 'adult');
  });

  it('6. Age 100 -> adult', () => {
    const profile = createProfile({ age: 100 });
    const result = resolveTrainingPopulation(profile);

    assert.equal(result.allowed, true);
    assert.equal(result.population, 'adult');
  });

  it('7. Out-of-range low age -> not allowed', () => {
    // Testing defensive behavior with synthetic profile
    const profile = createProfile({ age: 20 });
    const modifiedProfile: CanonicalUserProfile = {
      ...profile,
      anthropometrics: {
        ...profile.anthropometrics,
        age: 12,
      },
    };

    const result = resolveTrainingPopulation(modifiedProfile);
    assert.equal(result.allowed, false);
    assert.equal(result.population, null);
    assert.ok(result.reason.includes('outside the supported eligibility range'));
  });

  it('8. Out-of-range high age -> not allowed', () => {
    const profile = createProfile({ age: 20 });
    const modifiedProfile: CanonicalUserProfile = {
      ...profile,
      anthropometrics: {
        ...profile.anthropometrics,
        age: 101,
      },
    };

    const result = resolveTrainingPopulation(modifiedProfile);
    assert.equal(result.allowed, false);
    assert.equal(result.population, null);
    assert.ok(result.reason.includes('outside the supported eligibility range'));
  });

  it('9. Same input is deterministic', () => {
    const profile = createProfile({ age: 16 });

    const r1 = resolveTrainingPopulation(profile);
    const r2 = resolveTrainingPopulation(profile);
    const r3 = resolveTrainingPopulation(profile);

    assert.deepEqual(r1, r2);
    assert.deepEqual(r2, r3);
  });

  it('10. Function does not mutate profile', () => {
    const profile = createProfile({ age: 16 });
    const snapshot = JSON.parse(JSON.stringify(profile));

    resolveTrainingPopulation(profile);

    assert.deepEqual(profile, snapshot);
  });

  it('11. decisionTrace is non-empty', () => {
    const p1 = createProfile({ age: 15 });
    const r1 = resolveTrainingPopulation(p1);
    assert.ok(Array.isArray(r1.decisionTrace));
    assert.ok(r1.decisionTrace.length >= 3);
    for (const t of r1.decisionTrace) {
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0);
    }

    const p2 = createProfile({ age: 30 });
    const r2 = resolveTrainingPopulation(p2);
    assert.ok(Array.isArray(r2.decisionTrace));
    assert.ok(r2.decisionTrace.length >= 3);
  });

  it('12. No training prescription is produced', () => {
    const profile = createProfile({ age: 16 });
    const result = resolveTrainingPopulation(profile);
    const rawResult = result as Record<string, unknown>;

    assert.equal('workouts' in rawResult, false);
    assert.equal('exercises' in rawResult, false);
    assert.equal('sets' in rawResult, false);
    assert.equal('reps' in rawResult, false);
    assert.equal('rir' in rawResult, false);
    assert.equal('volume' in rawResult, false);
  });

  it('13. No medical score is produced', () => {
    const profile = createProfile({ age: 16 });
    const result = resolveTrainingPopulation(profile);
    const rawResult = result as Record<string, unknown>;

    assert.equal('healthScore' in rawResult, false);
    assert.equal('medicalDiagnosis' in rawResult, false);
    assert.equal('recoveryScore' in rawResult, false);
    assert.equal('readinessScore' in rawResult, false);
  });
});
