/**
 * Workout History Selectors (Stage W6.1)
 *
 * Pure selector functions to query and aggregate historical WorkoutExecution records.
 *
 * DESIGN INVARIANTS:
 * - 100% pure functions, zero side-effects.
 * - Non-mutating; always return new arrays or frozen values.
 * - Does NOT make progression or recovery decisions (delegated to T7 & T9).
 */

import type {
  WorkoutExecution,
  WorkoutExecutionStatus,
  WorkoutFeedbackSnapshot,
  SessionExecutionHistorySummary,
  ExercisePerformanceFeedback,
} from '../workout-runtime';
import { buildWorkoutFeedbackSnapshot } from '../workout-runtime';
import type { WorkoutPlan, WorkoutSession } from '../workout-plan';
import type { WorkoutHistoryFilter } from './types';

/**
 * Filter and sort executions newest-to-oldest by timestamp.
 */
export function selectExecutions(
  executions: readonly WorkoutExecution[],
  filter?: WorkoutHistoryFilter
): WorkoutExecution[] {
  let filtered = [...executions];

  if (filter?.planId) {
    filtered = filtered.filter((e) => e.planId === filter.planId);
  }

  if (filter?.sessionId) {
    filtered = filtered.filter((e) => e.sessionId === filter.sessionId);
  }

  if (filter?.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    filtered = filtered.filter((e) => statuses.includes(e.status));
  }

  if (filter?.fromTimestamp !== undefined) {
    filtered = filtered.filter(
      (e) => (e.completedAtTimestamp ?? e.startedAtTimestamp ?? 0) >= filter.fromTimestamp!
    );
  }

  if (filter?.toTimestamp !== undefined) {
    filtered = filtered.filter(
      (e) => (e.completedAtTimestamp ?? e.startedAtTimestamp ?? 0) <= filter.toTimestamp!
    );
  }

  // Sort newest first
  filtered.sort((a, b) => {
    const timeA = a.completedAtTimestamp ?? a.startedAtTimestamp ?? 0;
    const timeB = b.completedAtTimestamp ?? b.startedAtTimestamp ?? 0;
    return timeB - timeA;
  });

  if (filter?.limit !== undefined && filter.limit > 0) {
    return filtered.slice(0, filter.limit);
  }

  return filtered;
}

/**
 * Select completed executions only, newest first.
 */
export function selectCompletedExecutions(
  executions: readonly WorkoutExecution[],
  planId?: string
): WorkoutExecution[] {
  return selectExecutions(executions, { planId, status: 'completed' });
}

/**
 * Select the latest execution for a specific session ID (or any session if omitted).
 */
export function selectLatestExecution(
  executions: readonly WorkoutExecution[],
  sessionId?: string
): WorkoutExecution | null {
  const matching = selectExecutions(executions, { sessionId });
  return matching.length > 0 ? matching[0] : null;
}

/**
 * Select active/in-progress executions.
 */
export function selectActiveExecution(
  executions: readonly WorkoutExecution[],
  planId?: string,
  sessionId?: string
): WorkoutExecution | null {
  const active = selectExecutions(executions, {
    planId,
    sessionId,
    status: ['in_progress', 'not_started'],
  });
  return active.length > 0 ? active[0] : null;
}

/**
 * Build a structured SessionExecutionHistorySummary for downstream T9 recovery consumption.
 *
 * @param executions All relevant historical executions (can include all statuses)
 * @param totalPlannedSessions Number of sessions planned in the cycle
 * @param sessionLookup Optional lookup function to retrieve prescribed WorkoutSession for accurate set/rep calculations
 */
export function buildExecutionHistorySummary(
  executions: readonly WorkoutExecution[],
  totalPlannedSessions: number,
  sessionLookup?: (sessionId: string) => WorkoutSession | undefined
): SessionExecutionHistorySummary {
  const terminal = selectExecutions(executions, {
    status: ['completed', 'abandoned', 'skipped'],
  });

  const completedSessions = terminal.filter((e) => e.status === 'completed').length;
  const missedSessions = terminal.filter((e) => e.status === 'skipped').length;

  // Build feedback snapshots for all terminal executions in chronological order (oldest first, newest last)
  const chronologicalExecs = [...terminal].reverse();
  const recentSnapshots: WorkoutFeedbackSnapshot[] = chronologicalExecs.map((exec) => {
    const prescribedSession = sessionLookup ? sessionLookup(exec.sessionId) : undefined;
    return buildWorkoutFeedbackSnapshot(exec, prescribedSession);
  });

  // Calculate degraded sessions: completed or abandoned sessions where exercise feedback quality is degraded
  // or completed work sets was < prescribed work sets while not skipped
  let degradedSessions = 0;
  terminal.forEach((exec) => {
    if (exec.status === 'abandoned') {
      degradedSessions += 1;
      return;
    }
    if (exec.status === 'completed') {
      const hasDegradedExercise = exec.exerciseExecutions.some(
        (ex) =>
          ex.executionQuality === 'degraded' ||
          ex.setExecutions.some((s) => s.executionQuality === 'degraded')
      );
      if (hasDegradedExercise) {
        degradedSessions += 1;
      }
    }
  });

  // Calculate consecutive under-recovered sessions by inspecting the most recent sessions in chronological order
  // Chronological = oldest to newest
  const chronological = [...terminal].reverse();
  let consecutiveUnderRecoveredSessions = 0;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const exec = chronological[i];
    const isDegraded =
      exec.status === 'abandoned' ||
      exec.exerciseExecutions.some(
        (e) =>
          e.executionQuality === 'degraded' ||
          e.setExecutions.some((s) => s.executionQuality === 'degraded')
      );
    const hasLowRecoveryReport =
      exec.sessionFeedback?.perceivedRecoveryBeforeSession !== undefined &&
      exec.sessionFeedback.perceivedRecoveryBeforeSession <= 2;
    const hasHighSoreness =
      exec.sessionFeedback?.sorenessLevel === 'moderate' ||
      exec.sessionFeedback?.sorenessLevel === 'severe';

    if (isDegraded || hasLowRecoveryReport || hasHighSoreness) {
      consecutiveUnderRecoveredSessions += 1;
    } else {
      break;
    }
  }

  // Accumulated fatigue cycles estimate: 1 cycle per totalPlannedSessions completed
  const accumulatedFatigueCycles =
    totalPlannedSessions > 0 ? Math.floor(completedSessions / totalPlannedSessions) : 0;

  return {
    totalPlannedSessions,
    completedSessions,
    missedSessions,
    degradedSessions,
    consecutiveUnderRecoveredSessions,
    accumulatedFatigueCycles,
    recentSnapshots,
  };
}

/**
 * Aggregates historical performance feedback for a specific exercise across all completed executions.
 * Useful for T7 progression evaluation across sessions.
 */
export function selectExerciseHistory(
  executions: readonly WorkoutExecution[],
  exerciseId: string,
  sessionLookup?: (sessionId: string) => WorkoutSession | undefined
): {
  execution: WorkoutExecution;
  feedback: ExercisePerformanceFeedback;
}[] {
  const completedExecs = selectCompletedExecutions(executions);
  const results: {
    execution: WorkoutExecution;
    feedback: ExercisePerformanceFeedback;
  }[] = [];

  for (const exec of completedExecs) {
    const prescribedSession = sessionLookup ? sessionLookup(exec.sessionId) : undefined;
    const snapshot = buildWorkoutFeedbackSnapshot(exec, prescribedSession);
    const exerciseFb = snapshot.exerciseFeedbacks.find(
      (fb) => fb.exerciseId === exerciseId
    );
    if (exerciseFb) {
      results.push({
        execution: exec,
        feedback: exerciseFb,
      });
    }
  }

  return results;
}
