/**
 * Population Strategy Boundary & Pipeline Test Suite
 *
 * Verifies all required routing invariants:
 * - age 13
 * - age 14
 * - age 17
 * - age 18
 * - age 25
 * - age 100
 * - invalid age below 13
 * - invalid age above 100
 * - youth never invokes adult T1–T9
 * - adult still reaches existing adult pipeline with full T1–T9 results
 * - deterministic output
 * - input immutability
 * - non-empty decision traces
 * - youth path does not contain workout prescriptions
 * - ineligible path is blocked
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveStrategyPopulation } from '../strategyPopulation';
import { runStrategyPipeline } from '../strategyPipeline';

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

describe('Population Strategy Boundary & Pipeline', () => {
  it('1. Age 13 -> youth_strategy_pending', () => {
    const profile = createProfile({ age: 13 });
    const boundary = resolveStrategyPopulation(profile);

    assert.equal(boundary.allowed, true);
    assert.equal(boundary.population, 'youth');
    assert.equal(boundary.path, 'youth_strategy_pending');

    const pipeline = runStrategyPipeline(profile);
    assert.equal(pipeline.status, 'pending');
    assert.equal(pipeline.path, 'youth_strategy_pending');
  });

  it('2. Age 14 -> youth_strategy_pending', () => {
    const profile = createProfile({ age: 14 });
    const boundary = resolveStrategyPopulation(profile);

    assert.equal(boundary.allowed, true);
    assert.equal(boundary.population, 'youth');
    assert.equal(boundary.path, 'youth_strategy_pending');

    const pipeline = runStrategyPipeline(profile);
    assert.equal(pipeline.status, 'pending');
    assert.equal(pipeline.path, 'youth_strategy_pending');
  });

  it('3. Age 17 -> youth_strategy_pending', () => {
    const profile = createProfile({ age: 17 });
    const boundary = resolveStrategyPopulation(profile);

    assert.equal(boundary.allowed, true);
    assert.equal(boundary.population, 'youth');
    assert.equal(boundary.path, 'youth_strategy_pending');

    const pipeline = runStrategyPipeline(profile);
    assert.equal(pipeline.status, 'pending');
    assert.equal(pipeline.path, 'youth_strategy_pending');
  });

  it('4. Age 18 -> adult_strategy', () => {
    const profile = createProfile({ age: 18 });
    const boundary = resolveStrategyPopulation(profile);

    assert.equal(boundary.allowed, true);
    assert.equal(boundary.population, 'adult');
    assert.equal(boundary.path, 'adult_strategy');

    const pipeline = runStrategyPipeline(profile);
    assert.equal(pipeline.status, 'completed');
    assert.equal(pipeline.path, 'adult_strategy');
  });

  it('5. Age 25 -> adult_strategy', () => {
    const profile = createProfile({ age: 25 });
    const boundary = resolveStrategyPopulation(profile);

    assert.equal(boundary.allowed, true);
    assert.equal(boundary.population, 'adult');
    assert.equal(boundary.path, 'adult_strategy');

    const pipeline = runStrategyPipeline(profile);
    assert.equal(pipeline.status, 'completed');
    assert.equal(pipeline.path, 'adult_strategy');
  });

  it('6. Age 100 -> adult_strategy', () => {
    const profile = createProfile({ age: 100 });
    const boundary = resolveStrategyPopulation(profile);

    assert.equal(boundary.allowed, true);
    assert.equal(boundary.population, 'adult');
    assert.equal(boundary.path, 'adult_strategy');

    const pipeline = runStrategyPipeline(profile);
    assert.equal(pipeline.status, 'completed');
    assert.equal(pipeline.path, 'adult_strategy');
  });

  it('7. Invalid age below 13 -> ineligible and pipeline blocked', () => {
    const base = createProfile({ age: 20 });
    const invalidProfile: CanonicalUserProfile = {
      ...base,
      anthropometrics: {
        ...base.anthropometrics,
        age: 12,
      },
    };

    const boundary = resolveStrategyPopulation(invalidProfile);
    assert.equal(boundary.allowed, false);
    assert.equal(boundary.population, null);
    assert.equal(boundary.path, 'ineligible');

    const pipeline = runStrategyPipeline(invalidProfile);
    assert.equal(pipeline.status, 'ineligible');
    assert.equal(pipeline.path, 'ineligible');
    assert.ok(pipeline.decisionTrace.some((t) => t.includes('ineligible')));
  });

  it('8. Invalid age above 100 -> ineligible and pipeline blocked', () => {
    const base = createProfile({ age: 20 });
    const invalidProfile: CanonicalUserProfile = {
      ...base,
      anthropometrics: {
        ...base.anthropometrics,
        age: 105,
      },
    };

    const boundary = resolveStrategyPopulation(invalidProfile);
    assert.equal(boundary.allowed, false);
    assert.equal(boundary.population, null);
    assert.equal(boundary.path, 'ineligible');

    const pipeline = runStrategyPipeline(invalidProfile);
    assert.equal(pipeline.status, 'ineligible');
    assert.equal(pipeline.path, 'ineligible');
  });

  it('9. Youth never invokes adult T1–T9', () => {
    const profile = createProfile({ age: 15 });
    const pipeline = runStrategyPipeline(profile);

    assert.equal(pipeline.status, 'pending');
    assert.equal(pipeline.path, 'youth_strategy_pending');

    const rawResult = pipeline as Record<string, unknown>;
    assert.equal('objective' in rawResult, false, 'Youth result must not contain adult T1 objective');
    assert.equal('frequency' in rawResult, false, 'Youth result must not contain adult T2 frequency');
    assert.equal('structure' in rawResult, false, 'Youth result must not contain adult T3 structure');
    assert.equal('trainingLoad' in rawResult, false, 'Youth result must not contain adult T4 trainingLoad');
    assert.equal('exerciseSelection' in rawResult, false, 'Youth result must not contain adult T5 exerciseSelection');
    assert.equal('trainingDemand' in rawResult, false, 'Youth result must not contain adult T6 trainingDemand');
    assert.equal('progression' in rawResult, false, 'Youth result must not contain adult T7 progression');
    assert.equal('conditioning' in rawResult, false, 'Youth result must not contain adult T8 conditioning');
    assert.equal('recoveryConstraints' in rawResult, false, 'Youth result must not contain adult T9 recoveryConstraints');
  });

  it('10. Adult still reaches existing adult pipeline with full T1–T9 results', () => {
    const profile = createProfile({ age: 30 });
    const pipeline = runStrategyPipeline(profile);

    assert.equal(pipeline.status, 'completed');
    assert.equal(pipeline.path, 'adult_strategy');

    if (pipeline.status === 'completed') {
      assert.ok(pipeline.objective);
      assert.ok(pipeline.frequency);
      assert.ok(pipeline.structure);
      assert.ok(pipeline.trainingLoad);
      assert.ok(pipeline.exerciseSelection);
      assert.ok(pipeline.trainingDemand);
      assert.ok(pipeline.progression);
      assert.ok(pipeline.conditioning);
      assert.ok(pipeline.recoveryConstraints);

      assert.equal(pipeline.objective.primary, 'hypertrophy');
      assert.equal(pipeline.frequency.targetDays, 4);
      assert.equal(pipeline.structure.splitFamily, 'upper_lower');
      assert.equal(pipeline.trainingLoad.startingVolume, 'moderate');
      assert.ok(pipeline.exerciseSelection.candidates.length > 0);
      assert.ok(pipeline.trainingDemand.sessions.length > 0);
      assert.ok(pipeline.progression.method);
      assert.ok(pipeline.conditioning.demand);
      assert.equal(pipeline.recoveryConstraints.level, 'stable');
    }
  });

  it('11. Deterministic output', () => {
    const profileYouth = createProfile({ age: 15 });
    const y1 = runStrategyPipeline(profileYouth);
    const y2 = runStrategyPipeline(profileYouth);
    assert.deepEqual(y1, y2);

    const profileAdult = createProfile({ age: 30 });
    const a1 = runStrategyPipeline(profileAdult);
    const a2 = runStrategyPipeline(profileAdult);
    assert.deepEqual(a1, a2);
  });

  it('12. Input immutability', () => {
    const profile = createProfile({ age: 16 });
    const snapshot = JSON.parse(JSON.stringify(profile));

    resolveStrategyPopulation(profile);
    runStrategyPipeline(profile);

    assert.deepEqual(profile, snapshot);
  });

  it('13. Non-empty decision traces', () => {
    const profileYouth = createProfile({ age: 14 });
    const resYouth = runStrategyPipeline(profileYouth);
    assert.ok(Array.isArray(resYouth.decisionTrace));
    assert.ok(resYouth.decisionTrace.length > 0);
    for (const t of resYouth.decisionTrace) {
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0);
    }

    const profileAdult = createProfile({ age: 28 });
    const resAdult = runStrategyPipeline(profileAdult);
    assert.ok(Array.isArray(resAdult.decisionTrace));
    assert.ok(resAdult.decisionTrace.length > 0);
  });

  it('14. Youth path does not contain workout prescriptions', () => {
    const profile = createProfile({ age: 16 });
    const pipeline = runStrategyPipeline(profile);
    const raw = pipeline as Record<string, unknown>;

    assert.equal('workouts' in raw, false);
    assert.equal('exercises' in raw, false);
    assert.equal('sets' in raw, false);
    assert.equal('reps' in raw, false);
    assert.equal('rir' in raw, false);
    assert.equal('volume' in raw, false);
    assert.equal('split' in raw, false);
  });

  it('15. Ineligible path is blocked', () => {
    const base = createProfile({ age: 25 });
    const invalidProfile: CanonicalUserProfile = {
      ...base,
      anthropometrics: {
        ...base.anthropometrics,
        age: 10,
      },
    };

    const boundary = resolveStrategyPopulation(invalidProfile);
    assert.equal(boundary.allowed, false);
    assert.equal(boundary.path, 'ineligible');

    const pipeline = runStrategyPipeline(invalidProfile);
    assert.equal(pipeline.status, 'ineligible');
  });
});
