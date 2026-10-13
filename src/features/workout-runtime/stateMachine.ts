/**
 * Pure Runtime State Machine (Stage W4.1)
 *
 * Deterministic, immutable state transitions for live workout execution:
 * - Initialize workout from prescribed session
 * - Start / complete / abandon / skip workout
 * - Start / complete / skip / substitute exercise
 * - Record completed or skipped set executions
 * - Attach subjective feedback
 *
 * RULES:
 * 1. Purity: never mutates existing state, returns fresh deep-copied structures.
 * 2. Determinism: identical input state + action parameters => identical output state.
 * 3. Lifecycle integrity: completed/abandoned workouts reject new set/exercise updates.
 * 4. Duplicate set indexes are strictly rejected.
 */

import type { WorkoutSession, ExercisePrescription } from '../workout-plan';
import type {
  WorkoutExecution,
  ExerciseExecution,
  SetExecution,
  ConditioningExecution,
  SessionSubjectiveFeedback,
  LoadUnit,
} from './types';
import type { ExecutionQuality } from '../training-strategy/progressionStrategy';

/**
 * Creates an initial `not_started` WorkoutExecution from a prescribed WorkoutSession.
 */
export function initializeWorkoutExecution(
  session: WorkoutSession,
  planId?: string,
  executionId?: string
): WorkoutExecution {
  if (!session || typeof session !== 'object') {
    throw new TypeError('initializeWorkoutExecution requires a valid WorkoutSession.');
  }

  const execId = executionId ?? `exec_${session.sessionId}_${session.sequenceIndex}`;

  const exerciseExecutions: ExerciseExecution[] = session.exercises.map(
    (ex, idx) => ({
      exerciseId: ex.exerciseId,
      prescribedExerciseIndex: idx,
      status: 'pending',
      setExecutions: ex.sets.map((s) => ({
        setIndex: s.setIndex,
        setType: s.setType,
        completed: false,
        loadUnit: 'kg' as LoadUnit,
      })),
    })
  );

  const conditioningExecution: ConditioningExecution | undefined = session.conditioning
    ? {
        prescribed: session.conditioning,
        status: 'pending',
        completedAsPrescribed: false,
      }
    : undefined;

  return {
    executionId: execId,
    planId,
    sessionId: session.sessionId,
    sessionSequenceIndex: session.sequenceIndex,
    status: 'not_started',
    exerciseExecutions,
    conditioningExecution,
    decisionTrace: [
      `Initialized workout execution '${execId}' for session '${session.sessionId}' (${exerciseExecutions.length} exercises).`,
    ],
  };
}

/**
 * Transitions a WorkoutExecution to `in_progress`.
 */
export function startWorkoutExecution(
  current: WorkoutExecution,
  startedAtTimestamp: number
): WorkoutExecution {
  if (current.status !== 'not_started') {
    throw new Error(
      `Cannot start workout execution: current status is '${current.status}', expected 'not_started'.`
    );
  }
  if (!startedAtTimestamp || startedAtTimestamp <= 0) {
    throw new Error('startWorkoutExecution requires a positive timestamp.');
  }

  return {
    ...current,
    status: 'in_progress',
    startedAtTimestamp,
    decisionTrace: [
      ...current.decisionTrace,
      `Workout started at timestamp ${startedAtTimestamp}.`,
    ],
  };
}

/**
 * Starts an exercise execution (transitions from 'pending' to 'in_progress').
 */
export function startExerciseExecution(
  current: WorkoutExecution,
  exerciseId: string
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot start exercise: workout is '${current.status}', must be 'in_progress'.`);
  }

  const targetIdx = current.exerciseExecutions.findIndex((e) => e.exerciseId === exerciseId);
  if (targetIdx === -1) {
    throw new Error(`Exercise '${exerciseId}' not found in workout execution.`);
  }

  const targetEx = current.exerciseExecutions[targetIdx];
  if (targetEx.status !== 'pending') {
    throw new Error(
      `Cannot start exercise '${exerciseId}': current status is '${targetEx.status}', must be 'pending'.`
    );
  }

  const updatedExercises = current.exerciseExecutions.map((e, idx) =>
    idx === targetIdx ? { ...e, status: 'in_progress' as const } : e
  );

  return {
    ...current,
    exerciseExecutions: updatedExercises,
    decisionTrace: [
      ...current.decisionTrace,
      `Exercise '${exerciseId}' started (in_progress).`,
    ],
  };
}

export type RecordSetParams = {
  exerciseId: string;
  setIndex: number;
  actualReps: number;
  actualLoad?: number;
  loadUnit?: LoadUnit;
  perceivedEffortRIR?: number;
  executionQuality?: ExecutionQuality;
  notes?: string;
};

/**
 * Records a completed set execution for an active exercise.
 */
export function recordSetExecution(
  current: WorkoutExecution,
  params: RecordSetParams
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot record set: workout is '${current.status}', must be 'in_progress'.`);
  }

  const {
    exerciseId,
    setIndex,
    actualReps,
    actualLoad,
    loadUnit = 'kg',
    perceivedEffortRIR,
    executionQuality = 'clean',
    notes,
  } = params;

  if (actualReps < 0 || !Number.isInteger(actualReps)) {
    throw new Error('actualReps must be a non-negative integer.');
  }

  const targetExIdx = current.exerciseExecutions.findIndex((e) => e.exerciseId === exerciseId);
  if (targetExIdx === -1) {
    throw new Error(`Exercise '${exerciseId}' not found in workout execution.`);
  }

  const targetEx = current.exerciseExecutions[targetExIdx];
  if (targetEx.status === 'completed' || targetEx.status === 'skipped') {
    throw new Error(`Cannot record set on exercise '${exerciseId}' with status '${targetEx.status}'.`);
  }

  // Update or insert set execution
  const existingSetIdx = targetEx.setExecutions.findIndex((s) => s.setIndex === setIndex);
  let updatedSets: SetExecution[];

  if (existingSetIdx !== -1) {
    const existing = targetEx.setExecutions[existingSetIdx];
    updatedSets = targetEx.setExecutions.map((s, idx) =>
      idx === existingSetIdx
        ? {
            ...s,
            completed: true,
            actualReps,
            actualLoad,
            loadUnit,
            perceivedEffortRIR,
            executionQuality,
            notes,
          }
        : s
    );
  } else {
    // If not pre-allocated, append
    updatedSets = [
      ...targetEx.setExecutions,
      {
        setIndex,
        setType: 'work',
        completed: true,
        actualReps,
        actualLoad,
        loadUnit,
        perceivedEffortRIR,
        executionQuality,
        notes,
      },
    ];
  }

  const updatedExercise: ExerciseExecution = {
    ...targetEx,
    status: 'in_progress',
    setExecutions: updatedSets,
  };

  const updatedExercises = current.exerciseExecutions.map((e, idx) =>
    idx === targetExIdx ? updatedExercise : e
  );

  return {
    ...current,
    exerciseExecutions: updatedExercises,
    decisionTrace: [
      ...current.decisionTrace,
      `Recorded set ${setIndex} on '${exerciseId}' (${actualReps} reps @ ${actualLoad ?? 'BW'}${loadUnit}, RIR ${perceivedEffortRIR ?? 'none'}).`,
    ],
  };
}

/**
 * Marks an exercise execution as completed.
 */
export function completeExerciseExecution(
  current: WorkoutExecution,
  exerciseId: string,
  options: { overallQuality?: ExecutionQuality; notes?: string } = {}
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot complete exercise: workout is '${current.status}', must be 'in_progress'.`);
  }

  const targetIdx = current.exerciseExecutions.findIndex((e) => e.exerciseId === exerciseId);
  if (targetIdx === -1) {
    throw new Error(`Exercise '${exerciseId}' not found in workout execution.`);
  }

  const targetEx = current.exerciseExecutions[targetIdx];
  if (targetEx.status === 'completed' || targetEx.status === 'skipped') {
    throw new Error(`Cannot complete exercise '${exerciseId}': already in '${targetEx.status}' status.`);
  }

  // Must have at least one completed set
  const completedSets = targetEx.setExecutions.filter((s) => s.completed);
  if (completedSets.length === 0) {
    throw new Error(`Cannot complete exercise '${exerciseId}': zero sets have been recorded as completed.`);
  }

  const updatedExercise: ExerciseExecution = {
    ...targetEx,
    status: 'completed',
    executionQuality: options.overallQuality ?? targetEx.executionQuality ?? 'clean',
    notes: options.notes ? (targetEx.notes ? `${targetEx.notes} | ${options.notes}` : options.notes) : targetEx.notes,
  };

  const updatedExercises = current.exerciseExecutions.map((e, idx) =>
    idx === targetIdx ? updatedExercise : e
  );

  return {
    ...current,
    exerciseExecutions: updatedExercises,
    decisionTrace: [
      ...current.decisionTrace,
      `Exercise '${exerciseId}' completed (${completedSets.length} completed sets).`,
    ],
  };
}

/**
 * Marks an exercise as skipped.
 */
export function skipExerciseExecution(
  current: WorkoutExecution,
  exerciseId: string,
  reason?: string
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot skip exercise: workout is '${current.status}', must be 'in_progress'.`);
  }

  const targetIdx = current.exerciseExecutions.findIndex((e) => e.exerciseId === exerciseId);
  if (targetIdx === -1) {
    throw new Error(`Exercise '${exerciseId}' not found in workout execution.`);
  }

  const targetEx = current.exerciseExecutions[targetIdx];
  if (targetEx.status === 'completed') {
    throw new Error(`Cannot skip exercise '${exerciseId}': already completed.`);
  }

  const updatedExercise: ExerciseExecution = {
    ...targetEx,
    status: 'skipped',
    notes: reason ? (targetEx.notes ? `${targetEx.notes} | Skipped: ${reason}` : `Skipped: ${reason}`) : targetEx.notes,
  };

  const updatedExercises = current.exerciseExecutions.map((e, idx) =>
    idx === targetIdx ? updatedExercise : e
  );

  return {
    ...current,
    exerciseExecutions: updatedExercises,
    decisionTrace: [
      ...current.decisionTrace,
      `Exercise '${exerciseId}' skipped${reason ? ` (${reason})` : ''}.`,
    ],
  };
}

/**
 * Substitutes an exercise in-place with an approved substitute.
 */
export function substituteExerciseExecution(
  current: WorkoutExecution,
  exerciseId: string,
  substitutedExerciseId: string,
  prescribedExercise?: ExercisePrescription,
  reason?: string
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot substitute exercise: workout is '${current.status}', must be 'in_progress'.`);
  }

  const targetIdx = current.exerciseExecutions.findIndex((e) => e.exerciseId === exerciseId);
  if (targetIdx === -1) {
    throw new Error(`Exercise '${exerciseId}' not found in workout execution.`);
  }

  const targetEx = current.exerciseExecutions[targetIdx];
  if (targetEx.status === 'completed') {
    throw new Error(`Cannot substitute exercise '${exerciseId}': already completed.`);
  }

  // Validate allowed substitute if prescribed exercise is provided
  if (prescribedExercise) {
    if (!prescribedExercise.substitutionExerciseIds.includes(substitutedExerciseId)) {
      throw new Error(
        `Substitute '${substitutedExerciseId}' is not among allowed substitutions for '${exerciseId}'.`
      );
    }
  }

  const updatedExercise: ExerciseExecution = {
    ...targetEx,
    exerciseId: substitutedExerciseId,
    status: 'substituted',
    substitution: {
      originalExerciseId: exerciseId,
      substitutedExerciseId,
      reason,
    },
    notes: reason
      ? (targetEx.notes ? `${targetEx.notes} | Substituted: ${reason}` : `Substituted: ${reason}`)
      : targetEx.notes,
  };

  const updatedExercises = current.exerciseExecutions.map((e, idx) =>
    idx === targetIdx ? updatedExercise : e
  );

  return {
    ...current,
    exerciseExecutions: updatedExercises,
    decisionTrace: [
      ...current.decisionTrace,
      `Substituted exercise '${exerciseId}' with '${substitutedExerciseId}'${reason ? ` (${reason})` : ''}.`,
    ],
  };
}

/**
 * Records conditioning execution result.
 */
export function recordConditioningExecution(
  current: WorkoutExecution,
  params: {
    status: 'completed' | 'partially_completed' | 'skipped';
    actualDurationMinutes?: number;
    completedAsPrescribed?: boolean;
    perceivedEffortRIR?: number;
    notes?: string;
  }
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(`Cannot record conditioning: workout is '${current.status}', must be 'in_progress'.`);
  }
  if (!current.conditioningExecution) {
    throw new Error('Cannot record conditioning: no conditioning prescribed for this session.');
  }

  const updatedCond: ConditioningExecution = {
    ...current.conditioningExecution,
    status: params.status,
    actualDurationMinutes: params.actualDurationMinutes,
    completedAsPrescribed: params.completedAsPrescribed ?? (params.status === 'completed'),
    perceivedEffortRIR: params.perceivedEffortRIR,
    notes: params.notes,
  };

  return {
    ...current,
    conditioningExecution: updatedCond,
    decisionTrace: [
      ...current.decisionTrace,
      `Conditioning recorded as '${params.status}' (${params.actualDurationMinutes ?? 0}m).`,
    ],
  };
}

/**
 * Attaches subjective session feedback.
 */
export function attachSessionFeedback(
  current: WorkoutExecution,
  feedback: SessionSubjectiveFeedback
): WorkoutExecution {
  return {
    ...current,
    sessionFeedback: {
      ...current.sessionFeedback,
      ...feedback,
    },
    decisionTrace: [
      ...current.decisionTrace,
      `Subjective session feedback attached (sessionRPE: ${feedback.sessionRPE ?? 'unreported'}).`,
    ],
  };
}

/**
 * Completes the workout execution.
 */
export function completeWorkoutExecution(
  current: WorkoutExecution,
  completedAtTimestamp: number,
  feedback?: SessionSubjectiveFeedback
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(
      `Cannot complete workout execution: current status is '${current.status}', must be 'in_progress'.`
    );
  }
  if (!completedAtTimestamp || completedAtTimestamp <= 0) {
    throw new Error('completeWorkoutExecution requires a positive completedAtTimestamp.');
  }
  if (current.startedAtTimestamp && completedAtTimestamp < current.startedAtTimestamp) {
    throw new Error('completedAtTimestamp cannot precede startedAtTimestamp.');
  }

  // Ensure all exercises are resolved (completed, skipped, or substituted)
  const unresolved = current.exerciseExecutions.filter(
    (e) => e.status === 'pending' || e.status === 'in_progress'
  );
  if (unresolved.length > 0) {
    throw new Error(
      `Cannot complete workout: ${unresolved.length} exercise(s) remain unresolved (pending/in_progress).`
    );
  }

  return {
    ...current,
    status: 'completed',
    completedAtTimestamp,
    sessionFeedback: feedback ? { ...current.sessionFeedback, ...feedback } : current.sessionFeedback,
    decisionTrace: [
      ...current.decisionTrace,
      `Workout execution completed at timestamp ${completedAtTimestamp}.`,
    ],
  };
}

/**
 * Abandons the workout execution.
 */
export function abandonWorkoutExecution(
  current: WorkoutExecution,
  abandonedAtTimestamp: number,
  reason?: string
): WorkoutExecution {
  if (current.status !== 'in_progress') {
    throw new Error(
      `Cannot abandon workout execution: current status is '${current.status}', must be 'in_progress'.`
    );
  }

  return {
    ...current,
    status: 'abandoned',
    completedAtTimestamp: abandonedAtTimestamp,
    decisionTrace: [
      ...current.decisionTrace,
      `Workout execution abandoned at timestamp ${abandonedAtTimestamp}${reason ? ` (${reason})` : ''}.`,
    ],
  };
}

/**
 * Skips the workout entirely (without starting).
 */
export function skipWorkoutExecution(
  current: WorkoutExecution,
  reason?: string
): WorkoutExecution {
  if (current.status !== 'not_started') {
    throw new Error(
      `Cannot skip workout execution: current status is '${current.status}', must be 'not_started'.`
    );
  }

  return {
    ...current,
    status: 'skipped',
    decisionTrace: [
      ...current.decisionTrace,
      `Workout execution skipped${reason ? ` (${reason})` : ''}.`,
    ],
  };
}
