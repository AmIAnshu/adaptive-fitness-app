/**
 * Workout Plan Orchestration Engine (Stage W5.1)
 *
 * Provides the pure, authoritative entry point connecting the upstream
 * CanonicalUserProfile and Training Strategy Engine (T1–T10) to the downstream
 * Workout Plan Generator (W1–W3).
 *
 * TARGET FLOW:
 * CanonicalUserProfile
 *         ↓
 * validateCanonicalUserProfile()
 *         ↓
 * Population Guard (strategyPipeline.ts)
 *         ↓
 * T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
 *         ↓
 * TrainingStrategy (v1)
 *         ↓
 * W2 Session Skeleton (buildWorkoutPlanSkeleton)
 *         ↓
 * W3 Exact Prescription (generatePrescribedWorkoutPlan)
 *         ↓
 * validateWorkoutPlan() & Structural Invariant Verification
 *         ↓
 * WorkoutPlan (v1) [prescribed]
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, non-mutating, zero Math.random(), zero external dependencies.
 * 2. Adult trainees (18–100) receive fully prescribed adult WorkoutPlan.
 * 3. Youth trainees (13–17) are safely held at youth_strategy_pending boundary.
 * 4. Ineligible trainees (<13 or >100) are blocked at the boundary.
 * 5. Uses discriminated result union without throwing uncontrolled errors.
 * 6. Does not duplicate T1–T10, W2, or W3 rules; composes existing authoritative modules.
 */

import type { CanonicalUserProfile, ProfileValidationError } from '../profile';
import { validateCanonicalUserProfile } from '../profile';
import {
  runStrategyPipeline,
  type TrainingStrategy,
} from '../training-strategy';
import { resolveStrategyPopulation } from '../training-strategy/strategyPopulation';
import { isExerciseEquipmentCompatible } from '../training-strategy/exerciseSelection';
import type { ExerciseDefinition } from '../training-strategy/exerciseCatalog';
import { SEED_EXERCISE_CATALOG } from '../training-strategy/exerciseCatalog';
import type { RecoveryRuntimeState } from '../training-strategy/types';
import type {
  WorkoutPlan,
  WorkoutPlanValidationError,
} from './types';
import { validateWorkoutPlan } from './workoutPlanValidation';
import { buildWorkoutPlanSkeleton } from './sessionSkeleton';
import {
  generatePrescribedWorkoutPlan,
  type GeneratePrescribedWorkoutPlanOptions,
} from './prescriptionEngine';
import type { WorkoutAdaptationContext } from '../workout-history/adaptation';
import { buildAdaptiveStrategyInputs } from '../workout-history/adaptation';

// ============================================================================
// RESULT CONTRACT (Discriminated Union)
// ============================================================================

export type WorkoutPlanSuccessResult = {
  status: 'success';
  population: 'adult';
  profile: CanonicalUserProfile;
  strategy: TrainingStrategy;
  plan: WorkoutPlan;
  decisionTrace: string[];
};

export type WorkoutPlanInvalidProfileResult = {
  status: 'invalid_profile';
  errors: ProfileValidationError[];
  decisionTrace: string[];
};

export type WorkoutPlanYouthPendingResult = {
  status: 'youth_strategy_pending';
  population: 'youth';
  message: string;
  decisionTrace: string[];
};

export type WorkoutPlanIneligibleResult = {
  status: 'ineligible';
  reason: string;
  decisionTrace: string[];
};

export type WorkoutPlanStrategyFailedResult = {
  status: 'strategy_failed';
  reason: string;
  decisionTrace: string[];
};

export type WorkoutPlanInvalidPlanResult = {
  status: 'workout_plan_invalid';
  errors: WorkoutPlanValidationError[];
  decisionTrace: string[];
};

export type WorkoutPlanGenerationResult =
  | WorkoutPlanSuccessResult
  | WorkoutPlanInvalidProfileResult
  | WorkoutPlanYouthPendingResult
  | WorkoutPlanIneligibleResult
  | WorkoutPlanStrategyFailedResult
  | WorkoutPlanInvalidPlanResult;

export type GenerateWorkoutPlanOptions = GeneratePrescribedWorkoutPlanOptions & {
  customCatalog?: readonly ExerciseDefinition[];
  runtimeState?: RecoveryRuntimeState;
  adaptationContext?: WorkoutAdaptationContext;
};

// Map of seed exercises for equipment & avoidance validation
const SEED_CATALOG_MAP = new Map<string, ExerciseDefinition>(
  SEED_EXERCISE_CATALOG.map((ex) => [ex.id, ex])
);

/**
 * Validates post-generation structural invariants (Step 9 requirements).
 */
function verifyStructuralInvariants(
  plan: WorkoutPlan,
  profile: CanonicalUserProfile
): WorkoutPlanValidationError[] {
  const errors: WorkoutPlanValidationError[] = [];

  // 1. Generation stage and population
  if (plan.generationMetadata.generationStage !== 'prescribed') {
    errors.push({
      field: 'generationMetadata.generationStage',
      message: `Expected generationStage 'prescribed', got '${plan.generationMetadata.generationStage}'.`,
    });
  }

  if (plan.population !== 'adult') {
    errors.push({
      field: 'population',
      message: `Expected population 'adult' on adult path, got '${plan.population}'.`,
    });
  }

  // 2. Session IDs and Contiguous Sequencing
  if (plan.sessions.length === 0) {
    errors.push({
      field: 'sessions',
      message: 'Generated plan must contain at least one session.',
    });
  }

  const expectedSessionCount = plan.structure.sessionsPerCycle;
  if (plan.sessions.length !== expectedSessionCount) {
    errors.push({
      field: 'sessions.length',
      message: `Expected ${expectedSessionCount} sessions per cycle, got ${plan.sessions.length}.`,
    });
  }

  const seenSessionIds = new Set<string>();
  const avoidListLower = new Set(
    profile.exercisePreferences.avoid.map((id: string) => id.toLowerCase())
  );

  for (let i = 0; i < plan.sessions.length; i++) {
    const session = plan.sessions[i];
    const expectedSequence = i + 1;
    const expectedSessionId = `session_${expectedSequence}`;

    if (session.sequenceIndex !== expectedSequence) {
      errors.push({
        field: `sessions[${i}].sequenceIndex`,
        message: `Expected sequenceIndex ${expectedSequence}, got ${session.sequenceIndex}.`,
      });
    }

    if (session.sessionId !== expectedSessionId) {
      errors.push({
        field: `sessions[${i}].sessionId`,
        message: `Expected contiguous sessionId '${expectedSessionId}', got '${session.sessionId}'.`,
      });
    }

    if (seenSessionIds.has(session.sessionId)) {
      errors.push({
        field: `sessions[${i}].sessionId`,
        message: `Duplicate sessionId detected: '${session.sessionId}'.`,
      });
    }
    seenSessionIds.add(session.sessionId);

    // 3. Exercise Prescriptions Invariants
    if (!session.exercises || session.exercises.length === 0) {
      errors.push({
        field: `sessions[${i}].exercises`,
        message: `Session '${session.sessionId}' has zero exercise prescriptions.`,
      });
      continue;
    }

    for (let eIdx = 0; eIdx < session.exercises.length; eIdx++) {
      const ex = session.exercises[eIdx];

      // Verify avoided exercises are absent
      if (avoidListLower.has(ex.exerciseId.toLowerCase())) {
        errors.push({
          field: `sessions[${i}].exercises[${eIdx}].exerciseId`,
          message: `Avoided exercise '${ex.exerciseId}' was prescribed in session '${session.sessionId}'.`,
        });
      }

      // Verify equipment compatibility
      const def = SEED_CATALOG_MAP.get(ex.exerciseId);
      if (def && !isExerciseEquipmentCompatible(def, profile)) {
        errors.push({
          field: `sessions[${i}].exercises[${eIdx}].exerciseId`,
          message: `Exercise '${ex.exerciseId}' requires equipment not available in user environment.`,
        });
      }

      // Verify sets and RIR invariants
      if (!ex.sets || ex.sets.length === 0) {
        errors.push({
          field: `sessions[${i}].exercises[${eIdx}].sets`,
          message: `Exercise '${ex.exerciseId}' has empty sets array.`,
        });
      }

      if (ex.effortPrescription.minRIR < 0 || ex.effortPrescription.maxRIR < ex.effortPrescription.minRIR) {
        errors.push({
          field: `sessions[${i}].exercises[${eIdx}].effortPrescription`,
          message: `Exercise '${ex.exerciseId}' has invalid RIR boundaries (min: ${ex.effortPrescription.minRIR}, max: ${ex.effortPrescription.maxRIR}).`,
        });
      }
    }
  }

  return errors;
}

/**
 * Pure orchestration function: Generates a concrete, executable WorkoutPlan (v1)
 * from a CanonicalUserProfile.
 *
 * Composes:
 * 1. Canonical Profile Validation
 * 2. Population Guard & T1–T10 Strategy Pipeline
 * 3. W2 Session Skeleton Construction
 * 4. W3 Exact Prescription Generation
 * 5. Domain & Structural Invariant Validation
 *
 * @param profile - Validated CanonicalUserProfile
 * @param options - Generation options (deterministicSeed, customCatalog, runtimeState, duration budgeting)
 * @returns WorkoutPlanGenerationResult (discriminated union)
 */
export function generateWorkoutPlanFromProfile(
  profile: CanonicalUserProfile,
  options: GenerateWorkoutPlanOptions = {}
): WorkoutPlanGenerationResult {
  const trace: string[] = ['[WorkoutPlanGenerator] Orchestration Started'];

  // 1. Check Population Boundary First (Eligibility & Youth Protection)
  const populationBoundary = resolveStrategyPopulation(profile);
  if (populationBoundary.path === 'ineligible') {
    trace.push(`[WorkoutPlanGenerator] Trainee ineligible: ${populationBoundary.reason}`);
    return {
      status: 'ineligible',
      reason: populationBoundary.reason,
      decisionTrace: [...trace, ...populationBoundary.decisionTrace],
    };
  }

  if (populationBoundary.path === 'youth_strategy_pending') {
    trace.push('[WorkoutPlanGenerator] Trainee routed to protected youth pathway (no adult plan generated).');
    return {
      status: 'youth_strategy_pending',
      population: 'youth',
      message:
        'Youth training pathway selected (ages 13–17). Adult training strategy engine is held; awaiting youth developmental training guidelines milestone.',
      decisionTrace: [...trace, ...populationBoundary.decisionTrace],
    };
  }

  // 2. Validate the CanonicalUserProfile
  const profileValidation = validateCanonicalUserProfile(profile);
  if (!profileValidation.valid) {
    trace.push('[WorkoutPlanGenerator] Profile validation failed.');
    return {
      status: 'invalid_profile',
      errors: profileValidation.errors,
      decisionTrace: trace,
    };
  }
  trace.push('[WorkoutPlanGenerator] CanonicalUserProfile validated successfully.');

  // 3. Resolve Effective Recovery Runtime State (Explicit or Adapted from History)
  let effectiveRuntimeState = options.runtimeState;
  if (options.adaptationContext) {
    trace.push('[WorkoutPlanGenerator] Adaptation context provided; evaluating historical performance and recovery evidence.');
    const adaptationResult = buildAdaptiveStrategyInputs(options.adaptationContext);
    trace.push(...adaptationResult.decisionTrace);

    // Merge adapted runtime state with any explicit options.runtimeState overrides
    effectiveRuntimeState = {
      ...adaptationResult.runtimeState,
      ...options.runtimeState,
    };
  }

  // 4. Run the Strategy Pipeline (T1–T10)
  const pipelineResult = runStrategyPipeline(
    profile,
    options.customCatalog,
    effectiveRuntimeState
  );

  // 2a. Ineligible Trainee Boundary
  if (pipelineResult.status === 'ineligible') {
    trace.push(`[WorkoutPlanGenerator] Trainee ineligible: ${pipelineResult.reason}`);
    return {
      status: 'ineligible',
      reason: pipelineResult.reason,
      decisionTrace: [...trace, ...pipelineResult.decisionTrace],
    };
  }

  // 2b. Youth Trainee Protected Pathway (13–17)
  if (pipelineResult.status === 'pending') {
    trace.push('[WorkoutPlanGenerator] Trainee routed to protected youth pathway (no adult plan generated).');
    return {
      status: 'youth_strategy_pending',
      population: 'youth',
      message: pipelineResult.message,
      decisionTrace: [...trace, ...pipelineResult.decisionTrace],
    };
  }

  // 2c. Unexpected Strategy Pipeline Failure
  if (pipelineResult.status !== 'completed' || !pipelineResult.strategy) {
    trace.push('[WorkoutPlanGenerator] Strategy pipeline did not produce completed strategy.');
    return {
      status: 'strategy_failed',
      reason: 'Upstream training strategy engine did not complete successfully.',
      decisionTrace: [...trace, ...(pipelineResult as any).decisionTrace ?? []],
    };
  }

  const strategy = pipelineResult.strategy;
  trace.push(
    `[WorkoutPlanGenerator] TrainingStrategy (v1) assembled: Split=${strategy.structure.splitFamily}, SessionsPerCycle=${strategy.structure.sessionsPerCycle}.`
  );

  // 3. Build W2 Session Skeleton & Exercise Assignment
  const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
  trace.push(
    `[WorkoutPlanGenerator] W2 Session Skeleton constructed: ${skeleton.sessions.length} sessions, ${skeleton.generationMetadata.totalExercisesPrescribed} exercises.`
  );

  // 4. Generate W3 Exact Prescription
  const prescribedPlan = generatePrescribedWorkoutPlan(
    skeleton,
    strategy,
    profile,
    options
  );
  trace.push(
    `[WorkoutPlanGenerator] W3 Exact Prescription generated: Feasibility=${prescribedPlan.generationMetadata.durationFeasibility}, TotalSets=${prescribedPlan.generationMetadata.totalSetsPrescribed}.`
  );

  // 5. Validate Final WorkoutPlan against W1 Contracts
  const planValidation = validateWorkoutPlan(prescribedPlan);
  if (!planValidation.valid) {
    trace.push('[WorkoutPlanGenerator] Final WorkoutPlan failed W1 validation.');
    return {
      status: 'workout_plan_invalid',
      errors: planValidation.errors,
      decisionTrace: [...trace, ...prescribedPlan.decisionTrace],
    };
  }

  // 6. Verify Additional Structural Invariants (Step 9)
  const structuralErrors = verifyStructuralInvariants(prescribedPlan, profile);
  if (structuralErrors.length > 0) {
    trace.push('[WorkoutPlanGenerator] Final WorkoutPlan failed structural invariant verification.');
    return {
      status: 'workout_plan_invalid',
      errors: structuralErrors,
      decisionTrace: [...trace, ...prescribedPlan.decisionTrace],
    };
  }

  trace.push('[WorkoutPlanGenerator] Final WorkoutPlan verified and ready for runtime execution.');

  return {
    status: 'success',
    population: 'adult',
    profile,
    strategy,
    plan: prescribedPlan,
    decisionTrace: [...trace, ...prescribedPlan.decisionTrace],
  };
}
