/**
 * Downstream Strategy Adapters (Stage W4.1)
 *
 * Pure adapters transforming W4 runtime execution evidence into:
 * 1. WorkoutFeedbackSnapshot: Normalized session evidence snapshot.
 * 2. T7 ExercisePerformanceFeedback: Shape expected by progression engine.
 * 3. T9 RecoveryRuntimeState: Shape expected by recovery constraints engine.
 *
 * DESIGN INVARIANTS:
 * 1. Does NOT make progression/regression decisions (owned by T7).
 * 2. Does NOT make recovery constraint/deload decisions (owned by T9).
 * 3. Pure translation and aggregation of observed factual evidence.
 */

import type {
  WorkoutExecution,
  WorkoutFeedbackSnapshot,
  SessionExecutionHistorySummary,
} from './types';
import type { WorkoutSession, ExercisePrescription } from '../workout-plan';
import type {
  ExercisePerformanceFeedback,
  ExecutionQuality,
} from '../training-strategy/progressionStrategy';
import type {
  RecoveryRuntimeState,
  RecoveryConstraintLevel,
} from '../training-strategy/types';

/**
 * Builds a normalized WorkoutFeedbackSnapshot from a finished or in-flight WorkoutExecution.
 */
export function buildWorkoutFeedbackSnapshot(
  execution: WorkoutExecution,
  prescribedSession?: WorkoutSession
): WorkoutFeedbackSnapshot {
  if (!execution || typeof execution !== 'object') {
    throw new TypeError('buildWorkoutFeedbackSnapshot requires a valid WorkoutExecution.');
  }

  const totalPrescribedExercises = prescribedSession
    ? prescribedSession.exercises.length
    : execution.exerciseExecutions.length;

  let totalPrescribedWorkSets = 0;
  if (prescribedSession) {
    prescribedSession.exercises.forEach((ex) => {
      totalPrescribedWorkSets += ex.sets.filter((s) => s.setType === 'work').length;
    });
  } else {
    execution.exerciseExecutions.forEach((ex) => {
      totalPrescribedWorkSets += ex.setExecutions.filter((s) => s.setType === 'work').length;
    });
  }

  const completedExercisesCount = execution.exerciseExecutions.filter(
    (e) => e.status === 'completed' || e.status === 'substituted'
  ).length;

  const skippedExercisesCount = execution.exerciseExecutions.filter(
    (e) => e.status === 'skipped'
  ).length;

  let completedWorkSetsCount = 0;
  execution.exerciseExecutions.forEach((ex) => {
    completedWorkSetsCount += ex.setExecutions.filter(
      (s) => s.setType === 'work' && s.completed
    ).length;
  });

  const allPrescribedWorkCompleted =
    execution.status === 'completed' &&
    completedExercisesCount === totalPrescribedExercises &&
    completedWorkSetsCount >= totalPrescribedWorkSets;

  // Build exercise-level feedback for T7
  const exerciseFeedbacks: ExercisePerformanceFeedback[] = execution.exerciseExecutions.map(
    (ex) => {
      const isSubstituted = ex.status === 'substituted' || Boolean(ex.substitution);
      const isCompleted = ex.status === 'completed' || isSubstituted;

      // Find prescribed exercise for target comparison if available
      const prescribedEx = prescribedSession?.exercises[ex.prescribedExerciseIndex];
      const prescribedWorkSets = prescribedEx
        ? prescribedEx.sets.filter((s) => s.setType === 'work')
        : ex.setExecutions.filter((s) => s.setType === 'work');

      // Completed work sets (or all completed sets if only warmups completed)
      const completedSets = ex.setExecutions.filter((s) => s.completed);
      const completedWorkSets = completedSets.filter((s) => s.setType === 'work');
      const targetEvaluatedSets = completedWorkSets.length > 0 ? completedWorkSets : completedSets;

      // Target reps achieved evaluation:
      // True if all evaluated sets met or exceeded prescribed target reps or repRange.min
      let targetRepsAchieved: boolean | undefined = undefined;
      if (isCompleted && targetEvaluatedSets.length > 0) {
        if (prescribedEx) {
          const minTarget = prescribedEx.repetitionPrescription.targetReps ??
            prescribedEx.repetitionPrescription.repRange?.min ?? 8;
          targetRepsAchieved = targetEvaluatedSets.every((s) => (s.actualReps ?? 0) >= minTarget);
        } else {
          targetRepsAchieved = true;
        }
      } else if (ex.status === 'skipped') {
        targetRepsAchieved = false;
      }

      // Perceived RIR: average across completed sets
      let perceivedEffortRIR: number | undefined = undefined;
      const rirSets = targetEvaluatedSets.filter((s) => s.perceivedEffortRIR !== undefined);
      if (rirSets.length > 0) {
        const sumRIR = rirSets.reduce((sum, s) => sum + (s.perceivedEffortRIR ?? 0), 0);
        perceivedEffortRIR = Math.round((sumRIR / rirSets.length) * 10) / 10;
      }

      // Execution quality: worst quality among evaluated sets or exercise quality
      let executionQuality: ExecutionQuality = ex.executionQuality ?? 'clean';
      if (targetEvaluatedSets.some((s) => s.executionQuality === 'degraded')) {
        executionQuality = 'degraded';
      } else if (targetEvaluatedSets.some((s) => s.executionQuality === 'acceptable')) {
        executionQuality = executionQuality === 'clean' ? 'acceptable' : executionQuality;
      }

      return {
        exerciseId: ex.substitution?.originalExerciseId ?? ex.exerciseId,
        completed: isCompleted,
        targetRepsAchieved,
        perceivedEffortRIR,
        executionQuality,
        isSubstituted: isSubstituted || undefined,
      };
    }
  );

  const conditioningCompleted = execution.conditioningExecution
    ? execution.conditioningExecution.status === 'completed'
    : undefined;

  const summary = `Workout '${execution.sessionId}' status '${execution.status}': ${completedExercisesCount}/${totalPrescribedExercises} exercises, ${completedWorkSetsCount}/${totalPrescribedWorkSets} work sets completed.`;

  return {
    executionId: execution.executionId,
    sessionId: execution.sessionId,
    sessionSequenceIndex: execution.sessionSequenceIndex,
    sessionStatus: execution.status,
    startedAtTimestamp: execution.startedAtTimestamp,
    completedAtTimestamp: execution.completedAtTimestamp,
    totalPrescribedExercises,
    completedExercisesCount,
    skippedExercisesCount,
    totalPrescribedWorkSets,
    completedWorkSetsCount,
    allPrescribedWorkCompleted,
    exerciseFeedbacks,
    conditioningCompleted,
    subjectiveFeedback: execution.sessionFeedback,
    evidenceSummary: summary,
  };
}

/**
 * T7 Adapter: Converts WorkoutFeedbackSnapshot into array of ExercisePerformanceFeedback.
 */
export function adaptToT7PerformanceFeedback(
  snapshot: WorkoutFeedbackSnapshot
): ExercisePerformanceFeedback[] {
  if (!snapshot || !Array.isArray(snapshot.exerciseFeedbacks)) {
    return [];
  }
  return snapshot.exerciseFeedbacks.map((fb) => ({
    exerciseId: fb.exerciseId,
    completed: fb.completed,
    targetRepsAchieved: fb.targetRepsAchieved,
    perceivedEffortRIR: fb.perceivedEffortRIR,
    executionQuality: fb.executionQuality,
    isSubstituted: fb.isSubstituted,
  }));
}

/**
 * T9 Adapter: Translates session execution history and recent snapshots into RecoveryRuntimeState.
 */
export function adaptToT9RecoveryRuntimeState(
  history: SessionExecutionHistorySummary,
  options: {
    previousConstraintLevel?: RecoveryConstraintLevel;
    latestSubjectiveFeedback?: WorkoutFeedbackSnapshot['subjectiveFeedback'];
  } = {}
): RecoveryRuntimeState {
  const {
    missedSessions,
    degradedSessions,
    consecutiveUnderRecoveredSessions,
    accumulatedFatigueCycles,
    recentSnapshots,
  } = history;

  // Derive latest subjective signals from latest snapshot or provided options
  const latestSnapshot = recentSnapshots.length > 0
    ? recentSnapshots[recentSnapshots.length - 1]
    : undefined;

  const subjective = options.latestSubjectiveFeedback ?? latestSnapshot?.subjectiveFeedback;

  // Check if performance regression is observed in recent snapshots
  const performanceRegressionObserved = degradedSessions >= 2 || consecutiveUnderRecoveredSessions >= 2;

  return {
    energyLevel: subjective?.energyLevel,
    sorenessLevel: subjective?.sorenessLevel,
    recentMissedSessionsCount: missedSessions,
    recentDegradedSessionsCount: degradedSessions,
    consecutiveUnderRecoveredSessions,
    accumulatedFatigueCycles,
    performanceRegressionObserved,
    previousConstraintLevel: options.previousConstraintLevel ?? 'stable',
  };
}
