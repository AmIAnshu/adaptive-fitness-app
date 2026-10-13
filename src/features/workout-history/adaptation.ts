/**
 * Workout History Adaptation Loop (Stage W6.2)
 *
 * Connects historical workout execution evidence to upstream T7 progression
 * and T9 recovery decision authorities to produce adaptive strategy inputs for
 * future WorkoutPlan generation.
 *
 * DESIGN INVARIANTS:
 * 1. Pure functions; zero side effects; non-mutating.
 * 2. T7 remains the sole authority for progression, maintain, repeat, regress, and pause.
 * 3. T9 remains the sole authority for recovery constraints, modifiers, and deload decisions.
 * 4. Does NOT invent arbitrary progression formulas or recovery scores.
 * 5. Completed executions and historical plans are immutable.
 */

import type {
  WorkoutExecution,
  WorkoutFeedbackSnapshot,
  ExercisePerformanceFeedback,
} from '../workout-runtime';
import type {
  RecoveryRuntimeState,
  RecoveryConstraintLevel,
  DeloadDecision,
  RecoveryVolumeModifier,
  RecoveryEffortModifier,
  RecoveryConditioningModifier,
} from '../training-strategy/types';
import type {
  EvaluatedPerformanceOutcome,
  ExercisePerformanceHistoryEntry,
} from '../training-strategy/progressionStrategy';
import { evaluateExercisePerformance } from '../training-strategy/progressionStrategy';
import type { WorkoutPlan, WorkoutSession } from '../workout-plan';
import {
  buildExecutionHistorySummary,
  selectExerciseHistory,
  selectExecutions,
  selectCompletedExecutions,
} from './historySelectors';
import { adaptToT9RecoveryRuntimeState } from '../workout-runtime';

/**
 * Encapsulates the historical context passed to future WorkoutPlan generation.
 */
export interface WorkoutAdaptationContext {
  /** Optional planId to isolate history to a specific plan/cycle */
  planId?: string;
  /** Full or filtered list of historical WorkoutExecution records */
  historicalExecutions: readonly WorkoutExecution[];
  /** The prior WorkoutPlan from which executions were generated */
  previousPlan?: WorkoutPlan | null;
  /** The prior resolved recovery constraint level (for T9 hysteresis tracking) */
  previousConstraintLevel?: RecoveryConstraintLevel;
  /** Explicit subjective feedback overrides if present */
  latestSubjectiveFeedback?: WorkoutFeedbackSnapshot['subjectiveFeedback'];
}

/**
 * Summary of adaptive evaluation across T7 and T9 authorities.
 */
export interface AdaptiveStrategyEvaluation {
  runtimeState: RecoveryRuntimeState;
  exerciseOutcomes: EvaluatedPerformanceOutcome[];
  hasProgressionRegression: boolean;
  decisionTrace: string[];
}

/**
 * Pure evaluator: evaluates T7 performance outcomes for each unique exercise
 * appearing in historical executions or within a reference WorkoutPlan.
 *
 * For each exercise:
 * 1. Collects all completed execution feedbacks in chronological order (oldest to newest).
 * 2. Splits into historical entries (all prior sessions) and current feedback (the most recent session).
 * 3. Passes them directly to T7 `evaluateExercisePerformance(currentFeedback, recentHistory)`.
 */
export function evaluateT7ProgressionFromHistory(
  executions: readonly WorkoutExecution[],
  referencePlan?: WorkoutPlan | null,
  sessionLookup?: (sessionId: string) => WorkoutSession | undefined
): EvaluatedPerformanceOutcome[] {
  const completedExecs = selectCompletedExecutions(executions);
  if (completedExecs.length === 0) {
    return [];
  }

  // Fallback lookup from referencePlan if not provided
  const lookup =
    sessionLookup ??
    (referencePlan
      ? (sId: string) => referencePlan.sessions.find((s) => s.sessionId === sId)
      : undefined);

  // Discover all unique exercise IDs recorded in completed executions or reference plan
  const exerciseIds = new Set<string>();
  completedExecs.forEach((exec) => {
    exec.exerciseExecutions.forEach((ex) => {
      exerciseIds.add(ex.substitution?.originalExerciseId ?? ex.exerciseId);
    });
  });

  if (referencePlan) {
    referencePlan.sessions.forEach((s) => {
      s.exercises.forEach((ex) => {
        exerciseIds.add(ex.exerciseId);
      });
    });
  }

  const outcomes: EvaluatedPerformanceOutcome[] = [];

  for (const exId of exerciseIds) {
    // selectExerciseHistory returns newest first, so we reverse it to chronological order (oldest -> newest)
    const rawHistory = selectExerciseHistory(completedExecs, exId, lookup);
    if (rawHistory.length === 0) {
      continue;
    }

    const chronological = [...rawHistory].reverse();
    // Most recent session feedback is the last item
    const latestItem = chronological[chronological.length - 1];
    const priorItems = chronological.slice(0, chronological.length - 1);

    const recentHistoryEntries: ExercisePerformanceHistoryEntry[] = priorItems.map((item) => ({
      sessionTimestamp: item.execution.completedAtTimestamp ?? item.execution.startedAtTimestamp,
      feedback: item.feedback,
    }));

    const outcome = evaluateExercisePerformance(latestItem.feedback, recentHistoryEntries);
    outcomes.push(outcome);
  }

  return outcomes;
}

/**
 * Pure adapter: builds adaptive strategy inputs by synthesizing historical executions
 * through T9 recovery state construction and T7 performance evaluation.
 */
export function buildAdaptiveStrategyInputs(
  context: WorkoutAdaptationContext
): AdaptiveStrategyEvaluation {
  const {
    historicalExecutions,
    previousPlan,
    previousConstraintLevel,
    latestSubjectiveFeedback,
  } = context;

  const trace: string[] = ['[WorkoutAdaptation] Historical evaluation initialized.'];

  // 1. If no historical executions exist, return neutral baseline
  if (!historicalExecutions || historicalExecutions.length === 0) {
    trace.push('[WorkoutAdaptation] No historical executions found; neutral baseline preserved.');
    return {
      runtimeState: {
        previousConstraintLevel: previousConstraintLevel ?? 'stable',
      },
      exerciseOutcomes: [],
      hasProgressionRegression: false,
      decisionTrace: trace,
    };
  }

  const sessionLookup = previousPlan
    ? (sessionId: string) => previousPlan.sessions.find((s) => s.sessionId === sessionId)
    : undefined;

  const totalPlannedSessions = previousPlan?.structure.sessionsPerCycle ?? 0;

  // 2. Build T9 history summary
  const summary = buildExecutionHistorySummary(
    historicalExecutions,
    totalPlannedSessions,
    sessionLookup
  );

  trace.push(
    `[WorkoutAdaptation] Terminal history evaluated: ${summary.completedSessions} completed, ${summary.missedSessions} missed, ${summary.degradedSessions} degraded sessions.`
  );

  // 3. Evaluate T7 Exercise Performance Outcomes
  const exerciseOutcomes = evaluateT7ProgressionFromHistory(
    historicalExecutions,
    previousPlan,
    sessionLookup
  );

  // Check if any exercise produced a confirmed regression or paused progression
  const hasProgressionRegression = exerciseOutcomes.some(
    (o) => o.decision === 'regress' || o.plateauState === 'confirmed' || o.progressionPaused
  );

  if (hasProgressionRegression) {
    trace.push(
      '[WorkoutAdaptation] T7 confirmed regression detected; signaling recovery engine.'
    );
  }

  // 4. Adapt to T9 RecoveryRuntimeState
  const runtimeState = adaptToT9RecoveryRuntimeState(summary, {
    previousConstraintLevel,
    latestSubjectiveFeedback,
  });

  // If T7 confirmed regression, ensure performanceRegressionObserved is true on runtimeState
  if (hasProgressionRegression) {
    runtimeState.performanceRegressionObserved = true;
  }

  trace.push(
    `[WorkoutAdaptation] T9 RecoveryRuntimeState synthesized: previousLevel=${runtimeState.previousConstraintLevel}, regressionObserved=${runtimeState.performanceRegressionObserved}.`
  );

  return {
    runtimeState,
    exerciseOutcomes,
    hasProgressionRegression,
    decisionTrace: trace,
  };
}
