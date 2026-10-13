/**
 * Training Strategy Pipeline Entry Point
 *
 * Safe population routing & T1–T10 execution.
 * Orchestrates population eligibility and routing:
 * - adult (age 18–100): Routes to deterministic adult T1–T10 pipeline execution.
 * - youth (age 13–17): Stops safely at youth_strategy_pending boundary with zero adult T1–T10 execution.
 * - ineligible (age < 13 or > 100): Blocked at boundary.
 *
 * Authoritative pipeline sequence:
 * CanonicalUserProfile → Population Boundary →
 *   T1 Goal Resolution →
 *   T2 Frequency Resolution →
 *   T3 Training Structure →
 *   T4 Conservative Starting Guardrails →
 *   T5 Exercise Selection Rules →
 *   T6 Training Demand & Allocation →
 *   T7 Progression Strategy →
 *   T8 Baseline Conditioning Strategy →
 *   T9 Recovery Constraints →
 *   T10 Strategy Assembly
 *
 * INVARIANTS:
 * - Pure, deterministic, side-effect free, non-mutating.
 * - Adult pipeline execution is strictly isolated from youth.
 * - Zero fake sets, reps, RIR, volume, splits, or workouts generated for youth.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  FrequencyResolution,
  TrainingStructure,
  TrainingLoadStrategy,
  ExerciseSelectionStrategy,
  TrainingDemandPlan,
  ConditioningStrategy,
  RecoveryRuntimeState,
  RecoveryConstraints,
  TrainingStrategy,
} from './types';
import {
  type PopulationStrategyPath,
  resolveStrategyPopulation,
} from './strategyPopulation';
import { resolveTrainingObjective } from './goalResolution';
import { resolveFrequency } from './frequencyResolution';
import { resolveTrainingStructure } from './trainingStructure';
import { resolveTrainingLoad } from './trainingLoad';
import { resolveExerciseSelection } from './exerciseSelection';
import {
  resolveTrainingDemand,
  type ComprehensiveTrainingDemandAllocation,
} from './trainingDemand';
import {
  resolveProgressionStrategy,
  type ComprehensiveProgressionStrategy,
} from './progressionStrategy';
import { resolveConditioningStrategy } from './conditioningStrategy';
import { resolveRecoveryConstraints } from './recoveryConstraints';
import { assembleTrainingStrategy } from './strategyAssembly';
import type { ExerciseDefinition } from './exerciseCatalog';

export type AdultStrategyPipelineResult = {
  status: 'completed';
  path: 'adult_strategy';
  strategy: TrainingStrategy;
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

export type YouthStrategyPipelineResult = {
  status: 'pending';
  path: 'youth_strategy_pending';
  message: string;
  decisionTrace: string[];
};

export type IneligibleStrategyPipelineResult = {
  status: 'ineligible';
  path: 'ineligible';
  reason: string;
  decisionTrace: string[];
};

export type StrategyPipelineResult =
  | AdultStrategyPipelineResult
  | YouthStrategyPipelineResult
  | IneligibleStrategyPipelineResult;

/**
 * Safe population routing & T1–T10 execution.
 *
 * Orchestrates population-aware strategy pipeline:
 * - adult (18–100): routes to deterministic adult T1–T10 execution in sequence
 * - youth (13–17): stops safely at youth_strategy_pending boundary with zero adult T1–T10 execution
 * - ineligible (<13 or >100): blocked at boundary
 *
 * @param profile - Validated CanonicalUserProfile
 * @param customCatalog - Optional custom exercise catalog for exercise selection
 * @param runtimeState - Optional dynamic runtime recovery state for Stage T9
 * @returns StrategyPipelineResult
 */
export function runStrategyPipeline(
  profile: CanonicalUserProfile,
  customCatalog?: readonly ExerciseDefinition[],
  runtimeState?: RecoveryRuntimeState
): StrategyPipelineResult {
  const populationBoundary = resolveStrategyPopulation(profile);

  // 1. Ineligible case
  if (populationBoundary.path === 'ineligible') {
    return {
      status: 'ineligible',
      path: 'ineligible',
      reason: populationBoundary.reason,
      decisionTrace: [
        ...populationBoundary.decisionTrace,
        'Strategy pipeline stopped: User profile is ineligible for strategy generation.',
      ],
    };
  }

  // 2. Youth case: NEVER invoke adult T1–T9
  if (populationBoundary.path === 'youth_strategy_pending') {
    return {
      status: 'pending',
      path: 'youth_strategy_pending',
      message:
        'Youth training pathway selected (ages 13–17). Adult training strategy engine is held; awaiting youth developmental training guidelines milestone.',
      decisionTrace: [
        ...populationBoundary.decisionTrace,
        'Strategy pipeline branch: YOUTH',
        'Adult T1 (Goal Resolution) SKIPPED',
        'Adult T2 (Frequency Resolution) SKIPPED',
        'Adult T3 (Training Structure) SKIPPED',
        'Adult T4 (Training Load) SKIPPED',
        'Adult T5 (Exercise Selection) SKIPPED',
        'Adult T6 (Training Demand & Allocation) SKIPPED',
        'Adult T7 (Progression Strategy) SKIPPED',
        'Adult T8 (Conditioning Strategy) SKIPPED',
        'Adult T9 (Recovery Constraints) SKIPPED',
        'Adult T10 (Strategy Assembly) SKIPPED',
        'Zero adult volume, effort, split, demand, progression, conditioning, recovery constraints, or workout prescriptions were generated.',
      ],
    };
  }

  // 3. Adult case: invoke existing pure T1–T9 pipeline in sequence, followed by T10 assembly
  const objective = resolveTrainingObjective(profile);
  const frequency = resolveFrequency(profile);
  const structure = resolveTrainingStructure(profile, objective, frequency);
  const trainingLoad = resolveTrainingLoad(profile, objective, frequency, structure);
  const exerciseSelection = resolveExerciseSelection(profile, objective, structure, customCatalog);
  const trainingDemand = resolveTrainingDemand(
    profile,
    objective,
    frequency,
    structure,
    trainingLoad,
    exerciseSelection,
    customCatalog
  );
  const progression = resolveProgressionStrategy(
    profile,
    objective,
    structure,
    trainingLoad,
    trainingDemand
  );
  const conditioning = resolveConditioningStrategy(
    profile,
    objective,
    frequency,
    structure,
    trainingLoad,
    trainingDemand,
    progression
  );
  const recoveryConstraints = resolveRecoveryConstraints(
    profile,
    objective,
    structure,
    trainingLoad,
    trainingDemand,
    progression,
    conditioning,
    runtimeState
  );

  const decisionTrace: string[] = [
    ...populationBoundary.decisionTrace,
    'Strategy pipeline branch: ADULT',
    `T1 Primary Objective: ${objective.primary} (${objective.source})`,
    `T2 Target Frequency: ${frequency.targetDays} days (${frequency.structureMode})`,
    `T3 Structure: ${structure.splitFamily} (${structure.programmingComplexity})`,
    `T4 Starting Load: ${trainingLoad.startingVolume} volume, ${trainingLoad.effort.minRIR}-${trainingLoad.effort.maxRIR} RIR`,
    `T5 Eligible Candidates: ${exerciseSelection.candidates.length} (${exerciseSelection.excludedExerciseIds.length} excluded)`,
    `T6 Session Demand Allocations: ${trainingDemand.sessions.length} sessions (${trainingDemand.coveredMovementPatterns.length} patterns covered)`,
    `T7 Progression Method: ${progression.method} (${progression.exerciseProgressionPlans.length} exercise plans)`,
    `T8 Conditioning: ${conditioning.demand} demand (${conditioning.mode}), ${conditioning.preferredModalityFamilies.join(', ')}`,
    `T9 Recovery Constraints: ${recoveryConstraints.level} level (volume: ${recoveryConstraints.volumeModifier}, effort: ${recoveryConstraints.effortModifier}, conditioning: ${recoveryConstraints.conditioningModifier}, deload: ${recoveryConstraints.deloadDecision})`,
  ];

  const strategy = assembleTrainingStrategy({
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
  });

  return {
    status: 'completed',
    path: 'adult_strategy',
    strategy,
    objective,
    frequency,
    structure,
    trainingLoad,
    exerciseSelection,
    trainingDemand,
    progression,
    conditioning,
    recoveryConstraints,
    decisionTrace: strategy.decisionTrace,
  };
}
