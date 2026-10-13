/**
 * Population Eligibility Guard
 *
 * Evaluates the user's demographic/chronological age to establish the appropriate
 * training population pathway ("youth" vs "adult") prior to applying population-specific
 * strategy resolution rules.
 *
 * RULES:
 * - Age 13–17:
 *   → population = "youth"
 *   → allowed = true
 * - Age 18–100:
 *   → population = "adult"
 *   → allowed = true
 * - Out of range (< 13 or > 100):
 *   → population = null
 *   → allowed = false
 *
 * BOUNDARIES:
 * - Does NOT generate workouts or prescribe exercises.
 * - Does NOT calculate volume, sets, reps, or RIR.
 * - Does NOT modify calories, macros, or recovery scores.
 * - Does NOT make medical diagnoses or create clinical health scores.
 * - Pure, deterministic, non-mutating, zero dependencies.
 */

import type { CanonicalUserProfile } from '../profile';

export type TrainingPopulation = 'youth' | 'adult';

export type PopulationGuardResult = {
  allowed: boolean;
  population: TrainingPopulation | null;
  reason: string;
  decisionTrace: string[];
};

/**
 * Resolves the appropriate training population pathway based on user age.
 *
 * @param profile - Validated CanonicalUserProfile
 * @returns PopulationGuardResult
 */
export function resolveTrainingPopulation(
  profile: CanonicalUserProfile
): PopulationGuardResult {
  const age = profile.anthropometrics.age;

  if (typeof age !== 'number' || Number.isNaN(age) || age < 13 || age > 100) {
    const reason = `Age ${age} is outside the supported eligibility range (13–100 years).`;
    return {
      allowed: false,
      population: null,
      reason,
      decisionTrace: [
        `Chronological age: ${age}`,
        'Age validation check: FAILED (outside 13–100 boundary)',
        'Population pathway: null',
        reason,
      ],
    };
  }

  if (age >= 13 && age <= 17) {
    const reason = `Age ${age} qualifies for youth training pathway (13–17 years).`;
    return {
      allowed: true,
      population: 'youth',
      reason,
      decisionTrace: [
        `Chronological age: ${age}`,
        'Age validation check: PASSED',
        'Eligibility category: youth (13–17)',
        'Population pathway: youth',
        reason,
      ],
    };
  }

  // age >= 18 && age <= 100
  const reason = `Age ${age} qualifies for standard adult training pathway (18–100 years).`;
  return {
    allowed: true,
    population: 'adult',
    reason,
    decisionTrace: [
      `Chronological age: ${age}`,
      'Age validation check: PASSED',
      'Eligibility category: adult (18–100)',
      'Population pathway: adult',
      reason,
    ],
  };
}
