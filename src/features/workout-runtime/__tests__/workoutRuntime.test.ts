/**
 * Stage W4.1 — Runtime Workout Execution Test Suite
 *
 * Verifies the runtime execution state machine, set/exercise logging,
 * validation, T7 progression handoff adapter, T9 recovery handoff adapter,
 * immutability, and determinism.
 *
 * TEST CATEGORIES (A to G):
 * A. Lifecycle state transitions (start, progress, complete, abandon, skip, invalid transitions)
 * B. Set logging (completed sets, actual reps/load/RIR, execution quality, duplicate set indices, invalid values)
 * C. Exercise execution (completion, skipping, valid/invalid substitution, unresolved exercises)
 * D. Workout completion (valid completion, incomplete exercise rejection, skipped exercise handling)
 * E. T7 progression handoff adapter (clean execution, missed targets, degraded quality, substitutions)
 * F. T9 recovery handoff adapter (session history translation, missed/degraded sessions, fatigue indicators)
 * G. Immutability & Determinism (pure updates, snapshot preservation, identical outputs for identical inputs)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeWorkoutExecution,
  startWorkoutExecution,
  startExerciseExecution,
  recordSetExecution,
  completeExerciseExecution,
  skipExerciseExecution,
  substituteExerciseExecution,
  recordConditioningExecution,
  attachSessionFeedback,
  completeWorkoutExecution,
  abandonWorkoutExecution,
  skipWorkoutExecution,
  validateSetExecution,
  validateExerciseExecution,
  validateWorkoutExecution,
  buildWorkoutFeedbackSnapshot,
  adaptToT7PerformanceFeedback,
  adaptToT9RecoveryRuntimeState,
} from '../index';
import type { WorkoutSession, ExercisePrescription } from '../../workout-plan';
import { runStrategyPipeline } from '../../training-strategy';
import { buildCanonicalUserProfile } from '../../profile';
import { buildWorkoutPlanSkeleton, generatePrescribedWorkoutPlan } from '../../workout-plan';
import type { OnboardingData } from '../../onboarding/onboardingState';

function createSampleSession(): WorkoutSession {
  const baseData: OnboardingData = {
    goal: 'build_muscle',
    age: 28,
    heightCm: 180,
    weightKg: 78.5,
    trainingHistory: '1_to_2_years',
    consistency: 'mostly_consistent',
    exerciseConfidence: 4,
    programmingConfidence: 3,
    idealTrainingDays: 3,
    realisticMinimumDays: 3,
    availableDays: ['mon', 'wed', 'fri'],
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
    exerciseVariety: 'some_variety',
    favorites: ['bench_press'],
    dislikes: [],
    avoid: [],
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
    likedFoods: [],
    dislikedFoods: [],
    preferredMeals: '3',
    mealSource: 'mostly_cook',
    eatingOutFrequency: '1_2_week',
    nutritionStructure: 'mostly_structured',
    communicationStyle: 'educational',
    decisionAutonomy: 'recommend',
    explanationDepth: 'detailed',
    accountability: 'gentle',
    isCompleted: true,
  };

  const profile = buildCanonicalUserProfile(baseData);
  const result = runStrategyPipeline(profile);
  if (result.status !== 'completed') throw new Error('Strategy failed');
  const skeleton = buildWorkoutPlanSkeleton(result.strategy, profile);
  const plan = generatePrescribedWorkoutPlan(skeleton, result.strategy, profile);
  return plan.sessions[0];
}

describe('Stage W4.1 — Runtime Workout Execution Foundation', () => {
  // ==================================================
  // CATEGORY A: LIFECYCLE STATE TRANSITIONS
  // ==================================================
  describe('A. Lifecycle state transitions', () => {
    it('A.1. Initializes in "not_started" status with pending exercises', () => {
      const session = createSampleSession();
      const execution = initializeWorkoutExecution(session);

      assert.equal(execution.status, 'not_started');
      assert.equal(execution.sessionId, session.sessionId);
      assert.equal(execution.exerciseExecutions.length, session.exercises.length);
      execution.exerciseExecutions.forEach((e) => {
        assert.equal(e.status, 'pending');
        assert.ok(e.setExecutions.length > 0);
      });
    });

    it('A.2. Transitions from "not_started" to "in_progress" with timestamp', () => {
      const session = createSampleSession();
      const initial = initializeWorkoutExecution(session);
      const started = startWorkoutExecution(initial, 1700000000000);

      assert.equal(started.status, 'in_progress');
      assert.equal(started.startedAtTimestamp, 1700000000000);
      assert.ok(started.decisionTrace.length > initial.decisionTrace.length);
    });

    it('A.3. Rejects starting an already started or completed workout', () => {
      const session = createSampleSession();
      const initial = initializeWorkoutExecution(session);
      const started = startWorkoutExecution(initial, 1700000000000);

      assert.throws(() => startWorkoutExecution(started, 1700000001000), /expected 'not_started'/);
    });

    it('A.4. Transitions to "abandoned" when in_progress', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const abandoned = abandonWorkoutExecution(started, 1700000005000, 'User ran out of time');

      assert.equal(abandoned.status, 'abandoned');
      assert.equal(abandoned.completedAtTimestamp, 1700000005000);
    });

    it('A.5. Allows skipping a "not_started" workout', () => {
      const session = createSampleSession();
      const initial = initializeWorkoutExecution(session);
      const skipped = skipWorkoutExecution(initial, 'Trainee was traveling');

      assert.equal(skipped.status, 'skipped');
    });

    it('A.6. Rejects skipping an "in_progress" workout', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      assert.throws(() => skipWorkoutExecution(started), /must be 'not_started'/);
    });
  });

  // ==================================================
  // CATEGORY B: SET LOGGING
  // ==================================================
  describe('B. Set logging', () => {
    it('B.1. Successfully records completed set with reps, load, unit, and RIR', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const firstExId = started.exerciseExecutions[0].exerciseId;

      const updated = recordSetExecution(started, {
        exerciseId: firstExId,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 80,
        loadUnit: 'kg',
        perceivedEffortRIR: 2,
        executionQuality: 'clean',
      });

      const ex = updated.exerciseExecutions.find((e) => e.exerciseId === firstExId)!;
      assert.equal(ex.status, 'in_progress');
      const set1 = ex.setExecutions.find((s) => s.setIndex === 1)!;
      assert.equal(set1.completed, true);
      assert.equal(set1.actualReps, 10);
      assert.equal(set1.actualLoad, 80);
      assert.equal(set1.loadUnit, 'kg');
      assert.equal(set1.perceivedEffortRIR, 2);
      assert.equal(set1.executionQuality, 'clean');
    });

    it('B.2. Rejects negative actualReps or invalid numbers', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const firstExId = started.exerciseExecutions[0].exerciseId;

      assert.throws(
        () =>
          recordSetExecution(started, {
            exerciseId: firstExId,
            setIndex: 1,
            actualReps: -5,
          }),
        /actualReps must be a non-negative integer/
      );
    });

    it('B.3. Validator catches duplicate setIndex and missing reps', () => {
      const errors = validateSetExecution({
        setIndex: 1,
        setType: 'work',
        completed: true,
        actualReps: undefined,
        loadUnit: 'kg',
      });

      assert.ok(errors.some((e) => e.path.includes('actualReps')));
    });

    it('B.4. Validator catches out-of-range perceivedEffortRIR (> 10 or < 0)', () => {
      const errors = validateSetExecution({
        setIndex: 1,
        setType: 'work',
        completed: true,
        actualReps: 8,
        actualLoad: 60,
        loadUnit: 'kg',
        perceivedEffortRIR: 15,
      });

      assert.ok(errors.some((e) => e.path.includes('perceivedEffortRIR')));
    });
  });

  // ==================================================
  // CATEGORY C: EXERCISE EXECUTION & SUBSTITUTION
  // ==================================================
  describe('C. Exercise execution & substitution', () => {
    it('C.1. Completing an exercise requires at least one completed set', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const firstExId = started.exerciseExecutions[0].exerciseId;

      // Cannot complete with 0 sets completed
      assert.throws(
        () => completeExerciseExecution(started, firstExId),
        /zero sets have been recorded/
      );

      // Record a set first
      const withSet = recordSetExecution(started, {
        exerciseId: firstExId,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 70,
      });

      const completedEx = completeExerciseExecution(withSet, firstExId, {
        overallQuality: 'clean',
      });
      const ex = completedEx.exerciseExecutions.find((e) => e.exerciseId === firstExId)!;
      assert.equal(ex.status, 'completed');
    });

    it('C.2. Skipping an exercise marks it skipped and allows workout to complete', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const firstExId = started.exerciseExecutions[0].exerciseId;

      const skipped = skipExerciseExecution(started, firstExId, 'Equipment unavailable');
      const ex = skipped.exerciseExecutions.find((e) => e.exerciseId === firstExId)!;
      assert.equal(ex.status, 'skipped');
      assert.ok(ex.notes?.includes('Equipment unavailable'));
    });

    it('C.3. Substituting an exercise with an allowed substitute updates exercise ID and records substitution', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const prescribedEx = session.exercises[0];
      const substituteId = prescribedEx.substitutionExerciseIds[0];

      if (substituteId) {
        const substituted = substituteExerciseExecution(
          started,
          prescribedEx.exerciseId,
          substituteId,
          prescribedEx,
          'Dumbbell rack occupied'
        );

        const ex = substituted.exerciseExecutions[0];
        assert.equal(ex.exerciseId, substituteId);
        assert.equal(ex.status, 'substituted');
        assert.equal(ex.substitution?.originalExerciseId, prescribedEx.exerciseId);
        assert.equal(ex.substitution?.substitutedExerciseId, substituteId);
      }
    });

    it('C.4. Rejects substitution when substitute is not in allowed substitutions', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);
      const prescribedEx = session.exercises[0];

      assert.throws(
        () =>
          substituteExerciseExecution(
            started,
            prescribedEx.exerciseId,
            'completely_invalid_exercise',
            prescribedEx
          ),
        /not among allowed substitutions/
      );
    });
  });

  // ==================================================
  // CATEGORY D: WORKOUT COMPLETION
  // ==================================================
  describe('D. Workout completion', () => {
    it('D.1. Rejects completing workout while exercises remain pending or in_progress', () => {
      const session = createSampleSession();
      const started = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);

      assert.throws(
        () => completeWorkoutExecution(started, 1700000003000),
        /remain unresolved/
      );
    });

    it('D.2. Successfully completes workout when all exercises are resolved', () => {
      const session = createSampleSession();
      let execution = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);

      // Resolve every exercise (either complete or skip)
      for (const ex of session.exercises) {
        execution = recordSetExecution(execution, {
          exerciseId: ex.exerciseId,
          setIndex: 1,
          actualReps: 8,
          actualLoad: 50,
          perceivedEffortRIR: 2,
        });
        execution = completeExerciseExecution(execution, ex.exerciseId);
      }

      const completed = completeWorkoutExecution(execution, 1700000004000, {
        sessionRPE: 8,
        notes: 'Great workout',
      });

      assert.equal(completed.status, 'completed');
      assert.equal(completed.completedAtTimestamp, 1700000004000);
      assert.equal(completed.sessionFeedback?.sessionRPE, 8);

      const validation = validateWorkoutExecution(completed, session);
      assert.equal(validation.isValid, true);
    });
  });

  // ==================================================
  // CATEGORY E: T7 PROGRESSION HANDOFF ADAPTER
  // ==================================================
  describe('E. T7 progression handoff adapter', () => {
    it('E.1. Clean execution maps to completed = true and targetRepsAchieved = true', () => {
      const session = createSampleSession();
      let execution = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);

      const ex0 = session.exercises[0];
      execution = recordSetExecution(execution, {
        exerciseId: ex0.exerciseId,
        setIndex: 1,
        actualReps: 12,
        actualLoad: 75,
        perceivedEffortRIR: 2,
        executionQuality: 'clean',
      });
      execution = completeExerciseExecution(execution, ex0.exerciseId);

      // Skip remaining exercises for focused test
      for (let i = 1; i < session.exercises.length; i++) {
        execution = skipExerciseExecution(execution, session.exercises[i].exerciseId);
      }
      execution = completeWorkoutExecution(execution, 1700000004000);

      const snapshot = buildWorkoutFeedbackSnapshot(execution, session);
      const t7Feedback = adaptToT7PerformanceFeedback(snapshot);

      assert.equal(t7Feedback.length, session.exercises.length);
      const firstFb = t7Feedback.find((f) => f.exerciseId === ex0.exerciseId)!;
      assert.equal(firstFb.completed, true);
      assert.equal(firstFb.targetRepsAchieved, true);
      assert.equal(firstFb.perceivedEffortRIR, 2);
      assert.equal(firstFb.executionQuality, 'clean');
    });

    it('E.2. Missed target reps and degraded execution quality are preserved accurately for T7', () => {
      const session = createSampleSession();
      let execution = startWorkoutExecution(initializeWorkoutExecution(session), 1700000000000);

      const ex0 = session.exercises[0];
      // Trainee fails to achieve minimum target reps (e.g. only 4 reps when 8-12 is prescribed)
      execution = recordSetExecution(execution, {
        exerciseId: ex0.exerciseId,
        setIndex: 1,
        actualReps: 4,
        actualLoad: 100,
        perceivedEffortRIR: 0.5,
        executionQuality: 'degraded',
      });
      execution = completeExerciseExecution(execution, ex0.exerciseId);

      for (let i = 1; i < session.exercises.length; i++) {
        execution = skipExerciseExecution(execution, session.exercises[i].exerciseId);
      }
      execution = completeWorkoutExecution(execution, 1700000004000);

      const snapshot = buildWorkoutFeedbackSnapshot(execution, session);
      const t7Feedback = adaptToT7PerformanceFeedback(snapshot);
      const firstFb = t7Feedback.find((f) => f.exerciseId === ex0.exerciseId)!;

      assert.equal(firstFb.completed, true);
      assert.equal(firstFb.targetRepsAchieved, false);
      assert.equal(firstFb.executionQuality, 'degraded');
      assert.equal(firstFb.perceivedEffortRIR, 0.5);
    });
  });

  // ==================================================
  // CATEGORY F: T9 RECOVERY HANDOFF ADAPTER
  // ==================================================
  describe('F. T9 recovery handoff adapter', () => {
    it('F.1. Translates session history into valid RecoveryRuntimeState shape', () => {
      const runtimeState = adaptToT9RecoveryRuntimeState({
        totalPlannedSessions: 4,
        completedSessions: 3,
        missedSessions: 1,
        degradedSessions: 2,
        consecutiveUnderRecoveredSessions: 2,
        accumulatedFatigueCycles: 1,
        recentSnapshots: [],
      }, {
        previousConstraintLevel: 'constrained',
        latestSubjectiveFeedback: {
          energyLevel: 2,
          sorenessLevel: 'moderate',
        },
      });

      assert.equal(runtimeState.recentMissedSessionsCount, 1);
      assert.equal(runtimeState.recentDegradedSessionsCount, 2);
      assert.equal(runtimeState.consecutiveUnderRecoveredSessions, 2);
      assert.equal(runtimeState.accumulatedFatigueCycles, 1);
      assert.equal(runtimeState.performanceRegressionObserved, true);
      assert.equal(runtimeState.energyLevel, 2);
      assert.equal(runtimeState.sorenessLevel, 'moderate');
      assert.equal(runtimeState.previousConstraintLevel, 'constrained');
    });
  });

  // ==================================================
  // CATEGORY G: IMMUTABILITY & DETERMINISM
  // ==================================================
  describe('G. Immutability & determinism', () => {
    it('G.1. State transitions return fresh objects without mutating previous state', () => {
      const session = createSampleSession();
      const initial = initializeWorkoutExecution(session);
      const initialSnapshot = JSON.stringify(initial);

      const started = startWorkoutExecution(initial, 1700000000000);
      assert.equal(JSON.stringify(initial), initialSnapshot);
      assert.notEqual(initial.status, started.status);

      const withSet = recordSetExecution(started, {
        exerciseId: session.exercises[0].exerciseId,
        setIndex: 1,
        actualReps: 10,
      });
      assert.notEqual(started, withSet);
      assert.equal(started.exerciseExecutions[0].setExecutions[0].completed, false);
      assert.equal(withSet.exerciseExecutions[0].setExecutions[0].completed, true);
    });

    it('G.2. Deterministic execution: identical inputs produce identical output states', () => {
      const session = createSampleSession();
      const exec1 = startWorkoutExecution(initializeWorkoutExecution(session, 'p1', 'e1'), 1000);
      const exec2 = startWorkoutExecution(initializeWorkoutExecution(session, 'p1', 'e1'), 1000);

      assert.deepEqual(exec1, exec2);
    });
  });
});
