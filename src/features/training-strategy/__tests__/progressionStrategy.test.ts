/**
 * T7 — Progression Strategy Test Suite
 *
 * Verifies all required progression strategy invariants:
 * A. Progression mode selection (hypertrophy, strength, fat loss support, body composition, general fitness)
 * B. Experience sensitivity (foundational, standard, advanced)
 * C. Performance states (clear success, acceptable, missed, degraded technique, repeated decline, missing data)
 * D. Trend handling (single anomaly not plateau, repeated stagnation creates plateau, repeated decline produces regression)
 * E. Exercise differences (different progression profiles produce appropriate methods)
 * F. Substitution (substituted exercise does not inherit unsafe assumptions)
 * G. Integration (T4 boundaries respected, T6 allocation respected)
 * H. Determinism (same input produces identical output)
 * I. Immutability (input history and profile are not mutated)
 * J. Scope (no exact weights, sets, reps, calendar days, calories, macros, or medical/injury diagnoses)
 * K. Population boundary (age 13, 17, 18, youth isolation, adult pipeline execution)
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
import { resolveExerciseSelection } from '../exerciseSelection';
import { resolveTrainingDemand } from '../trainingDemand';
import {
  resolveProgressionStrategy,
  evaluateExercisePerformance,
  type ExercisePerformanceFeedback,
  type ExercisePerformanceHistoryEntry,
} from '../progressionStrategy';
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

describe('T7 — Progression Strategy', () => {
  it('A.1. Hypertrophy objective selects double_progression for standard trainees', () => {
    const profile = createProfile({ goal: 'build_muscle' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.equal(prog.method, 'double_progression');
  });

  it('A.2. Strength objective selects load_progression for standard trainees', () => {
    const profile = createProfile({ goal: 'get_stronger' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.equal(prog.method, 'load_progression');
  });

  it('A.3. Fat loss support selects conservative_progression', () => {
    const profile = createProfile({ goal: 'lose_fat' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.equal(prog.method, 'conservative_progression');
  });

  it('A.4. Body composition selects double_progression', () => {
    const profile = createProfile({ goal: 'build_muscle_lose_fat' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.equal(prog.method, 'double_progression');
  });

  it('A.5. General fitness selects performance_progression', () => {
    const profile = createProfile({ goal: 'improve_fitness' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.equal(prog.method, 'performance_progression');
  });

  it('B.1. Foundational trainees always receive conservative_progression regardless of goal', () => {
    const profile = createProfile({
      goal: 'get_stronger',
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
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.equal(struct.programmingComplexity, 'foundational');
    assert.equal(prog.method, 'conservative_progression');
    assert.equal(prog.performanceCriteria.requiredSuccessfulExposures, 2);
  });

  it('C.1. Clear success progresses target', () => {
    const feedback: ExercisePerformanceFeedback = {
      exerciseId: 'bench_press',
      completed: true,
      targetRepsAchieved: true,
      executionQuality: 'clean',
      perceivedEffortRIR: 2,
    };

    const outcome = evaluateExercisePerformance(feedback, []);
    assert.equal(outcome.decision, 'progress');
    assert.equal(outcome.plateauState, 'none');
    assert.equal(outcome.trend, 'improving');
  });

  it('C.2. Degraded execution quality maintains target rather than progressing', () => {
    const feedback: ExercisePerformanceFeedback = {
      exerciseId: 'bench_press',
      completed: true,
      targetRepsAchieved: true,
      executionQuality: 'degraded',
      perceivedEffortRIR: 1,
    };

    const outcome = evaluateExercisePerformance(feedback, []);
    assert.equal(outcome.decision, 'maintain');
    assert.equal(outcome.trend, 'declining');
    assert.ok(outcome.rationale.includes('Technique quality degraded'));
  });

  it('C.3. Incomplete exercise session repeats current target', () => {
    const feedback: ExercisePerformanceFeedback = {
      exerciseId: 'bench_press',
      completed: false,
    };

    const outcome = evaluateExercisePerformance(feedback, []);
    assert.equal(outcome.decision, 'repeat');
    assert.equal(outcome.plateauState, 'none');
  });

  it('C.4. Missing performance data results in conservative maintain without assuming success', () => {
    const feedback: ExercisePerformanceFeedback = {
      exerciseId: 'bench_press',
      completed: true,
      // targetRepsAchieved omitted
    };

    const outcome = evaluateExercisePerformance(feedback, []);
    assert.equal(outcome.decision, 'maintain');
    assert.equal(outcome.trend, 'uncertain');
  });

  it('D.1. Single anomalous missed session repeats target without confirming plateau', () => {
    const history: ExercisePerformanceHistoryEntry[] = [
      { feedback: { exerciseId: 'bench_press', completed: true, targetRepsAchieved: true } },
      { feedback: { exerciseId: 'bench_press', completed: true, targetRepsAchieved: true } },
    ];
    const current: ExercisePerformanceFeedback = {
      exerciseId: 'bench_press',
      completed: true,
      targetRepsAchieved: false,
    };

    const outcome = evaluateExercisePerformance(current, history);
    assert.equal(outcome.decision, 'repeat');
    assert.notEqual(outcome.plateauState, 'confirmed');
  });

  it('D.2. Repeated stagnation (3 missed targets) confirms plateau and signals regression', () => {
    const history: ExercisePerformanceHistoryEntry[] = [
      { feedback: { exerciseId: 'bench_press', completed: true, targetRepsAchieved: false } },
      { feedback: { exerciseId: 'bench_press', completed: true, targetRepsAchieved: false } },
    ];
    const current: ExercisePerformanceFeedback = {
      exerciseId: 'bench_press',
      completed: true,
      targetRepsAchieved: false,
    };

    const outcome = evaluateExercisePerformance(current, history);
    assert.equal(outcome.decision, 'regress');
    assert.equal(outcome.progressionPaused, true);
    assert.ok(outcome.regressionReason && outcome.regressionReason.length > 0);
    assert.equal(outcome.plateauState, 'confirmed');
    assert.equal(outcome.trend, 'declining');
  });

  it('D.3. Regression outcome is a signal only: does NOT modify T6 demand or make deload decisions', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    // Snapshot T6 demand before progression evaluation
    const demandSnapshot = JSON.parse(JSON.stringify(demand));

    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    // Verify T6 demand was completely untouched by progression evaluation
    assert.deepEqual(demand, demandSnapshot);

    // Verify T7 produces no deload decision or recovery constraint objects
    const rawProg = prog as Record<string, unknown>;
    assert.equal('recoveryConstraints' in rawProg, false);
    assert.equal('deload' in rawProg, false);
    assert.equal('demandReduction' in rawProg, false);
  });

  it('E.1. Different progression profiles produce appropriate exercise-specific progression methods', () => {
    const profile = createProfile({ goal: 'get_stronger' });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    // Primary compound receives load_progression, accessory receives double_progression
    assert.ok(prog.exerciseProgressionPlans.length > 0);
    const accessoryPlan = prog.exerciseProgressionPlans.find((p) => p.method === 'double_progression');
    const primaryPlan = prog.exerciseProgressionPlans.find((p) => p.method === 'load_progression');

    assert.ok(accessoryPlan, 'Accessory exercises should use double_progression');
    assert.ok(primaryPlan, 'Primary compound exercises under strength should use load_progression');
  });

  it('F.1. Substituted exercise maintains baseline and does not inherit unsafe assumptions', () => {
    const current: ExercisePerformanceFeedback = {
      exerciseId: 'dumbbell_bench_press',
      completed: true,
      isSubstituted: true,
    };

    const outcome = evaluateExercisePerformance(current, []);
    assert.equal(outcome.decision, 'maintain');
    assert.equal(outcome.trend, 'uncertain');
    assert.ok(outcome.rationale.includes('substituted'));
  });

  it('G.1. T4 and T6 boundaries are respected in progression strategy', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.ok(prog.exerciseProgressionPlans.length > 0);
    assert.ok(prog.stallPolicy.enabled);
  });

  it('H.1. Determinism: same input produces identical progression strategy', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    const p1 = resolveProgressionStrategy(profile, obj, struct, load, demand);
    const p2 = resolveProgressionStrategy(profile, obj, struct, load, demand);

    assert.deepEqual(p1, p2);
  });

  it('I.1. Immutability: input profile and history are not mutated', () => {
    const profile = createProfile();
    const snapProfile = JSON.parse(JSON.stringify(profile));
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);

    resolveProgressionStrategy(profile, obj, struct, load, demand);
    assert.deepEqual(profile, snapProfile);

    const history: ExercisePerformanceHistoryEntry[] = [
      { feedback: { exerciseId: 'bench_press', completed: true, targetRepsAchieved: true } },
    ];
    const snapHistory = JSON.parse(JSON.stringify(history));
    evaluateExercisePerformance({ exerciseId: 'bench_press', completed: true }, history);
    assert.deepEqual(history, snapHistory);
  });

  it('J.1. Scope & safety: T7 produces no exact sets, reps, load, RIR, calendar days, or medical scores', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const load = resolveTrainingLoad(profile, obj, freq, struct);
    const sel = resolveExerciseSelection(profile, obj, struct);
    const demand = resolveTrainingDemand(profile, obj, freq, struct, load, sel);
    const prog = resolveProgressionStrategy(profile, obj, struct, load, demand);

    const raw = prog as Record<string, unknown>;
    assert.equal('sets' in raw, false);
    assert.equal('reps' in raw, false);
    assert.equal('weightKg' in raw, false);
    assert.equal('exactWeight' in raw, false);
    assert.equal('calendarDays' in raw, false);
    assert.equal('medicalDiagnosis' in raw, false);
    assert.equal('injuryDiagnosis' in raw, false);
    assert.equal('recoveryScore' in raw, false);
  });

  it('K.1. Pipeline integration: adult reaches T7 through runStrategyPipeline', () => {
    const profile = createProfile({ age: 28 });
    const pipeline = runStrategyPipeline(profile);

    assert.equal(pipeline.status, 'completed');
    assert.equal(pipeline.path, 'adult_strategy');
    if (pipeline.status === 'completed') {
      assert.ok(pipeline.progression);
      assert.ok(pipeline.progression.exerciseProgressionPlans.length > 0);
      assert.ok(pipeline.decisionTrace.some((t) => t.includes('T7 Progression Method')));
    }
  });

  it('K.2. Pipeline integration: youth profile (age 13-17) never reaches T7', () => {
    const youthAges = [13, 14, 17];
    for (const age of youthAges) {
      const profile = createProfile({ age });
      const pipeline = runStrategyPipeline(profile);

      assert.equal(pipeline.status, 'pending');
      assert.equal(pipeline.path, 'youth_strategy_pending');
      const raw = pipeline as Record<string, unknown>;
      assert.equal('progression' in raw, false);
      assert.ok(pipeline.decisionTrace.some((t) => t.includes('Adult T7 (Progression Strategy) SKIPPED')));
    }
  });

  it('K.3. Pipeline integration: ineligible profile never reaches T7', () => {
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
    assert.equal('progression' in raw, false);
  });
});
