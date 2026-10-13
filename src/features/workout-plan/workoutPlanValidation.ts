/**
 * Workout Plan Validation Engine (Stage W1)
 *
 * Implements pure, deterministic domain contract validation for WorkoutPlan (v1).
 * Verifies schema version, population boundaries, required structural fields,
 * session sequences, exercise prescriptions, and set modeling.
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, side-effect free, non-mutating.
 * 2. Does NOT depend on external state or runtime services.
 * 3. Returns detailed validation errors and contextual warnings.
 */

import type {
  WorkoutPlan,
  WorkoutSession,
  ExercisePrescription,
  SetPrescription,
  WorkoutPlanValidationResult,
  WorkoutPlanValidationError,
} from './types';

const VALID_SET_TYPES = new Set(['warmup', 'work', 'cooldown', 'optional']);
const VALID_ROLES = new Set(['primary', 'secondary', 'accessory', 'optional']);
const VALID_RECOVERY_LEVELS = new Set([
  'stable',
  'mildly_constrained',
  'constrained',
  'strongly_constrained',
]);

/**
 * Validates a candidate WorkoutPlan object against Stage W1 contracts.
 *
 * @param plan - Candidate WorkoutPlan object
 * @returns WorkoutPlanValidationResult
 */
export function validateWorkoutPlan(plan: unknown): WorkoutPlanValidationResult {
  const errors: WorkoutPlanValidationError[] = [];
  const warnings: string[] = [];

  if (!plan || typeof plan !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'plan', message: 'WorkoutPlan must be a non-null object.' }],
      warnings: [],
    };
  }

  const p = plan as Partial<WorkoutPlan>;

  // 1. Schema Version & Population
  if (p.schemaVersion !== 1) {
    errors.push({
      field: 'schemaVersion',
      message: `Invalid schemaVersion: expected 1, got ${p.schemaVersion}.`,
    });
  }

  if (p.population !== 'adult') {
    errors.push({
      field: 'population',
      message: `Invalid population: expected "adult", got "${p.population}". Youth and ineligible trainees cannot receive an adult WorkoutPlan.`,
    });
  }

  if (p.sourceStrategyVersion !== 1) {
    errors.push({
      field: 'sourceStrategyVersion',
      message: `Invalid sourceStrategyVersion: expected 1, got ${p.sourceStrategyVersion}.`,
    });
  }

  // 2. Training Objective Context
  if (!p.objective || typeof p.objective !== 'object') {
    errors.push({ field: 'objective', message: 'Missing or invalid objective context.' });
  } else {
    if (!p.objective.primary) {
      errors.push({ field: 'objective.primary', message: 'Missing primary training objective.' });
    }
    if (!p.objective.source) {
      errors.push({ field: 'objective.source', message: 'Missing objective source.' });
    }
  }

  // 3. Training Structure Context
  if (!p.structure || typeof p.structure !== 'object') {
    errors.push({ field: 'structure', message: 'Missing or invalid training structure context.' });
  } else {
    if (!p.structure.splitFamily) {
      errors.push({ field: 'structure.splitFamily', message: 'Missing splitFamily in structure.' });
    }
    if (!p.structure.programmingComplexity) {
      errors.push({ field: 'structure.programmingComplexity', message: 'Missing programmingComplexity.' });
    }
    if (typeof p.structure.sessionsPerCycle !== 'number' || p.structure.sessionsPerCycle < 1) {
      errors.push({ field: 'structure.sessionsPerCycle', message: 'sessionsPerCycle must be a positive integer.' });
    }
    if (typeof p.structure.targetDaysPerWeek !== 'number' || p.structure.targetDaysPerWeek < 1) {
      errors.push({ field: 'structure.targetDaysPerWeek', message: 'targetDaysPerWeek must be a positive integer.' });
    }
  }

  // 4. Recovery Context
  if (!p.recoveryContext || typeof p.recoveryContext !== 'object') {
    errors.push({ field: 'recoveryContext', message: 'Missing recoveryContext.' });
  } else {
    if (!VALID_RECOVERY_LEVELS.has(p.recoveryContext.level)) {
      errors.push({
        field: 'recoveryContext.level',
        message: `Invalid recovery level: ${p.recoveryContext.level}.`,
      });
    }
    if (!p.recoveryContext.volumeModifier) {
      errors.push({ field: 'recoveryContext.volumeModifier', message: 'Missing volumeModifier.' });
    }
    if (!p.recoveryContext.effortModifier) {
      errors.push({ field: 'recoveryContext.effortModifier', message: 'Missing effortModifier.' });
    }
    if (!p.recoveryContext.conditioningModifier) {
      errors.push({ field: 'recoveryContext.conditioningModifier', message: 'Missing conditioningModifier.' });
    }
    if (!p.recoveryContext.frequencyModifier) {
      errors.push({ field: 'recoveryContext.frequencyModifier', message: 'Missing frequencyModifier.' });
    }
    if (!p.recoveryContext.deloadDecision) {
      errors.push({ field: 'recoveryContext.deloadDecision', message: 'Missing deloadDecision.' });
    }

    if (p.recoveryContext.level === 'strongly_constrained' && p.recoveryContext.deloadDecision === 'recommend') {
      warnings.push('Workout plan is configured under strongly constrained recovery with recommended deload.');
    }
  }

  // 5. Sessions
  if (!Array.isArray(p.sessions) || p.sessions.length === 0) {
    errors.push({ field: 'sessions', message: 'WorkoutPlan must contain at least one WorkoutSession.' });
  } else {
    p.sessions.forEach((session: WorkoutSession, sIdx: number) => {
      validateSession(session, sIdx, errors);
    });
  }

  // 6. Generation Metadata
  if (!p.generationMetadata || typeof p.generationMetadata !== 'object') {
    errors.push({ field: 'generationMetadata', message: 'Missing generationMetadata.' });
  } else {
    if (p.generationMetadata.generatorVersion !== '1.0.0') {
      errors.push({
        field: 'generationMetadata.generatorVersion',
        message: `Invalid generatorVersion: expected "1.0.0", got "${p.generationMetadata.generatorVersion}".`,
      });
    }
    if (typeof p.generationMetadata.generatedAtTimestamp !== 'number') {
      errors.push({
        field: 'generationMetadata.generatedAtTimestamp',
        message: 'generatedAtTimestamp must be a number.',
      });
    }
  }

  // 7. Decision Trace
  if (!Array.isArray(p.decisionTrace) || p.decisionTrace.length === 0) {
    errors.push({ field: 'decisionTrace', message: 'decisionTrace must be a non-empty array of strings.' });
  } else {
    p.decisionTrace.forEach((trace: unknown, tIdx: number) => {
      if (typeof trace !== 'string' || trace.trim().length === 0) {
        errors.push({ field: `decisionTrace[${tIdx}]`, message: 'Trace entries must be non-empty strings.' });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateSession(
  session: WorkoutSession,
  sIdx: number,
  errors: WorkoutPlanValidationError[]
): void {
  if (!session || typeof session !== 'object') {
    errors.push({ field: `sessions[${sIdx}]`, message: 'Session must be a non-null object.' });
    return;
  }

  if (!session.sessionId || typeof session.sessionId !== 'string') {
    errors.push({ field: `sessions[${sIdx}].sessionId`, message: 'Missing sessionId.' });
  }

  if (typeof session.sequenceIndex !== 'number' || session.sequenceIndex < 1) {
    errors.push({ field: `sessions[${sIdx}].sequenceIndex`, message: 'sequenceIndex must be a positive integer.' });
  }

  if (!session.sessionName || typeof session.sessionName !== 'string') {
    errors.push({ field: `sessions[${sIdx}].sessionName`, message: 'Missing sessionName.' });
  }

  if (!Array.isArray(session.focusAreas) || session.focusAreas.length === 0) {
    errors.push({ field: `sessions[${sIdx}].focusAreas`, message: 'focusAreas must be a non-empty array.' });
  }

  if (typeof session.targetDurationMinutes !== 'number' || session.targetDurationMinutes <= 0) {
    errors.push({ field: `sessions[${sIdx}].targetDurationMinutes`, message: 'targetDurationMinutes must be positive.' });
  }

  if (!Array.isArray(session.exercises) || session.exercises.length === 0) {
    errors.push({ field: `sessions[${sIdx}].exercises`, message: 'Session must contain at least one ExercisePrescription.' });
  } else {
    session.exercises.forEach((exercise: ExercisePrescription, eIdx: number) => {
      validateExercise(exercise, sIdx, eIdx, errors);
    });
  }

  if (session.conditioning) {
    validateConditioning(session.conditioning, sIdx, errors);
  }
}

function validateExercise(
  exercise: ExercisePrescription,
  sIdx: number,
  eIdx: number,
  errors: WorkoutPlanValidationError[]
): void {
  const prefix = `sessions[${sIdx}].exercises[${eIdx}]`;

  if (!exercise || typeof exercise !== 'object') {
    errors.push({ field: prefix, message: 'Exercise prescription must be a non-null object.' });
    return;
  }

  if (!exercise.exerciseId || typeof exercise.exerciseId !== 'string') {
    errors.push({ field: `${prefix}.exerciseId`, message: 'Missing exerciseId.' });
  }

  if (!exercise.exerciseName || typeof exercise.exerciseName !== 'string') {
    errors.push({ field: `${prefix}.exerciseName`, message: 'Missing exerciseName.' });
  }

  if (!VALID_ROLES.has(exercise.role)) {
    errors.push({ field: `${prefix}.role`, message: `Invalid exercise role: ${exercise.role}.` });
  }

  if (!exercise.movementPattern) {
    errors.push({ field: `${prefix}.movementPattern`, message: 'Missing movementPattern.' });
  }

  if (!Array.isArray(exercise.targetMuscles) || exercise.targetMuscles.length === 0) {
    errors.push({ field: `${prefix}.targetMuscles`, message: 'targetMuscles must be a non-empty array.' });
  }

  // Sets
  if (!Array.isArray(exercise.sets) || exercise.sets.length === 0) {
    errors.push({ field: `${prefix}.sets`, message: 'Exercise must prescribe at least one set.' });
  } else {
    exercise.sets.forEach((set: SetPrescription, setIdx: number) => {
      if (!set || typeof set !== 'object') {
        errors.push({ field: `${prefix}.sets[${setIdx}]`, message: 'Set must be a non-null object.' });
      } else {
        if (typeof set.setIndex !== 'number' || set.setIndex < 1) {
          errors.push({ field: `${prefix}.sets[${setIdx}].setIndex`, message: 'setIndex must be a positive integer.' });
        }
        if (!VALID_SET_TYPES.has(set.setType)) {
          errors.push({ field: `${prefix}.sets[${setIdx}].setType`, message: `Invalid setType: ${set.setType}.` });
        }
      }
    });
  }

  // Repetition Prescription
  if (!exercise.repetitionPrescription || typeof exercise.repetitionPrescription !== 'object') {
    errors.push({ field: `${prefix}.repetitionPrescription`, message: 'Missing repetitionPrescription.' });
  } else {
    if (!exercise.repetitionPrescription.label) {
      errors.push({ field: `${prefix}.repetitionPrescription.label`, message: 'Missing repetition label.' });
    }
    const hasTarget = typeof exercise.repetitionPrescription.targetReps === 'number';
    const hasRange =
      exercise.repetitionPrescription.repRange &&
      typeof exercise.repetitionPrescription.repRange.min === 'number' &&
      typeof exercise.repetitionPrescription.repRange.max === 'number';
    if (!hasTarget && !hasRange) {
      errors.push({
        field: `${prefix}.repetitionPrescription`,
        message: 'repetitionPrescription must provide either targetReps or a valid repRange.',
      });
    }
  }

  // Effort Prescription
  if (!exercise.effortPrescription || typeof exercise.effortPrescription !== 'object') {
    errors.push({ field: `${prefix}.effortPrescription`, message: 'Missing effortPrescription.' });
  } else {
    const { minRIR, maxRIR, targetRIR, effortGuidance } = exercise.effortPrescription;
    if (typeof minRIR !== 'number' || typeof maxRIR !== 'number' || typeof targetRIR !== 'number') {
      errors.push({ field: `${prefix}.effortPrescription`, message: 'effortPrescription RIR values must be numbers.' });
    } else if (minRIR > maxRIR) {
      errors.push({ field: `${prefix}.effortPrescription`, message: 'minRIR cannot exceed maxRIR.' });
    }
    if (!effortGuidance || typeof effortGuidance !== 'string') {
      errors.push({ field: `${prefix}.effortPrescription.effortGuidance`, message: 'Missing effortGuidance.' });
    }
  }

  if (typeof exercise.restSeconds !== 'number' || exercise.restSeconds < 0) {
    errors.push({ field: `${prefix}.restSeconds`, message: 'restSeconds must be a non-negative number.' });
  }

  if (!exercise.progressionMethod) {
    errors.push({ field: `${prefix}.progressionMethod`, message: 'Missing progressionMethod.' });
  }
}

function validateConditioning(
  conditioning: WorkoutSession['conditioning'],
  sIdx: number,
  errors: WorkoutPlanValidationError[]
): void {
  const prefix = `sessions[${sIdx}].conditioning`;
  if (!conditioning || typeof conditioning !== 'object') return;

  if (!conditioning.demand) {
    errors.push({ field: `${prefix}.demand`, message: 'Missing conditioning demand.' });
  }
  if (!conditioning.mode) {
    errors.push({ field: `${prefix}.mode`, message: 'Missing conditioning mode.' });
  }
  if (!conditioning.placement) {
    errors.push({ field: `${prefix}.placement`, message: 'Missing conditioning placement.' });
  }
  if (!conditioning.modalityFamily) {
    errors.push({ field: `${prefix}.modalityFamily`, message: 'Missing conditioning modalityFamily.' });
  }
  if (!conditioning.intensityGuidance) {
    errors.push({ field: `${prefix}.intensityGuidance`, message: 'Missing conditioning intensityGuidance.' });
  }
}
