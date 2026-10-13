/**
 * Stage T10 — Strategy Assembly
 *
 * Deterministically assembles already-resolved stage outputs T1–T9 into a single
 * coherent TrainingStrategy (v1) object for downstream consumption.
 *
 * ARCHITECTURAL ROLE:
 * - T10 is strictly an ASSEMBLY layer, NOT a decision engine and NOT a workout generator.
 * - Does NOT generate workout sessions, exact sets, reps, loads, weights, or RIR values.
 * - Does NOT assign workouts to fixed calendar weekdays.
 * - Does NOT compute calories, macros, or nutritional targets.
 * - Does NOT calculate numeric readiness or recovery scores (e.g. 0-100).
 * - Preserves baseline decisions (T4 starting load guardrails, T8 baseline conditioning intent)
 *   alongside ongoing runtime recovery constraints (T9).
 * - Preserves qualitative recovery modifier semantics (volume, effort, conditioning,
 *   frequency, deload) without inventing ad-hoc numeric reductions.
 *
 * POPULATION SAFETY:
 * - Adult (ages 18-100): Validated adult pipeline results assemble into TrainingStrategy (v1).
 * - Youth (ages 13-17): Strictly stops at youth_strategy_pending; adult T1-T10 execution is barred.
 * - Ineligible (<13 or >100): Blocked at boundary.
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, side-effect free, and non-mutating.
 * 2. Inputs are preserved with zero mutation.
 * 3. Aggregates a transparent, end-to-end decision trace.
 */

import type {
  ResolvedObjective,
  FrequencyResolution,
  TrainingStructure,
  TrainingLoadStrategy,
  ExerciseSelectionStrategy,
  ConditioningStrategy,
  RecoveryConstraints,
  TrainingStrategy,
  TrainingStrategyValidationResult,
} from './types';
import type { ComprehensiveTrainingDemandAllocation } from './trainingDemand';
import type { ComprehensiveProgressionStrategy } from './progressionStrategy';

export type AssembleTrainingStrategyInput = {
  objective: ResolvedObjective;
  frequency: FrequencyResolution;
  structure: TrainingStructure;
  trainingLoad: TrainingLoadStrategy;
  exerciseSelection: ExerciseSelectionStrategy;
  trainingDemand: ComprehensiveTrainingDemandAllocation;
  progression: ComprehensiveProgressionStrategy;
  conditioning: ConditioningStrategy;
  recoveryConstraints: RecoveryConstraints;
  decisionTrace?: readonly string[];
};

/**
 * Assembles resolved T1–T9 stages into one coherent TrainingStrategy (v1).
 *
 * @param input - Resolved stage outputs T1 through T9 and optional prior decision trace
 * @returns Fully assembled TrainingStrategy (v1)
 */
export function assembleTrainingStrategy(
  input: AssembleTrainingStrategyInput
): TrainingStrategy {
  if (!input || typeof input !== 'object') {
    throw new TypeError('assembleTrainingStrategy: input must be a non-null object.');
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
    decisionTrace,
  } = input;

  if (!objective) throw new Error('assembleTrainingStrategy: objective (T1) is required.');
  if (!frequency) throw new Error('assembleTrainingStrategy: frequency (T2) is required.');
  if (!structure) throw new Error('assembleTrainingStrategy: structure (T3) is required.');
  if (!trainingLoad) throw new Error('assembleTrainingStrategy: trainingLoad (T4) is required.');
  if (!exerciseSelection) throw new Error('assembleTrainingStrategy: exerciseSelection (T5) is required.');
  if (!trainingDemand) throw new Error('assembleTrainingStrategy: trainingDemand (T6) is required.');
  if (!progression) throw new Error('assembleTrainingStrategy: progression (T7) is required.');
  if (!conditioning) throw new Error('assembleTrainingStrategy: conditioning (T8) is required.');
  if (!recoveryConstraints) throw new Error('assembleTrainingStrategy: recoveryConstraints (T9) is required.');

  const aggregatedTrace: string[] = [
    ...(decisionTrace ?? []),
    `T10 Strategy Assembly: Coherent TrainingStrategy (v1) assembled for adult trainee (objective: ${objective.primary}, split: ${structure.splitFamily}, frequency: ${frequency.targetDays}d, recovery: ${recoveryConstraints.level}).`,
  ];

  return {
    schemaVersion: 1,
    population: 'adult',
    objective,
    frequency,
    structure,
    trainingLoad,
    exerciseSelection,
    trainingDemand,
    progression,
    conditioning,
    recoveryConstraints,
    decisionTrace: aggregatedTrace,
  };
}

/**
 * Validates a TrainingStrategy object against schema v1 contracts.
 *
 * @param strategy - Candidate strategy object to validate
 * @returns Validation result with valid flag, errors, and warnings
 */
export function validateTrainingStrategy(
  strategy: unknown
): TrainingStrategyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!strategy || typeof strategy !== 'object') {
    return {
      valid: false,
      errors: ['TrainingStrategy must be a non-null object.'],
      warnings: [],
    };
  }

  const s = strategy as Partial<TrainingStrategy>;

  if (s.schemaVersion !== 1) {
    errors.push(`Invalid schemaVersion: expected 1, got ${s.schemaVersion}.`);
  }

  if (s.population !== 'adult') {
    errors.push(`Invalid population: expected "adult", got "${s.population}".`);
  }

  if (!s.objective || typeof s.objective !== 'object') {
    errors.push('Missing or invalid objective (Stage T1).');
  }

  if (!s.frequency || typeof s.frequency !== 'object') {
    errors.push('Missing or invalid frequency (Stage T2).');
  }

  if (!s.structure || typeof s.structure !== 'object') {
    errors.push('Missing or invalid structure (Stage T3).');
  }

  if (!s.trainingLoad || typeof s.trainingLoad !== 'object') {
    errors.push('Missing or invalid trainingLoad (Stage T4).');
  }

  if (!s.exerciseSelection || typeof s.exerciseSelection !== 'object') {
    errors.push('Missing or invalid exerciseSelection (Stage T5).');
  }

  if (!s.trainingDemand || typeof s.trainingDemand !== 'object') {
    errors.push('Missing or invalid trainingDemand (Stage T6).');
  }

  if (!s.progression || typeof s.progression !== 'object') {
    errors.push('Missing or invalid progression (Stage T7).');
  }

  if (!s.conditioning || typeof s.conditioning !== 'object') {
    errors.push('Missing or invalid conditioning (Stage T8).');
  }

  if (!s.recoveryConstraints || typeof s.recoveryConstraints !== 'object') {
    errors.push('Missing or invalid recoveryConstraints (Stage T9).');
  }

  if (!Array.isArray(s.decisionTrace) || s.decisionTrace.length === 0) {
    errors.push('Missing or empty decisionTrace.');
  }

  if (
    s.recoveryConstraints?.level === 'strongly_constrained' &&
    s.recoveryConstraints?.deloadDecision === 'recommend'
  ) {
    warnings.push('Trainee is under strongly constrained recovery with a recommended deload.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
