/**
 * Deterministic Execution Fixtures for Level C Adaptive E2E Tests
 *
 * Constructs typed, strictly valid WorkoutPlan and WorkoutExecution fixtures
 * to verify T7 progression and T9 recovery adaptations end-to-end.
 */

import { buildCanonicalUserProfile } from '../../src/features/profile';
import { generateWorkoutPlanFromProfile, type WorkoutPlan, type WorkoutSession } from '../../src/features/workout-plan';
import {
  initializeWorkoutExecution,
  startWorkoutExecution,
  recordSetExecution,
  completeExerciseExecution,
  completeWorkoutExecution,
  abandonWorkoutExecution,
  skipExerciseExecution,
  type WorkoutExecution,
} from '../../src/features/workout-runtime';
import { QA_PERSONAS, type QAPersonaId } from '../../src/qa/personas';

export function getBasePlanForPersona(personaId: QAPersonaId = 'PERSONA_A_BASELINE'): WorkoutPlan {
  const persona = QA_PERSONAS[personaId];
  const profile = buildCanonicalUserProfile(persona);
  const result = generateWorkoutPlanFromProfile(profile);
  if (result.status !== 'success') {
    throw new Error(`Plan generation failed for persona ${personaId}: ${result.status}`);
  }
  return result.plan;
}

/**
 * Creates a clean execution meeting all target reps and RIR.
 */
export function createCleanExecution(
  session: WorkoutSession,
  planId: string = 'plan_default',
  startTimestamp: number = 1000,
  overrides?: {
    reps?: number;
    load?: number;
    rir?: number;
    energyLevel?: 1 | 2 | 3 | 4 | 5;
    sorenessLevel?: 'none' | 'mild' | 'moderate' | 'severe';
  }
): WorkoutExecution {
  let exec = initializeWorkoutExecution(session, planId, `exec_clean_${startTimestamp}`);
  exec = startWorkoutExecution(exec, startTimestamp);

  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.setType === 'work') {
        const targetReps = ex.repetitionPrescription.targetReps ?? ex.repetitionPrescription.repRange?.min ?? 8;
        exec = recordSetExecution(exec, {
          exerciseId: ex.exerciseId,
          setIndex: s.setIndex,
          actualReps: overrides?.reps ?? targetReps,
          actualLoad: overrides?.load ?? 60,
          perceivedEffortRIR: overrides?.rir ?? 2,
          executionQuality: 'clean',
        });
      }
    }
    exec = completeExerciseExecution(exec, ex.exerciseId);
  }

  return completeWorkoutExecution(exec, startTimestamp + 3600000, {
    energyLevel: overrides?.energyLevel ?? 4,
    sorenessLevel: overrides?.sorenessLevel ?? 'mild',
    perceivedRecoveryBeforeSession: 4,
    sessionRPE: 7,
  });
}

/**
 * Creates an execution where target reps were missed.
 */
export function createMissedTargetExecution(
  session: WorkoutSession,
  planId: string = 'plan_default',
  startTimestamp: number = 1000
): WorkoutExecution {
  let exec = initializeWorkoutExecution(session, planId, `exec_missed_${startTimestamp}`);
  exec = startWorkoutExecution(exec, startTimestamp);

  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.setType === 'work') {
        exec = recordSetExecution(exec, {
          exerciseId: ex.exerciseId,
          setIndex: s.setIndex,
          actualReps: 2, // severely missed
          actualLoad: 70,
          perceivedEffortRIR: 0,
          executionQuality: 'clean',
        });
      }
    }
    exec = completeExerciseExecution(exec, ex.exerciseId);
  }

  return completeWorkoutExecution(exec, startTimestamp + 3600000, {
    energyLevel: 3,
    sorenessLevel: 'moderate',
    perceivedRecoveryBeforeSession: 3,
    sessionRPE: 9,
  });
}

/**
 * Creates a degraded quality execution.
 */
export function createDegradedExecution(
  session: WorkoutSession,
  planId: string = 'plan_default',
  startTimestamp: number = 1000
): WorkoutExecution {
  let exec = initializeWorkoutExecution(session, planId, `exec_deg_${startTimestamp}`);
  exec = startWorkoutExecution(exec, startTimestamp);

  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.setType === 'work') {
        exec = recordSetExecution(exec, {
          exerciseId: ex.exerciseId,
          setIndex: s.setIndex,
          actualReps: 8,
          actualLoad: 60,
          perceivedEffortRIR: 1,
          executionQuality: 'degraded',
        });
      }
    }
    exec = completeExerciseExecution(exec, ex.exerciseId, { overallQuality: 'degraded' });
  }

  return completeWorkoutExecution(exec, startTimestamp + 3600000, {
    energyLevel: 2,
    sorenessLevel: 'moderate',
    perceivedRecoveryBeforeSession: 3,
    sessionRPE: 8,
  });
}

/**
 * Creates a severely exhausted / under-recovered execution.
 */
export function createSeverelyExhaustedExecution(
  session: WorkoutSession,
  planId: string = 'plan_default',
  startTimestamp: number = 1000
): WorkoutExecution {
  let exec = initializeWorkoutExecution(session, planId, `exec_exhausted_${startTimestamp}`);
  exec = startWorkoutExecution(exec, startTimestamp);
  return abandonWorkoutExecution(exec, startTimestamp + 600000, 'Severe systemic exhaustion');
}
