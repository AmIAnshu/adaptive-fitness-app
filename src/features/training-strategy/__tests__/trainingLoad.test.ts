/**
 * T4 — Starting Volume & Effort Test Suite
 *
 * Verifies all 28 required invariants:
 * 1. Foundational user defaults to low starting volume.
 * 2. Standard user with normal recovery gets moderate starting volume.
 * 3. Advanced user does not automatically receive high volume.
 * 4. High volume requires supportive conditions.
 * 5. Constrained recovery lowers starting volume by at most one qualitative level where appropriate.
 * 6. "Not sure" recovery does not automatically count as poor recovery.
 * 7. 20–30 minute sessions favor low starting volume.
 * 8. 45–60 minute sessions can support moderate starting volume.
 * 9. 75+ minute sessions alone do not force high volume.
 * 10. "Fewer, higher effort" does not automatically increase volume.
 * 11. "More volume" can support higher starting volume when constraints allow.
 * 12. Preferred effort "moderate" maps to 3–4 RIR before modifiers.
 * 13. Preferred effort "hard" maps to 2–3 RIR before modifiers.
 * 14. Preferred effort "very_hard" maps to 1–2 RIR before modifiers.
 * 15. "Very hard" + foundational experience is moderated away from failure.
 * 16. Constrained recovery makes effort more conservative.
 * 17. No result contains 0 RIR.
 * 18. minRIR <= maxRIR always.
 * 19. Same input produces exactly the same result.
 * 20. Function does not mutate profile.
 * 21. volumeReason is non-empty.
 * 22. effortReason is non-empty.
 * 23. decisionTrace is non-empty.
 * 24. No exact sets/reps/exercises/workout assignments are produced.
 * 25. No recovery score is produced.
 * 26. Frequency alone never forces high volume.
 * 27. Long session duration alone never forces high volume.
 * 28. Advanced status alone never forces high volume.
 * 29. T4 is a conservative starting guardrail: produces no deload decision or ongoing fatigue state.
 * 30. T4 starting load remains deterministic at plan initialization.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingObjective } from '../goalResolution';
import { resolveFrequency } from '../frequencyResolution';
import { resolveTrainingStructure } from '../trainingStructure';
import { resolveTrainingLoad } from '../trainingLoad';

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

describe('T4 — Starting Volume & Effort', () => {
  it('1. Foundational user defaults to low starting volume', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 1,
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'low');
  });

  it('2. Standard user with normal recovery gets moderate starting volume', () => {
    const profile = createProfile({
      trainingHistory: '6_to_12_months',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
      sessionDuration: '45_60',
      sleepDuration: '7_to_8',
      sleepQuality: 4,
      energyLevel: 4,
      stressLevel: 2,
      workoutRecovery: 'mostly_recovered',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'moderate');
  });

  it('3. Advanced user does not automatically receive high volume', () => {
    const profile = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '45_60', // standard duration, balanced volume
      volumePreference: 'balanced',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'moderate');
  });

  it('4. High volume requires supportive conditions', () => {
    // Advanced user + favorable recovery + long session + more_volume preference + hypertrophy
    const supportiveProfile = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '60_75',
      volumePreference: 'more_volume',
      goal: 'build_muscle',
      sleepDuration: '7_to_8',
      sleepQuality: 5,
      energyLevel: 5,
      stressLevel: 1,
      workoutRecovery: 'fully_recovered',
    });
    const obj = resolveTrainingObjective(supportiveProfile);
    const freq = resolveFrequency(supportiveProfile);
    const struct = resolveTrainingStructure(supportiveProfile, obj, freq);
    const load = resolveTrainingLoad(supportiveProfile, obj, freq, struct);

    assert.equal(load.startingVolume, 'high');
  });

  it('5. Constrained recovery lowers starting volume by at most one qualitative level where appropriate', () => {
    // Standard baseline (moderate) with constrained recovery -> low
    const constrainedStandard = createProfile({
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
      sessionDuration: '45_60',
      sleepDuration: 'under_5',
      sleepQuality: 2,
      energyLevel: 1,
      stressLevel: 5,
      workoutRecovery: 'often_fatigued',
    });
    const obj1 = resolveTrainingObjective(constrainedStandard);
    const freq1 = resolveFrequency(constrainedStandard);
    const struct1 = resolveTrainingStructure(constrainedStandard, obj1, freq1);
    const load1 = resolveTrainingLoad(constrainedStandard, obj1, freq1, struct1);

    assert.equal(load1.startingVolume, 'low');

    // High potential profile constrained by poor recovery -> drops to moderate (one qualitative level)
    const constrainedHighCandidate = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '75_plus',
      volumePreference: 'more_volume',
      sleepDuration: 'under_5',
      sleepQuality: 2,
      energyLevel: 2,
      stressLevel: 4,
      workoutRecovery: 'often_fatigued',
    });
    const obj2 = resolveTrainingObjective(constrainedHighCandidate);
    const freq2 = resolveFrequency(constrainedHighCandidate);
    const struct2 = resolveTrainingStructure(constrainedHighCandidate, obj2, freq2);
    const load2 = resolveTrainingLoad(constrainedHighCandidate, obj2, freq2, struct2);

    assert.ok(load2.startingVolume === 'moderate' || load2.startingVolume === 'low');
    assert.notEqual(load2.startingVolume, 'high');
  });

  it('6. "Not sure" recovery does not automatically count as poor recovery', () => {
    // Normal sleep/energy with workoutRecovery='not_sure'
    const profile = createProfile({
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
      sessionDuration: '45_60',
      sleepDuration: '7_to_8',
      sleepQuality: 3,
      energyLevel: 3,
      stressLevel: 2,
      workoutRecovery: 'not_sure',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'moderate');
  });

  it('7. 20–30 minute sessions favor low starting volume', () => {
    const profile = createProfile({
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 4,
      programmingConfidence: 3,
      sessionDuration: '20_30',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'low');
  });

  it('8. 45–60 minute sessions can support moderate starting volume', () => {
    const profile = createProfile({
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
      sessionDuration: '45_60',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'moderate');
  });

  it('9. 75+ minute sessions alone do not force high volume', () => {
    // Foundational user with 75+ min session still gets low volume
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'rarely',
      exerciseConfidence: 1,
      programmingConfidence: 1,
      sessionDuration: '75_plus',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'low');
  });

  it('10. "Fewer, higher effort" does not automatically increase volume', () => {
    const profile = createProfile({
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
      volumePreference: 'fewer_high_effort',
      sessionDuration: '60_75',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.notEqual(load.startingVolume, 'high');
  });

  it('11. "More volume" can support higher starting volume when constraints allow', () => {
    const profile = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '60_75',
      volumePreference: 'more_volume',
      goal: 'build_muscle',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.startingVolume, 'high');
  });

  it('12. Preferred effort "moderate" maps to 3–4 RIR before modifiers', () => {
    const profile = createProfile({
      preferredEffort: 'moderate',
      workoutRecovery: 'mostly_recovered',
      sleepDuration: '7_to_8',
      sleepQuality: 4,
      energyLevel: 4,
      stressLevel: 2,
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.effort.minRIR, 3);
    assert.equal(load.effort.maxRIR, 4);
  });

  it('13. Preferred effort "hard" maps to 2–3 RIR before modifiers', () => {
    const profile = createProfile({
      preferredEffort: 'hard',
      workoutRecovery: 'mostly_recovered',
      sleepDuration: '7_to_8',
      sleepQuality: 4,
      energyLevel: 4,
      stressLevel: 2,
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.effort.minRIR, 2);
    assert.equal(load.effort.maxRIR, 3);
  });

  it('14. Preferred effort "very_hard" maps to 1–2 RIR before modifiers', () => {
    // Advanced user with very_hard preference and good recovery
    const profile = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      preferredEffort: 'very_hard',
      workoutRecovery: 'fully_recovered',
      sleepDuration: '7_to_8',
      sleepQuality: 5,
      energyLevel: 5,
      stressLevel: 1,
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.equal(load.effort.minRIR, 1);
    assert.equal(load.effort.maxRIR, 2);
  });

  it('15. "Very hard" + foundational experience is moderated away from failure', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 1,
      preferredEffort: 'very_hard',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    // Foundational users must not receive 1-2 RIR
    assert.ok(load.effort.minRIR >= 2);
    assert.ok(load.effort.maxRIR >= 3);
  });

  it('16. Constrained recovery makes effort more conservative', () => {
    const profile = createProfile({
      preferredEffort: 'hard', // normally 2-3 RIR
      sleepDuration: 'under_5',
      sleepQuality: 1,
      energyLevel: 1,
      stressLevel: 5,
      workoutRecovery: 'often_fatigued',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    // Hard (2-3 RIR) shifted one step farther from failure becomes 3-4 RIR
    assert.equal(load.effort.minRIR, 3);
    assert.equal(load.effort.maxRIR, 4);
  });

  it('17. No result contains 0 RIR', () => {
    const allEfforts = ['moderate', 'hard', 'very_hard', 'not_sure'] as const;
    for (const eff of allEfforts) {
      const p = createProfile({ preferredEffort: eff });
      const obj = resolveTrainingObjective(p);
      const freq = resolveFrequency(p);
      const struct = resolveTrainingStructure(p, obj, freq);
      const load = resolveTrainingLoad(p, obj, freq, struct);

      assert.ok(load.effort.minRIR >= 1);
      assert.ok(load.effort.maxRIR >= 1);
    }
  });

  it('18. minRIR <= maxRIR always', () => {
    const testCases: Partial<OnboardingData>[] = [
      { preferredEffort: 'moderate' },
      { preferredEffort: 'hard' },
      { preferredEffort: 'very_hard' },
      { preferredEffort: 'not_sure' },
      { preferredEffort: 'very_hard', trainingHistory: 'never' },
      { preferredEffort: 'hard', sleepDuration: 'under_5', energyLevel: 1 },
    ];

    for (const tc of testCases) {
      const p = createProfile(tc);
      const obj = resolveTrainingObjective(p);
      const freq = resolveFrequency(p);
      const struct = resolveTrainingStructure(p, obj, freq);
      const load = resolveTrainingLoad(p, obj, freq, struct);

      assert.ok(load.effort.minRIR <= load.effort.maxRIR);
    }
  });

  it('19. Same input produces exactly the same result', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);

    const run1 = resolveTrainingLoad(profile, obj, freq, struct);
    const run2 = resolveTrainingLoad(profile, obj, freq, struct);
    const run3 = resolveTrainingLoad(profile, obj, freq, struct);

    assert.deepEqual(run1, run2);
    assert.deepEqual(run2, run3);
  });

  it('20. Function does not mutate profile', () => {
    const profile = createProfile();
    const snapshot = JSON.parse(JSON.stringify(profile));
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);

    resolveTrainingLoad(profile, obj, freq, struct);

    assert.deepEqual(profile, snapshot);
  });

  it('21. volumeReason is non-empty', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.ok(Array.isArray(load.volumeReason));
    assert.ok(load.volumeReason.length > 0);
    for (const r of load.volumeReason) {
      assert.equal(typeof r, 'string');
      assert.ok(r.trim().length > 0);
    }
  });

  it('22. effortReason is non-empty', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.ok(Array.isArray(load.effortReason));
    assert.ok(load.effortReason.length > 0);
    for (const r of load.effortReason) {
      assert.equal(typeof r, 'string');
      assert.ok(r.trim().length > 0);
    }
  });

  it('23. decisionTrace is non-empty', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.ok(Array.isArray(load.decisionTrace));
    assert.ok(load.decisionTrace.length > 0);
    for (const t of load.decisionTrace) {
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0);
    }
  });

  it('24. No exact sets/reps/exercises/workout assignments are produced', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const rawLoad = load as Record<string, unknown>;

    assert.equal('sets' in rawLoad, false);
    assert.equal('reps' in rawLoad, false);
    assert.equal('exercises' in rawLoad, false);
    assert.equal('exerciseIds' in rawLoad, false);
    assert.equal('workouts' in rawLoad, false);
  });

  it('25. No recovery score is produced', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const rawLoad = load as Record<string, unknown>;

    assert.equal('recoveryScore' in rawLoad, false);
    assert.equal('readinessScore' in rawLoad, false);
  });

  it('26. Frequency alone never forces high volume', () => {
    // 6-day standard frequency trainee with normal duration and balanced preference
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      sessionDuration: '45_60',
      volumePreference: 'balanced',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.notEqual(load.startingVolume, 'high');
  });

  it('27. Long session duration alone never forces high volume', () => {
    // Standard user with 75+ session and balanced volume
    const profile = createProfile({
      sessionDuration: '75_plus',
      volumePreference: 'balanced',
      trainingHistory: '6_to_12_months',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.notEqual(load.startingVolume, 'high');
  });

  it('28. Advanced status alone never forces high volume', () => {
    const profile = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '30_45',
      volumePreference: 'balanced',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);

    assert.notEqual(load.startingVolume, 'high');
    assert.equal(load.startingVolume, 'moderate');
  });

  it('29. T4 is a conservative starting guardrail: produces no deload decision or ongoing fatigue state', () => {
    const profile = createProfile({
      sleepDuration: 'under_5',
      sleepQuality: 1,
      energyLevel: 1,
      stressLevel: 5,
      workoutRecovery: 'often_fatigued',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const rawLoad = load as Record<string, unknown>;

    // T4 establishes a conservative starting workload (volume=low, effort moderated)
    assert.equal(load.startingVolume, 'low');
    assert.equal(load.effort.minRIR, 3);
    assert.equal(load.effort.maxRIR, 4);

    // T4 does not output runtime recovery engine entities (deferred to T9)
    assert.equal('deload' in rawLoad, false);
    assert.equal('deloadDecision' in rawLoad, false);
    assert.equal('runtimeRecoveryState' in rawLoad, false);
    assert.equal('recoveryScore' in rawLoad, false);
    assert.equal('recoveryConstraints' in rawLoad, false);
  });

  it('30. T4 starting load remains deterministic at plan initialization', () => {
    const profile = createProfile({
      goal: 'build_muscle',
      trainingHistory: '1_to_2_years',
      preferredEffort: 'hard',
      sleepDuration: 'under_5',
      energyLevel: 2,
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);

    const load1 = resolveTrainingLoad(profile, obj, freq, struct);
    const load2 = resolveTrainingLoad(profile, obj, freq, struct);

    assert.deepEqual(load1, load2);
  });
});
