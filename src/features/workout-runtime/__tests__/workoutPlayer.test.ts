/**
 * Stage W4.2 — Workout Player UI & Runtime Wiring Test Suite
 *
 * Verifies player controller workflows, dev fixture consistency,
 * set/exercise state transitions, finish-early semantics, exercise substitution,
 * data integrity preservation, validation boundaries, T7/T9 handoffs,
 * and pure deterministic immutability.
 *
 * TEST CATEGORIES (A to G):
 * A. Dev fixture & structural setup (deterministic session, exercises, sets, conditioning)
 * B. Player runtime wiring (start, record set, finish early, skip, substitute, complete, abandon)
 * C. Validation & boundary enforcement (invalid reps/load/RIR rejection, lifecycle blocks)
 * D. Data integrity (prescribed values preserved, factual partial sets never faked)
 * E. T7 progression handoff verification (performance feedback accurately mapped)
 * F. T9 recovery handoff verification (recovery runtime state truthfully captured)
 * G. Determinism & immutability (action sequence replaying yields deep equality)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeterministicDevWorkoutPlan,
  getDevWorkoutSession,
} from '../devFixture';
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
  validateSetExecution,
  buildWorkoutFeedbackSnapshot,
  adaptToT7PerformanceFeedback,
  adaptToT9RecoveryRuntimeState,
} from '../index';

describe('W4.2 Workout Player UI + Runtime Wiring', () => {
  // =========================================================================
  // CATEGORY A: Dev Fixture & Structural Setup
  // =========================================================================
  describe('Category A: Dev Fixture & Structural Setup', () => {
    it('generates a valid, deterministic W3 WorkoutPlan fixture', () => {
      const plan = createDeterministicDevWorkoutPlan();
      assert.strictEqual(plan.schemaVersion, 1);
      assert.strictEqual(plan.population, 'adult');
      assert.ok(plan.sessions.length > 0, 'Plan has at least one session');
      assert.ok(plan.generationMetadata.totalSetsPrescribed > 0);
    });

    it('retrieves session_1 by default or specific ID with resistance exercises', () => {
      const session = getDevWorkoutSession();
      assert.strictEqual(session.sessionId, 'session_1');
      assert.ok(session.exercises.length >= 3, 'Session has at least 3 exercises');
      assert.ok(session.targetDurationMinutes > 0, 'Duration is positive');

      // Specific session lookup
      const session2 = getDevWorkoutSession('session_2');
      assert.strictEqual(session2.sessionId, 'session_2');
    });

    it('preserves all prescribed exercise fields without null or NaN fields', () => {
      const session = getDevWorkoutSession();
      for (const ex of session.exercises) {
        assert.ok(ex.exerciseId, 'Exercise has ID');
        assert.ok(ex.exerciseName, 'Exercise has Name');
        assert.ok(ex.sets.length > 0, 'Target sets > 0');
        assert.ok(ex.repetitionPrescription, 'Valid rep target');
        assert.ok(ex.effortPrescription, 'Valid effort prescription');
        assert.ok(ex.effortPrescription.targetRIR >= 0, 'Valid target RIR');
        assert.ok(ex.restSeconds > 0, 'Valid rest target');
        assert.ok(['primary', 'secondary', 'accessory'].includes(ex.role), 'Valid movement role');
      }
    });
  });

  // =========================================================================
  // CATEGORY B: Player Runtime Wiring
  // =========================================================================
  describe('Category B: Player Runtime Wiring', () => {
    it('executes a full workout flow: start -> log sets -> condition -> feedback -> complete', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      assert.strictEqual(exec.status, 'not_started');

      // Start workout
      const tStart = 1700000000000;
      exec = startWorkoutExecution(exec, tStart);
      assert.strictEqual(exec.status, 'in_progress');
      assert.strictEqual(exec.startedAtTimestamp, tStart);

      // Perform all exercises
      for (let i = 0; i < session.exercises.length; i++) {
        const ex = session.exercises[i];
        exec = startExerciseExecution(exec, ex.exerciseId);

        const targetReps = ex.repetitionPrescription.targetReps ?? ex.repetitionPrescription.repRange?.min ?? 10;
        const targetRIR = ex.effortPrescription.targetRIR;

        for (let s = 1; s <= ex.sets.length; s++) {
          exec = recordSetExecution(exec, {
            exerciseId: ex.exerciseId,
            setIndex: s,
            actualReps: targetReps,
            actualLoad: 50 + s * 5,
            loadUnit: 'kg',
            perceivedEffortRIR: targetRIR,
            executionQuality: 'clean',
          });
        }
        exec = completeExerciseExecution(exec, ex.exerciseId, {
          overallQuality: 'clean',
          notes: 'Completed all prescribed sets',
        });
        const exState = exec.exerciseExecutions.find((e) => e.exerciseId === ex.exerciseId)!;
        assert.strictEqual(exState.status, 'completed');
      }

      // Record conditioning
      if (session.conditioning) {
        const dur = session.conditioning.durationMinutesGuidance?.target ?? 20;
        exec = recordConditioningExecution(exec, {
          actualDurationMinutes: dur,
          completedAsPrescribed: true,
          perceivedEffortRIR: 3,
          notes: 'Zone 2 conditioning completed smoothly',
        });
        assert.ok(exec.conditioningExecution);
        assert.strictEqual(exec.conditioningExecution.actualDurationMinutes, dur);
      }

      // Attach subjective session feedback
      exec = attachSessionFeedback(exec, {
        sessionRPE: 7.5,
        energyLevel: 4,
        sorenessLevel: 'none',
        notes: 'Felt strong throughout session',
      });
      assert.strictEqual(exec.sessionFeedback?.sessionRPE, 7.5);

      // Complete workout
      const tEnd = 1700003600000;
      exec = completeWorkoutExecution(exec, tEnd);
      assert.strictEqual(exec.status, 'completed');
      assert.strictEqual(exec.completedAtTimestamp, tEnd);
    });

    it('handles finish-early semantics: 1 of 3 sets done marks exercise completed with partial note, does not fake unperformed sets', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      const targetExercise = session.exercises[0];
      assert.ok(targetExercise.sets.length >= 2, 'Has at least 2 sets to test partial finish');

      exec = startExerciseExecution(exec, targetExercise.exerciseId);

      // Record set 1 only
      exec = recordSetExecution(exec, {
        exerciseId: targetExercise.exerciseId,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 60,
        loadUnit: 'kg',
        perceivedEffortRIR: 2,
        executionQuality: 'clean',
      });

      // Finish early with partial note
      exec = completeExerciseExecution(exec, targetExercise.exerciseId, {
        notes: 'Fatigue limit reached; ended early',
      });

      const exExec = exec.exerciseExecutions.find((e) => e.exerciseId === targetExercise.exerciseId)!;
      assert.strictEqual(exExec.status, 'completed');
      const completedSets = exExec.setExecutions.filter((s) => s.completed);
      assert.strictEqual(completedSets.length, 1);
      assert.ok(exExec.notes?.includes('Fatigue limit reached; ended early'));

      // The unperformed sets must NOT be marked completed
      const unperformed = exExec.setExecutions.filter((s) => s.setIndex > 1);
      assert.ok(unperformed.every((s) => !s.completed));
    });

    it('handles skip exercise correctly: 0 sets done marks exercise skipped', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      const targetExercise = session.exercises[0];
      exec = skipExerciseExecution(exec, targetExercise.exerciseId, 'Equipment occupied');
      const exExec = exec.exerciseExecutions.find((e) => e.exerciseId === targetExercise.exerciseId)!;
      assert.strictEqual(exExec.status, 'skipped');
      assert.ok(exExec.notes?.includes('Equipment occupied'));
      assert.strictEqual(exExec.setExecutions.filter((s) => s.completed).length, 0);
    });

    it('handles exercise substitution: swaps prescribed exercise with allowed substitute', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      const targetExercise = session.exercises[0];
      const substituteId = targetExercise.substitutionExerciseIds[0] || 'substitute_exercise_1';

      exec = substituteExerciseExecution(
        exec,
        targetExercise.exerciseId,
        substituteId,
        targetExercise,
        'Equipment busy'
      );

      const subEx = exec.exerciseExecutions.find((e) => e.exerciseId === substituteId)!;
      assert.strictEqual(subEx.status, 'substituted');
      assert.strictEqual(subEx.substitution?.originalExerciseId, targetExercise.exerciseId);
      assert.strictEqual(subEx.substitution?.reason, 'Equipment busy');

      // Now record sets on substituted exercise
      exec = recordSetExecution(exec, {
        exerciseId: substituteId,
        setIndex: 1,
        actualReps: 12,
        actualLoad: 24,
        loadUnit: 'kg',
        perceivedEffortRIR: 2,
        executionQuality: 'clean',
      });
      exec = completeExerciseExecution(exec, substituteId, { overallQuality: 'clean' });

      const finishedSubEx = exec.exerciseExecutions.find((e) => e.exerciseId === substituteId)!;
      assert.strictEqual(finishedSubEx.status, 'completed');
      assert.strictEqual(finishedSubEx.setExecutions[0].actualReps, 12);
    });

    it('allows abandoning a workout at any point with truthful reason', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      // Abandon after 1 set
      const ex0 = session.exercises[0];
      exec = startExerciseExecution(exec, ex0.exerciseId);
      exec = recordSetExecution(exec, {
        exerciseId: ex0.exerciseId,
        setIndex: 1,
        actualReps: 8,
        actualLoad: 60,
        loadUnit: 'kg',
        perceivedEffortRIR: 3,
        executionQuality: 'clean',
      });

      exec = abandonWorkoutExecution(exec, 1700001000000, 'Emergency interruption');
      assert.strictEqual(exec.status, 'abandoned');
      assert.ok(exec.decisionTrace.some((t) => t.includes('Emergency interruption')));
      assert.strictEqual(exec.completedAtTimestamp, 1700001000000);
    });
  });

  // =========================================================================
  // CATEGORY C: Validation & Error Handling
  // =========================================================================
  describe('Category C: Validation & Error Handling', () => {
    it('rejects invalid set logging inputs (negative reps, negative load, negative RIR)', () => {
      const validSet = {
        setIndex: 1,
        setType: 'work' as const,
        completed: true,
        actualReps: 10,
        actualLoad: 50,
        loadUnit: 'kg' as const,
        perceivedEffortRIR: 2,
        executionQuality: 'clean' as const,
      };

      // Negative reps
      const err1 = validateSetExecution({ ...validSet, actualReps: -1 });
      assert.ok(err1.length > 0, 'Detected negative reps');

      // Negative load
      const err2 = validateSetExecution({ ...validSet, actualLoad: -5 });
      assert.ok(err2.length > 0, 'Detected negative load');

      // Negative RIR
      const err3 = validateSetExecution({ ...validSet, perceivedEffortRIR: -0.5 });
      assert.ok(err3.length > 0, 'Detected negative RIR');

      // RIR > 10
      const err4 = validateSetExecution({ ...validSet, perceivedEffortRIR: 11 });
      assert.ok(err4.length > 0, 'Detected excessive RIR');
    });

    it('rejects completing a workout when exercises remain pending or in_progress', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      // Only complete exercise 0
      const ex0 = session.exercises[0];
      exec = startExerciseExecution(exec, ex0.exerciseId);
      exec = recordSetExecution(exec, {
        exerciseId: ex0.exerciseId,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 50,
      });
      exec = completeExerciseExecution(exec, ex0.exerciseId);

      // Other exercises are still pending
      assert.throws(
        () => completeWorkoutExecution(exec, 1700002000000),
        /remain unresolved/
      );
    });

    it('rejects modifying an already completed or abandoned workout execution', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);
      exec = abandonWorkoutExecution(exec, 1700001000000, 'Test abandon');

      // Attempting to start exercise on abandoned session
      assert.throws(
        () => startExerciseExecution(exec, session.exercises[0].exerciseId),
        /Cannot start exercise: workout is 'abandoned'/
      );
    });
  });

  // =========================================================================
  // CATEGORY D: Data Integrity & Prescription Separation
  // =========================================================================
  describe('Category D: Data Integrity & Prescription Separation', () => {
    it('never overwrites prescribed exercise targets with actual performed values', () => {
      const session = getDevWorkoutSession();
      const ex0 = session.exercises[0];
      const originalSetsCount = ex0.sets.length;
      const originalRepsPrescription = JSON.stringify(ex0.repetitionPrescription);

      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);
      exec = startExerciseExecution(exec, ex0.exerciseId);

      // Performed values intentionally diverge from prescribed
      exec = recordSetExecution(exec, {
        exerciseId: ex0.exerciseId,
        setIndex: 1,
        actualReps: 25, // well above target
        actualLoad: 120,
        loadUnit: 'kg',
        perceivedEffortRIR: 0, // max effort
        executionQuality: 'grind',
      });

      // Assert original session is completely unchanged
      assert.strictEqual(session.exercises[0].sets.length, originalSetsCount);
      assert.strictEqual(JSON.stringify(session.exercises[0].repetitionPrescription), originalRepsPrescription);

      // In execution, exerciseId references original
      const exExec = exec.exerciseExecutions.find((e) => e.exerciseId === ex0.exerciseId)!;
      assert.strictEqual(exExec.exerciseId, ex0.exerciseId);
    });

    it('factual partial sets are preserved honestly without phantom padding', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      // Prescribed >= 2 sets, user only does 1 set
      const ex0 = session.exercises[0];
      exec = startExerciseExecution(exec, ex0.exerciseId);
      exec = recordSetExecution(exec, {
        exerciseId: ex0.exerciseId,
        setIndex: 1,
        actualReps: 6,
        actualLoad: 80,
        loadUnit: 'kg',
        perceivedEffortRIR: 1,
        executionQuality: 'breakdown',
      });
      exec = completeExerciseExecution(exec, ex0.exerciseId, {
        overallQuality: 'breakdown',
        notes: 'Cut short due to technique breakdown',
      });

      const exExec = exec.exerciseExecutions.find((e) => e.exerciseId === ex0.exerciseId)!;
      const completedSets = exExec.setExecutions.filter((s) => s.completed);
      assert.strictEqual(completedSets.length, 1);
      assert.strictEqual(completedSets[0].actualReps, 6);
      assert.strictEqual(completedSets[0].executionQuality, 'breakdown');
    });
  });

  // =========================================================================
  // CATEGORY E: T7 Progression Handoff Verification
  // =========================================================================
  describe('Category E: T7 Progression Handoff Verification', () => {
    it('produces structured performance feedback matching T7 progression expectations', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      // Exercise 0: All target reps met cleanly
      const ex0 = session.exercises[0];
      const targetReps = ex0.repetitionPrescription.targetReps ?? ex0.repetitionPrescription.repRange?.max ?? 12;
      const targetRIR = ex0.effortPrescription.targetRIR;

      exec = startExerciseExecution(exec, ex0.exerciseId);
      for (let s = 1; s <= ex0.sets.length; s++) {
        exec = recordSetExecution(exec, {
          exerciseId: ex0.exerciseId,
          setIndex: s,
          actualReps: targetReps,
          actualLoad: 70,
          loadUnit: 'kg',
          perceivedEffortRIR: targetRIR,
          executionQuality: 'clean',
        });
      }
      exec = completeExerciseExecution(exec, ex0.exerciseId, { overallQuality: 'clean' });

      // Exercise 1: Substituted
      const ex1 = session.exercises[1];
      const subId1 = ex1.substitutionExerciseIds[0] || 'substitute_id_1';
      exec = substituteExerciseExecution(exec, ex1.exerciseId, subId1, ex1, 'Pull-up bar busy');
      exec = recordSetExecution(exec, {
        exerciseId: subId1,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 55,
        loadUnit: 'kg',
        perceivedEffortRIR: 2,
        executionQuality: 'clean',
      });
      exec = completeExerciseExecution(exec, subId1, { overallQuality: 'clean' });

      // Skip remaining
      for (let i = 2; i < session.exercises.length; i++) {
        const exRem = session.exercises[i];
        exec = skipExerciseExecution(exec, exRem.exerciseId, 'Ran out of time');
      }
      exec = completeWorkoutExecution(exec, 1700003000000);

      // Adapt to T7 feedback via snapshot
      const snapshot = buildWorkoutFeedbackSnapshot(exec, session);
      const t7Feedback = adaptToT7PerformanceFeedback(snapshot);
      assert.strictEqual(t7Feedback.length, session.exercises.length);

      // Exercise 0 feedback
      const fb0 = t7Feedback.find((f) => f.exerciseId === ex0.exerciseId)!;
      assert.strictEqual(fb0.completed, true);
      assert.strictEqual(fb0.targetRepsAchieved, true);
      assert.strictEqual(fb0.executionQuality, 'clean');
      assert.strictEqual(fb0.isSubstituted, undefined);

      // Exercise 1 feedback (substituted)
      const fb1 = t7Feedback.find((f) => f.exerciseId === ex1.exerciseId)!;
      assert.strictEqual(fb1.completed, true);
      assert.strictEqual(fb1.isSubstituted, true);

      // Skipped exercises feedback
      const fb2 = t7Feedback.find((f) => f.exerciseId === session.exercises[2].exerciseId)!;
      assert.strictEqual(fb2.completed, false);
      assert.strictEqual(fb2.targetRepsAchieved, false);
    });
  });

  // =========================================================================
  // CATEGORY F: T9 Recovery Handoff Verification
  // =========================================================================
  describe('Category F: T9 Recovery Handoff Verification', () => {
    it('produces structured recovery runtime state capturing fatigue signals without deciding recovery actions', () => {
      const session = getDevWorkoutSession();
      let exec = initializeWorkoutExecution(session);
      exec = startWorkoutExecution(exec, 1700000000000);

      for (let i = 0; i < session.exercises.length; i++) {
        const ex = session.exercises[i];
        exec = startExerciseExecution(exec, ex.exerciseId);
        exec = recordSetExecution(exec, {
          exerciseId: ex.exerciseId,
          setIndex: 1,
          actualReps: 10,
          actualLoad: 60,
          loadUnit: 'kg',
          perceivedEffortRIR: 0.5, // near failure (high effort)
          executionQuality: 'grind',
        });
        exec = completeExerciseExecution(exec, ex.exerciseId, { overallQuality: 'grind' });
      }

      exec = attachSessionFeedback(exec, {
        sessionRPE: 9, // high RPE
        energyLevel: 2, // low energy
        sorenessLevel: 'moderate',
        notes: 'Very strenuous session',
      });
      exec = completeWorkoutExecution(exec, 1700003000000);

      const snapshot = buildWorkoutFeedbackSnapshot(exec, session);
      const recoveryState = adaptToT9RecoveryRuntimeState(
        {
          totalPlannedSessions: session.exercises.length,
          completedSessions: 1,
          missedSessions: 0,
          degradedSessions: 0,
          consecutiveUnderRecoveredSessions: 0,
          accumulatedFatigueCycles: 0,
          recentSnapshots: [snapshot],
        },
        {
          latestSubjectiveFeedback: snapshot.subjectiveFeedback,
          previousConstraintLevel: 'stable',
        }
      );

      assert.strictEqual(recoveryState.energyLevel, 2);
      assert.strictEqual(recoveryState.sorenessLevel, 'moderate');
      assert.strictEqual(recoveryState.recentMissedSessionsCount, 0);
      assert.strictEqual(recoveryState.recentDegradedSessionsCount, 0);
      assert.strictEqual(recoveryState.previousConstraintLevel, 'stable');

      // Crucial: T9 adapter provides factual evidence ONLY, does NOT mutate recovery rules or strategy
      assert.strictEqual((recoveryState as any).deloadPrescribed, undefined);
      assert.strictEqual((recoveryState as any).volumeReductionPercent, undefined);
    });
  });

  // =========================================================================
  // CATEGORY G: Determinism & Immutability
  // =========================================================================
  describe('Category G: Determinism & Immutability', () => {
    it('replaying the identical action sequence produces deeply identical state trees', () => {
      const runScenario = () => {
        const session = getDevWorkoutSession();
        let exec = initializeWorkoutExecution(session, 'plan-fix', 'exec-fix');
        exec = startWorkoutExecution(exec, 1700000000000);
        const ex0 = session.exercises[0];
        exec = startExerciseExecution(exec, ex0.exerciseId);
        exec = recordSetExecution(exec, {
          exerciseId: ex0.exerciseId,
          setIndex: 1,
          actualReps: 8,
          actualLoad: 80,
          loadUnit: 'kg',
          perceivedEffortRIR: 2,
          executionQuality: 'clean',
        });
        exec = completeExerciseExecution(exec, ex0.exerciseId, { overallQuality: 'clean' });
        for (let i = 1; i < session.exercises.length; i++) {
          exec = skipExerciseExecution(exec, session.exercises[i].exerciseId, 'Replay test skip');
        }
        exec = completeWorkoutExecution(exec, 1700002000000);
        const feedback = buildWorkoutFeedbackSnapshot(exec, session);
        const t7 = adaptToT7PerformanceFeedback(feedback);
        const t9 = adaptToT9RecoveryRuntimeState({
          totalPlannedSessions: 1,
          completedSessions: 1,
          missedSessions: 0,
          degradedSessions: 0,
          consecutiveUnderRecoveredSessions: 0,
          accumulatedFatigueCycles: 0,
          recentSnapshots: [feedback],
        });
        return { exec, feedback, t7, t9 };
      };

      const run1 = runScenario();
      const run2 = runScenario();

      assert.deepStrictEqual(run1.exec, run2.exec);
      assert.deepStrictEqual(run1.feedback, run2.feedback);
      assert.deepStrictEqual(run1.t7, run2.t7);
      assert.deepStrictEqual(run1.t9, run2.t9);
    });

    it('each execution state modification returns a new object reference', () => {
      const session = getDevWorkoutSession();
      const state0 = initializeWorkoutExecution(session);
      const state1 = startWorkoutExecution(state0, 1700000000000);
      assert.notStrictEqual(state0, state1);
      assert.strictEqual(state0.status, 'not_started');
      assert.strictEqual(state1.status, 'in_progress');

      const ex0 = session.exercises[0];
      const state2 = startExerciseExecution(state1, ex0.exerciseId);
      assert.notStrictEqual(state1, state2);
      const exIn1 = state1.exerciseExecutions.find((e) => e.exerciseId === ex0.exerciseId)!;
      const exIn2 = state2.exerciseExecutions.find((e) => e.exerciseId === ex0.exerciseId)!;
      assert.strictEqual(exIn1.status, 'pending');
      assert.strictEqual(exIn2.status, 'in_progress');
    });
  });
});
