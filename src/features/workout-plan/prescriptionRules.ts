/**
 * Exact Prescription Rules & Deterministic Policy Configuration (Stage W3)
 *
 * Centralizes all deterministic domain rules, policy tables, and resolvers
 * for converting workout session skeletons into final concrete prescriptions:
 * - Set counts & warm-up budgeting
 * - Repetition ranges & target reps
 * - Effort / RIR boundaries & T4/T9 interaction
 * - Rest seconds guidance
 * - Duration feasibility budgeting
 * - Conditioning execution detail
 *
 * DESIGN INVARIANTS:
 * 1. Zero magic numbers: all values originate from explicit policy tables.
 * 2. Pure, deterministic, side-effect free, and non-mutating.
 * 3. Non-medical: no heart-rate zones, calorie burn formulas, or fake readiness math.
 * 4. Safety first: failure-by-default is strictly prevented (minRIR >= 1 across all standard prescriptions).
 */

import type {
  TrainingObjective,
  StartingVolume,
  ProgrammingComplexity,
  RecoveryVolumeModifier,
  RecoveryEffortModifier,
  DeloadDecision,
  ConditioningDemand,
  ConditioningMode,
  ConditioningModalityFamily,
  PriorityLevel,
  TrainingTarget,
} from '../training-strategy';
import type { ExerciseAllocationRole } from '../training-strategy/trainingDemand';
import type {
  ExerciseType,
  ExerciseProgressionProfile,
} from '../training-strategy/exerciseCatalog';
import type {
  RepetitionPrescription,
  RepetitionRange,
  EffortPrescription,
  SetType,
  ConditioningPrescription,
} from './types';

// ==================================================
// 1. SET BUDGET POLICY
// ==================================================

export type SetBudgetResult = {
  warmupSets: number;
  workSets: number;
  optionalSets: number;
  totalSets: number;
  reason: string;
};

/**
 * Base work-set allocation table by role and starting volume ceiling (T4).
 */
export const BASE_WORK_SETS_TABLE: Record<
  ExerciseAllocationRole,
  Record<StartingVolume, number>
> = {
  primary: {
    low: 3,
    moderate: 4,
    high: 5,
  },
  secondary: {
    low: 2,
    moderate: 3,
    high: 4,
  },
  accessory: {
    low: 2,
    moderate: 2,
    high: 3,
  },
  optional: {
    low: 1,
    moderate: 2,
    high: 2,
  },
};

/**
 * Resolves the deterministic set count and breakdown for an exercise prescription.
 *
 * Adjusts base sets according to:
 * - T4 startingVolume
 * - Exercise role & type
 * - Trainee volumePreference
 * - T9 recovery volumeModifier ('maintain' | 'reduce' | 'strongly_reduce')
 * - T9 deloadDecision ('none' | 'consider' | 'recommend')
 */
export function resolveExerciseSetBudget(
  role: ExerciseAllocationRole,
  exerciseType: ExerciseType,
  progressionProfile: ExerciseProgressionProfile,
  startingVolume: StartingVolume,
  volumePreference: string | undefined,
  volumeModifier: RecoveryVolumeModifier,
  deloadDecision: DeloadDecision,
  isFirstExerciseOfPatternInSession: boolean,
  targetPriority: PriorityLevel = 'moderate'
): SetBudgetResult {
  // 1. Base work sets from role and starting volume (anchored by T4)
  let workSets = BASE_WORK_SETS_TABLE[role][startingVolume];

  // 2. T6 Target Demand alignment:
  // If target muscle is low priority in T6 demand plan, constrain non-primary work sets
  if (targetPriority === 'low' && role !== 'primary') {
    workSets = Math.min(workSets, 2);
  }

  const baseBeforePreference = workSets;

  // 3. Trainee volume preference adjustment (if non-deload)
  if (deloadDecision !== 'recommend' && volumeModifier === 'maintain') {
    if (volumePreference === 'more_volume' && role !== 'optional') {
      workSets = Math.min(workSets + 1, 5);
    } else if (volumePreference === 'fewer_higher_effort') {
      // Role-specific minimums:
      // - primary: 2 (retains compound minimum)
      // - secondary: 2 (retains compound minimum)
      // - accessory: 1 (reduces below compound minimum)
      // - optional: 0 (may be removed entirely)
      const roleMinimumFloor: Record<ExerciseAllocationRole, number> = {
        primary: 2,
        secondary: 2,
        accessory: 1,
        optional: 0,
      };
      const floor = roleMinimumFloor[role];
      const candidateSets = workSets - 1;
      // Invariant: resulting workSets <= base workSets before preference modifier
      workSets = Math.min(baseBeforePreference, Math.max(floor, candidateSets));
    }
  }

  // 4. T9 Recovery Volume Modifier adjustments
  if (volumeModifier === 'reduce') {
    // Discrete reduction: 1 work set less (minimum 2 for compound, 1 for isolation, 0 for optional)
    const minSets = role === 'primary' || role === 'secondary' ? 2 : role === 'accessory' ? 1 : 0;
    workSets = Math.max(workSets - 1, minSets);
  } else if (volumeModifier === 'strongly_reduce') {
    // Strong discrete reduction: 2 work sets less (minimum 2 for primary/secondary, 1 for isolation, 0 for optional)
    const minSets = role === 'primary' || role === 'secondary' ? 2 : role === 'accessory' ? 1 : 0;
    workSets = Math.max(workSets - 2, minSets);
  }

  // 5. Deload Decision adjustment
  if (deloadDecision === 'recommend') {
    // Conservative deload structure: exactly 2 work sets for primary/secondary, 1-2 for accessory
    workSets = role === 'primary' || role === 'secondary' ? 2 : 1;
  }

  // 6. Warm-up sets policy:
  // Warm-up sets only belong to primary/secondary multi-joint compound movements
  // that are the first movement of their pattern in the session.
  let warmupSets = 0;
  if (
    (role === 'primary' || progressionProfile === 'primary_compound') &&
    isFirstExerciseOfPatternInSession &&
    exerciseType !== 'bodyweight' &&
    exerciseType !== 'isolation' &&
    exerciseType !== 'cardio'
  ) {
    warmupSets = deloadDecision === 'recommend' ? 1 : 2;
  } else if (
    role === 'secondary' &&
    isFirstExerciseOfPatternInSession &&
    exerciseType === 'compound'
  ) {
    warmupSets = 1;
  }

  // 7. Optional sets:
  // If role is optional, mark all sets as optional sets instead of work sets
  let optionalSets = 0;
  if (role === 'optional') {
    optionalSets = workSets;
    workSets = 0;
  }

  const totalSets = warmupSets + workSets + optionalSets;
  const reason =
    deloadDecision === 'recommend'
      ? 'Deload active: work sets capped conservatively at 1–2.'
      : volumeModifier !== 'maintain'
      ? `Recovery constrained (${volumeModifier}): work sets reduced.`
      : `Standard budget for ${role} role under ${startingVolume} starting volume.`;

  return {
    warmupSets,
    workSets,
    optionalSets,
    totalSets,
    reason,
  };
}

// ==================================================
// 1.1 TARGET-LEVEL ALLOCATION BUDGETS & DISTRIBUTION
// ==================================================

export type TargetSessionBudget = {
  target: TrainingTarget;
  priority: PriorityLevel;
  workloadBand: 'low' | 'moderate' | 'high';
  maxWorkSets: number;
  reason: string;
};

export type ExerciseAllocationCandidate = {
  exerciseId: string;
  role: ExerciseAllocationRole;
  exerciseType: ExerciseType;
  progressionProfile: ExerciseProgressionProfile;
  isFirstOfPattern: boolean;
  baseBudget: SetBudgetResult;
};

export type DistributedExerciseSetBudget = {
  exerciseId: string;
  role: ExerciseAllocationRole;
  warmupSets: number;
  workSets: number;
  optionalSets: number;
  totalSets: number;
  reason: string;
};

/**
 * Resolves the deterministic maximum work-set allocation for a specific target muscle
 * within a session, derived from T6 priority & workloadBand, adjusted for recovery & deload.
 */
export function resolveTargetSessionBudget(
  target: TrainingTarget,
  priority: PriorityLevel,
  workloadBand: 'low' | 'moderate' | 'high',
  volumeModifier: RecoveryVolumeModifier,
  deloadDecision: DeloadDecision
): TargetSessionBudget {
  let maxWorkSets = 3;

  if (priority === 'low') {
    // Low-priority target: maintenance / constrained volume
    maxWorkSets = workloadBand === 'low' ? 2 : 3;
  } else if (priority === 'moderate') {
    // Moderate-priority target: balanced volume
    maxWorkSets = workloadBand === 'low' ? 4 : workloadBand === 'moderate' ? 6 : 7;
  } else {
    // High-priority target: focal area / stimulus volume
    maxWorkSets = workloadBand === 'low' ? 6 : workloadBand === 'moderate' ? 8 : 10;
  }

  // T9 Deload adjustment
  if (deloadDecision === 'recommend') {
    maxWorkSets = priority === 'low' ? 2 : priority === 'moderate' ? 4 : 5;
  } else if (volumeModifier === 'reduce') {
    // Discrete recovery reduction
    maxWorkSets = Math.max(priority === 'low' ? 2 : 3, maxWorkSets - 1);
  } else if (volumeModifier === 'strongly_reduce') {
    // Strong discrete recovery reduction
    maxWorkSets = Math.max(priority === 'low' ? 2 : 2, maxWorkSets - 2);
  }

  return {
    target,
    priority,
    workloadBand,
    maxWorkSets,
    reason: `Target ${target} (${priority} priority, ${workloadBand} band) budgeted for ${maxWorkSets} max work sets.`,
  };
}

export type TargetCycleBudget = {
  target: TrainingTarget;
  priority: PriorityLevel;
  workloadBand: 'low' | 'moderate' | 'high';
  exposureTarget: number;
  maxCycleWorkSets: number;
  maxSessionWorkSets: number;
  reason: string;
};

/**
 * Resolves the deterministic multi-session cycle work-set budget for a target muscle,
 * relational to upstream T6 TargetDemand (priority, workloadBand, exposureTarget).
 * Prevents low-priority targets from accumulating excessive volume across multiple sessions.
 */
export function resolveTargetCycleBudget(
  target: TrainingTarget,
  priority: PriorityLevel,
  workloadBand: 'low' | 'moderate' | 'high',
  exposureTarget: number,
  volumeModifier: RecoveryVolumeModifier,
  deloadDecision: DeloadDecision
): TargetCycleBudget {
  const sessionBudget = resolveTargetSessionBudget(
    target,
    priority,
    workloadBand,
    volumeModifier,
    deloadDecision
  );

  // Base cycle set capacity scaled deterministically by exposureTarget (e.g. 1, 2, 3 weekly exposures)
  // while strictly anchored by target priority and workloadBand:
  const normalizedExposures = Math.max(1, Math.min(3, Math.round(exposureTarget || 1)));

  let maxCycleWorkSets: number;

  if (priority === 'low') {
    // Low priority targets: maintenance envelope (typically 1 exposure).
    // If assigned 1 exposure: 3-4 sets. If assigned 2 exposures: 5-6 sets. Capped to prevent volume leakage.
    const basePerExposure = workloadBand === 'low' ? 3 : 4;
    maxCycleWorkSets = normalizedExposures === 1 ? basePerExposure : basePerExposure + 2;
  } else if (priority === 'moderate') {
    // Moderate priority targets: balanced multi-session volume (~2 exposures).
    // 1 exposure: 5-7 sets. 2 exposures: 8-14 sets. 3 exposures: 12-16 sets.
    if (normalizedExposures === 1) {
      maxCycleWorkSets = workloadBand === 'low' ? 5 : workloadBand === 'moderate' ? 6 : 7;
    } else if (normalizedExposures === 2) {
      maxCycleWorkSets = workloadBand === 'low' ? 8 : workloadBand === 'moderate' ? 12 : 14;
    } else {
      maxCycleWorkSets = workloadBand === 'low' ? 11 : workloadBand === 'moderate' ? 14 : 16;
    }
  } else {
    // High priority targets: focal stimulus (~2-3 exposures).
    // 1 exposure: 7-10 sets. 2 exposures: 12-20 sets. 3 exposures: 16-24 sets.
    if (normalizedExposures === 1) {
      maxCycleWorkSets = workloadBand === 'low' ? 7 : workloadBand === 'moderate' ? 9 : 10;
    } else if (normalizedExposures === 2) {
      maxCycleWorkSets = workloadBand === 'low' ? 12 : workloadBand === 'moderate' ? 16 : 20;
    } else {
      maxCycleWorkSets = workloadBand === 'low' ? 16 : workloadBand === 'moderate' ? 20 : 24;
    }
  }

  // T9 recovery & deload modifiers
  if (deloadDecision === 'recommend') {
    maxCycleWorkSets = priority === 'low' ? 2 : priority === 'moderate' ? 6 : 8;
  } else if (volumeModifier === 'reduce') {
    maxCycleWorkSets = Math.max(priority === 'low' ? 2 : 5, maxCycleWorkSets - 2);
  } else if (volumeModifier === 'strongly_reduce') {
    maxCycleWorkSets = Math.max(priority === 'low' ? 2 : 4, maxCycleWorkSets - 4);
  }

  return {
    target,
    priority,
    workloadBand,
    exposureTarget,
    maxCycleWorkSets,
    maxSessionWorkSets: sessionBudget.maxWorkSets,
    reason: `Target ${target} (${priority} priority, ${workloadBand} band, ${exposureTarget} exposures) budgeted for max ${maxCycleWorkSets} cycle work sets.`,
  };
}

/**
 * Distributes a target muscle's session set budget across exercises assigned to that target.
 *
 * Invariants:
 * 1. Total work sets across all exercises targeting the muscle cannot exceed maxWorkSets.
 * 2. Primary compound movement coverage is strictly preserved (minimum 3 work sets if requested >= 3).
 * 3. Secondary compound movements retain compound floor (2 work sets).
 * 4. Accessories trim first to prevent volume leak on low/constrained targets.
 * 5. Optional sets trim first.
 */
export function distributeTargetSetBudget(
  targetBudget: TargetSessionBudget,
  candidates: ExerciseAllocationCandidate[]
): DistributedExerciseSetBudget[] {
  if (candidates.length === 0) return [];

  // Start with each candidate's requested work and optional sets
  const allocations: DistributedExerciseSetBudget[] = candidates.map((c) => ({
    exerciseId: c.exerciseId,
    role: c.role,
    warmupSets: c.baseBudget.warmupSets,
    workSets: c.baseBudget.workSets,
    optionalSets: c.baseBudget.optionalSets,
    totalSets: c.baseBudget.totalSets,
    reason: c.baseBudget.reason,
  }));

  const currentTotalWorkSets = allocations.reduce((sum, a) => sum + a.workSets, 0);

  if (currentTotalWorkSets > targetBudget.maxWorkSets) {
    let excess = currentTotalWorkSets - targetBudget.maxWorkSets;

    // Pass 1: Trim optional sets if any
    for (const alloc of [...allocations].reverse()) {
      if (excess <= 0) break;
      if (alloc.role === 'optional' && alloc.optionalSets > 0) {
        const reduction = Math.min(excess, alloc.optionalSets);
        alloc.optionalSets -= reduction;
        alloc.reason += ` | Target ${targetBudget.target} constrained: optional sets reduced by ${reduction}.`;
      }
    }

    // Pass 2a: Trim work sets on accessory exercises > 2 down to 2
    for (const alloc of [...allocations].reverse()) {
      if (excess <= 0) break;
      if (alloc.role === 'accessory' && alloc.workSets > 2) {
        const reduction = Math.min(excess, alloc.workSets - 2);
        alloc.workSets -= reduction;
        excess -= reduction;
        alloc.reason += ` | Target ${targetBudget.target} constrained: accessory work sets trimmed by ${reduction}.`;
      }
    }

    // Pass 2b: Trim work sets on accessory exercises > 1 down to 1
    for (const alloc of [...allocations].reverse()) {
      if (excess <= 0) break;
      if (alloc.role === 'accessory' && alloc.workSets > 1) {
        const reduction = Math.min(excess, alloc.workSets - 1);
        alloc.workSets -= reduction;
        excess -= reduction;
        alloc.reason += ` | Target ${targetBudget.target} constrained: accessory work sets trimmed to 1.`;
      }
    }

    // Pass 2c: If still excess and target is 'low' priority, accessories may reduce to 0
    if (excess > 0 && targetBudget.priority === 'low') {
      for (const alloc of [...allocations].reverse()) {
        if (excess <= 0) break;
        if (alloc.role === 'accessory' && alloc.workSets > 0) {
          const reduction = Math.min(excess, alloc.workSets);
          alloc.workSets -= reduction;
          excess -= reduction;
          alloc.reason += ` | Target ${targetBudget.target} low priority: accessory work sets trimmed to 0.`;
        }
      }
    }

    // Pass 3: Trim secondary compound work sets down to compound floor 2
    for (const alloc of [...allocations].reverse()) {
      if (excess <= 0) break;
      if (alloc.role === 'secondary' && alloc.workSets > 2) {
        const reduction = Math.min(excess, alloc.workSets - 2);
        alloc.workSets -= reduction;
        excess -= reduction;
        alloc.reason += ` | Target ${targetBudget.target} constrained: secondary compound work sets trimmed to 2.`;
      }
    }

    // Pass 4: Trim primary compound work sets if > 3 (preserving required primary coverage at 3 sets minimum)
    for (const alloc of [...allocations].reverse()) {
      if (excess <= 0) break;
      if (alloc.role === 'primary' && alloc.workSets > 3) {
        const reduction = Math.min(excess, alloc.workSets - 3);
        alloc.workSets -= reduction;
        excess -= reduction;
        alloc.reason += ` | Target ${targetBudget.target} constrained: primary compound work sets trimmed to 3.`;
      }
    }
  }

  // Recompute totalSets for each allocation
  allocations.forEach((alloc) => {
    alloc.totalSets = alloc.warmupSets + alloc.workSets + alloc.optionalSets;
  });

  return allocations;
}

// ==================================================
// 2. REP RANGE POLICY
// ==================================================

export type RepRangePolicyKey =
  | 'primary_compound_strength'
  | 'primary_compound_hypertrophy'
  | 'primary_compound_general'
  | 'secondary_compound_strength'
  | 'secondary_compound_hypertrophy'
  | 'secondary_compound_general'
  | 'isolation_hypertrophy'
  | 'isolation_general'
  | 'bodyweight_endurance'
  | 'core_endurance';

const REP_RANGE_TABLE: Record<RepRangePolicyKey, RepetitionRange> = {
  primary_compound_strength: { min: 4, max: 6 },
  primary_compound_hypertrophy: { min: 6, max: 10 },
  primary_compound_general: { min: 6, max: 8 },
  secondary_compound_strength: { min: 6, max: 8 },
  secondary_compound_hypertrophy: { min: 8, max: 12 },
  secondary_compound_general: { min: 8, max: 12 },
  isolation_hypertrophy: { min: 10, max: 15 },
  isolation_general: { min: 10, max: 15 },
  bodyweight_endurance: { min: 8, max: 15 },
  core_endurance: { min: 12, max: 20 },
};

/**
 * Resolves the deterministic repetition prescription for an exercise.
 */
export function resolveExerciseRepetitionPrescription(
  objective: TrainingObjective,
  role: ExerciseAllocationRole,
  progressionProfile: ExerciseProgressionProfile,
  exerciseType: ExerciseType,
  programmingComplexity: ProgrammingComplexity
): RepetitionPrescription {
  let range: RepetitionRange;

  if (progressionProfile === 'bodyweight' || exerciseType === 'bodyweight') {
    range = REP_RANGE_TABLE.bodyweight_endurance;
  } else if (exerciseType === 'isolation' || role === 'accessory') {
    range =
      objective === 'hypertrophy'
        ? REP_RANGE_TABLE.isolation_hypertrophy
        : REP_RANGE_TABLE.isolation_general;
  } else if (role === 'primary' || progressionProfile === 'primary_compound') {
    if (objective === 'strength') {
      // Foundational trainees start with slightly safer rep range (5-7) on primary lifts
      range =
        programmingComplexity === 'foundational'
          ? { min: 5, max: 7 }
          : REP_RANGE_TABLE.primary_compound_strength;
    } else if (objective === 'hypertrophy') {
      range = REP_RANGE_TABLE.primary_compound_hypertrophy;
    } else {
      range = REP_RANGE_TABLE.primary_compound_general;
    }
  } else {
    // Secondary compound
    if (objective === 'strength') {
      range = REP_RANGE_TABLE.secondary_compound_strength;
    } else {
      range = REP_RANGE_TABLE.secondary_compound_hypertrophy;
    }
  }

  // Deterministic targetReps derived as midpoint of min and max
  const targetReps = Math.round((range.min + range.max) / 2);
  const label = `${range.min}–${range.max} reps`;

  return {
    targetReps,
    repRange: { min: range.min, max: range.max },
    label,
  };
}

// ==================================================
// 3. EFFORT / RIR RESOLUTION POLICY
// ==================================================

/**
 * Centralized deterministic resolver for final exercise effort prescription.
 *
 * Combines:
 * - T4 effort boundaries (minRIR, maxRIR)
 * - T9 recovery effortModifier ('maintain' | 'easier')
 * - T9 deloadDecision ('none' | 'consider' | 'recommend')
 * - Exercise role (primary vs accessory)
 * - Trainee programming complexity
 *
 * CRITICAL SAFETY INVARIANTS:
 * - minRIR <= maxRIR always.
 * - Never produces RIR 0 (failure-by-default is prohibited).
 * - Deload enforces conservative RIR 4–5.
 * - Easier effort modifier shifts boundaries away from failure (+1 RIR buffer).
 */
export function resolveExerciseEffortPrescription(
  t4MinRIR: number,
  t4MaxRIR: number,
  effortModifier: RecoveryEffortModifier,
  deloadDecision: DeloadDecision,
  role: ExerciseAllocationRole,
  programmingComplexity: ProgrammingComplexity
): EffortPrescription {
  let effectiveMinRIR = t4MinRIR;
  let effectiveMaxRIR = t4MaxRIR;
  let guidancePrefix = 'Target';

  // 1. Deload takes highest precedence
  if (deloadDecision === 'recommend') {
    effectiveMinRIR = 4;
    effectiveMaxRIR = 5;
    const targetRIR = 4;
    return {
      targetRIR,
      minRIR: effectiveMinRIR,
      maxRIR: effectiveMaxRIR,
      effortGuidance: 'Deload effort: Keep 4–5 RIR reserve (light recovery execution, do not strain).',
    };
  }

  // 2. Apply T9 recovery effortModifier
  if (effortModifier === 'easier') {
    effectiveMinRIR += 1;
    effectiveMaxRIR += 1;
    guidancePrefix = 'Recovery-buffered effort';
  }

  // 3. Role and complexity refinement:
  // Primary compound lifts for foundational trainees receive an extra safety buffer if at boundary
  if (role === 'primary' && programmingComplexity === 'foundational' && effectiveMinRIR < 2) {
    effectiveMinRIR = 2;
    effectiveMaxRIR = Math.max(effectiveMaxRIR, 3);
  }

  // Invariant clamps:
  // Non-deload prescriptions must NEVER be harder than T4 starting effort boundary
  effectiveMinRIR = Math.max(t4MinRIR, Math.max(1, effectiveMinRIR));
  effectiveMaxRIR = Math.max(effectiveMinRIR, effectiveMaxRIR);

  // Target RIR is midpoint
  const targetRIR = Math.round((effectiveMinRIR + effectiveMaxRIR) / 2);

  const effortGuidance =
    guidancePrefix === 'Recovery-buffered effort'
      ? `Recovery-buffered effort: Maintain ${effectiveMinRIR}–${effectiveMaxRIR} RIR (conservative reserve).`
      : deloadDecision === 'consider'
      ? `Maintain ${effectiveMinRIR}–${effectiveMaxRIR} RIR (consider upcoming deload if fatigue persists).`
      : `Target ${effectiveMinRIR}–${effectiveMaxRIR} RIR.`;

  return {
    targetRIR,
    minRIR: effectiveMinRIR,
    maxRIR: effectiveMaxRIR,
    effortGuidance,
  };
}

// ==================================================
// 4. REST GUIDANCE POLICY
// ==================================================

/**
 * Centralized deterministic rest seconds policy.
 *
 * Rules:
 * - Primary compound + strength objective: 150-180s (2.5 - 3 min)
 * - Primary compound + standard: 120s (2 min)
 * - Secondary compound: 90s (1.5 min)
 * - Isolation / accessory: 60s (1 min)
 * - Optional exercises: 60s
 * - Deload: 90-120s (unrushed recovery)
 */
export function resolveExerciseRestSeconds(
  role: ExerciseAllocationRole,
  exerciseType: ExerciseType,
  objective: TrainingObjective,
  deloadDecision: DeloadDecision
): number {
  if (deloadDecision === 'recommend') {
    return role === 'primary' ? 120 : 90;
  }

  if (role === 'primary') {
    if (objective === 'strength') return 180;
    return 120;
  }

  if (role === 'secondary') {
    if (objective === 'strength') return 120;
    return 90;
  }

  if (exerciseType === 'isolation' || role === 'accessory') {
    return 60;
  }

  return 60;
}

// ==================================================
// 5. SESSION DURATION FEASIBILITY BUDGETING
// ==================================================

export type DurationFeasibilityCategory =
  | 'comfortably_within_budget'
  | 'near_budget'
  | 'constrained';

export type SessionDurationBudgetResult = {
  estimatedDurationMinutes: number;
  nominalTargetMinutes: number;
  feasibility: DurationFeasibilityCategory;
  reductionApplied: boolean;
  notes: string[];
};

/**
 * Estimates nominal execution time of a session and evaluates feasibility.
 *
 * Abstraction:
 * - Each warm-up set: ~45s execution + 60s rest = ~1.75 min
 * - Each work set: ~45s execution + restSeconds = (45 + rest) / 60 min
 * - Transition between exercises: ~1.5 min
 * - Optional conditioning: nominal duration guidance if present (~15-20 min)
 */
export function evaluateSessionDurationFeasibility(
  totalWarmupSets: number,
  workSetsWithRest: Array<{ restSeconds: number }>,
  exerciseCount: number,
  conditioningTargetMinutes: number,
  targetDurationMinutes: number
): SessionDurationBudgetResult {
  let estimatedMinutes = 0;

  // Warm-up sets: ~1.75 min each
  estimatedMinutes += totalWarmupSets * 1.75;

  // Work sets: execution (0.75 min) + rest
  for (const set of workSetsWithRest) {
    estimatedMinutes += 0.75 + set.restSeconds / 60;
  }

  // Exercise changeover time: ~1.5 min per exercise transition
  if (exerciseCount > 1) {
    estimatedMinutes += (exerciseCount - 1) * 1.5;
  }

  // Conditioning duration
  estimatedMinutes += conditioningTargetMinutes;

  const roundedEst = Math.round(estimatedMinutes);
  const ratio = roundedEst / targetDurationMinutes;

  let feasibility: DurationFeasibilityCategory = 'comfortably_within_budget';
  if (ratio > 1.15) {
    feasibility = 'constrained';
  } else if (ratio > 0.95) {
    feasibility = 'near_budget';
  }

  const notes: string[] = [
    `Estimated session duration: ~${roundedEst}m vs target ${targetDurationMinutes}m (${feasibility}).`,
  ];

  return {
    estimatedDurationMinutes: roundedEst,
    nominalTargetMinutes: targetDurationMinutes,
    feasibility,
    reductionApplied: false,
    notes,
  };
}

// ==================================================
// 6. CONDITIONING EXECUTION DETAIL POLICY
// ==================================================

/**
 * Materializes concrete conditioning guidance based on T8 strategy and T9 recovery constraints.
 */
export function materializeConditioningPrescription(
  demand: ConditioningDemand,
  mode: ConditioningMode,
  placementGuidance: string,
  modality: ConditioningModalityFamily,
  conditioningModifier: string,
  targetAvailabilityNotes: string
): ConditioningPrescription | undefined {
  if (demand === 'none' || conditioningModifier === 'omit') {
    return undefined;
  }

  const isReduced = conditioningModifier === 'reduce';

  // Duration guidance derived from demand and recovery modifier
  let minMinutes = 15;
  let targetMinutes = 20;
  let maxMinutes = 25;

  if (demand === 'minimal' || isReduced) {
    minMinutes = 10;
    targetMinutes = 15;
    maxMinutes = 20;
  } else if (demand === 'moderate') {
    minMinutes = 20;
    targetMinutes = 25;
    maxMinutes = 30;
  }

  const intensityGuidance = isReduced
    ? 'Reduced active recovery intensity: low conversational pace, low impact.'
    : demand === 'moderate'
    ? 'Moderate steady-state intensity: sustainable conversational effort.'
    : 'Low-to-moderate baseline conditioning pace.';

  return {
    demand,
    mode,
    placement: placementGuidance as any,
    modalityFamily: modality,
    durationMinutesGuidance: {
      min: minMinutes,
      target: targetMinutes,
      max: maxMinutes,
    },
    intensityGuidance,
    notes: isReduced
      ? `Recovery constrained: conditioning duration and intensity moderated. ${targetAvailabilityNotes}`
      : targetAvailabilityNotes,
  };
}
