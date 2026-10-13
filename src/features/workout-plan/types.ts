/**
 * Workout Plan Generator Contracts (Stage W1)
 *
 * Defines the strongly-typed contracts and interfaces for the Workout Plan Generator.
 * The generator consumes an upstream TrainingStrategy (v1) and converts it into a
 * versioned, executable WorkoutPlan (v1).
 *
 * DESIGN INVARIANTS:
 * 1. Upstream Strategy Separation:
 *    - TrainingStrategy (v1) is an authoritative, immutable upstream input.
 *    - The generator materializes concrete sessions without redefining upstream strategy.
 * 2. Generator Ownership:
 *    - Owns concrete sessions, exercise ordering, set counts, rep ranges, effort guidance,
 *      rest guidance, and conditioning placement.
 *    - Does NOT own goals, split selection, target frequency, programming complexity,
 *      recovery assessment, progression policies, or nutrition.
 * 3. Qualitative Recovery Handoff:
 *    - Consumes T9 qualitative modifiers (volumeModifier, effortModifier, conditioningModifier,
 *      frequencyModifier, deloadDecision) without inventing premature numeric formulas.
 * 4. Population Safety:
 *    - Adult (ages 18-100): produces valid WorkoutPlan (v1).
 *    - Youth (ages 13-17) and Ineligible: strictly barred from receiving adult WorkoutPlan.
 * 5. Purity & Immutability:
 *    - Pure, deterministic, side-effect free, zero external dependencies.
 */

import type {
  TrainingObjective,
  ObjectiveSource,
  SplitFamily,
  ProgrammingComplexity,
  ScheduleStructure,
  TrainingTarget,
  MovementPattern,
  ProgressionMethod,
  ConditioningDemand,
  ConditioningMode,
  ConditioningModalityFamily,
  SessionPlacementGuidance,
  RecoveryConstraintLevel,
  RecoveryVolumeModifier,
  RecoveryEffortModifier,
  RecoveryConditioningModifier,
  RecoveryFrequencyModifier,
  DeloadDecision,
  TrainingStrategy,
} from '../training-strategy';
import type { ExerciseAllocationRole } from '../training-strategy/trainingDemand';

// ==================================================
// SET & REPETITION PRESCRIPTION CONTRACTS
// ==================================================

export type SetType = 'warmup' | 'work' | 'cooldown' | 'optional';

export type RepetitionRange = {
  min: number;
  max: number;
};

export type RepetitionPrescription = {
  targetReps?: number;
  repRange?: RepetitionRange;
  label: string;
};

export type EffortPrescription = {
  targetRIR: number;
  minRIR: number;
  maxRIR: number;
  effortGuidance: string;
};

export type SetPrescription = {
  setIndex: number;
  setType: SetType;
  targetReps?: number;
  repRange?: RepetitionRange;
  targetRIR?: number;
  restSeconds?: number;
};

// ==================================================
// EXERCISE PRESCRIPTION CONTRACTS
// ==================================================

export type ExercisePrescription = {
  exerciseId: string;
  exerciseName: string;
  role: ExerciseAllocationRole;
  movementPattern: MovementPattern;
  targetMuscles: TrainingTarget[];
  sets: SetPrescription[];
  repetitionPrescription: RepetitionPrescription;
  effortPrescription: EffortPrescription;
  restSeconds: number;
  progressionMethod: ProgressionMethod;
  substitutionExerciseIds: string[];
  notes?: string;
};

// ==================================================
// CONDITIONING PRESCRIPTION CONTRACTS
// ==================================================

export type ConditioningPrescription = {
  demand: ConditioningDemand;
  mode: ConditioningMode;
  placement: SessionPlacementGuidance;
  modalityFamily: ConditioningModalityFamily;
  durationMinutesGuidance?: {
    min: number;
    target: number;
    max: number;
  };
  intensityGuidance: string;
  notes?: string;
};

// ==================================================
// WORKOUT SESSION CONTRACTS
// ==================================================

export type WorkoutSession = {
  sessionId: string;
  sequenceIndex: number;
  sessionName: string;
  focusAreas: TrainingTarget[];
  primaryMovementPatterns: MovementPattern[];
  targetDurationMinutes: number;
  exercises: ExercisePrescription[];
  conditioning?: ConditioningPrescription;
  sessionNotes: string[];
};

// ==================================================
// RECOVERY CONTEXT CONTRACT
// ==================================================

export type WorkoutPlanRecoveryContext = {
  level: RecoveryConstraintLevel;
  volumeModifier: RecoveryVolumeModifier;
  effortModifier: RecoveryEffortModifier;
  conditioningModifier: RecoveryConditioningModifier;
  frequencyModifier: RecoveryFrequencyModifier;
  deloadDecision: DeloadDecision;
  activeConstraintsSummary: string[];
};

// ==================================================
// TOP-LEVEL WORKOUT PLAN (v1)
// ==================================================

export type WorkoutPlan = {
  schemaVersion: 1;
  population: 'adult';
  sourceStrategyVersion: 1;

  objective: {
    primary: TrainingObjective;
    source: ObjectiveSource;
  };

  structure: {
    splitFamily: SplitFamily;
    programmingComplexity: ProgrammingComplexity;
    sessionsPerCycle: number;
    targetDaysPerWeek: number;
    scheduleMode: ScheduleStructure;
  };

  recoveryContext: WorkoutPlanRecoveryContext;

  sessions: WorkoutSession[];

  generationMetadata: {
    generatedAtTimestamp: number;
    generatorVersion: '1.0.0';
    generationStage?: 'skeleton' | 'prescribed';
    durationFeasibility?: 'comfortably_within_budget' | 'near_budget' | 'constrained';
    deterministicSeed?: string;
    totalExercisesPrescribed: number;
    totalSetsPrescribed: number;
  };

  decisionTrace: string[];
};

// ==================================================
// VALIDATION & HANDOFF CONTRACTS
// ==================================================

export type WorkoutPlanValidationError = {
  field: string;
  message: string;
};

export type WorkoutPlanValidationResult = {
  valid: boolean;
  errors: WorkoutPlanValidationError[];
  warnings: string[];
};

export type WorkoutPlanHandoffResult =
  | {
      status: 'ready';
      population: 'adult';
      strategy: TrainingStrategy;
      plan: WorkoutPlan;
      decisionTrace: string[];
    }
  | {
      status: 'pending';
      population: 'youth';
      path: 'youth_strategy_pending';
      message: string;
      decisionTrace: string[];
    }
  | {
      status: 'ineligible';
      reason: string;
      decisionTrace: string[];
    };
