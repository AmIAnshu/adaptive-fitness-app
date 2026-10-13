/**
 * Session Skeleton & Exercise Assignment Engine (Stage W2)
 *
 * Materializes concrete workout session skeletons and deterministically assigns
 * eligible exercises to sessions based on upstream TrainingStrategy (v1) and
 * CanonicalUserProfile.
 *
 * ARCHITECTURAL ROLE:
 * - W1: Defined WorkoutPlan (v1) contracts, boundaries, and validation.
 * - W2: Builds the session skeleton and assigns eligible exercises.
 * - W3: Generates exact set counts, rep ranges, rest durations, and RIR budgets.
 *
 * OWNERSHIP BOUNDARIES:
 * - W2 owns:
 *   * Session composition & sequencing (1-based sequenceIndex, stable deterministic sessionId).
 *   * User-friendly deterministic session naming (no internal programming-complexity jargon).
 *   * Qualitative target and movement-pattern coverage.
 *   * Exercise assignment to sessions respecting T5 eligibility, hard exclusions, and T6 demand.
 *   * Redundancy protection (preventing duplicate patterns/targets in same session).
 *   * Deterministic exercise ordering: primary compounds -> secondary compounds -> isolation/accessories.
 *   * Exercise variety handling (repeat_key_exercises, some_variety, change_often).
 *   * Session duration budgeting (compact skeletons for 20_30, standard for 45_60+).
 *   * Conditioning slot attachment based on T8 guidance and T9 recovery constraints.
 *   * Compatible substitution candidate attachment from T5 candidates.
 *   * Preservation of upstream T7 progression method metadata.
 *
 * - W2 does NOT own:
 *   * Goals, split selection, target frequency, recovery-state evaluation.
 *   * Exact numeric set counts, rep prescriptions, loads (kg/lbs), or RIR targets (deferred to W3).
 *   * Calendar weekday assignments.
 *   * Runtime fatigue evaluations or live workout substitutions.
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, non-mutating, zero dependencies.
 * 2. Hard exclusions (avoid list & equipment incompatibility) are absolute.
 * 3. Youth trainees (13-17) and ineligible trainees never receive an adult workout plan.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  TrainingStrategy,
  MovementPattern,
  TrainingTarget,
  ProgressionMethod,
  SplitFamily,
} from '../training-strategy';
import {
  type ExerciseDefinition,
  type ExerciseProgressionProfile,
  SEED_EXERCISE_CATALOG,
} from '../training-strategy/exerciseCatalog';
import type { AllocatedSessionDemand } from '../training-strategy/trainingDemand';
import type {
  WorkoutPlan,
  WorkoutSession,
  ExercisePrescription,
  SetPrescription,
  RepetitionPrescription,
  EffortPrescription,
  ConditioningPrescription,
  WorkoutPlanRecoveryContext,
} from './types';

// Map of seed exercises for fast lookup
const EXERCISE_DEF_MAP = new Map<string, ExerciseDefinition>(
  SEED_EXERCISE_CATALOG.map((ex) => [ex.id, ex])
);

/**
 * Returns formatted display name for an exercise.
 */
export function formatExerciseDisplayName(exerciseId: string): string {
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
 * Derives a clean, user-friendly session name without exposing internal programming complexity.
 */
export function deriveSessionName(
  sequenceIndex: number,
  splitFamily: SplitFamily,
  focusAreas: readonly TrainingTarget[],
  totalSessions: number
): string {
  const formatTarget = (t: TrainingTarget): string => {
    switch (t) {
      case 'chest': return 'Chest';
      case 'back': return 'Back';
      case 'shoulders': return 'Shoulders';
      case 'biceps': return 'Biceps';
      case 'triceps': return 'Triceps';
      case 'quads': return 'Quads';
      case 'hamstrings': return 'Hamstrings';
      case 'glutes': return 'Glutes';
      case 'calves': return 'Calves';
      case 'core': return 'Core';
      case 'conditioning': return 'Conditioning';
      default: return t;
    }
  };

  if (splitFamily === 'full_body') {
    if (totalSessions <= 1) return 'Full Body';
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const letter = letters[(sequenceIndex - 1) % letters.length] ?? `${sequenceIndex}`;
    return `Full Body ${letter}`;
  }

  if (splitFamily === 'upper_lower') {
    const isUpper = (sequenceIndex - 1) % 2 === 0;
    const cycleNum = Math.floor((sequenceIndex - 1) / 2) + 1;
    const variant = totalSessions > 2 ? ` ${cycleNum === 1 ? 'A' : 'B'}` : '';
    return isUpper ? `Upper Body${variant}` : `Lower Body${variant}`;
  }

  if (splitFamily === 'ppl') {
    const cyclePos = (sequenceIndex - 1) % 3;
    const cycleNum = Math.floor((sequenceIndex - 1) / 3) + 1;
    const variant = totalSessions > 3 ? ` ${cycleNum === 1 ? 'A' : 'B'}` : '';
    if (cyclePos === 0) return `Push${variant}`;
    if (cyclePos === 1) return `Pull${variant}`;
    return `Legs & Core${variant}`;
  }

  // Hybrid / Specialization
  const topFocus = focusAreas.slice(0, 2).map(formatTarget).join(' & ');
  return topFocus ? `Session ${sequenceIndex} — ${topFocus}` : `Session ${sequenceIndex}`;
}

/**
 * Calculates target exercise slot count based on session duration category.
 */
export function deriveExerciseSlotTarget(
  durationCategory: string | undefined,
  baseSlotTarget: number
): { min: number; target: number; max: number } {
  switch (durationCategory) {
    case '20_30':
      return { min: 3, target: Math.min(baseSlotTarget, 4), max: 4 };
    case '30_45':
      return { min: 3, target: Math.min(baseSlotTarget, 5), max: 5 };
    case '45_60':
      return { min: 4, target: Math.max(4, Math.min(baseSlotTarget, 6)), max: 6 };
    case '60_75':
    case '75_plus':
      return { min: 4, target: Math.max(5, Math.min(baseSlotTarget, 7)), max: 8 };
    default:
      return { min: 3, target: baseSlotTarget, max: baseSlotTarget + 1 };
  }
}

/**
 * Derives nominal target duration in minutes from profile schedule.
 */
export function deriveNominalDurationMinutes(durationCategory: string | undefined): number {
  switch (durationCategory) {
    case '20_30': return 30;
    case '30_45': return 45;
    case '45_60': return 55;
    case '60_75': return 70;
    case '75_plus': return 80;
    default: return 50;
  }
}

/**
 * Resolves baseline rep range placeholder for W2 skeleton.
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
 * Deterministic rank score for ordering exercises within a session:
 * 1. Primary compound movements first
 * 2. Secondary compound movements second
 * 3. Isolation & accessory movements third
 * 4. Optional / conditioning movements last
 */
function getExerciseOrderScore(def: ExerciseDefinition | undefined, role: string): number {
  if (!def) return 100;

  let base = 50;
  if (role === 'primary' || def.progressionProfile === 'primary_compound') {
    base = 10;
  } else if (role === 'secondary' || def.progressionProfile === 'secondary_compound') {
    base = 30;
  } else if (def.exerciseType === 'isolation' || role === 'accessory') {
    base = 60;
  } else if (role === 'optional') {
    base = 80;
  }

  // Foundational technical multi-joint movements are prioritized slightly earlier
  if (def.exerciseType === 'compound' && def.stableSetup) {
    base -= 2;
  }

  return base;
}

/**
 * Core W2 Engine: Builds session skeletons and assigns eligible exercises.
 *
 * @param strategy - Upstream TrainingStrategy (v1)
 * @param profile - Validated CanonicalUserProfile
 * @returns Fully constructed WorkoutPlan (v1) with session skeletons and assigned exercises
 */
export function buildWorkoutPlanSkeleton(
  strategy: TrainingStrategy,
  profile: CanonicalUserProfile
): WorkoutPlan {
  if (!strategy || typeof strategy !== 'object') {
    throw new TypeError('buildWorkoutPlanSkeleton requires a valid TrainingStrategy object.');
  }
  if (!profile || typeof profile !== 'object') {
    throw new TypeError('buildWorkoutPlanSkeleton requires a valid CanonicalUserProfile object.');
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

  const w2Trace: string[] = [];

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

  // 3. User Preferences & Hard Exclusions
  const avoidSet = new Set(profile.exercisePreferences.avoid);
  const excludedSet = new Set(exerciseSelection.excludedExerciseIds);
  const varietyPreference = profile.trainingPreferences.exerciseVariety;
  const sessionDurationCategory = profile.schedule.sessionDuration;
  const nominalDurationMinutes = deriveNominalDurationMinutes(sessionDurationCategory);

  w2Trace.push(
    `W2 Skeleton Initialization: Split ${structure.splitFamily}, ${structure.sessionsPerCycle} sessions/cycle, variety preference '${varietyPreference}', duration category '${sessionDurationCategory}'.`
  );

  // 4. Session Construction & Exercise Assignment
  const allocatedSessions = trainingDemand.sessions as AllocatedSessionDemand[];
  const totalSessions = allocatedSessions.length;

  let totalExercisesPrescribed = 0;
  let totalSetsPrescribed = 0;

  // Track key exercises assigned across sessions for variety policy handling
  const assignedKeyExerciseIds = new Set<string>();

  const sessions: WorkoutSession[] = allocatedSessions.map((allocatedSession, sessionIdx) => {
    const sequenceIndex = sessionIdx + 1;
    const sessionId = `session_${sequenceIndex}`;
    const sessionName = deriveSessionName(
      sequenceIndex,
      structure.splitFamily,
      allocatedSession.focusAreas,
      totalSessions
    );

    // Calculate slot capacity adapted to session duration
    const slotTarget = deriveExerciseSlotTarget(
      sessionDurationCategory,
      allocatedSession.exerciseSlotRange.target
    );

    const sessionExercises: ExercisePrescription[] = [];
    const usedExerciseIdsInSession = new Set<string>();
    const usedMovementPatternsInSession = new Set<MovementPattern>();
    const usedPrimaryTargetsInSession = new Set<TrainingTarget>();

    // Step A: Seed exercises from T6 allocation that satisfy hard constraints
    for (const alloc of allocatedSession.allocatedExercises) {
      if (sessionExercises.length >= slotTarget.target) break;

      // Hard check: avoid list & excluded
      if (avoidSet.has(alloc.exerciseId) || excludedSet.has(alloc.exerciseId)) {
        w2Trace.push(
          `Skipped allocated exercise ${alloc.exerciseId} in session ${sequenceIndex} due to hard exclusion.`
        );
        continue;
      }

      if (usedExerciseIdsInSession.has(alloc.exerciseId)) continue;

      const def = EXERCISE_DEF_MAP.get(alloc.exerciseId);

      // Redundancy check within session
      if (def) {
        const primaryTarget = def.primaryMuscles[0];
        const primaryPattern = def.movementPatterns[0];
        const hasRedundantTargetPattern =
          primaryTarget &&
          primaryPattern &&
          usedPrimaryTargetsInSession.has(primaryTarget) &&
          usedMovementPatternsInSession.has(primaryPattern);

        if (hasRedundantTargetPattern) {
          w2Trace.push(
            `Redundancy Protection: Skipped duplicate pattern/target (${primaryPattern} on ${primaryTarget}) for ${def.id} in session ${sequenceIndex}.`
          );
          continue;
        }
      }

      // Progression Method lookup
      const exerciseProgPlan = progression.exerciseProgressionPlans.find(
        (p) => p.exerciseId === alloc.exerciseId
      );
      const progressionMethod: ProgressionMethod = exerciseProgPlan
        ? exerciseProgPlan.method
        : progression.method;

      // Substitutions: eligible T5 candidates sharing movement pattern
      const substitutionExerciseIds = exerciseSelection.candidates
        .filter((c) => {
          if (c.exerciseId === alloc.exerciseId) return false;
          if (avoidSet.has(c.exerciseId) || excludedSet.has(c.exerciseId)) return false;
          const cDef = EXERCISE_DEF_MAP.get(c.exerciseId);
          return cDef ? cDef.movementPatterns.includes(alloc.movementPattern) : false;
        })
        .slice(0, 3)
        .map((c) => c.exerciseId);

      const repPrescription = deriveBaselineRepetition(objective.primary);
      const restSeconds = deriveRestSeconds(alloc.role);

      // Default placeholder sets for W2 skeleton (3 sets)
      const sets: SetPrescription[] = [1, 2, 3].map((setIndex) => ({
        setIndex,
        setType: 'work',
        repRange: repPrescription.repRange,
        targetRIR: defaultEffortPrescription.targetRIR,
        restSeconds,
      }));

      sessionExercises.push({
        exerciseId: alloc.exerciseId,
        exerciseName: formatExerciseDisplayName(alloc.exerciseId),
        role: alloc.role,
        movementPattern: alloc.movementPattern,
        targetMuscles: [...alloc.targetMuscles],
        sets,
        repetitionPrescription: repPrescription,
        effortPrescription: defaultEffortPrescription,
        restSeconds,
        progressionMethod,
        substitutionExerciseIds,
        notes: alloc.rationale,
      });

      usedExerciseIdsInSession.add(alloc.exerciseId);
      assignedKeyExerciseIds.add(alloc.exerciseId);
      if (def) {
        def.movementPatterns.forEach((p) => usedMovementPatternsInSession.add(p));
        def.primaryMuscles.forEach((m) => usedPrimaryTargetsInSession.add(m));
      }
    }

    // Step B: If under minimum slots or target slots, pull additional eligible candidates
    if (sessionExercises.length < slotTarget.target) {
      for (const cand of exerciseSelection.candidates) {
        if (sessionExercises.length >= slotTarget.target) break;
        if (usedExerciseIdsInSession.has(cand.exerciseId)) continue;
        if (avoidSet.has(cand.exerciseId) || excludedSet.has(cand.exerciseId)) continue;

        const def = EXERCISE_DEF_MAP.get(cand.exerciseId);
        if (!def) continue;

        // Must align with session focus areas
        const matchesFocus = def.primaryMuscles.some((m) =>
          allocatedSession.focusAreas.includes(m)
        );
        if (!matchesFocus) continue;

        // Variety Handling:
        // If change_often, prefer exercises not already used across previous sessions
        if (varietyPreference === 'change_often' && assignedKeyExerciseIds.has(cand.exerciseId)) {
          // Deprioritize already-assigned exercises in change_often mode if alternatives exist
          continue;
        }

        // Redundancy Protection:
        // Do not add exercise sharing both primary target and primary pattern with existing session exercise
        const primaryTarget = def.primaryMuscles[0];
        const primaryPattern = def.movementPatterns[0];
        const isRedundant =
          primaryTarget &&
          primaryPattern &&
          usedPrimaryTargetsInSession.has(primaryTarget) &&
          usedMovementPatternsInSession.has(primaryPattern);

        if (isRedundant) continue;

        const role =
          def.exerciseType === 'isolation'
            ? 'accessory'
            : def.progressionProfile === 'secondary_compound'
            ? 'secondary'
            : 'optional';

        const repPrescription = deriveBaselineRepetition(objective.primary);
        const restSeconds = deriveRestSeconds(role);

        const sets: SetPrescription[] = [1, 2, 3].map((setIndex) => ({
          setIndex,
          setType: 'work',
          repRange: repPrescription.repRange,
          targetRIR: defaultEffortPrescription.targetRIR,
          restSeconds,
        }));

        const substitutionExerciseIds = exerciseSelection.candidates
          .filter((c) => {
            if (c.exerciseId === cand.exerciseId) return false;
            if (avoidSet.has(c.exerciseId) || excludedSet.has(c.exerciseId)) return false;
            const cDef = EXERCISE_DEF_MAP.get(c.exerciseId);
            return cDef ? cDef.movementPatterns.includes(primaryPattern) : false;
          })
          .slice(0, 3)
          .map((c) => c.exerciseId);

        sessionExercises.push({
          exerciseId: cand.exerciseId,
          exerciseName: formatExerciseDisplayName(cand.exerciseId),
          role,
          movementPattern: primaryPattern,
          targetMuscles: [...def.primaryMuscles],
          sets,
          repetitionPrescription: repPrescription,
          effortPrescription: defaultEffortPrescription,
          restSeconds,
          progressionMethod: progression.method,
          substitutionExerciseIds,
          notes: `Additional ${role} exercise covering ${def.primaryMuscles.join(', ')}`,
        });

        usedExerciseIdsInSession.add(cand.exerciseId);
        assignedKeyExerciseIds.add(cand.exerciseId);
        def.movementPatterns.forEach((p) => usedMovementPatternsInSession.add(p));
        def.primaryMuscles.forEach((m) => usedPrimaryTargetsInSession.add(m));
      }
    }

    // Step C: Deterministic Exercise Ordering
    // Order: Primary compound -> Secondary compound -> Isolation/Accessory -> Optional
    sessionExercises.sort((a, b) => {
      const defA = EXERCISE_DEF_MAP.get(a.exerciseId);
      const defB = EXERCISE_DEF_MAP.get(b.exerciseId);
      const scoreA = getExerciseOrderScore(defA, a.role);
      const scoreB = getExerciseOrderScore(defB, b.role);

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return a.exerciseId.localeCompare(b.exerciseId);
    });

    totalExercisesPrescribed += sessionExercises.length;
    totalSetsPrescribed += sessionExercises.reduce((acc, ex) => acc + ex.sets.length, 0);

    // Step D: Conditioning Attachment
    let sessionConditioning: ConditioningPrescription | undefined;
    const canAttachConditioning =
      conditioning.demand !== 'none' &&
      recoveryConstraints.conditioningModifier !== 'omit';

    if (canAttachConditioning) {
      // Check placement guidance
      const placement = conditioning.placement.guidance;
      const isPostResistance = placement === 'post_resistance';
      const isFlexible = placement === 'flexible';

      // For integrated or post_resistance, attach to session
      if (isPostResistance || isFlexible) {
        const modality = conditioning.preferredModalityFamilies[0] ?? 'walking_low_intensity';
        const isReduced = recoveryConstraints.conditioningModifier === 'reduce';

        sessionConditioning = {
          demand: conditioning.demand,
          mode: conditioning.mode,
          placement,
          modalityFamily: modality,
          intensityGuidance: isReduced
            ? 'Reduced-intensity active recovery conditioning (recovery constrained).'
            : 'Standard baseline conditioning intensity.',
          notes: conditioning.frequencyRelationship.targetAvailabilityGuidance,
        };
      }
    }

    const sessionNotes = [
      allocatedSession.rationale,
      `Duration budget: target ${slotTarget.target} exercise slots for ~${nominalDurationMinutes}m session.`,
    ];

    return {
      sessionId,
      sequenceIndex,
      sessionName,
      focusAreas: [...allocatedSession.focusAreas],
      primaryMovementPatterns: [...allocatedSession.movementRequirements],
      targetDurationMinutes: nominalDurationMinutes,
      exercises: sessionExercises,
      conditioning: sessionConditioning,
      sessionNotes,
    };
  });

  w2Trace.push(
    `W2 Session Construction Complete: Produced ${sessions.length} sessions, ${totalExercisesPrescribed} exercises prescribed across cycle.`
  );

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
      generationStage: 'skeleton',
      totalExercisesPrescribed,
      totalSetsPrescribed,
    },
    decisionTrace: [...upstreamTrace, ...w2Trace],
  };
}
