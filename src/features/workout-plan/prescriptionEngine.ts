/**
 * Stage W3 — Exact Prescription Generator Engine
 *
 * Converts a W2 workout session skeleton and upstream TrainingStrategy (v1)
 * into a fully realized, concrete, executable WorkoutPlan (v1).
 *
 * ARCHITECTURAL ROLE:
 * - W1: Defined WorkoutPlan (v1) contracts, boundaries, and validation.
 * - W2: Built the session skeleton, sequencing, and exercise assignment.
 * - W3: Generates exact set counts, set types (warmup/work/optional), rep ranges,
 *   target reps, RIR boundaries, rest durations, conditioning execution details,
 *   duration feasibility budgeting, and deload prescriptions.
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, non-mutating, zero dependencies.
 * 2. W2 numeric values are structural placeholders; W3 is the authoritative final prescription layer.
 * 3. Does NOT calculate load weights (kg/lbs) or calendar weekday dates.
 * 4. Does NOT calculate calories, macros, or nutrition prescriptions.
 * 5. Does NOT calculate numeric recovery scores or readiness percentages.
 * 6. Hard exclusions (avoid list & equipment incompatibility) are strictly preserved.
 * 7. Population safety: Youth (13–17) and ineligible trainees never receive an adult workout plan.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  TrainingStrategy,
  MovementPattern,
  TrainingTarget,
} from '../training-strategy';
import {
  type ExerciseDefinition,
  type ExerciseType,
  type ExerciseProgressionProfile,
  SEED_EXERCISE_CATALOG,
} from '../training-strategy/exerciseCatalog';
import type {
  WorkoutPlan,
  WorkoutSession,
  ExercisePrescription,
  SetPrescription,
} from './types';
import {
  resolveExerciseSetBudget,
  resolveExerciseRepetitionPrescription,
  resolveExerciseEffortPrescription,
  resolveExerciseRestSeconds,
  evaluateSessionDurationFeasibility,
  materializeConditioningPrescription,
  resolveTargetSessionBudget,
  resolveTargetCycleBudget,
  distributeTargetSetBudget,
  type DurationFeasibilityCategory,
  type SessionDurationBudgetResult,
  type DistributedExerciseSetBudget,
  type ExerciseAllocationCandidate,
  type TargetCycleBudget,
} from './prescriptionRules';
import { buildWorkoutPlanSkeleton } from './sessionSkeleton';

const EXERCISE_DEF_MAP = new Map<string, ExerciseDefinition>(
  SEED_EXERCISE_CATALOG.map((ex) => [ex.id, ex])
);

export type GeneratePrescribedWorkoutPlanOptions = {
  deterministicSeed?: string;
  enforceDurationBudget?: boolean;
};

/**
 * Materializes concrete prescriptions onto an existing W2 workout skeleton or directly from strategy & profile.
 *
 * @param skeleton - Valid WorkoutPlan skeleton (from W2 or buildWorkoutPlanSkeleton)
 * @param strategy - Authoritative upstream TrainingStrategy (v1)
 * @param profile - Validated CanonicalUserProfile
 * @param options - Generation options (deterministicSeed, enforceDurationBudget)
 * @returns Fully prescribed, executable WorkoutPlan (v1)
 */
export function generatePrescribedWorkoutPlan(
  skeleton: WorkoutPlan,
  strategy: TrainingStrategy,
  profile: CanonicalUserProfile,
  options: GeneratePrescribedWorkoutPlanOptions = {}
): WorkoutPlan {
  if (!skeleton || typeof skeleton !== 'object') {
    throw new TypeError('generatePrescribedWorkoutPlan requires a valid WorkoutPlan skeleton.');
  }
  if (!strategy || typeof strategy !== 'object') {
    throw new TypeError('generatePrescribedWorkoutPlan requires a valid TrainingStrategy object.');
  }
  if (!profile || typeof profile !== 'object') {
    throw new TypeError('generatePrescribedWorkoutPlan requires a valid CanonicalUserProfile object.');
  }

  const {
    objective,
    structure,
    trainingLoad,
    conditioning,
    recoveryConstraints,
    progression,
  } = strategy;

  const w3Trace: string[] = [];

  const startingVolume = trainingLoad.startingVolume;
  const volumePreference = profile.trainingPreferences.volumePreference;
  const programmingComplexity = structure.programmingComplexity;
  const primaryGoal = objective.primary;

  const t4MinRIR = trainingLoad.effort.minRIR;
  const t4MaxRIR = trainingLoad.effort.maxRIR;
  const effortModifier = recoveryConstraints.effortModifier;
  const volumeModifier = recoveryConstraints.volumeModifier;
  const conditioningModifier = recoveryConstraints.conditioningModifier;
  const deloadDecision = recoveryConstraints.deloadDecision;

  w3Trace.push(
    `W3 Prescription Engine Initialized: Primary goal '${primaryGoal}', complexity '${programmingComplexity}', starting volume '${startingVolume}', T4 RIR [${t4MinRIR}, ${t4MaxRIR}], recovery level '${recoveryConstraints.level}'.`
  );

  if (deloadDecision === 'recommend') {
    w3Trace.push('W3 Deload Policy: Materializing conservative deload prescriptions (capped work sets & RIR 4–5 reserve).');
  } else if (volumeModifier !== 'maintain' || effortModifier !== 'maintain') {
    w3Trace.push(`W3 Recovery Policy: Active modifiers (volume: '${volumeModifier}', effort: '${effortModifier}').`);
  }

  let totalExercisesPrescribed = 0;
  let totalSetsPrescribed = 0;
  let cycleFeasibility: DurationFeasibilityCategory = 'comfortably_within_budget';

  // Pre-calculate upstream T6 cycle-level target budgets and maintain consumed work sets across sessions
  const targetCycleBudgetMap = new Map<TrainingTarget, TargetCycleBudget>();
  strategy.trainingDemand.weeklyTargets.forEach((t) => {
    targetCycleBudgetMap.set(
      t.target,
      resolveTargetCycleBudget(
        t.target,
        t.priority,
        t.workloadBand,
        t.exposureTarget,
        volumeModifier,
        deloadDecision
      )
    );
  });
  const consumedCycleWorkSets = new Map<TrainingTarget, number>();

  // 1. Process each session in the skeleton
  const prescribedSessions: WorkoutSession[] = skeleton.sessions.map((session) => {
    const sessionPatternSeen = new Set<MovementPattern>();

    // A. Group session exercises by primary target muscle
    const exercisesByTarget = new Map<
      TrainingTarget,
      Array<{
        exercise: (typeof session.exercises)[0];
        exerciseType: ExerciseType;
        progressionProfile: ExerciseProgressionProfile;
        isFirstOfPattern: boolean;
        def: ExerciseDefinition | undefined;
      }>
    >();

    session.exercises.forEach((ex) => {
      const def = EXERCISE_DEF_MAP.get(ex.exerciseId);
      const exerciseType = def?.exerciseType ?? 'compound';
      const progressionProfile = def?.progressionProfile ?? 'secondary_compound';
      const isFirstOfPattern = !sessionPatternSeen.has(ex.movementPattern);
      sessionPatternSeen.add(ex.movementPattern);

      const primaryTarget = ex.targetMuscles[0] ?? 'chest';
      const existing = exercisesByTarget.get(primaryTarget) ?? [];
      existing.push({
        exercise: ex,
        exerciseType,
        progressionProfile,
        isFirstOfPattern,
        def,
      });
      exercisesByTarget.set(primaryTarget, existing);
    });

    // B. For each target, resolve target session budget and distribute across exercises,
    // constrained by remaining cycle-level target volume budget.
    const distributedBudgetsByExerciseId = new Map<string, DistributedExerciseSetBudget>();

    for (const [target, targetExs] of exercisesByTarget.entries()) {
      const targetDemandItem = strategy.trainingDemand.weeklyTargets.find(
        (t) => t.target === target
      );
      const targetPriority = targetDemandItem?.priority ?? 'moderate';
      const targetWorkloadBand =
        targetDemandItem?.workloadBand ?? (startingVolume === 'low' ? 'low' : 'moderate');

      const targetSessionBudget = resolveTargetSessionBudget(
        target,
        targetPriority,
        targetWorkloadBand,
        volumeModifier,
        deloadDecision
      );

      // Check remaining cycle allowance
      const cycleBudget =
        targetCycleBudgetMap.get(target) ??
        resolveTargetCycleBudget(
          target,
          targetPriority,
          targetWorkloadBand,
          targetDemandItem?.exposureTarget ?? 1,
          volumeModifier,
          deloadDecision
        );
      const consumedSoFar = consumedCycleWorkSets.get(target) ?? 0;
      const remainingCycleSets = Math.max(0, cycleBudget.maxCycleWorkSets - consumedSoFar);

      // Has a primary compound exercise? If so, preserve primary minimum floor (at least 2 work sets)
      const hasPrimary = targetExs.some((item) => item.exercise.role === 'primary');
      const minSessionFloor = hasPrimary ? 2 : 0;
      const effectiveMaxWorkSets = Math.max(
        minSessionFloor,
        Math.min(targetSessionBudget.maxWorkSets, remainingCycleSets)
      );

      const effectiveSessionBudget = {
        ...targetSessionBudget,
        maxWorkSets: effectiveMaxWorkSets,
      };

      const candidates: ExerciseAllocationCandidate[] = targetExs.map((item) => {
        const baseBudget = resolveExerciseSetBudget(
          item.exercise.role,
          item.exerciseType,
          item.progressionProfile,
          startingVolume,
          volumePreference,
          volumeModifier,
          deloadDecision,
          item.isFirstOfPattern,
          targetPriority
        );
        return {
          exerciseId: item.exercise.exerciseId,
          role: item.exercise.role,
          exerciseType: item.exerciseType,
          progressionProfile: item.progressionProfile,
          isFirstOfPattern: item.isFirstOfPattern,
          baseBudget,
        };
      });

      const distributed = distributeTargetSetBudget(effectiveSessionBudget, candidates);
      distributed.forEach((d) => distributedBudgetsByExerciseId.set(d.exerciseId, d));

      // Track consumed cycle work sets for this target
      const sessionAllocatedWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      consumedCycleWorkSets.set(target, consumedSoFar + sessionAllocatedWorkSets);
    }

    // C. Prescribe each exercise within session using distributed target budgets
    let prescribedExercises: ExercisePrescription[] = session.exercises.map((ex) => {
      const def = EXERCISE_DEF_MAP.get(ex.exerciseId);
      const exerciseType = def?.exerciseType ?? 'compound';
      const progressionProfile = def?.progressionProfile ?? 'secondary_compound';
      const setBudget = distributedBudgetsByExerciseId.get(ex.exerciseId)!;

      // C.1. Resolve Final Repetition Prescription
      const repetitionPrescription = resolveExerciseRepetitionPrescription(
        primaryGoal,
        ex.role,
        progressionProfile,
        exerciseType,
        programmingComplexity
      );

      // C.2. Resolve Final Effort / RIR Prescription
      const effortPrescription = resolveExerciseEffortPrescription(
        t4MinRIR,
        t4MaxRIR,
        effortModifier,
        deloadDecision,
        ex.role,
        programmingComplexity
      );

      // C.3. Resolve Rest Guidance
      const restSeconds = resolveExerciseRestSeconds(
        ex.role,
        exerciseType,
        primaryGoal,
        deloadDecision
      );

      // C.4. Materialize Concrete Sets Array
      const sets: SetPrescription[] = [];
      let setIndexCounter = 1;

      // Add warm-up sets if budgeted
      for (let w = 0; w < setBudget.warmupSets; w++) {
        sets.push({
          setIndex: setIndexCounter++,
          setType: 'warmup',
          repRange: { min: 8, max: 10 },
          targetReps: 10,
          targetRIR: 4, // Light warm-up effort
          restSeconds: 60,
        });
      }

      // Add work sets
      for (let ws = 0; ws < setBudget.workSets; ws++) {
        sets.push({
          setIndex: setIndexCounter++,
          setType: 'work',
          repRange: repetitionPrescription.repRange,
          targetReps: repetitionPrescription.targetReps,
          targetRIR: effortPrescription.targetRIR,
          restSeconds,
        });
      }

      // Add optional sets
      for (let op = 0; op < setBudget.optionalSets; op++) {
        sets.push({
          setIndex: setIndexCounter++,
          setType: 'optional',
          repRange: repetitionPrescription.repRange,
          targetReps: repetitionPrescription.targetReps,
          targetRIR: effortPrescription.targetRIR,
          restSeconds,
        });
      }

      // Progression Method lookup from T7
      const exerciseProgPlan = progression.exerciseProgressionPlans.find(
        (p) => p.exerciseId === ex.exerciseId
      );
      const progressionMethod = exerciseProgPlan ? exerciseProgPlan.method : progression.method;

      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        role: ex.role,
        movementPattern: ex.movementPattern,
        targetMuscles: [...ex.targetMuscles],
        sets,
        repetitionPrescription,
        effortPrescription,
        restSeconds,
        progressionMethod,
        substitutionExerciseIds: [...ex.substitutionExerciseIds],
        notes: ex.notes ? `${ex.notes} | ${setBudget.reason}` : setBudget.reason,
      };
    });

    // Filter out exercises that received 0 sets (e.g. optional or low priority accessory reduced to 0)
    prescribedExercises = prescribedExercises.filter((e) => e.sets.length > 0);

    // B. Materialize Conditioning Prescription
    const sessionConditioning = materializeConditioningPrescription(
      conditioning.demand,
      conditioning.mode,
      conditioning.placement.guidance,
      conditioning.preferredModalityFamilies[0] ?? 'walking_low_intensity',
      conditioningModifier,
      conditioning.frequencyRelationship.targetAvailabilityGuidance
    );

    // C. Evaluate Duration Feasibility
    const conditioningTargetMinutes =
      sessionConditioning?.durationMinutesGuidance?.target ?? 0;

    let finalSessionConditioning = sessionConditioning;
    let finalConditioningMinutes = conditioningTargetMinutes;

    const reindexSets = (sets: SetPrescription[]): SetPrescription[] =>
      sets.map((s, idx) => ({ ...s, setIndex: idx + 1 }));

    const computeSessionDuration = (
      exercises: ExercisePrescription[],
      condMinutes: number
    ): SessionDurationBudgetResult => {
      const warmupCount = exercises.reduce(
        (sum, ex) => sum + ex.sets.filter((s) => s.setType === 'warmup').length,
        0
      );
      const workSets: Array<{ restSeconds: number }> = [];
      exercises.forEach((ex) => {
        ex.sets
          .filter((s) => s.setType === 'work')
          .forEach(() => workSets.push({ restSeconds: ex.restSeconds }));
      });
      return evaluateSessionDurationFeasibility(
        warmupCount,
        workSets,
        exercises.length,
        condMinutes,
        session.targetDurationMinutes
      );
    };

    let durationBudgetResult = computeSessionDuration(
      prescribedExercises,
      finalConditioningMinutes
    );

    // D. Global Duration Feasibility Balancing:
    // When session is constrained under duration category:
    // Priority order:
    // 1. Prune optional exercises/content first
    // 2. Reduce or omit conditioning next (if conditioning is present and session cannot support it)
    // 3. Trim accessory set density next (capped at minimum 1 work set)
    // 4. In compact sessions (target <= 30m), streamline warmups and cap secondary compound work sets at 2
    // 5. Primary compound movements remain protected
    if (
      options.enforceDurationBudget !== false &&
      durationBudgetResult.feasibility === 'constrained'
    ) {
      // Step 1: Filter out optional exercises first
      const hasOptional = prescribedExercises.some((e) => e.role === 'optional');
      if (hasOptional) {
        prescribedExercises = prescribedExercises.filter((e) => e.role !== 'optional');
        w3Trace.push(
          `Duration Feasibility: Pruned optional exercise(s) in session ${session.sequenceIndex} to satisfy duration budget.`
        );
        durationBudgetResult = computeSessionDuration(
          prescribedExercises,
          finalConditioningMinutes
        );
      }

      // Step 2: If still constrained and conditioning is attached, shorten conditioning to 10 min active recovery
      if (
        durationBudgetResult.feasibility === 'constrained' &&
        finalSessionConditioning &&
        finalConditioningMinutes > 10
      ) {
        finalConditioningMinutes = 10;
        finalSessionConditioning = {
          ...finalSessionConditioning,
          durationMinutesGuidance: {
            min: 10,
            target: 10,
            max: 12,
          },
          notes: `${finalSessionConditioning.notes ?? ''} [Duration constrained: shortened to 10m]`.trim(),
        };
        w3Trace.push(
          `Duration Feasibility: Shortened conditioning to 10m in session ${session.sequenceIndex} to fit duration budget.`
        );
        durationBudgetResult = computeSessionDuration(
          prescribedExercises,
          finalConditioningMinutes
        );
      }

      // Step 3a: If still constrained, trim work sets on accessory exercises > 2 down to 2
      if (durationBudgetResult.feasibility === 'constrained') {
        for (const ex of [...prescribedExercises].reverse()) {
          if (ex.role === 'accessory') {
            const workSets = ex.sets.filter((s) => s.setType === 'work');
            if (workSets.length > 2) {
              const nonWorkSets = ex.sets.filter((s) => s.setType !== 'work');
              const trimmedWork = workSets.slice(0, 2);
              ex.sets = reindexSets([...nonWorkSets, ...trimmedWork]);
              w3Trace.push(
                `Duration Feasibility: Trimmed accessory work sets to 2 on ${ex.exerciseId} in session ${session.sequenceIndex}.`
              );
            }
          }
        }
        durationBudgetResult = computeSessionDuration(
          prescribedExercises,
          finalConditioningMinutes
        );
      }

      // Step 3b: If still constrained, trim accessory work sets down to minimum 1 work set
      if (durationBudgetResult.feasibility === 'constrained') {
        for (const ex of [...prescribedExercises].reverse()) {
          if (ex.role === 'accessory') {
            const workSets = ex.sets.filter((s) => s.setType === 'work');
            if (workSets.length > 1) {
              const nonWorkSets = ex.sets.filter((s) => s.setType !== 'work');
              const trimmedWork = workSets.slice(0, 1);
              ex.sets = reindexSets([...nonWorkSets, ...trimmedWork]);
              w3Trace.push(
                `Duration Feasibility: Trimmed accessory work sets to 1 on ${ex.exerciseId} in session ${session.sequenceIndex}.`
              );
            }
          }
        }
        durationBudgetResult = computeSessionDuration(
          prescribedExercises,
          finalConditioningMinutes
        );
      }

      // Step 3c: If still constrained after accessory reduction and conditioning is present,
      // omit conditioning to protect core resistance training.
      if (durationBudgetResult.feasibility === 'constrained' && finalSessionConditioning) {
        finalSessionConditioning = undefined;
        finalConditioningMinutes = 0;
        w3Trace.push(
          `Duration Feasibility: Omitted conditioning in session ${session.sequenceIndex} after accessory reduction because session cannot support both core resistance work and conditioning.`
        );
        durationBudgetResult = computeSessionDuration(
          prescribedExercises,
          finalConditioningMinutes
        );
      }

      // Step 3c: If still constrained in compact sessions (<= 30m), streamline warmups and cap secondary compound work sets at 2
      if (
        durationBudgetResult.feasibility === 'constrained' &&
        session.targetDurationMinutes <= 30
      ) {
        for (const ex of prescribedExercises) {
          if (ex.role === 'secondary') {
            // Trim secondary warmups and cap work sets at 2
            const workSets = ex.sets.filter((s) => s.setType === 'work');
            const cappedWork = workSets.length > 2 ? workSets.slice(0, 2) : workSets;
            ex.sets = reindexSets([...cappedWork]);
            w3Trace.push(
              `Duration Feasibility: Trimmed secondary compound work sets to 2 and streamlined warmups on ${ex.exerciseId} in compact session ${session.sequenceIndex}.`
            );
          } else if (ex.role === 'primary') {
            // Cap primary warmups at 1 set in compact 30m sessions
            const warmups = ex.sets.filter((s) => s.setType === 'warmup');
            if (warmups.length > 1) {
              const workSets = ex.sets.filter((s) => s.setType === 'work');
              ex.sets = reindexSets([warmups[0], ...workSets]);
              w3Trace.push(
                `Duration Feasibility: Capped primary compound warmup at 1 set on ${ex.exerciseId} in compact session ${session.sequenceIndex}.`
              );
            }
          }
        }
        durationBudgetResult = computeSessionDuration(
          prescribedExercises,
          finalConditioningMinutes
        );
      }
    }

    if (durationBudgetResult.feasibility === 'constrained') {
      cycleFeasibility = 'constrained';
    } else if (
      durationBudgetResult.feasibility === 'near_budget' &&
      cycleFeasibility !== 'constrained'
    ) {
      cycleFeasibility = 'near_budget';
    }

    const sessionNotes = [
      ...session.sessionNotes,
      ...durationBudgetResult.notes,
    ];

    return {
      sessionId: session.sessionId,
      sequenceIndex: session.sequenceIndex,
      sessionName: session.sessionName,
      focusAreas: [...session.focusAreas],
      primaryMovementPatterns: [...session.primaryMovementPatterns],
      targetDurationMinutes: session.targetDurationMinutes,
      exercises: prescribedExercises,
      conditioning: finalSessionConditioning,
      sessionNotes,
    };
  });

  const finalExercisesPrescribed = prescribedSessions.reduce(
    (sum, s) => sum + s.exercises.length,
    0
  );
  const finalSetsPrescribed = prescribedSessions.reduce(
    (sum, s) => sum + s.exercises.reduce((exSum, e) => exSum + e.sets.length, 0),
    0
  );

  w3Trace.push(
    `W3 Prescription Generation Complete: Prescribed ${prescribedSessions.length} sessions, ${finalExercisesPrescribed} exercises, ${finalSetsPrescribed} total sets. Feasibility: ${cycleFeasibility}.`
  );

  return {
    schemaVersion: 1,
    population: 'adult',
    sourceStrategyVersion: 1,
    objective: { ...skeleton.objective },
    structure: { ...skeleton.structure },
    recoveryContext: { ...skeleton.recoveryContext },
    sessions: prescribedSessions,
    generationMetadata: {
      generatedAtTimestamp: skeleton.generationMetadata.generatedAtTimestamp,
      generatorVersion: '1.0.0',
      generationStage: 'prescribed',
      durationFeasibility: cycleFeasibility,
      deterministicSeed: options.deterministicSeed,
      totalExercisesPrescribed: finalExercisesPrescribed,
      totalSetsPrescribed: finalSetsPrescribed,
    },
    decisionTrace: [...skeleton.decisionTrace, ...w3Trace],
  };
}

/**
 * End-to-end W1 -> W2 -> W3 pipeline helper.
 * Converts an upstream TrainingStrategy (v1) and profile directly into a fully prescribed WorkoutPlan (v1).
 */
export function generateWorkoutPlanFromStrategy(
  strategy: TrainingStrategy,
  profile: CanonicalUserProfile,
  options: GeneratePrescribedWorkoutPlanOptions = {}
): WorkoutPlan {
  const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
  return generatePrescribedWorkoutPlan(skeleton, strategy, profile, options);
}
