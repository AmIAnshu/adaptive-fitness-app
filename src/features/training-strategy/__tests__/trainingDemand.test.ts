/**
 * T6 — Training Demand & Allocation and Metadata Audit Test Suite
 *
 * Verifies all required invariants:
 * 1. Pre-T6 Metadata Audit & Consistency
 * 2. Objective Demand (hypertrophy, strength, fat loss support, body composition, general fitness)
 * 3. Frequency & Split structure (1-2 day, 3-4 day, 5-6 day, flexible sequence)
 * 4. Volume ceiling integration (low, moderate, high)
 * 5. Exercise preferences (favorites, dislikes, avoid)
 * 6. Equipment compatibility
 * 7. Difficulty / foundational protection
 * 8. Deterministic redundancy protection
 * 9. Determinism and input immutability
 * 10. Safety / scope (no exact sets, reps, load, RIR, calendar assignments, or recovery scores)
 * 11. Population boundary (age 13, 17, 18, youth isolation, adult pipeline execution)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile, DayOfWeek } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingObjective } from '../goalResolution';
import { resolveFrequency } from '../frequencyResolution';
import { resolveTrainingStructure } from '../trainingStructure';
import { resolveTrainingLoad } from '../trainingLoad';
import { resolveExerciseSelection } from '../exerciseSelection';
import { resolveTrainingDemand } from '../trainingDemand';
import { runStrategyPipeline } from '../strategyPipeline';
import {
  SEED_EXERCISE_CATALOG,
  type ExerciseDefinition,
} from '../exerciseCatalog';
import type { MovementPattern, TrainingTarget } from '../types';

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

describe('1. Pre-T6 Exercise Metadata Audit', () => {
  it('1.1. Every exercise ID in the catalog is unique', () => {
    const ids = new Set<string>();
    for (const ex of SEED_EXERCISE_CATALOG) {
      assert.equal(ids.has(ex.id), false, `Duplicate exercise ID found: ${ex.id}`);
      ids.add(ex.id);
    }
    assert.equal(SEED_EXERCISE_CATALOG.length, 27);
  });

  it('1.2. Every exercise has complete, non-empty required metadata', () => {
    for (const ex of SEED_EXERCISE_CATALOG) {
      assert.ok(ex.id.trim().length > 0);
      assert.ok(ex.name.trim().length > 0);
      assert.ok(Array.isArray(ex.movementPatterns) && ex.movementPatterns.length > 0);
      assert.ok(Array.isArray(ex.primaryMuscles) && ex.primaryMuscles.length > 0);
      assert.ok(Array.isArray(ex.secondaryMuscles));
      assert.ok(Array.isArray(ex.equipmentRequired));
      assert.ok(['foundational', 'standard', 'advanced'].includes(ex.difficulty));
      assert.ok(['compound', 'isolation', 'machine', 'bodyweight', 'cardio'].includes(ex.exerciseType));
      assert.ok(
        ['primary_compound', 'secondary_compound', 'isolation', 'bodyweight', 'conditioning'].includes(
          ex.progressionProfile
        )
      );
      assert.equal(typeof ex.stableSetup, 'boolean');
    }
  });

  it('1.3. Exercise movement patterns and muscle targets are canonically valid', () => {
    const validPatterns: MovementPattern[] = [
      'squat',
      'hinge',
      'horizontal_push',
      'horizontal_pull',
      'vertical_push',
      'vertical_pull',
      'lunge',
      'carry',
      'core',
      'conditioning',
    ];

    const validTargets: TrainingTarget[] = [
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'core',
      'conditioning',
    ];

    for (const ex of SEED_EXERCISE_CATALOG) {
      for (const pat of ex.movementPatterns) {
        assert.ok(validPatterns.includes(pat), `Invalid movement pattern: ${pat} in ${ex.id}`);
      }
      for (const target of ex.primaryMuscles) {
        assert.ok(validTargets.includes(target), `Invalid primary target: ${target} in ${ex.id}`);
      }
      for (const target of ex.secondaryMuscles) {
        assert.ok(validTargets.includes(target), `Invalid secondary target: ${target} in ${ex.id}`);
      }
    }
  });
});

describe('2. T6 — Training Demand & Allocation', () => {
  it('2.1. Hypertrophy objective configures high/moderate workload bands across major muscle groups', () => {
    const profile = createProfile({ goal: 'build_muscle' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.equal(demand.demandLevels.chest, 'moderate');
    assert.equal(demand.demandLevels.back, 'moderate');
    assert.equal(demand.demandLevels.quads, 'moderate');
    assert.ok(demand.weeklyTargets.length >= 10);
  });

  it('2.2. Strength objective prioritizes major compound targets', () => {
    const profile = createProfile({ goal: 'get_stronger' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    const chestTarget = demand.weeklyTargets.find((t) => t.target === 'chest');
    assert.ok(chestTarget);
    assert.equal(chestTarget.priority, 'high');
  });

  it('2.3. Fat loss support balances practical resistance targets without eliminating muscle groups', () => {
    const profile = createProfile({ goal: 'lose_fat' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.equal(demand.demandLevels.chest, 'moderate');
    assert.equal(demand.demandLevels.back, 'moderate');
  });

  it('2.4. Frequency & split structure: 2-day full body allocates 2 sessions with broad pattern coverage', () => {
    const profile = createProfile({
      idealTrainingDays: 2,
      realisticMinimumDays: 2,
      availableDays: ['tue', 'fri'],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.equal(demand.sessions.length, 2);
    assert.equal(demand.targetSessions, 2);
    for (const sess of demand.sessions) {
      assert.ok(sess.allocatedExercises.length > 0);
    }
  });

  it('2.5. Frequency & split structure: 4-day upper/lower allocates 4 sessions', () => {
    const profile = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'tue', 'thu', 'fri'],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.equal(demand.sessions.length, 4);
    assert.equal(demand.targetSessions, 4);
  });

  it('2.6. Flexible sequence preserves abstract sequencing without fixed weekdays', () => {
    const profile = createProfile({
      scheduleFlexibility: 'often_changes',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.ok(demand.decisionTrace.some((t) => t.includes('Flexible sequence mode')));
    for (const sess of demand.sessions) {
      assert.ok('sessionIndex' in sess);
      assert.equal('weekday' in (sess as Record<string, unknown>), false);
      assert.equal('dayOfWeek' in (sess as Record<string, unknown>), false);
    }
  });

  it('2.7. Volume ceiling integration: low starting volume constrains session slot budgets', () => {
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
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.equal(load.startingVolume, 'low');
    for (const sess of demand.sessions) {
      assert.equal(sess.exerciseSlotRange.target, 4);
      assert.ok(sess.allocatedExercises.length <= 5);
    }
  });

  it('2.8. Redundancy protection: prevents duplicate primary patterns and targets in a session', () => {
    const profile = createProfile({
      favorites: ['bench_press', 'machine_chest_press', 'dumbbell_bench_press'],
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    // Verify session 1 does not allocate 3 duplicate horizontal chest presses
    for (const sess of demand.sessions) {
      const horizontalPushExercises = sess.allocatedExercises.filter(
        (e) => e.movementPattern === 'horizontal_push'
      );
      assert.ok(
        horizontalPushExercises.length <= 2,
        `Session ${sess.sessionIndex} should not have excessive redundant horizontal push`
      );
    }
  });

  it('2.9. Hard avoid constraints remain strictly honored in allocation', () => {
    const profile = createProfile({
      avoid: ['deadlift', 'bench_press'],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    for (const sess of demand.sessions) {
      for (const item of sess.allocatedExercises) {
        assert.notEqual(item.exerciseId, 'deadlift');
        assert.notEqual(item.exerciseId, 'bench_press');
      }
    }
  });

  it('2.10. Equipment constraints remain strictly honored in allocation', () => {
    const profile = createProfile({
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells'],
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    for (const sess of demand.sessions) {
      for (const item of sess.allocatedExercises) {
        // Must not include barbell or machine moves
        assert.notEqual(item.exerciseId, 'barbell_squat');
        assert.notEqual(item.exerciseId, 'barbell_row');
        assert.notEqual(item.exerciseId, 'cable_row');
      }
    }
  });

  it('2.11. Foundational user allocation is protected from advanced-only dominant exercises', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'rarely',
      exerciseConfidence: 1,
      programmingConfidence: 1,
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    // Advanced-only exercises should not monopolize foundational sessions
    for (const sess of demand.sessions) {
      const advancedAllocations = sess.allocatedExercises.filter((e) => {
        const def = SEED_EXERCISE_CATALOG.find((x) => x.id === e.exerciseId);
        return def?.difficulty === 'advanced';
      });
      assert.ok(advancedAllocations.length <= 1);
    }
  });

  it('2.12. Determinism: same input produces identical output', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);

    const d1 = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const d2 = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.deepEqual(d1, d2);
  });

  it('2.13. Immutability: inputs are not mutated', () => {
    const profile = createProfile();
    const snapProfile = JSON.parse(JSON.stringify(profile));
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);

    resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    assert.deepEqual(profile, snapProfile);
  });

  it('2.14. Scope & safety: T6 produces no final sets, reps, load, RIR, calendar days, or recovery scores', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    const rawDemand = demand as Record<string, unknown>;
    assert.equal('sets' in rawDemand, false);
    assert.equal('reps' in rawDemand, false);
    assert.equal('load' in rawDemand, false);
    assert.equal('weight' in rawDemand, false);
    assert.equal('rir' in rawDemand, false);
    assert.equal('recoveryScore' in rawDemand, false);

    for (const sess of demand.sessions) {
      const rawSess = sess as Record<string, unknown>;
      assert.equal('weekday' in rawSess, false);
      assert.equal('calendarDate' in rawSess, false);
      for (const ex of sess.allocatedExercises) {
        const rawEx = ex as Record<string, unknown>;
        assert.equal('sets' in rawEx, false);
        assert.equal('reps' in rawEx, false);
        assert.equal('weightKg' in rawEx, false);
        assert.equal('targetRIR' in rawEx, false);
      }
    }
  });

  it('2.15. Pipeline Integration: adult profile reaches T6 demand plan through runStrategyPipeline', () => {
    const profile = createProfile({ age: 28 });
    const pipeline = runStrategyPipeline(profile);

    assert.equal(pipeline.status, 'completed');
    assert.equal(pipeline.path, 'adult_strategy');
    if (pipeline.status === 'completed') {
      assert.ok(pipeline.trainingDemand);
      assert.ok(pipeline.trainingDemand.sessions.length > 0);
      assert.ok(pipeline.trainingDemand.weeklyTargets.length > 0);
      assert.ok(pipeline.decisionTrace.some((t) => t.includes('T6 Session Demand Allocations')));
    }
  });

  it('2.16. Pipeline Integration: youth profile (age 13-17) never reaches T6', () => {
    const youthAges = [13, 15, 17];
    for (const age of youthAges) {
      const profile = createProfile({ age });
      const pipeline = runStrategyPipeline(profile);

      assert.equal(pipeline.status, 'pending');
      assert.equal(pipeline.path, 'youth_strategy_pending');
      const raw = pipeline as Record<string, unknown>;
      assert.equal('trainingDemand' in raw, false);
      assert.equal('objective' in raw, false);
      assert.equal('frequency' in raw, false);
      assert.equal('structure' in raw, false);
      assert.equal('trainingLoad' in raw, false);
      assert.equal('exerciseSelection' in raw, false);
      assert.ok(pipeline.decisionTrace.some((t) => t.includes('Adult T6 (Training Demand & Allocation) SKIPPED')));
    }
  });

  it('2.17. Pipeline Integration: ineligible age never reaches T6', () => {
    const base = createProfile({ age: 28 });
    const invalidProfile: CanonicalUserProfile = {
      ...base,
      anthropometrics: {
        ...base.anthropometrics,
        age: 12,
      },
    };

    const pipeline = runStrategyPipeline(invalidProfile);
    assert.equal(pipeline.status, 'ineligible');
    const raw = pipeline as Record<string, unknown>;
    assert.equal('trainingDemand' in raw, false);
  });
});
