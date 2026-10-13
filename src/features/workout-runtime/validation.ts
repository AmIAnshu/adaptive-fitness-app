/**
 * Runtime Execution Validation (Stage W4.1)
 *
 * Pure validator detecting structural and domain inconsistencies in WorkoutExecution,
 * ExerciseExecution, SetExecution, and feedback records.
 */

import type {
  WorkoutExecution,
  ExerciseExecution,
  SetExecution,
  WorkoutFeedbackSnapshot,
} from './types';
import type { WorkoutSession } from '../workout-plan';

export type RuntimeValidationIssue = {
  path: string;
  message: string;
};

export type RuntimeValidationResult = {
  isValid: boolean;
  errors: RuntimeValidationIssue[];
  warnings: RuntimeValidationIssue[];
};

/**
 * Validates a SetExecution record.
 */
export function validateSetExecution(
  set: SetExecution,
  pathPrefix: string = 'set'
): RuntimeValidationIssue[] {
  const errors: RuntimeValidationIssue[] = [];

  if (!set || typeof set !== 'object') {
    errors.push({ path: pathPrefix, message: 'Set execution must be a valid object.' });
    return errors;
  }

  if (typeof set.setIndex !== 'number' || set.setIndex <= 0 || !Number.isInteger(set.setIndex)) {
    errors.push({ path: `${pathPrefix}.setIndex`, message: 'setIndex must be a positive integer.' });
  }

  if (!['warmup', 'work', 'cooldown', 'optional'].includes(set.setType)) {
    errors.push({ path: `${pathPrefix}.setType`, message: `Invalid setType: '${set.setType}'.` });
  }

  if (typeof set.completed !== 'boolean') {
    errors.push({ path: `${pathPrefix}.completed`, message: 'completed must be a boolean.' });
  }

  if (!['kg', 'lb', 'bodyweight'].includes(set.loadUnit)) {
    errors.push({ path: `${pathPrefix}.loadUnit`, message: `Invalid loadUnit: '${set.loadUnit}'.` });
  }

  // When a set is marked completed:
  if (set.completed) {
    if (set.actualReps === undefined || set.actualReps === null) {
      errors.push({
        path: `${pathPrefix}.actualReps`,
        message: 'Completed set requires actualReps to be recorded.',
      });
    } else if (
      typeof set.actualReps !== 'number' ||
      set.actualReps < 0 ||
      !Number.isInteger(set.actualReps) ||
      !Number.isFinite(set.actualReps)
    ) {
      errors.push({
        path: `${pathPrefix}.actualReps`,
        message: 'actualReps must be a non-negative finite integer.',
      });
    }

    if (set.actualLoad !== undefined && set.actualLoad !== null) {
      if (typeof set.actualLoad !== 'number' || set.actualLoad < 0 || !Number.isFinite(set.actualLoad)) {
        errors.push({
          path: `${pathPrefix}.actualLoad`,
          message: 'actualLoad must be a non-negative finite number when provided.',
        });
      }
    }

    if (set.perceivedEffortRIR !== undefined && set.perceivedEffortRIR !== null) {
      if (
        typeof set.perceivedEffortRIR !== 'number' ||
        set.perceivedEffortRIR < 0 ||
        set.perceivedEffortRIR > 10 ||
        !Number.isFinite(set.perceivedEffortRIR)
      ) {
        errors.push({
          path: `${pathPrefix}.perceivedEffortRIR`,
          message: 'perceivedEffortRIR must be a finite number between 0 and 10.',
        });
      }
    }

    if (set.executionQuality !== undefined && set.executionQuality !== null) {
      if (!['clean', 'acceptable', 'degraded', 'unreported'].includes(set.executionQuality)) {
        errors.push({
          path: `${pathPrefix}.executionQuality`,
          message: `Invalid executionQuality: '${set.executionQuality}'.`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validates an ExerciseExecution against prescribed session expectations.
 */
export function validateExerciseExecution(
  ex: ExerciseExecution,
  prescribedSession?: WorkoutSession,
  pathPrefix: string = 'exercise'
): RuntimeValidationIssue[] {
  const errors: RuntimeValidationIssue[] = [];

  if (!ex || typeof ex !== 'object') {
    errors.push({ path: pathPrefix, message: 'Exercise execution must be a valid object.' });
    return errors;
  }

  if (!ex.exerciseId || typeof ex.exerciseId !== 'string') {
    errors.push({ path: `${pathPrefix}.exerciseId`, message: 'exerciseId must be a non-empty string.' });
  }

  if (
    typeof ex.prescribedExerciseIndex !== 'number' ||
    ex.prescribedExerciseIndex < 0 ||
    !Number.isInteger(ex.prescribedExerciseIndex)
  ) {
    errors.push({
      path: `${pathPrefix}.prescribedExerciseIndex`,
      message: 'prescribedExerciseIndex must be a non-negative integer.',
    });
  }

  if (!['pending', 'in_progress', 'completed', 'skipped', 'substituted'].includes(ex.status)) {
    errors.push({ path: `${pathPrefix}.status`, message: `Invalid exercise status: '${ex.status}'.` });
  }

  // Cross-reference with prescribed session if available
  if (prescribedSession) {
    const prescribedExercise = prescribedSession.exercises[ex.prescribedExerciseIndex];
    if (!prescribedExercise) {
      errors.push({
        path: `${pathPrefix}.prescribedExerciseIndex`,
        message: `No prescribed exercise found at index ${ex.prescribedExerciseIndex} in session '${prescribedSession.sessionId}'.`,
      });
    } else {
      // If substituted, verify substitution info
      if (ex.status === 'substituted') {
        if (!ex.substitution || !ex.substitution.substitutedExerciseId) {
          errors.push({
            path: `${pathPrefix}.substitution`,
            message: 'Substituted exercise execution requires valid substitution record.',
          });
        } else {
          // Verify substitute is an allowed substitution
          if (!prescribedExercise.substitutionExerciseIds.includes(ex.substitution.substitutedExerciseId)) {
            errors.push({
              path: `${pathPrefix}.substitution.substitutedExerciseId`,
              message: `Substituted exercise '${ex.substitution.substitutedExerciseId}' is not among allowed substitutions for '${prescribedExercise.exerciseId}'.`,
            });
          }
        }
      } else {
        // Exercise ID should match prescribed exercise
        if (ex.exerciseId !== prescribedExercise.exerciseId) {
          errors.push({
            path: `${pathPrefix}.exerciseId`,
            message: `exerciseId '${ex.exerciseId}' does not match prescribed exercise '${prescribedExercise.exerciseId}'.`,
          });
        }
      }
    }
  }

  // Set executions validation
  if (!Array.isArray(ex.setExecutions)) {
    errors.push({ path: `${pathPrefix}.setExecutions`, message: 'setExecutions must be an array.' });
  } else {
    const seenIndices = new Set<number>();
    ex.setExecutions.forEach((set, sIdx) => {
      const setPrefix = `${pathPrefix}.setExecutions[${sIdx}]`;
      const setErrors = validateSetExecution(set, setPrefix);
      errors.push(...setErrors);

      if (seenIndices.has(set.setIndex)) {
        errors.push({
          path: `${setPrefix}.setIndex`,
          message: `Duplicate setIndex ${set.setIndex} found in exercise '${ex.exerciseId}'.`,
        });
      }
      seenIndices.add(set.setIndex);
    });

    // Completed exercise cannot have 0 completed work sets unless all sets were optional
    if (ex.status === 'completed') {
      const completedSets = ex.setExecutions.filter((s) => s.completed);
      if (completedSets.length === 0) {
        errors.push({
          path: `${pathPrefix}.status`,
          message: 'Exercise cannot be marked completed without any completed sets.',
        });
      }
    }
  }

  return errors;
}

/**
 * Validates a WorkoutExecution against prescribed session expectations.
 */
export function validateWorkoutExecution(
  execution: WorkoutExecution,
  prescribedSession?: WorkoutSession
): RuntimeValidationResult {
  const errors: RuntimeValidationIssue[] = [];
  const warnings: RuntimeValidationIssue[] = [];

  if (!execution || typeof execution !== 'object') {
    return {
      isValid: false,
      errors: [{ path: 'execution', message: 'WorkoutExecution must be a valid object.' }],
      warnings: [],
    };
  }

  if (!execution.executionId || typeof execution.executionId !== 'string') {
    errors.push({ path: 'executionId', message: 'executionId must be a non-empty string.' });
  }

  if (!execution.sessionId || typeof execution.sessionId !== 'string') {
    errors.push({ path: 'sessionId', message: 'sessionId must be a non-empty string.' });
  }

  if (!['not_started', 'in_progress', 'completed', 'abandoned', 'skipped'].includes(execution.status)) {
    errors.push({ path: 'status', message: `Invalid execution status: '${execution.status}'.` });
  }

  // Session ID cross-reference
  if (prescribedSession && execution.sessionId !== prescribedSession.sessionId) {
    errors.push({
      path: 'sessionId',
      message: `execution sessionId '${execution.sessionId}' does not match prescribed sessionId '${prescribedSession.sessionId}'.`,
    });
  }

  // Lifecycle timestamp checks
  if (execution.status === 'in_progress' || execution.status === 'completed' || execution.status === 'abandoned') {
    if (!execution.startedAtTimestamp || execution.startedAtTimestamp <= 0) {
      errors.push({
        path: 'startedAtTimestamp',
        message: 'startedAtTimestamp must be recorded for active/finished workout.',
      });
    }
  }

  if (execution.status === 'completed' || execution.status === 'abandoned') {
    if (!execution.completedAtTimestamp || execution.completedAtTimestamp <= 0) {
      errors.push({
        path: 'completedAtTimestamp',
        message: 'completedAtTimestamp must be recorded when workout is finished.',
      });
    } else if (
      execution.startedAtTimestamp &&
      execution.completedAtTimestamp < execution.startedAtTimestamp
    ) {
      errors.push({
        path: 'completedAtTimestamp',
        message: 'completedAtTimestamp cannot precede startedAtTimestamp.',
      });
    }
  }

  // Exercise executions validation
  if (!Array.isArray(execution.exerciseExecutions)) {
    errors.push({ path: 'exerciseExecutions', message: 'exerciseExecutions must be an array.' });
  } else {
    execution.exerciseExecutions.forEach((ex, idx) => {
      const exErrors = validateExerciseExecution(
        ex,
        prescribedSession,
        `exerciseExecutions[${idx}]`
      );
      errors.push(...exErrors);
    });

    // If workout is completed, ensure all exercises are resolved (completed, skipped, or substituted)
    if (execution.status === 'completed') {
      const unresolved = execution.exerciseExecutions.filter(
        (e) => e.status === 'pending' || e.status === 'in_progress'
      );
      if (unresolved.length > 0) {
        errors.push({
          path: 'status',
          message: `Workout cannot be marked completed while ${unresolved.length} exercise(s) remain in pending or in_progress status.`,
        });
      }
    }
  }

  // Decision trace
  if (!Array.isArray(execution.decisionTrace)) {
    errors.push({ path: 'decisionTrace', message: 'decisionTrace must be an array.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
