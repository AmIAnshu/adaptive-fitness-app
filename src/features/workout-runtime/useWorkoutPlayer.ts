/**
 * React Controller Hook for Workout Execution (Stage W4.2)
 *
 * Encapsulates the UI runtime state, connecting UI actions directly to the pure W4.1
 * state machine functions.
 *
 * INVARIANTS:
 * - Does NOT mutate previous execution snapshots.
 * - All state transitions call W4.1 pure functions.
 * - Does NOT make progression or recovery decisions.
 * - Provides clean derived status helpers for the UI.
 */

import { useState, useCallback, useMemo } from 'react';
import type { WorkoutSession, ExercisePrescription } from '../workout-plan';
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
  type WorkoutExecution,
  type RecordSetParams,
  type SessionSubjectiveFeedback,
  type ExecutionQuality,
  type LoadUnit,
  buildWorkoutFeedbackSnapshot,
  adaptToT7PerformanceFeedback,
  adaptToT9RecoveryRuntimeState,
  validateWorkoutExecution,
  type WorkoutFeedbackSnapshot,
} from './index';

export type UseWorkoutPlayerOptions = {
  prescribedSession: WorkoutSession;
  planId?: string;
  initialExecutionId?: string;
  initialExecution?: WorkoutExecution | null;
  onExecutionChange?: (execution: WorkoutExecution) => void;
};

export function useWorkoutPlayer({
  prescribedSession,
  planId,
  initialExecutionId,
  initialExecution,
  onExecutionChange,
}: UseWorkoutPlayerOptions) {
  // Initialize pure runtime execution state (resumes if initialExecution provided)
  const [execution, setExecutionState] = useState<WorkoutExecution>(() =>
    initialExecution ?? initializeWorkoutExecution(prescribedSession, planId, initialExecutionId)
  );

  const setExecution = useCallback(
    (action: WorkoutExecution | ((prev: WorkoutExecution) => WorkoutExecution)) => {
      setExecutionState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        onExecutionChange?.(next);
        return next;
      });
    },
    [onExecutionChange]
  );

  // Active exercise index within session (navigation)
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(() => {
    if (initialExecution && initialExecution.exerciseExecutions) {
      const firstUnresolved = initialExecution.exerciseExecutions.findIndex(
        (e) => e.status === 'pending' || e.status === 'in_progress'
      );
      return firstUnresolved >= 0 ? firstUnresolved : 0;
    }
    return 0;
  });

  // Rest timer state (seconds remaining, active flag)
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number>(0);
  const [isRestActive, setIsRestActive] = useState<boolean>(false);

  // Finish early dialog / modal state
  const [showFinishEarlyPrompt, setShowFinishEarlyPrompt] = useState<boolean>(false);

  // Substitution modal state
  const [showSubstitutionModal, setShowSubstitutionModal] = useState<boolean>(false);

  // Abandon confirmation modal state
  const [showAbandonModal, setShowAbandonModal] = useState<boolean>(false);

  // Validation error state for user feedback
  const [uiError, setUiError] = useState<string | null>(null);

  // Current active exercise prescription and execution
  const currentPrescribedExercise: ExercisePrescription | undefined =
    prescribedSession.exercises[activeExerciseIndex];

  const currentExerciseExecution = useMemo(() => {
    return execution.exerciseExecutions[activeExerciseIndex];
  }, [execution.exerciseExecutions, activeExerciseIndex]);

  // Total exercise count and progress
  const totalExercises = prescribedSession.exercises.length;
  const progressRatio = totalExercises > 0 ? (activeExerciseIndex + 1) / totalExercises : 0;

  // Actions wired directly to W4.1 pure functions

  const handleStartWorkout = useCallback(() => {
    try {
      setUiError(null);
      const now = Date.now();
      setExecution((prev) => startWorkoutExecution(prev, now));
    } catch (err: any) {
      setUiError(err.message ?? 'Failed to start workout.');
    }
  }, []);

  const handleStartExercise = useCallback(
    (exerciseId: string) => {
      try {
        setUiError(null);
        setExecution((prev) => startExerciseExecution(prev, exerciseId));
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to start exercise.');
      }
    },
    []
  );

  const handleRecordSet = useCallback(
    (params: {
      setIndex: number;
      actualReps: number;
      actualLoad?: number;
      loadUnit?: LoadUnit;
      perceivedEffortRIR?: number;
      executionQuality?: ExecutionQuality;
      notes?: string;
    }) => {
      try {
        setUiError(null);
        if (!currentPrescribedExercise) return;

        // Auto-start exercise if currently pending
        let targetExecution = execution;
        if (currentExerciseExecution?.status === 'pending') {
          targetExecution = startExerciseExecution(
            targetExecution,
            currentExerciseExecution.exerciseId
          );
        }

        const updated = recordSetExecution(targetExecution, {
          exerciseId: currentExerciseExecution.exerciseId,
          ...params,
        });
        setExecution(updated);

        // Trigger optional rest countdown using prescribed restSeconds
        const prescribedRest = currentPrescribedExercise.restSeconds ?? 90;
        if (prescribedRest > 0) {
          setRestSecondsRemaining(prescribedRest);
          setIsRestActive(true);
        }
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to record set.');
      }
    },
    [currentPrescribedExercise, currentExerciseExecution, execution]
  );

  const handleSkipRestTimer = useCallback(() => {
    setIsRestActive(false);
    setRestSecondsRemaining(0);
  }, []);

  const handleCompleteCurrentExercise = useCallback(
    (options?: { overallQuality?: ExecutionQuality; notes?: string }) => {
      try {
        setUiError(null);
        if (!currentExerciseExecution) return;

        const updated = completeExerciseExecution(
          execution,
          currentExerciseExecution.exerciseId,
          options
        );
        setExecution(updated);

        // Auto-advance to next exercise if available
        if (activeExerciseIndex < totalExercises - 1) {
          setActiveExerciseIndex((prev) => prev + 1);
        }
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to complete exercise.');
      }
    },
    [currentExerciseExecution, execution, activeExerciseIndex, totalExercises]
  );

  const handleFinishExerciseEarly = useCallback(
    (reason: string = 'Finished early by user') => {
      try {
        setUiError(null);
        if (!currentExerciseExecution) return;

        // Check if at least 1 set was completed
        const hasCompletedSets = currentExerciseExecution.setExecutions.some((s) => s.completed);

        let updated: WorkoutExecution;
        if (hasCompletedSets) {
          // Complete exercise with explicit partial note so factual record is preserved
          updated = completeExerciseExecution(
            execution,
            currentExerciseExecution.exerciseId,
            { notes: `[Partial: ${reason}]` }
          );
        } else {
          // If 0 sets were performed, skip the exercise
          updated = skipExerciseExecution(
            execution,
            currentExerciseExecution.exerciseId,
            reason
          );
        }

        setExecution(updated);
        setShowFinishEarlyPrompt(false);

        // Advance to next exercise if available
        if (activeExerciseIndex < totalExercises - 1) {
          setActiveExerciseIndex((prev) => prev + 1);
        }
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to finish exercise early.');
      }
    },
    [currentExerciseExecution, execution, activeExerciseIndex, totalExercises]
  );

  const handleSkipCurrentExercise = useCallback(
    (reason: string = 'Skipped by user') => {
      try {
        setUiError(null);
        if (!currentExerciseExecution) return;

        const updated = skipExerciseExecution(
          execution,
          currentExerciseExecution.exerciseId,
          reason
        );
        setExecution(updated);

        // Advance to next exercise if available
        if (activeExerciseIndex < totalExercises - 1) {
          setActiveExerciseIndex((prev) => prev + 1);
        }
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to skip exercise.');
      }
    },
    [currentExerciseExecution, execution, activeExerciseIndex, totalExercises]
  );

  const handleSubstituteCurrentExercise = useCallback(
    (substituteId: string, reason?: string) => {
      try {
        setUiError(null);
        if (!currentExerciseExecution || !currentPrescribedExercise) return;

        const updated = substituteExerciseExecution(
          execution,
          currentExerciseExecution.exerciseId,
          substituteId,
          currentPrescribedExercise,
          reason
        );
        setExecution(updated);
        setShowSubstitutionModal(false);
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to substitute exercise.');
      }
    },
    [currentExerciseExecution, currentPrescribedExercise, execution]
  );

  const handleRecordConditioning = useCallback(
    (params: {
      status: 'completed' | 'partially_completed' | 'skipped';
      actualDurationMinutes?: number;
      perceivedEffortRIR?: number;
      notes?: string;
    }) => {
      try {
        setUiError(null);
        setExecution((prev) => recordConditioningExecution(prev, params));
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to record conditioning.');
      }
    },
    []
  );

  const handleAttachFeedback = useCallback(
    (feedback: SessionSubjectiveFeedback) => {
      try {
        setUiError(null);
        setExecution((prev) => attachSessionFeedback(prev, feedback));
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to attach feedback.');
      }
    },
    []
  );

  const handleCompleteWorkout = useCallback(
    (feedback?: SessionSubjectiveFeedback) => {
      try {
        setUiError(null);
        const now = Date.now();
        const completed = completeWorkoutExecution(execution, now, feedback);
        setExecution(completed);
        return completed;
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to complete workout.');
        return null;
      }
    },
    [execution]
  );

  const handleAbandonWorkout = useCallback(
    (reason: string = 'User exited') => {
      try {
        setUiError(null);
        const now = Date.now();
        const abandoned = abandonWorkoutExecution(execution, now, reason);
        setExecution(abandoned);
        setShowAbandonModal(false);
        return abandoned;
      } catch (err: any) {
        setUiError(err.message ?? 'Failed to abandon workout.');
        return null;
      }
    },
    [execution]
  );

  // Derived feedback snapshot (for completion screen and T7/T9 adapters)
  const feedbackSnapshot: WorkoutFeedbackSnapshot = useMemo(() => {
    return buildWorkoutFeedbackSnapshot(execution, prescribedSession);
  }, [execution, prescribedSession]);

  const t7Feedback = useMemo(() => {
    return adaptToT7PerformanceFeedback(feedbackSnapshot);
  }, [feedbackSnapshot]);

  const validationResult = useMemo(() => {
    return validateWorkoutExecution(execution, prescribedSession);
  }, [execution, prescribedSession]);

  return {
    execution,
    activeExerciseIndex,
    setActiveExerciseIndex,
    currentPrescribedExercise,
    currentExerciseExecution,
    totalExercises,
    progressRatio,
    restSecondsRemaining,
    isRestActive,
    setRestSecondsRemaining,
    uiError,
    setUiError,
    showFinishEarlyPrompt,
    setShowFinishEarlyPrompt,
    showSubstitutionModal,
    setShowSubstitutionModal,
    showAbandonModal,
    setShowAbandonModal,
    feedbackSnapshot,
    t7Feedback,
    validationResult,
    // Actions
    handleStartWorkout,
    handleStartExercise,
    handleRecordSet,
    handleSkipRestTimer,
    handleCompleteCurrentExercise,
    handleFinishExerciseEarly,
    handleSkipCurrentExercise,
    handleSubstituteCurrentExercise,
    handleRecordConditioning,
    handleAttachFeedback,
    handleCompleteWorkout,
    handleAbandonWorkout,
  };
}
