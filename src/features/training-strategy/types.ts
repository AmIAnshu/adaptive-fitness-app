/**
 * Training Strategy Engine Contracts
 *
 * Defines the strongly-typed contracts and interfaces for the deterministic
 * Training Strategy Engine. The engine transforms a CanonicalUserProfile into
 * a high-level TrainingStrategy through sequential resolution stages (T1-T10).
 *
 * DESIGN INVARIANTS:
 * 1. Same CanonicalUserProfile + same rules/database + same engine version
 *    produces deterministic results.
 * 2. Preferences never override hard constraints.
 * 3. "Avoid" exercises are hard exclusions; "favorites" and "dislikes" are soft preferences.
 * 4. TrainingStrategy contains NO calories, macros, meal plans, exact workout UI objects,
 *    exact sets/reps per exercise, AI-generated explanations, or fake readiness/recovery scores.
 * 5. Recovery is represented as interpretable constraints, not numeric readiness scores.
 * 6. The strategy layer describes what the workout generator should accomplish,
 *    not the final exercise session instances.
 */

import type {
  CanonicalUserProfile,
  SleepDuration,
  WorkoutRecovery,
} from '../profile';

export type { CanonicalUserProfile, SleepDuration, WorkoutRecovery };

// ==================================================
// T1 — GOAL RESOLUTION
// ==================================================

export type TrainingObjective =
  | 'hypertrophy'
  | 'fat_loss_support'
  | 'body_composition'
  | 'strength'
  | 'general_fitness';

export type ObjectiveSource =
  | 'explicit'
  | 'inferred_from_preferences'
  | 'safe_default';

export type PriorityLevel = 'high' | 'moderate' | 'low';

export type ResolvedObjective = {
  primary: TrainingObjective;
  source: ObjectiveSource;
  resistancePriority: 'high' | 'moderate';
  conditioningPriority: PriorityLevel;
  performancePriority: PriorityLevel;
  decisionTrace: string[];
};

// ==================================================
// T2 — FREQUENCY RESOLUTION
// ==================================================

export type ScheduleStructure =
  | 'fixed_split'
  | 'hybrid'
  | 'flexible_sequence';

export type FrequencyResolution = {
  targetDays: number;
  minimumViableDays: number;
  availableDayCount: number;
  structureMode: ScheduleStructure;
  decisionTrace: string[];
};

// ==================================================
// T3 — TRAINING STRUCTURE
// ==================================================

export type ProgrammingComplexity =
  | 'foundational'
  | 'standard'
  | 'advanced';

export type SplitFamily =
  | 'full_body'
  | 'upper_lower'
  | 'ppl'
  | 'hybrid'
  | 'specialization';

export type TrainingStructure = {
  splitFamily: SplitFamily;
  sessionsPerCycle: number;
  programmingComplexity: ProgrammingComplexity;
  decisionTrace: string[];
};

// ==================================================
// T4 — STARTING VOLUME & EFFORT
// ==================================================

export type StartingVolume =
  | 'low'
  | 'moderate'
  | 'high';

export type EffortStrategy = {
  minRIR: number;
  maxRIR: number;
};

export type TrainingLoadStrategy = {
  startingVolume: StartingVolume;
  effort: EffortStrategy;
  volumeReason: string[];
  effortReason: string[];
  decisionTrace: string[];
};

// ==================================================
// T5 — EXERCISE SELECTION
// ==================================================

export type ExerciseSelectionReason =
  | 'required_for_coverage'
  | 'equipment_compatible'
  | 'goal_compatible'
  | 'experience_appropriate'
  | 'favorite'
  | 'time_efficient'
  | 'variety';

export type ExerciseCandidate = {
  exerciseId: string;
  priority: number;
  reasons: ExerciseSelectionReason[];
};

export type ExerciseSelectionStrategy = {
  candidates: ExerciseCandidate[];
  excludedExerciseIds: string[];
  exclusionReasons: Record<string, string[]>;
  decisionTrace: string[];
};

// ==================================================
// T6 — TRAINING DEMAND & ALLOCATION
// ==================================================

export type TrainingTarget =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'conditioning';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'lunge'
  | 'carry'
  | 'core'
  | 'conditioning';

export type TargetDemand = {
  target: TrainingTarget;
  priority: PriorityLevel;
  exposureTarget: number;
  workloadBand: 'low' | 'moderate' | 'high';
};

export type SessionDemand = {
  sessionIndex: number;
  focusAreas: TrainingTarget[];
  movementRequirements: MovementPattern[];
  exerciseSlotRange: {
    min: number;
    target: number;
    max: number;
  };
};

export type TrainingDemandPlan = {
  weeklyTargets: TargetDemand[];
  sessions: SessionDemand[];
  minimumViableSessions: number;
  targetSessions: number;
  decisionTrace: string[];
};

// ==================================================
// T7 — PROGRESSION STRATEGY
// ==================================================

export type ProgressionMethod =
  | 'double_progression'
  | 'load_progression'
  | 'performance_progression'
  | 'conservative_progression';

export type ProgressionStrategy = {
  method: ProgressionMethod;

  performanceCriteria: {
    requiresTargetReps: boolean;
    requiresEffortWithinRange: boolean;
    requiredSuccessfulExposures: number;
  };

  decisions: {
    progress: string;
    maintain: string;
    regress: string;
  };

  stallPolicy: {
    detectionWindow: number;
    enabled: boolean;
  };

  decisionTrace: string[];
};

// ==================================================
// T8 — CONDITIONING STRATEGY
// ==================================================

export type ConditioningPriority = PriorityLevel;

export type ConditioningDemand = 'none' | 'minimal' | 'moderate';

export type ConditioningMode =
  | 'none'
  | 'optional'
  | 'integrated'
  | 'dedicated';

export type ConditioningModalityFamily =
  | 'steady_state'
  | 'intervals'
  | 'mixed_conditioning'
  | 'recreational_activity'
  | 'walking_low_intensity';

export type ResistanceProtection = 'high' | 'moderate';

export type InterferenceSensitivity = 'high' | 'moderate' | 'low';

export type SessionPlacementGuidance =
  | 'post_resistance'
  | 'separate_session'
  | 'flexible'
  | 'none';

export type MinimumViableFallback =
  | 'prioritize_resistance_omit_conditioning'
  | 'prioritize_resistance_reduce_conditioning'
  | 'maintain_integrated_conditioning';

export type ConditioningFrequencyRelationship = {
  targetAvailabilityGuidance: string;
  minimumViableFallback: MinimumViableFallback;
  fallbackGuidance: string;
};

export type ConditioningStrategy = {
  priority: ConditioningPriority;
  demand: ConditioningDemand;
  mode: ConditioningMode;
  preferredModalityFamilies: ConditioningModalityFamily[];
  optionalModalityAlternatives: ConditioningModalityFamily[];
  interferenceConsiderations: {
    resistanceProtection: ResistanceProtection;
    interferenceSensitivity: InterferenceSensitivity;
    rationale: string;
  };
  frequencyRelationship: ConditioningFrequencyRelationship;
  placement: {
    guidance: SessionPlacementGuidance;
    rationale: string;
  };
  decisionTrace: string[];
};

// ==================================================
// T9 — RECOVERY CONSTRAINTS
// ==================================================

export type RecoveryConstraintLevel =
  | 'stable'
  | 'mildly_constrained'
  | 'constrained'
  | 'strongly_constrained';

export type RecoveryVolumeModifier =
  | 'maintain'
  | 'reduce'
  | 'strongly_reduce';

export type RecoveryEffortModifier =
  | 'maintain'
  | 'easier';

export type RecoveryConditioningModifier =
  | 'maintain'
  | 'reduce'
  | 'omit';

export type RecoveryFrequencyModifier =
  | 'maintain'
  | 'reduce';

export type DeloadDecision =
  | 'none'
  | 'consider'
  | 'recommend';

export type SorenessLevel = 'none' | 'mild' | 'moderate' | 'severe';

export type RecoveryEvidenceCategory =
  | 'isolated_signal'
  | 'converging_current_signals'
  | 'repeated_history_evidence'
  | 'persistent_multi_signal_history';

export type RecoveryRuntimeState = {
  sleepDuration?: SleepDuration;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  workoutRecovery?: WorkoutRecovery;
  sorenessLevel?: SorenessLevel;
  recentMissedSessionsCount?: number;
  recentDegradedSessionsCount?: number;
  consecutiveUnderRecoveredSessions?: number;
  accumulatedFatigueCycles?: number;
  performanceRegressionObserved?: boolean;
  previousConstraintLevel?: RecoveryConstraintLevel;
};

export type RecoveryConstraints = {
  level: RecoveryConstraintLevel;
  volumeModifier: RecoveryVolumeModifier;
  effortModifier: RecoveryEffortModifier;
  conditioningModifier: RecoveryConditioningModifier;
  frequencyModifier: RecoveryFrequencyModifier;
  deloadDecision: DeloadDecision;
  reasons: string[];
  decisionTrace: string[];
};

import type { ComprehensiveTrainingDemandAllocation } from './trainingDemand';
import type { ComprehensiveProgressionStrategy } from './progressionStrategy';

// ==================================================
// T10 — FINAL TRAINING STRATEGY
// ==================================================

export type TrainingStrategy = {
  schemaVersion: 1;
  population: 'adult';

  objective: ResolvedObjective;
  frequency: FrequencyResolution;
  structure: TrainingStructure;
  trainingLoad: TrainingLoadStrategy;
  exerciseSelection: ExerciseSelectionStrategy;
  trainingDemand: ComprehensiveTrainingDemandAllocation;
  progression: ComprehensiveProgressionStrategy;
  conditioning: ConditioningStrategy;
  recoveryConstraints: RecoveryConstraints;

  decisionTrace: string[];
};

export type TrainingStrategyValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
