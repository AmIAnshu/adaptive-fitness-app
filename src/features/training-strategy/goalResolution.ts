/**
 * T1 — Goal Resolution
 *
 * Deterministically resolves the high-level TrainingObjective and priority
 * profile from the CanonicalUserProfile.
 *
 * PRECEDENCE:
 * 1. Explicit Onboarding Goal (Screen 1)
 * 2. Preference-Based Inference (Screen 6 Training Style if Goal is "not_sure")
 * 3. Safe Default (general_fitness)
 *
 * INVARIANTS:
 * - Pure, deterministic, side-effect free, free of randomness.
 * - Does not mutate incoming profile.
 * - Does not calculate calories, macros, volume, sets/reps, or RIR.
 */

import type { CanonicalUserProfile } from '../profile';
import type { ResolvedObjective, TrainingObjective } from './types';

/**
 * Resolves the primary training objective and domain priorities from the canonical user profile.
 *
 * @param profile - Validated canonical user profile
 * @returns Deterministic ResolvedObjective with decision trace
 */
export function resolveTrainingObjective(
  profile: CanonicalUserProfile
): ResolvedObjective {
  const explicitGoal = profile.goal?.primary;
  const preferredStyle = profile.trainingPreferences?.preferredStyle;

  // --------------------------------------------------
  // 1. EXPLICIT GOAL RESOLUTION
  // --------------------------------------------------
  switch (explicitGoal) {
    case 'build_muscle':
      return {
        primary: 'hypertrophy',
        source: 'explicit',
        resistancePriority: 'high',
        conditioningPriority: 'low',
        performancePriority: 'moderate',
        decisionTrace: [
          'Primary goal explicitly selected: build_muscle',
          'Resolved objective: hypertrophy',
        ],
      };

    case 'lose_fat':
      return {
        primary: 'fat_loss_support',
        source: 'explicit',
        resistancePriority: 'high',
        conditioningPriority: 'moderate',
        performancePriority: 'low',
        decisionTrace: [
          'Primary goal explicitly selected: lose_fat',
          'Resolved objective: fat_loss_support',
        ],
      };

    case 'build_muscle_lose_fat':
      return {
        primary: 'body_composition',
        source: 'explicit',
        resistancePriority: 'high',
        conditioningPriority: 'moderate',
        performancePriority: 'moderate',
        decisionTrace: [
          'Primary goal explicitly selected: build_muscle_lose_fat',
          'Resolved objective: body_composition',
        ],
      };

    case 'get_stronger':
      return {
        primary: 'strength',
        source: 'explicit',
        resistancePriority: 'high',
        conditioningPriority: 'low',
        performancePriority: 'high',
        decisionTrace: [
          'Primary goal explicitly selected: get_stronger',
          'Resolved objective: strength',
        ],
      };

    case 'improve_fitness':
      return {
        primary: 'general_fitness',
        source: 'explicit',
        resistancePriority: 'high',
        conditioningPriority: 'moderate',
        performancePriority: 'moderate',
        decisionTrace: [
          'Primary goal explicitly selected: improve_fitness',
          'Resolved objective: general_fitness',
        ],
      };

    default:
      break;
  }

  // --------------------------------------------------
  // 2. PREFERENCE-BASED INFERENCE (when explicit goal is "not_sure")
  // --------------------------------------------------
  if (preferredStyle === 'hypertrophy') {
    return {
      primary: 'hypertrophy',
      source: 'inferred_from_preferences',
      resistancePriority: 'high',
      conditioningPriority: 'low',
      performancePriority: 'moderate',
      decisionTrace: [
        'Primary goal was not specified',
        'Training style indicates hypertrophy preference',
        'Resolved objective: hypertrophy from preferences',
      ],
    };
  }

  if (preferredStyle === 'strength') {
    return {
      primary: 'strength',
      source: 'inferred_from_preferences',
      resistancePriority: 'high',
      conditioningPriority: 'low',
      performancePriority: 'high',
      decisionTrace: [
        'Primary goal was not specified',
        'Training style indicates strength preference',
        'Resolved objective: strength from preferences',
      ],
    };
  }

  if (preferredStyle === 'general_fitness') {
    return {
      primary: 'general_fitness',
      source: 'inferred_from_preferences',
      resistancePriority: 'high',
      conditioningPriority: 'moderate',
      performancePriority: 'moderate',
      decisionTrace: [
        'Primary goal was not specified',
        'Training style indicates general_fitness preference',
        'Resolved objective: general_fitness from preferences',
      ],
    };
  }

  // --------------------------------------------------
  // 3. SAFE DEFAULT
  // Note: "high_intensity" alone does NOT infer a special objective.
  // "balanced", "not_sure", or missing styles fall back to safe default.
  // --------------------------------------------------
  const styleReason =
    preferredStyle && preferredStyle !== 'not_sure'
      ? `Training style (${preferredStyle}) did not provide a sufficient objective`
      : 'Training style did not provide a sufficient objective';

  return {
    primary: 'general_fitness',
    source: 'safe_default',
    resistancePriority: 'high',
    conditioningPriority: 'moderate',
    performancePriority: 'moderate',
    decisionTrace: [
      'Primary goal was not specified',
      styleReason,
      'Resolved objective: general_fitness as safe default',
    ],
  };
}
