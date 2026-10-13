/**
 * Workout History Adapters (Stage W6.1)
 *
 * Bridges the stored execution history to downstream T7 Progression and T9 Recovery engines.
 *
 * INVARIANTS:
 * - Pure functions; no side-effects.
 * - Does NOT decide progressions or recovery interventions.
 * - Strictly preserves existing T7 ExercisePerformanceFeedback and T9 RecoveryRuntimeState contracts.
 */

import type {
  WorkoutExecution,
  WorkoutFeedbackSnapshot,
  SessionExecutionHistorySummary,
  ExercisePerformanceFeedback,
} from '../workout-runtime';
import {
  adaptToT7PerformanceFeedback,
  adaptToT9RecoveryRuntimeState,
} from '../workout-runtime';
import type { RecoveryRuntimeState, RecoveryConstraintLevel } from '../training-strategy/types';
import type { WorkoutPlan, WorkoutSession } from '../workout-plan';
import { buildExecutionHistorySummary, selectExerciseHistory } from './historySelectors';

/**
 * Builds T9 RecoveryRuntimeState from raw historical executions and plan structure.
 */
export function buildRecoveryRuntimeStateFromHistory(
  executions: readonly WorkoutExecution[],
  plan: WorkoutPlan,
  options: {
    previousConstraintLevel?: RecoveryConstraintLevel;
  } = {}
): RecoveryRuntimeState {
  const sessionLookup = (sessionId: string) =>
    plan.sessions.find((s) => s.sessionId === sessionId);

  const summary = buildExecutionHistorySummary(
    executions,
    plan.structure.sessionsPerCycle,
    sessionLookup
  );

  return adaptToT9RecoveryRuntimeState(summary, options);
}

/**
 * Extracts all T7 ExercisePerformanceFeedback records for a specific exercise from history.
 */
export function extractExercisePerformanceHistory(
  executions: readonly WorkoutExecution[],
  exerciseId: string,
  sessionLookup?: (sessionId: string) => WorkoutSession | undefined
): ExercisePerformanceFeedback[] {
  const history = selectExerciseHistory(executions, exerciseId, sessionLookup);
  return history.map((h) => h.feedback);
}
