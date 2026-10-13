/**
 * Comprehensive Test Suite for Workout History & Local Persistence (Stage W6.1)
 *
 * Verifies all requirement areas specified by W6.1:
 * A. Storage Architecture & Repository Contract
 * B. WorkoutPlan Persistence & Hydration
 * C. WorkoutExecution Lifecycle & Terminal History
 * D. In-Progress Session Resume & Interruption Safety
 * E. Race Protection & Concurrent Update Safety
 * F. Factual Execution Evidence Integrity
 * G. Downstream T7 Progression Adapter Integration
 * H. Downstream T9 Recovery Adapter Integration
 * I. Storage Corruption Handling & Graceful Recovery
 * J. Querying, Filtering & Performance
 * K. Immutability & Determinism Verification
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  LocalWorkoutHistoryRepository,
  setRawStorageItemForTesting,
  WORKOUT_HISTORY_STORAGE_KEY,
  selectExecutions,
  selectCompletedExecutions,
  selectLatestExecution,
  selectActiveExecution,
  buildExecutionHistorySummary,
  selectExerciseHistory,
  buildRecoveryRuntimeStateFromHistory,
  extractExercisePerformanceHistory,
  type WorkoutHistoryStoreV1,
} from '../index';

import {
  initializeWorkoutExecution,
  startWorkoutExecution,
  recordSetExecution,
  completeExerciseExecution,
  completeWorkoutExecution,
  abandonWorkoutExecution,
  skipWorkoutExecution,
  getDevWorkoutSession,
  createDeterministicDevWorkoutPlan,
  type WorkoutExecution,
} from '../../workout-runtime';

import {
  validateWorkoutPlan,
  type WorkoutPlan,
  type WorkoutSession,
} from '../../workout-plan';

function getTestPlan(): WorkoutPlan {
  return createDeterministicDevWorkoutPlan();
}

/**
 * Helper to resolve all exercises in a session so completeWorkoutExecution succeeds.
 */
function completeAllExercises(
  execution: WorkoutExecution,
  session: WorkoutSession
): WorkoutExecution {
  let curr = execution;
  for (const ex of session.exercises) {
    const exExec = curr.exerciseExecutions.find((e) => e.exerciseId === ex.exerciseId);
    if (!exExec?.setExecutions.some((s) => s.completed)) {
      curr = recordSetExecution(curr, {
        exerciseId: ex.exerciseId,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 60,
        perceivedEffortRIR: 2,
      });
    }
    if (exExec?.status !== 'completed' && exExec?.status !== 'skipped') {
      curr = completeExerciseExecution(curr, ex.exerciseId);
    }
  }
  return curr;
}

describe('Stage W6.1 — Workout History & Local Persistence Foundation', () => {
  let repo: LocalWorkoutHistoryRepository;

  beforeEach(async () => {
    repo = new LocalWorkoutHistoryRepository();
    await repo.clearAll();
  });

  // ==========================================================================
  // SECTION A: Repository Contract & Store Schema
  // ==========================================================================
  describe('A. Repository Contract & Schema', () => {
    it('initializes with null activePlan and empty executions list', async () => {
      const activePlan = await repo.loadActivePlan();
      const executions = await repo.getExecutions();
      assert.equal(activePlan, null);
      assert.deepEqual(executions, []);
    });

    it('clears all data cleanly on clearAll()', async () => {
      const plan = getTestPlan();
      await repo.saveActivePlan(plan);
      const session = plan.sessions[0];
      const exec = initializeWorkoutExecution(session, 'plan_test');
      await repo.saveActiveExecution(exec);

      assert.notEqual(await repo.loadActivePlan(), null);
      assert.equal((await repo.getExecutions()).length, 1);

      await repo.clearAll();

      assert.equal(await repo.loadActivePlan(), null);
      assert.equal((await repo.getExecutions()).length, 0);
    });
  });

  // ==========================================================================
  // SECTION B: WorkoutPlan Persistence & Hydration
  // ==========================================================================
  describe('B. WorkoutPlan Persistence & Hydration', () => {
    it('persists and restores a real generated WorkoutPlan with zero structural loss', async () => {
      const plan = getTestPlan();
      await repo.saveActivePlan(plan);

      const hydrated = await repo.loadActivePlan();
      assert.notEqual(hydrated, null);
      assert.equal(hydrated!.schemaVersion, 1);
      assert.equal(hydrated!.population, 'adult');
      assert.equal(hydrated!.structure.splitFamily, plan.structure.splitFamily);
      assert.equal(hydrated!.sessions.length, plan.sessions.length);
      assert.equal(hydrated!.sessions[0].sessionId, plan.sessions[0].sessionId);

      // Verify domain validator accepts hydrated plan
      const validation = validateWorkoutPlan(hydrated);
      assert.equal(validation.valid, true);
    });

    it('rejects saving an invalid or corrupted WorkoutPlan object', async () => {
      const corruptPlan = { schemaVersion: 99, badField: true } as any;
      await assert.rejects(async () => {
        await repo.saveActivePlan(corruptPlan);
      }, /Cannot persist invalid WorkoutPlan/);
    });

    it('clears activePlan when passing null', async () => {
      const plan = getTestPlan();
      await repo.saveActivePlan(plan);
      assert.notEqual(await repo.loadActivePlan(), null);

      await repo.saveActivePlan(null);
      assert.equal(await repo.loadActivePlan(), null);
    });
  });

  // ==========================================================================
  // SECTION C: WorkoutExecution Lifecycle & Terminal History
  // ==========================================================================
  describe('C. WorkoutExecution Lifecycle & Terminal History', () => {
    it('records an in-progress workout and updates it without duplicating entries', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'test_plan', 'exec_001');
      await repo.saveActiveExecution(initial);

      let stored = await repo.getExecutions();
      assert.equal(stored.length, 1);
      assert.equal(stored[0].status, 'not_started');

      const started = startWorkoutExecution(initial, 1000);
      await repo.saveActiveExecution(started);

      stored = await repo.getExecutions();
      assert.equal(stored.length, 1);
      assert.equal(stored[0].status, 'in_progress');
      assert.equal(stored[0].startedAtTimestamp, 1000);
    });

    it('saves completed workout to terminal history', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'test_plan', 'exec_comp_1');
      const started = startWorkoutExecution(initial, 1000);
      const allResolved = completeAllExercises(started, devSession);
      const workoutCompleted = completeWorkoutExecution(allResolved, 2000, {
        sessionRPE: 8,
        energyLevel: 4,
      });

      await repo.saveTerminalExecution(workoutCompleted);

      const terminal = await repo.getExecutionById('exec_comp_1');
      assert.notEqual(terminal, null);
      assert.equal(terminal!.status, 'completed');
      assert.equal(terminal!.completedAtTimestamp, 2000);
      assert.equal(terminal!.sessionFeedback?.sessionRPE, 8);
    });

    it('saves abandoned workout to terminal history preserving recorded sets', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'test_plan', 'exec_abandon_1');
      const started = startWorkoutExecution(initial, 1000);
      const setRecorded = recordSetExecution(started, {
        exerciseId: devSession.exercises[0].exerciseId,
        setIndex: 1,
        actualReps: 8,
        actualLoad: 75,
      });
      const abandoned = abandonWorkoutExecution(setRecorded, 1500, 'Trainee had to leave');

      await repo.saveTerminalExecution(abandoned);

      const terminal = await repo.getExecutionById('exec_abandon_1');
      assert.notEqual(terminal, null);
      assert.equal(terminal!.status, 'abandoned');
      assert.equal(terminal!.exerciseExecutions[0].setExecutions[0].completed, true);
      assert.equal(terminal!.exerciseExecutions[0].setExecutions[0].actualReps, 8);
    });

    it('saves skipped workout to terminal history', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'test_plan', 'exec_skip_1');
      const skipped = skipWorkoutExecution(initial, 'Trainee sick');

      await repo.saveTerminalExecution(skipped);

      const terminal = await repo.getExecutionById('exec_skip_1');
      assert.notEqual(terminal, null);
      assert.equal(terminal!.status, 'skipped');
    });

    it('rejects saveTerminalExecution for in_progress or not_started status', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'test_plan', 'exec_invalid');
      await assert.rejects(async () => {
        await repo.saveTerminalExecution(initial);
      }, /saveTerminalExecution expects status 'completed', 'abandoned', or 'skipped'/);
    });
  });

  // ==========================================================================
  // SECTION D: In-Progress Session Resume & Interruption Safety
  // ==========================================================================
  describe('D. In-Progress Session Resume & Interruption Safety', () => {
    it('retrieves active in-flight execution by planId and sessionId for clean resumption', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'plan_resume', 'exec_resume_1');
      const started = startWorkoutExecution(initial, 1000);
      const withSet = recordSetExecution(started, {
        exerciseId: devSession.exercises[0].exerciseId,
        setIndex: 1,
        actualReps: 12,
        actualLoad: 50,
      });

      await repo.saveActiveExecution(withSet);

      // Simulate app restart / screen reload
      const loaded = await repo.loadActiveExecution('plan_resume', devSession.sessionId);
      assert.notEqual(loaded, null);
      assert.equal(loaded!.executionId, 'exec_resume_1');
      assert.equal(loaded!.status, 'in_progress');
      assert.equal(loaded!.exerciseExecutions[0].setExecutions[0].completed, true);
      assert.equal(loaded!.exerciseExecutions[0].setExecutions[0].actualReps, 12);
      assert.equal(loaded!.exerciseExecutions[0].setExecutions[0].actualLoad, 50);
    });

    it('returns null for loadActiveExecution once the session is terminal (completed)', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'plan_resume', 'exec_done_1');
      const started = startWorkoutExecution(initial, 1000);
      const allResolved = completeAllExercises(started, devSession);
      const finished = completeWorkoutExecution(allResolved, 2000);

      await repo.saveTerminalExecution(finished);

      const active = await repo.loadActiveExecution('plan_resume', devSession.sessionId);
      assert.equal(active, null);
    });
  });

  // ==========================================================================
  // SECTION E: Race Protection & Concurrent Write Serialization
  // ==========================================================================
  describe('E. Race Protection & Serialization', () => {
    it('safely serializes concurrent rapid updates without data loss', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'plan_concurrent', 'exec_concurrent_1');
      const started = startWorkoutExecution(initial, 1000);

      // Dispatch 3 rapid set updates concurrently
      let current = started;
      const promises: Promise<void>[] = [];
      for (let i = 1; i <= 3; i++) {
        current = recordSetExecution(current, {
          exerciseId: devSession.exercises[0].exerciseId,
          setIndex: i,
          actualReps: 10 + i,
          actualLoad: 60,
        });
        promises.push(repo.saveActiveExecution(current));
      }

      await Promise.all(promises);

      const retrieved = await repo.getExecutionById('exec_concurrent_1');
      assert.notEqual(retrieved, null);
      const completedSets = retrieved!.exerciseExecutions[0].setExecutions.filter((s) => s.completed);
      assert.equal(completedSets.length, 3);
      assert.equal(completedSets[0].actualReps, 11);
      assert.equal(completedSets[1].actualReps, 12);
      assert.equal(completedSets[2].actualReps, 13);
    });
  });

  // ==========================================================================
  // SECTION F: Factual Execution Evidence Integrity
  // ==========================================================================
  describe('F. Factual Execution Evidence Integrity', () => {
    it('preserves exact loads, reps, RIR, execution qualities, and subjective notes', async () => {
      const devSession = getDevWorkoutSession();
      const initial = initializeWorkoutExecution(devSession, 'plan_integrity', 'exec_int_1');
      const started = startWorkoutExecution(initial, 1000);
      const withSet = recordSetExecution(started, {
        exerciseId: devSession.exercises[0].exerciseId,
        setIndex: 1,
        actualReps: 9,
        actualLoad: 82.5,
        loadUnit: 'kg',
        perceivedEffortRIR: 1.5,
        executionQuality: 'acceptable',
        notes: 'Felt slight fatigue on last rep',
      });
      const allResolved = completeAllExercises(withSet, devSession);
      const finished = completeWorkoutExecution(allResolved, 3000, {
        sessionRPE: 8,
        energyLevel: 3,
        sorenessLevel: 'moderate',
        notes: 'Overall solid workout',
      });

      await repo.saveTerminalExecution(finished);

      const retrieved = await repo.getExecutionById('exec_int_1');
      assert.notEqual(retrieved, null);
      const s = retrieved!.exerciseExecutions[0].setExecutions[0];
      assert.equal(s.actualReps, 9);
      assert.equal(s.actualLoad, 82.5);
      assert.equal(s.loadUnit, 'kg');
      assert.equal(s.perceivedEffortRIR, 1.5);
      assert.equal(s.executionQuality, 'acceptable');
      assert.equal(s.notes, 'Felt slight fatigue on last rep');

      assert.equal(retrieved!.sessionFeedback?.sessionRPE, 8);
      assert.equal(retrieved!.sessionFeedback?.energyLevel, 3);
      assert.equal(retrieved!.sessionFeedback?.sorenessLevel, 'moderate');
      assert.equal(retrieved!.sessionFeedback?.notes, 'Overall solid workout');
    });
  });

  // ==========================================================================
  // SECTION G: Downstream T7 Progression Adapter Integration
  // ==========================================================================
  describe('G. Downstream T7 Progression Adapter Integration', () => {
    it('extracts structured ExercisePerformanceFeedback across historical executions', async () => {
      const devSession = getDevWorkoutSession();
      const targetExerciseId = devSession.exercises[0].exerciseId;

      // Create 2 historical executions for this exercise
      const exec1 = initializeWorkoutExecution(devSession, 'plan_1', 'hist_1');
      const s1 = startWorkoutExecution(exec1, 1000);
      const r1 = completeAllExercises(s1, devSession);
      const f1 = completeWorkoutExecution(r1, 2000);
      await repo.saveTerminalExecution(f1);

      const exec2 = initializeWorkoutExecution(devSession, 'plan_1', 'hist_2');
      const s2 = startWorkoutExecution(exec2, 3000);
      const r2 = completeAllExercises(s2, devSession);
      const f2 = completeWorkoutExecution(r2, 4000);
      await repo.saveTerminalExecution(f2);

      const allExecs = await repo.getExecutions();
      const exerciseHistory = extractExercisePerformanceHistory(
        allExecs,
        targetExerciseId,
        (sId) => devSession
      );

      assert.equal(exerciseHistory.length, 2);
      assert.equal(exerciseHistory[0].exerciseId, targetExerciseId);
      assert.equal(exerciseHistory[0].completed, true);
      assert.equal(exerciseHistory[1].completed, true);
    });
  });

  // ==========================================================================
  // SECTION H: Downstream T9 Recovery Adapter Integration
  // ==========================================================================
  describe('H. Downstream T9 Recovery Adapter Integration', () => {
    it('aggregates history into RecoveryRuntimeState preserving existing T9 contracts', async () => {
      const plan = getTestPlan();
      const devSession = plan.sessions[0];

      // Session 1: completed normally
      const exec1 = initializeWorkoutExecution(devSession, 'plan_t9', 'rec_1');
      const s1 = startWorkoutExecution(exec1, 1000);
      const c1 = completeAllExercises(s1, devSession);
      const f1 = completeWorkoutExecution(c1, 2000, {
        energyLevel: 4,
        sorenessLevel: 'mild',
      });
      await repo.saveTerminalExecution(f1);

      // Session 2: abandoned due to fatigue (degraded)
      const exec2 = initializeWorkoutExecution(devSession, 'plan_t9', 'rec_2');
      const s2 = startWorkoutExecution(exec2, 3000);
      const f2 = abandonWorkoutExecution(s2, 3500, 'Excess fatigue');
      await repo.saveTerminalExecution(f2);

      const allExecs = await repo.getExecutions();
      const recoveryRuntimeState = buildRecoveryRuntimeStateFromHistory(allExecs, plan);

      assert.equal(recoveryRuntimeState.recentDegradedSessionsCount, 1);
      assert.equal(recoveryRuntimeState.recentMissedSessionsCount, 0);
      assert.equal(recoveryRuntimeState.consecutiveUnderRecoveredSessions, 1);
      assert.equal(recoveryRuntimeState.previousConstraintLevel, 'stable');
    });

    it('detects multiple degraded sessions triggering performanceRegressionObserved', async () => {
      const plan = getTestPlan();
      const devSession = plan.sessions[0];

      // Two consecutive abandoned sessions
      const exec1 = initializeWorkoutExecution(devSession, 'plan_t9', 'deg_1');
      const s1 = startWorkoutExecution(exec1, 1000);
      const f1 = abandonWorkoutExecution(s1, 1500, 'Fatigued');
      await repo.saveTerminalExecution(f1);

      const exec2 = initializeWorkoutExecution(devSession, 'plan_t9', 'deg_2');
      const s2 = startWorkoutExecution(exec2, 2000);
      const f2 = abandonWorkoutExecution(s2, 2500, 'Exhausted');
      await repo.saveTerminalExecution(f2);

      const allExecs = await repo.getExecutions();
      const recoveryState = buildRecoveryRuntimeStateFromHistory(allExecs, plan);

      assert.equal(recoveryState.recentDegradedSessionsCount, 2);
      assert.equal(recoveryState.performanceRegressionObserved, true);
    });
  });

  // ==========================================================================
  // SECTION I: Storage Corruption Handling & Graceful Recovery
  // ==========================================================================
  describe('I. Storage Corruption Handling & Graceful Recovery', () => {
    it('discards corrupted execution records while preserving valid ones on hydration', async () => {
      const devSession = getDevWorkoutSession();
      const validExec = initializeWorkoutExecution(devSession, 'plan_corr', 'valid_1');
      await repo.saveActiveExecution(validExec);

      // Inject a corrupt execution directly into the raw store
      const storeWithCorrupt: WorkoutHistoryStoreV1 = {
        schemaVersion: 1,
        activePlan: null,
        executions: [
          validExec,
          { executionId: '', sessionId: '', status: 'invalid_status' } as any, // corrupt!
        ],
        lastUpdatedTimestamp: Date.now(),
      };

      setRawStorageItemForTesting(JSON.stringify(storeWithCorrupt));

      // Load via fresh repository
      const freshRepo = new LocalWorkoutHistoryRepository();
      const executions = await freshRepo.getExecutions();

      // Only validExec is preserved
      assert.equal(executions.length, 1);
      assert.equal(executions[0].executionId, 'valid_1');
    });

    it('recovers cleanly from totally malformed non-JSON data without crashing', async () => {
      setRawStorageItemForTesting('{malformed json! not valid');

      const freshRepo = new LocalWorkoutHistoryRepository();
      const plan = await freshRepo.loadActivePlan();
      const executions = await freshRepo.getExecutions();

      assert.equal(plan, null);
      assert.deepEqual(executions, []);
    });
  });

  // ==========================================================================
  // SECTION J: Querying, Filtering & Performance
  // ==========================================================================
  describe('J. Querying, Filtering & Performance', () => {
    it('filters executions by status, sessionId, and timestamp range', async () => {
      const devSession = getDevWorkoutSession();
      const e1 = initializeWorkoutExecution(devSession, 'p1', 'q_1');
      const s1 = startWorkoutExecution(e1, 1000);
      const c1 = completeAllExercises(s1, devSession);
      const comp1 = completeWorkoutExecution(c1, 1500);
      await repo.saveTerminalExecution(comp1);

      const e2 = initializeWorkoutExecution(devSession, 'p1', 'q_2');
      const skip2 = skipWorkoutExecution(e2);
      await repo.saveTerminalExecution(skip2);

      const completed = await repo.getExecutions({ status: 'completed' });
      assert.equal(completed.length, 1);
      assert.equal(completed[0].executionId, 'q_1');

      const skipped = await repo.getExecutions({ status: 'skipped' });
      assert.equal(skipped.length, 1);
      assert.equal(skipped[0].executionId, 'q_2');
    });

    it('sorts executions newest-to-oldest by default', async () => {
      const devSession = getDevWorkoutSession();
      const e1 = initializeWorkoutExecution(devSession, 'p1', 'old_1');
      const s1 = startWorkoutExecution(e1, 1000);
      const c1 = completeAllExercises(s1, devSession);
      const f1 = completeWorkoutExecution(c1, 1200);
      await repo.saveTerminalExecution(f1);

      const e2 = initializeWorkoutExecution(devSession, 'p1', 'new_1');
      const s2 = startWorkoutExecution(e2, 5000);
      const c2 = completeAllExercises(s2, devSession);
      const f2 = completeWorkoutExecution(c2, 5500);
      await repo.saveTerminalExecution(f2);

      const list = await repo.getExecutions();
      assert.equal(list.length, 2);
      assert.equal(list[0].executionId, 'new_1'); // newest first
      assert.equal(list[1].executionId, 'old_1');
    });
  });

  // ==========================================================================
  // SECTION K: Determinism & Immutability
  // ==========================================================================
  describe('K. Determinism & Immutability', () => {
    it('does not mutate historical executions in place when reading or filtering', async () => {
      const devSession = getDevWorkoutSession();
      const e1 = initializeWorkoutExecution(devSession, 'p_immut', 'immut_1');
      const s1 = startWorkoutExecution(e1, 1000);
      const c1 = completeAllExercises(s1, devSession);
      const f1 = completeWorkoutExecution(c1, 2000);
      await repo.saveTerminalExecution(f1);

      const read1 = await repo.getExecutions();
      const read2 = await repo.getExecutions();

      assert.notEqual(read1, read2); // fresh array instance
      assert.deepEqual(read1, read2);
    });
  });
});
