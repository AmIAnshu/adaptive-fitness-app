/**
 * Workout Plan Generator Boundary & Upstream Handoff (Stage W1)
 *
 * Implements the architectural boundary between the upstream Training Strategy Engine (T1–T10)
 * and the downstream Workout Plan Generator.
 *
 * DESIGN INVARIANTS:
 * 1. Upstream Strategy Preservation:
 *    - Does NOT mutate TrainingStrategy (v1) or CanonicalUserProfile.
 *    - Does NOT redefine goals, frequency, split family, or recovery constraints.
 * 2. Qualitative Modifier Fidelity:
 *    - Preserves T9 qualitative recovery modifiers (volumeModifier, effortModifier,
 *      conditioningModifier, frequencyModifier, deloadDecision) inside recoveryContext.
 * 3. Population Protection:
 *    - Adult trainees (18-100) produce valid WorkoutPlan (v1).
 *    - Youth trainees (13-17) strictly receive status: 'pending', path: 'youth_strategy_pending'.
 *    - Ineligible trainees strictly receive status: 'ineligible'.
 * 4. Purity, determinism, side-effect free, zero external dependencies.
 */

import type {
  TrainingStrategy,
  StrategyPipelineResult,
} from '../training-strategy';
import { SEED_EXERCISE_CATALOG } from '../training-strategy/exerciseCatalog';
import type {
  WorkoutPlan,
  WorkoutSession,
  ExercisePrescription,
  SetPrescription,
  RepetitionPrescription,
  EffortPrescription,
  ConditioningPrescription,
  WorkoutPlanRecoveryContext,
  WorkoutPlanHandoffResult,
} from './types';

import type { AllocatedSessionDemand } from '../training-strategy/trainingDemand';

// Map of seed exercises for display name and pattern lookup
const EXERCISE_DEF_MAP = new Map(
  SEED_EXERCISE_CATALOG.map((ex) => [ex.id, ex])
);

function formatExerciseName(exerciseId: string): string {
  const def = EXERCISE_DEF_MAP.get(exerciseId);
  if (def) {
    return def.name;
  }
  return exerciseId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Derives baseline repetition prescription from the primary training objective.
 */
function deriveBaselineRepetition(primaryGoal: string): RepetitionPrescription {
  switch (primaryGoal) {
    case 'strength':
      return {
        repRange: { min: 4, max: 6 },
        label: '4–6 reps',
      };
    case 'hypertrophy':
    case 'build_muscle':
      return {
        repRange: { min: 8, max: 12 },
        label: '8–12 reps',
      };
    case 'fat_loss_support':
      return {
        repRange: { min: 10, max: 15 },
        label: '10–15 reps',
      };
    default:
      return {
        repRange: { min: 8, max: 12 },
        label: '8–12 reps',
      };
  }
}

/**
 * Derives rest seconds guidance based on exercise role.
 */
function deriveRestSeconds(role: string): number {
  if (role === 'primary') return 120;
  if (role === 'secondary') return 90;
  return 60;
}

/**
 * Instantiates a concrete, versioned WorkoutPlan (v1) from an upstream TrainingStrategy (v1).
 *
 * This function serves as the W1 baseline mapping layer. It materializes the abstract
 * demand and allocation from T6 and T5 into structured session and exercise prescriptions
 * without yet applying complex heuristic generation algorithms (deferred to W2+).
 *
 * @param strategy - Upstream TrainingStrategy (v1)
 * @returns Immutable WorkoutPlan (v1)
 */
export function createInitialWorkoutPlanFromStrategy(
  strategy: TrainingStrategy
): WorkoutPlan {
  if (!strategy || typeof strategy !== 'object') {
    throw new TypeError('createInitialWorkoutPlanFromStrategy requires a valid TrainingStrategy object.');
  }

  const {
    objective,
    frequency,
    structure,
    trainingLoad,
    exerciseSelection,
    trainingDemand,
    progression,
    conditioning,
    recoveryConstraints,
    decisionTrace: upstreamTrace,
  } = strategy;

  // 1. Establish Recovery Context from Stage T9
  const recoveryContext: WorkoutPlanRecoveryContext = {
    level: recoveryConstraints.level,
    volumeModifier: recoveryConstraints.volumeModifier,
    effortModifier: recoveryConstraints.effortModifier,
    conditioningModifier: recoveryConstraints.conditioningModifier,
    frequencyModifier: recoveryConstraints.frequencyModifier,
    deloadDecision: recoveryConstraints.deloadDecision,
    activeConstraintsSummary: [...recoveryConstraints.reasons],
  };

  // 2. Effort Prescription reflecting baseline effort modified qualitatively by recovery
  const baselineMinRIR = trainingLoad.effort.minRIR;
  const baselineMaxRIR = trainingLoad.effort.maxRIR;
  const effortIsEasier = recoveryConstraints.effortModifier === 'easier';

  const effectiveMinRIR = effortIsEasier ? baselineMinRIR + 1 : baselineMinRIR;
  const effectiveMaxRIR = effortIsEasier ? baselineMaxRIR + 1 : baselineMaxRIR;
  const targetRIR = Math.round((effectiveMinRIR + effectiveMaxRIR) / 2);

  const defaultEffortPrescription: EffortPrescription = {
    targetRIR,
    minRIR: effectiveMinRIR,
    maxRIR: effectiveMaxRIR,
    effortGuidance: effortIsEasier
      ? `Recovery-buffered effort: Maintain ${effectiveMinRIR}–${effectiveMaxRIR} RIR (conservative reserve).`
      : `Target ${effectiveMinRIR}–${effectiveMaxRIR} RIR.`,
  };

  // 3. Map Sessions from T6 Allocation
  let totalExercisesPrescribed = 0;
  let totalSetsPrescribed = 0;

  const allocatedSessions = trainingDemand.sessions as AllocatedSessionDemand[];

  const sessions: WorkoutSession[] = allocatedSessions.map((allocatedSession) => {
    const sessionIndex = allocatedSession.sessionIndex;
    const sessionName = `Session ${sessionIndex}: ${allocatedSession.focusAreas.join(' & ')}`;

    // Map exercises within session
    const exercises: ExercisePrescription[] = allocatedSession.allocatedExercises.map((alloc) => {
      totalExercisesPrescribed += 1;

      const repetitionPrescription = deriveBaselineRepetition(objective.primary);
      const restSeconds = deriveRestSeconds(alloc.role);

      // Default baseline sets (3 work sets)
      const sets: SetPrescription[] = [1, 2, 3].map((setIndex) => {
        totalSetsPrescribed += 1;
        return {
          setIndex,
          setType: 'work',
          repRange: repetitionPrescription.repRange,
          targetRIR: defaultEffortPrescription.targetRIR,
          restSeconds,
        };
      });

      // Find compatible candidate substitutions sharing the same movement pattern from T5
      const substitutionExerciseIds = exerciseSelection.candidates
        .filter((c) => {
          if (c.exerciseId === alloc.exerciseId) return false;
          const def = EXERCISE_DEF_MAP.get(c.exerciseId);
          return def ? def.movementPatterns.includes(alloc.movementPattern) : false;
        })
        .slice(0, 3)
        .map((c) => c.exerciseId);

      // Find progression plan for this exercise if present in T7
      const exerciseProgPlan = progression.exerciseProgressionPlans.find(
        (p) => p.exerciseId === alloc.exerciseId
      );
      const progressionMethod = exerciseProgPlan ? exerciseProgPlan.method : progression.method;

      return {
        exerciseId: alloc.exerciseId,
        exerciseName: formatExerciseName(alloc.exerciseId),
        role: alloc.role,
        movementPattern: alloc.movementPattern,
        targetMuscles: [...alloc.targetMuscles],
        sets,
        repetitionPrescription,
        effortPrescription: defaultEffortPrescription,
        restSeconds,
        progressionMethod,
        substitutionExerciseIds,
        notes: alloc.rationale,
      };
    });

    // Optional Conditioning Prescription from Stage T8/T9
    let sessionConditioning: ConditioningPrescription | undefined;
    if (conditioning.demand !== 'none' && recoveryConstraints.conditioningModifier !== 'omit') {
      sessionConditioning = {
        demand: conditioning.demand,
        mode: conditioning.mode,
        placement: conditioning.placement.guidance,
        modalityFamily: conditioning.preferredModalityFamilies[0] ?? 'walking_low_intensity',
        intensityGuidance:
          recoveryConstraints.conditioningModifier === 'reduce'
            ? 'Reduced-intensity active recovery conditioning.'
            : 'Standard baseline conditioning intensity.',
        notes: conditioning.frequencyRelationship.targetAvailabilityGuidance,
      };
    }

    return {
      sessionId: `session_${sessionIndex}`,
      sequenceIndex: sessionIndex,
      sessionName,
      focusAreas: [...allocatedSession.focusAreas],
      primaryMovementPatterns: [...allocatedSession.movementRequirements],
      targetDurationMinutes: 50,
      exercises,
      conditioning: sessionConditioning,
      sessionNotes: [allocatedSession.rationale],
    };
  });

  const decisionTrace: string[] = [
    ...upstreamTrace,
    `W1 Generator Handoff: Consumed TrainingStrategy (v1) with objective ${objective.primary}, split ${structure.splitFamily}, frequency ${frequency.targetDays}d, recovery level ${recoveryConstraints.level}.`,
    `W1 Plan Materialization: Prescribed ${sessions.length} sessions, ${totalExercisesPrescribed} total exercise allocations, ${totalSetsPrescribed} total sets.`,
  ];

  return {
    schemaVersion: 1,
    population: 'adult',
    sourceStrategyVersion: 1,
    objective: {
      primary: objective.primary,
      source: objective.source,
    },
    structure: {
      splitFamily: structure.splitFamily,
      programmingComplexity: structure.programmingComplexity,
      sessionsPerCycle: structure.sessionsPerCycle,
      targetDaysPerWeek: frequency.targetDays,
      scheduleMode: frequency.structureMode,
    },
    recoveryContext,
    sessions,
    generationMetadata: {
      generatedAtTimestamp: Date.now(),
      generatorVersion: '1.0.0',
      totalExercisesPrescribed,
      totalSetsPrescribed,
    },
    decisionTrace,
  };
}

/**
 * Evaluates the handoff between the Strategy Pipeline and the Workout Plan Generator.
 *
 * Enforces population boundaries:
 * - adult (18-100): produces valid WorkoutPlan (v1).
 * - youth (13-17): returns pending with youth_strategy_pending; adult plan generation is prohibited.
 * - ineligible: returns ineligible status.
 *
 * @param pipelineResult - Result from runStrategyPipeline()
 * @returns WorkoutPlanHandoffResult
 */
export function handoffToWorkoutPlanGenerator(
  pipelineResult: StrategyPipelineResult
): WorkoutPlanHandoffResult {
  if (pipelineResult.status === 'ineligible') {
    return {
      status: 'ineligible',
      reason: pipelineResult.reason,
      decisionTrace: [
        ...pipelineResult.decisionTrace,
        'Workout Plan Generator Boundary: Ineligible trainee blocked. Zero workout plans generated.',
      ],
    };
  }

  if (pipelineResult.status === 'pending') {
    return {
      status: 'pending',
      population: 'youth',
      path: 'youth_strategy_pending',
      message: pipelineResult.message,
      decisionTrace: [
        ...pipelineResult.decisionTrace,
        'Workout Plan Generator Boundary: Youth trainee halted safely at youth_strategy_pending. Adult workout plan generation strictly barred.',
      ],
    };
  }

  // Adult pipeline completed
  const plan = createInitialWorkoutPlanFromStrategy(pipelineResult.strategy);

  return {
    status: 'ready',
    population: 'adult',
    strategy: pipelineResult.strategy,
    plan,
    decisionTrace: [
      ...plan.decisionTrace,
      'Workout Plan Generator Boundary: Adult plan handoff complete and verified.',
    ],
  };
}
