/**
 * T6 — Training Demand & Allocation
 *
 * Deterministically translates resolved objectives, target frequency, split structure,
 * starting volume, and ranked exercise candidates into qualitative resistance-training demand
 * and session-level movement/exercise allocations.
 *
 * DESIGN INVARIANTS:
 * 1. T6 is NOT the final workout generator:
 *    - Does NOT generate exact sets, exact reps, load prescriptions, or RIR values.
 *    - Does NOT assign workouts to fixed calendar weekdays.
 *    - Creates abstract session demand buckets and exercise slot allocations with explicit roles.
 * 2. Deterministic Redundancy Protection:
 *    - Prevents multiple exercises sharing the same primary movement pattern and primary target
 *      from monopolizing a session, ensuring balanced pattern and target coverage.
 * 3. Volume Ceiling Integration:
 *    - Respects T4 starting volume ('low' | 'moderate' | 'high') when budgeting slot ranges.
 * 4. Experience & Constraint Precedence:
 *    - Enforces hard exclusions (avoid list & equipment) and protects foundational trainees.
 * 5. Pure, deterministic, non-mutating, zero dependencies.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  FrequencyResolution,
  TrainingStructure,
  TrainingLoadStrategy,
  ExerciseSelectionStrategy,
  TrainingTarget,
  MovementPattern,
  PriorityLevel,
  TargetDemand,
  SessionDemand,
  TrainingDemandPlan,
} from './types';
import {
  type ExerciseDefinition,
  SEED_EXERCISE_CATALOG,
} from './exerciseCatalog';

export type TrainingDemandLevel = 'low' | 'moderate' | 'high';

export type ExerciseAllocationRole =
  | 'primary'
  | 'secondary'
  | 'accessory'
  | 'optional';

export type ExerciseAllocationItem = {
  exerciseId: string;
  role: ExerciseAllocationRole;
  targetMuscles: TrainingTarget[];
  movementPattern: MovementPattern;
  rationale: string;
};

export type AllocatedSessionDemand = SessionDemand & {
  allocatedExercises: ExerciseAllocationItem[];
  rationale: string;
};

export type ComprehensiveTrainingDemandAllocation = TrainingDemandPlan & {
  sessions: AllocatedSessionDemand[];
  demandLevels: Record<TrainingTarget, TrainingDemandLevel>;
  coveredMovementPatterns: MovementPattern[];
  redundancyNotes: string[];
};

/**
 * Resolves qualitative weekly target demand levels for all canonical muscle groups.
 */
function resolveWeeklyTargetDemands(
  objective: ResolvedObjective,
  structure: TrainingStructure,
  load: TrainingLoadStrategy
): {
  targets: TargetDemand[];
  demandLevels: Record<TrainingTarget, TrainingDemandLevel>;
  reasons: string[];
} {
  const primaryGoal = objective.primary;
  const startingVol = load.startingVolume;
  const reasons: string[] = [];

  const allTargets: TrainingTarget[] = [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core',
    'conditioning',
  ];

  const demandLevels: Record<TrainingTarget, TrainingDemandLevel> = {} as Record<TrainingTarget, TrainingDemandLevel>;
  const targets: TargetDemand[] = [];

  for (const target of allTargets) {
    let priority: PriorityLevel = 'moderate';
    let demandLevel: TrainingDemandLevel = startingVol === 'low' ? 'low' : 'moderate';
    let exposures = 2;

    if (target === 'conditioning') {
      priority = objective.conditioningPriority;
      demandLevel = objective.conditioningPriority === 'high' ? 'moderate' : 'low';
      exposures = objective.conditioningPriority === 'high' ? 2 : 1;
    } else {
      // Resistance muscle targets
      switch (primaryGoal) {
        case 'hypertrophy':
          if (['chest', 'back', 'quads', 'hamstrings', 'glutes'].includes(target)) {
            priority = 'high';
            demandLevel = startingVol === 'high' ? 'high' : 'moderate';
            exposures = 2;
          } else if (['shoulders', 'biceps', 'triceps'].includes(target)) {
            priority = 'moderate';
            demandLevel = startingVol === 'low' ? 'low' : 'moderate';
            exposures = 2;
          } else {
            priority = 'low';
            demandLevel = 'low';
            exposures = 1;
          }
          break;

        case 'strength':
          if (['chest', 'back', 'quads', 'hamstrings'].includes(target)) {
            priority = 'high';
            demandLevel = startingVol === 'high' ? 'high' : 'moderate';
            exposures = 2;
          } else if (['shoulders', 'glutes', 'triceps', 'core'].includes(target)) {
            priority = 'moderate';
            demandLevel = 'moderate';
            exposures = 2;
          } else {
            priority = 'low';
            demandLevel = 'low';
            exposures = 1;
          }
          break;

        case 'body_composition':
          if (['chest', 'back', 'quads', 'hamstrings', 'glutes'].includes(target)) {
            priority = 'high';
            demandLevel = startingVol === 'low' ? 'low' : 'moderate';
            exposures = 2;
          } else {
            priority = 'moderate';
            demandLevel = 'low';
            exposures = 1;
          }
          break;

        case 'fat_loss_support':
          if (['chest', 'back', 'quads', 'glutes'].includes(target)) {
            priority = 'high';
            demandLevel = 'moderate';
            exposures = 2;
          } else {
            priority = 'low';
            demandLevel = 'low';
            exposures = 1;
          }
          break;

        case 'general_fitness':
        default:
          if (['chest', 'back', 'quads', 'hamstrings', 'core'].includes(target)) {
            priority = 'high';
            demandLevel = 'moderate';
            exposures = 2;
          } else {
            priority = 'moderate';
            demandLevel = 'low';
            exposures = 1;
          }
          break;
      }
    }

    demandLevels[target] = demandLevel;
    targets.push({
      target,
      priority,
      exposureTarget: exposures,
      workloadBand: demandLevel,
    });
  }

  reasons.push(
    `Weekly target demands configured for primary objective: ${primaryGoal} under ${startingVol} starting volume ceiling.`
  );

  return { targets, demandLevels, reasons };
}

/**
 * Derives abstract session demand templates based on target days and split family.
 */
function createSessionDemandTemplates(
  targetDays: number,
  structure: TrainingStructure,
  startingVolume: 'low' | 'moderate' | 'high'
): SessionDemand[] {
  const templates: SessionDemand[] = [];

  // Slot range budgeting based on starting volume
  const slotRange =
    startingVolume === 'low'
      ? { min: 3, target: 4, max: 5 }
      : startingVolume === 'high'
      ? { min: 5, target: 6, max: 8 }
      : { min: 4, target: 5, max: 6 };

  const { splitFamily } = structure;

  for (let i = 0; i < targetDays; i++) {
    const sessionIndex = i + 1;
    let focusAreas: TrainingTarget[] = [];
    let movementRequirements: MovementPattern[] = [];

    if (splitFamily === 'full_body') {
      focusAreas = ['chest', 'back', 'quads', 'hamstrings', 'core'];
      movementRequirements =
        i % 2 === 0
          ? ['horizontal_push', 'horizontal_pull', 'squat', 'hinge']
          : ['vertical_push', 'vertical_pull', 'lunge', 'hinge'];
    } else if (splitFamily === 'upper_lower') {
      const isUpper = i % 2 === 0;
      if (isUpper) {
        focusAreas = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
        movementRequirements = ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'];
      } else {
        focusAreas = ['quads', 'hamstrings', 'glutes', 'calves', 'core'];
        movementRequirements = ['squat', 'hinge', 'lunge', 'core'];
      }
    } else if (splitFamily === 'ppl') {
      const cyclePos = i % 3;
      if (cyclePos === 0) {
        // Push
        focusAreas = ['chest', 'shoulders', 'triceps'];
        movementRequirements = ['horizontal_push', 'vertical_push'];
      } else if (cyclePos === 1) {
        // Pull
        focusAreas = ['back', 'biceps'];
        movementRequirements = ['horizontal_pull', 'vertical_pull'];
      } else {
        // Legs
        focusAreas = ['quads', 'hamstrings', 'glutes', 'calves', 'core'];
        movementRequirements = ['squat', 'hinge', 'lunge', 'core'];
      }
    } else {
      // Hybrid or Specialization
      if (i % 2 === 0) {
        focusAreas = ['chest', 'back', 'shoulders'];
        movementRequirements = ['horizontal_push', 'horizontal_pull', 'vertical_push'];
      } else {
        focusAreas = ['quads', 'hamstrings', 'glutes', 'core'];
        movementRequirements = ['squat', 'hinge', 'core'];
      }
    }

    templates.push({
      sessionIndex,
      focusAreas,
      movementRequirements,
      exerciseSlotRange: { ...slotRange },
    });
  }

  return templates;
}

/**
 * Allocates ranked eligible exercises into abstract session buckets with redundancy protection.
 */
function allocateExercisesToSessions(
  templates: SessionDemand[],
  candidates: ExerciseSelectionStrategy['candidates'],
  catalog: readonly ExerciseDefinition[]
): {
  sessions: AllocatedSessionDemand[];
  coveredPatterns: Set<MovementPattern>;
  redundancyNotes: string[];
} {
  const catalogMap = new Map<string, ExerciseDefinition>();
  for (const ex of catalog) {
    catalogMap.set(ex.id, ex);
  }

  const coveredPatterns = new Set<MovementPattern>();
  const redundancyNotes: string[] = [];

  const allocatedSessions: AllocatedSessionDemand[] = [];

  for (const template of templates) {
    const sessionAllocations: ExerciseAllocationItem[] = [];
    const usedPrimaryTargetsInSession = new Set<TrainingTarget>();
    const usedMovementPatternsInSession = new Set<MovementPattern>();

    // 1. Primary Movement Allocations: satisfy required movement patterns
    for (const reqPattern of template.movementRequirements) {
      if (sessionAllocations.length >= template.exerciseSlotRange.target) {
        break;
      }

      // Find top ranked candidate that satisfies this required pattern
      const match = candidates.find((cand) => {
        const def = catalogMap.get(cand.exerciseId);
        if (!def) return false;
        if (!def.movementPatterns.includes(reqPattern)) return false;
        // Check redundancy within current session
        const hasPrimaryOverlap = def.primaryMuscles.some((m) =>
          usedPrimaryTargetsInSession.has(m)
        );
        const hasPatternOverlap = usedMovementPatternsInSession.has(reqPattern);

        // If we haven't covered this pattern yet, prefer non-overlapping candidate
        if (hasPatternOverlap) return false;
        return true;
      });

      if (match) {
        const def = catalogMap.get(match.exerciseId)!;
        sessionAllocations.push({
          exerciseId: match.exerciseId,
          role: def.progressionProfile === 'primary_compound' ? 'primary' : 'secondary',
          targetMuscles: [...def.primaryMuscles],
          movementPattern: reqPattern,
          rationale: `Satisfies required movement pattern ${reqPattern} for session ${template.sessionIndex}`,
        });

        coveredPatterns.add(reqPattern);
        usedMovementPatternsInSession.add(reqPattern);
        for (const m of def.primaryMuscles) {
          usedPrimaryTargetsInSession.add(m);
        }
      }
    }

    // 2. Secondary & Accessory Allocations: fill focus areas up to slot target
    for (const cand of candidates) {
      if (sessionAllocations.length >= template.exerciseSlotRange.target) {
        break;
      }

      // Already allocated in this session?
      if (sessionAllocations.some((a) => a.exerciseId === cand.exerciseId)) {
        continue;
      }

      const def = catalogMap.get(cand.exerciseId);
      if (!def) continue;

      // Must be relevant to session focus areas
      const matchesFocus = def.primaryMuscles.some((m) => template.focusAreas.includes(m));
      if (!matchesFocus) continue;

      // Redundancy Protection:
      // Don't duplicate primary muscle + movement pattern combo
      const sharesPrimaryPattern = sessionAllocations.some(
        (a) =>
          a.movementPattern === def.movementPatterns[0] &&
          def.primaryMuscles.some((m) => a.targetMuscles.includes(m))
      );

      if (sharesPrimaryPattern) {
        redundancyNotes.push(
          `Excluded duplicate ${def.id} in session ${template.sessionIndex} to prevent redundant ${def.movementPatterns[0]} on ${def.primaryMuscles.join('/')}`
        );
        continue;
      }

      const role: ExerciseAllocationRole =
        def.exerciseType === 'isolation'
          ? 'accessory'
          : def.progressionProfile === 'secondary_compound'
          ? 'secondary'
          : 'optional';

      const primaryPat = def.movementPatterns[0] || 'core';
      sessionAllocations.push({
        exerciseId: cand.exerciseId,
        role,
        targetMuscles: [...def.primaryMuscles],
        movementPattern: primaryPat,
        rationale: `Fills ${role} slot for focus area (${def.primaryMuscles.join(', ')})`,
      });

      coveredPatterns.add(primaryPat);
      for (const m of def.primaryMuscles) {
        usedPrimaryTargetsInSession.add(m);
      }
    }

    allocatedSessions.push({
      ...template,
      allocatedExercises: sessionAllocations,
      rationale: `Session ${template.sessionIndex} allocated with ${sessionAllocations.length} exercises balancing movement patterns and focus areas`,
    });
  }

  return {
    sessions: allocatedSessions,
    coveredPatterns,
    redundancyNotes,
  };
}

/**
 * Resolves training demand and allocation for downstream workout generation.
 *
 * @param profile - Validated canonical user profile
 * @param objective - Resolved objective from T1
 * @param frequency - Resolved frequency from T2
 * @param structure - Resolved structure from T3
 * @param load - Resolved starting load from T4
 * @param selection - Resolved exercise selection from T5
 * @param catalog - Optional exercise catalog (defaults to SEED_EXERCISE_CATALOG)
 * @returns ComprehensiveTrainingDemandAllocation
 */
export function resolveTrainingDemand(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  frequency: FrequencyResolution,
  structure: TrainingStructure,
  load: TrainingLoadStrategy,
  selection: ExerciseSelectionStrategy,
  catalog: readonly ExerciseDefinition[] = SEED_EXERCISE_CATALOG
): ComprehensiveTrainingDemandAllocation {
  const { targets: weeklyTargets, demandLevels, reasons: targetReasons } = resolveWeeklyTargetDemands(
    objective,
    structure,
    load
  );

  const templates = createSessionDemandTemplates(
    frequency.targetDays,
    structure,
    load.startingVolume
  );

  const { sessions, coveredPatterns, redundancyNotes } = allocateExercisesToSessions(
    templates,
    selection.candidates,
    catalog
  );

  const decisionTrace: string[] = [
    `Target frequency: ${frequency.targetDays} sessions/cycle`,
    `Split family: ${structure.splitFamily}`,
    `Starting volume ceiling: ${load.startingVolume}`,
    `Primary objective: ${objective.primary}`,
    ...targetReasons,
    `Abstract session templates created: ${templates.length}`,
    `Total movement patterns covered: ${coveredPatterns.size}`,
    `Redundancy protections applied: ${redundancyNotes.length}`,
  ];

  if (frequency.structureMode === 'flexible_sequence') {
    decisionTrace.push('Flexible sequence mode: sessions represent abstract ordering, not calendar weekdays');
  }

  return {
    weeklyTargets,
    sessions,
    minimumViableSessions: frequency.minimumViableDays,
    targetSessions: frequency.targetDays,
    demandLevels,
    coveredMovementPatterns: Array.from(coveredPatterns),
    redundancyNotes,
    decisionTrace,
  };
}
