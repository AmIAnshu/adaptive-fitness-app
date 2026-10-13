/**
 * Population Strategy Boundary
 *
 * Provides a formal strategy-level routing boundary to guarantee that
 * adult-oriented strategy stages (T1–T9) are never silently applied to youth trainees.
 *
 * ROUTING CONTRACT:
 * - Adult (age 18–100):
 *   → allowed = true
 *   → population = "adult"
 *   → path = "adult_strategy" (proceeds to adult deterministic T1–T9 pipeline)
 * - Youth (age 13–17):
 *   → allowed = true
 *   → population = "youth"
 *   → path = "youth_strategy_pending" (stops safely, adult T1–T9 execution strictly prohibited)
 * - Ineligible (age < 13 or > 100):
 *   → allowed = false
 *   → population = null
 *   → path = "ineligible" (blocked at boundary)
 *
 * INVARIANTS:
 * - Pure, deterministic, non-mutating, zero dependencies.
 * - Does NOT create workout prescriptions, volume, sets, reps, or RIR.
 */

import type { CanonicalUserProfile } from '../profile';
import {
  type TrainingPopulation,
  resolveTrainingPopulation,
} from './populationGuard';

export type PopulationStrategyPath =
  | 'adult_strategy'
  | 'youth_strategy_pending'
  | 'ineligible';

export type PopulationStrategyBoundaryResult = {
  allowed: boolean;
  population: TrainingPopulation | null;
  path: PopulationStrategyPath;
  reason: string;
  decisionTrace: string[];
};

/**
 * Resolves the strategy population boundary and operational routing path.
 *
 * @param profile - Validated CanonicalUserProfile
 * @returns PopulationStrategyBoundaryResult
 */
export function resolveStrategyPopulation(
  profile: CanonicalUserProfile
): PopulationStrategyBoundaryResult {
  const guard = resolveTrainingPopulation(profile);

  if (!guard.allowed || guard.population === null) {
    const reason = `User age ${profile.anthropometrics.age} is outside eligible training bounds (13–100 years).`;
    return {
      allowed: false,
      population: null,
      path: 'ineligible',
      reason,
      decisionTrace: [
        ...guard.decisionTrace,
        'Strategy routing: INELIGIBLE',
        'Training engine pathway blocked due to age boundary violation',
      ],
    };
  }

  if (guard.population === 'youth') {
    const reason = `User age ${profile.anthropometrics.age} requires youth-specific training strategy; adult strategy pipeline is blocked pending youth protocol integration.`;
    return {
      allowed: true,
      population: 'youth',
      path: 'youth_strategy_pending',
      reason,
      decisionTrace: [
        ...guard.decisionTrace,
        'Strategy routing: YOUTH_STRATEGY_PENDING',
        'Adult T1–T9 training strategy pipeline execution is prohibited for youth trainees',
        'Standing by for youth developmental training milestone',
      ],
    };
  }

  // guard.population === 'adult'
  const reason = `User age ${profile.anthropometrics.age} routed to standard adult training strategy pipeline.`;
  return {
    allowed: true,
    population: 'adult',
    path: 'adult_strategy',
    reason,
    decisionTrace: [
      ...guard.decisionTrace,
      'Strategy routing: ADULT_STRATEGY',
      'Proceeding with adult deterministic T1–T9 strategy pipeline',
    ],
  };
}
