/**
 * Workout Runtime Contracts (Stage W4.1)
 *
 * Defines the strongly-typed contracts and interfaces for live workout execution,
 * recording actual performed work, and creating structured feedback snapshots
 * for downstream T7 Progression and T9 Recovery adaptation.
 *
 * ARCHITECTURAL BOUNDARY:
 * - W3: Owns the prescribed workout (sets, reps, RIR boundaries, rest, conditioning).
 *       Does NOT own actual load history.
 * - W4: Consumes the prescribed WorkoutPlan, owns the runtime execution state,
 *       records actual load / reps / completion / quality / RIR / substitutions,
 *       and produces structured runtime feedback.
 *       Does NOT itself decide progressions, regressions, recovery constraints, or deloads.
 * - T7: Evaluates progression / plateau / regression based on W4 feedback.
 * - T9: Evaluates recovery constraints / deload decisions based on W4 session history.
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, immutable, zero external dependencies.
 * 2. Exact load (kg/lbs) is captured here at runtime execution history.
 * 3. Does NOT rewrite the prescribed WorkoutPlan after execution begins.
 * 4. Zero Math.random(), zero hidden global state.
 */

import type { SetType, ConditioningPrescription } from '../workout-plan';
import type {
  ExecutionQuality,
  ExercisePerformanceFeedback,
} from '../training-strategy/progressionStrategy';
export type { ExecutionQuality, ExercisePerformanceFeedback };
import type {
  RecoveryRuntimeState,
  SorenessLevel,
} from '../training-strategy/types';

// ==================================================
// 1. STATUS LIFECYCLE ENUMS
// ==================================================

export type WorkoutExecutionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'skipped';

export type ExerciseExecutionStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'substituted';

export type ConditioningExecutionStatus =
  | 'pending'
  | 'completed'
  | 'partially_completed'
  | 'skipped';

export type LoadUnit = 'kg' | 'lb' | 'bodyweight';

// ==================================================
// 2. SET EXECUTION CONTRACT
// ==================================================

export type SetExecution = {
  setIndex: number;
  setType: SetType;
  completed: boolean;
  actualReps?: number;
  actualLoad?: number;
  loadUnit: LoadUnit;
  perceivedEffortRIR?: number;
  executionQuality?: ExecutionQuality;
  notes?: string;
};

// ==================================================
// 3. EXERCISE EXECUTION CONTRACT
// ==================================================

export type ExerciseSubstitutionInfo = {
  originalExerciseId: string;
  substitutedExerciseId: string;
  reason?: string;
};

export type ExerciseExecution = {
  exerciseId: string;
  prescribedExerciseIndex: number;
  status: ExerciseExecutionStatus;
  setExecutions: SetExecution[];
  substitution?: ExerciseSubstitutionInfo;
  executionQuality?: ExecutionQuality;
  notes?: string;
};

// ==================================================
// 4. CONDITIONING EXECUTION CONTRACT
// ==================================================

export type ConditioningExecution = {
  prescribed?: ConditioningPrescription;
  status: ConditioningExecutionStatus;
  actualDurationMinutes?: number;
  completedAsPrescribed: boolean;
  perceivedEffortRIR?: number;
  notes?: string;
};

// ==================================================
// 5. SESSION SUBJECTIVE FEEDBACK CONTRACT
// ==================================================

export type SessionSubjectiveFeedback = {
  sessionRPE?: number; // Borg CR-10 style rating (1-10)
  perceivedRecoveryBeforeSession?: 1 | 2 | 3 | 4 | 5;
  sorenessLevel?: SorenessLevel;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
};

// ==================================================
// 6. TOP-LEVEL WORKOUT EXECUTION (v1)
// ==================================================

export type WorkoutExecution = {
  executionId: string;
  planId?: string;
  sessionId: string;
  sessionSequenceIndex: number;
  status: WorkoutExecutionStatus;
  startedAtTimestamp?: number;
  completedAtTimestamp?: number;
  exerciseExecutions: ExerciseExecution[];
  conditioningExecution?: ConditioningExecution;
  sessionFeedback?: SessionSubjectiveFeedback;
  decisionTrace: string[];
};

// ==================================================
// 7. STRUCTURED WORKOUT FEEDBACK SNAPSHOT (T7 / T9)
// ==================================================

export type WorkoutFeedbackSnapshot = {
  executionId: string;
  sessionId: string;
  sessionSequenceIndex: number;
  sessionStatus: WorkoutExecutionStatus;
  startedAtTimestamp?: number;
  completedAtTimestamp?: number;
  totalPrescribedExercises: number;
  completedExercisesCount: number;
  skippedExercisesCount: number;
  totalPrescribedWorkSets: number;
  completedWorkSetsCount: number;
  allPrescribedWorkCompleted: boolean;
  exerciseFeedbacks: ExercisePerformanceFeedback[];
  conditioningCompleted?: boolean;
  subjectiveFeedback?: SessionSubjectiveFeedback;
  evidenceSummary: string;
};

// ==================================================
// 8. T9 SESSION HISTORY INPUT
// ==================================================

export type SessionExecutionHistorySummary = {
  totalPlannedSessions: number;
  completedSessions: number;
  missedSessions: number;
  degradedSessions: number;
  consecutiveUnderRecoveredSessions: number;
  accumulatedFatigueCycles: number;
  recentSnapshots: WorkoutFeedbackSnapshot[];
};
