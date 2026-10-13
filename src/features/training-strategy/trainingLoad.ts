/**
 * T4 — Starting Volume & Effort Resolution
 *
 * Deterministically determines a conservative STARTING workload strategy
 * (starting volume and effort / RIR boundaries) without generating final workouts,
 * set/rep numbers, or numeric readiness/recovery scores.
 *
 * RULES:
 * 1. Starting Volume ('low' | 'moderate' | 'high'):
 *    - Baseline:
 *      * foundational: 'low'
 *      * standard: 'moderate'
 *      * advanced: 'moderate' (advanced does NOT automatically get 'high')
 *    - High Volume requires ALL of:
 *      * advanced complexity (or standard with supportive conditions)
 *      * favorable recovery (not constrained)
 *      * sufficient session duration (60_75 or 75_plus)
 *      * compatible volume preference ('more_volume' or 'balanced', not 'fewer_high_effort')
 *      * objective where workload is useful (e.g. hypertrophy / body_composition / strength)
 *    - Duration Modifiers:
 *      * 20_30: favors 'low' starting workload
 *      * 30_45: 'low' or 'moderate'
 *      * 45_60: 'moderate' commonly feasible
 *      * 60_75 / 75_plus: higher capacity feasible if other signals support it
 *    - Recovery Modifiers:
 *      * Clearly constrained recovery reduces baseline volume by at most one qualitative level (e.g. moderate -> low).
 *      * Uncertain / 'not_sure' does not assume poor recovery.
 *    - Preference Modifier:
 *      * 'fewer_high_effort': biases toward lower/moderate volume.
 *      * 'more_volume': supports moderate/high volume when capacity and recovery allow.
 *      * Preference never overrides experience guardrail or constrained recovery.
 *
 * 2. Starting Effort ({ minRIR, maxRIR }):
 *    - Base Preference:
 *      * 'moderate' -> 3-4 RIR
 *      * 'hard' -> 2-3 RIR
 *      * 'very_hard' -> 1-2 RIR
 *      * 'not_sure' -> 2-3 RIR
 *    - Experience Guardrail:
 *      * Foundational users who select 'very_hard' are moderated to 2-3 RIR (never 0-1 RIR).
 *    - Recovery Guardrail:
 *      * Clearly constrained recovery shifts the target range 1 RIR farther from failure
 *        (e.g., 2-3 -> 3-4; 1-2 -> 2-3; 3-4 -> 3-4 bound).
 *    - Numerical Bounds:
 *      * minRIR >= 1 always (never 0 RIR default).
 *      * maxRIR >= minRIR always.
 *
 * INVARIANTS:
 * - Pure, deterministic, side-effect free, non-mutating.
 * - No exact sets, reps, exercises, or calendar workout assignments.
 * - No numeric recovery scores or medical logic.
 *
 * ARCHITECTURAL ROLE & RECOVERY OWNERSHIP:
 * - T4 establishes conservative starting-plan workload guardrails from onboarding context.
 * - T4 is NOT a runtime recovery constraint engine: it does NOT produce recovery scores,
 *   deload decisions, ongoing fatigue states, or runtime recovery recommendations.
 * - T9 (Recovery Constraints) authoritatively owns ongoing recovery-state constraints and
 *   adaptive reductions/deload decisions after actual training/recovery feedback.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  FrequencyResolution,
  TrainingStructure,
  TrainingLoadStrategy,
  StartingVolume,
  EffortStrategy,
} from './types';

/**
 * Evaluates static onboarding lifestyle signals to determine initial starting-plan
 * recovery guardrail state.
 *
 * This is an initial conservative starting-load safety adjustment based on onboarding signals,
 * NOT an ongoing recovery constraint engine (which belongs authoritatively to T9).
 *
 * Clearly constrained requires multiple negative signals across sleep, energy,
 * stress, and between-workout fatigue.
 * 'not_sure' values or isolated mild signals do NOT trigger constrained status.
 * Never produces a numeric recovery score, deload decision, or ongoing fatigue state.
 */
function evaluateRecoveryState(profile: CanonicalUserProfile): {
  isConstrained: boolean;
  reasons: string[];
} {
  const { sleepDuration, sleepQuality, energyLevel, stressLevel, workoutRecovery } =
    profile.recoveryLifestyle;

  const negativeSignals: string[] = [];

  // Short sleep
  if (sleepDuration === 'under_5' || sleepDuration === '5_to_6') {
    negativeSignals.push(`short sleep duration (${sleepDuration === 'under_5' ? '<5h' : '5-6h'})`);
  }

  // Low sleep quality
  if (sleepQuality <= 2) {
    negativeSignals.push(`low sleep quality (${sleepQuality}/5)`);
  }

  // Low daily energy
  if (energyLevel <= 2) {
    negativeSignals.push(`low daily energy (${energyLevel}/5)`);
  }

  // High daily stress (note: 4 or 5 indicates high stress)
  if (stressLevel >= 4) {
    negativeSignals.push(`elevated daily stress (${stressLevel}/5)`);
  }

  // Frequent between-workout fatigue
  if (workoutRecovery === 'often_fatigued') {
    negativeSignals.push('frequent between-workout fatigue');
  }

  // A clearly constrained pattern requires at least 2 distinct negative signals.
  // One isolated signal does not dominate or penalize the user.
  const isConstrained = negativeSignals.length >= 2;

  return {
    isConstrained,
    reasons: negativeSignals,
  };
}

/**
 * Resolves qualitative starting volume category.
 */
function resolveStartingVolume(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  frequency: FrequencyResolution,
  structure: TrainingStructure,
  recoveryState: { isConstrained: boolean; reasons: string[] }
): { volume: StartingVolume; reasons: string[] } {
  const reasons: string[] = [];
  const { programmingComplexity } = structure;
  const sessionDuration = profile.schedule.sessionDuration;
  const volumePref = profile.trainingPreferences.volumePreference;
  const primaryObjective = objective.primary;

  // 1. Initial Baseline by Programming Complexity
  let baseline: StartingVolume = 'moderate';
  if (programmingComplexity === 'foundational') {
    baseline = 'low';
    reasons.push('Foundational programming complexity sets a low starting baseline');
  } else if (programmingComplexity === 'advanced') {
    baseline = 'moderate';
    reasons.push('Advanced programming complexity establishes a moderate starting baseline');
  } else {
    baseline = 'moderate';
    reasons.push('Standard programming complexity establishes a moderate starting baseline');
  }

  // 2. High Starting Volume Feasibility Check
  // High volume requires:
  // - Not foundational
  // - Unconstrained recovery
  // - Session duration >= 60 min (60_75 or 75_plus)
  // - volumePreference is 'more_volume' (or advanced with 'balanced' + long session + hypertrophy)
  // - Objective where volume is useful (hypertrophy, body_composition, strength)
  const isLongSession = sessionDuration === '60_75' || sessionDuration === '75_plus';
  const hasCompatibleGoal =
    primaryObjective === 'hypertrophy' ||
    primaryObjective === 'body_composition' ||
    primaryObjective === 'strength';
  const prefersMoreVolume = volumePref === 'more_volume';

  const canConsiderHigh =
    programmingComplexity !== 'foundational' &&
    !recoveryState.isConstrained &&
    isLongSession &&
    hasCompatibleGoal &&
    (prefersMoreVolume || (programmingComplexity === 'advanced' && volumePref === 'balanced' && sessionDuration === '75_plus'));

  if (canConsiderHigh) {
    baseline = 'high';
    reasons.push(
      'High starting volume supported by advanced/standard experience, favorable recovery, extended session duration, and compatible volume preference'
    );
  } else if (programmingComplexity === 'advanced' && baseline === 'moderate') {
    reasons.push(
      'Advanced experience does not automatically assign high volume without full supportive recovery, session capacity, and preference signals'
    );
  }

  // 3. Session Duration Constraints
  if (sessionDuration === '20_30') {
    if (baseline === 'high' || baseline === 'moderate') {
      baseline = 'low';
      reasons.push('Short session duration (20–30 min) constrains starting workload to low');
    } else {
      reasons.push('Short session duration (20–30 min) aligns with low starting workload');
    }
  } else if (sessionDuration === '30_45') {
    if (baseline === 'high') {
      baseline = 'moderate';
      reasons.push('Moderate session duration (30–45 min) caps starting workload at moderate');
    }
  }

  // 4. Volume Preference Constraints (User modifier)
  if (volumePref === 'fewer_high_effort' && baseline === 'high') {
    baseline = 'moderate';
    reasons.push('User preference for fewer exercises moderates starting volume to moderate');
  }

  // 5. Recovery Modifier (Reduces by at most one qualitative level)
  if (recoveryState.isConstrained) {
    if (baseline === 'high') {
      baseline = 'moderate';
      reasons.push(
        `Constrained recovery (${recoveryState.reasons.join(', ')}) adjusts starting volume from high to moderate`
      );
    } else if (baseline === 'moderate') {
      baseline = 'low';
      reasons.push(
        `Constrained recovery (${recoveryState.reasons.join(', ')}) adjusts starting volume from moderate to low`
      );
    } else {
      reasons.push(
        `Constrained recovery (${recoveryState.reasons.join(', ')}) confirms conservative low starting volume`
      );
    }
  }

  return {
    volume: baseline,
    reasons,
  };
}

/**
 * Resolves starting effort / RIR target range.
 */
function resolveStartingEffort(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  structure: TrainingStructure,
  recoveryState: { isConstrained: boolean; reasons: string[] }
): { effort: EffortStrategy; reasons: string[] } {
  const reasons: string[] = [];
  const prefEffort = profile.trainingPreferences.preferredEffort;
  const { programmingComplexity } = structure;

  // 1. Base Mapping from Preference
  let minRIR: number;
  let maxRIR: number;

  switch (prefEffort) {
    case 'moderate':
      minRIR = 3;
      maxRIR = 4;
      reasons.push('Preferred effort is moderate: baseline target 3–4 RIR');
      break;
    case 'hard':
      minRIR = 2;
      maxRIR = 3;
      reasons.push('Preferred effort is hard: baseline target 2–3 RIR');
      break;
    case 'very_hard':
      minRIR = 1;
      maxRIR = 2;
      reasons.push('Preferred effort is very hard: baseline target 1–2 RIR');
      break;
    case 'not_sure':
    default:
      minRIR = 2;
      maxRIR = 3;
      reasons.push('Preferred effort not specified: safe baseline target 2–3 RIR');
      break;
  }

  // 2. Experience Guardrail (Foundational Users)
  if (programmingComplexity === 'foundational') {
    if (prefEffort === 'very_hard') {
      minRIR = 2;
      maxRIR = 3;
      reasons.push(
        'Foundational experience moderates very hard effort preference to 2–3 RIR to ensure technical learning and safety'
      );
    } else {
      reasons.push('Foundational experience maintains conservative starting effort away from failure');
    }
  }

  // 3. Recovery Guardrail
  if (recoveryState.isConstrained) {
    if (minRIR === 1 && maxRIR === 2) {
      minRIR = 2;
      maxRIR = 3;
      reasons.push(
        `Constrained recovery shifts effort target to 2–3 RIR (${recoveryState.reasons.join(', ')})`
      );
    } else if (minRIR === 2 && maxRIR === 3) {
      minRIR = 3;
      maxRIR = 4;
      reasons.push(
        `Constrained recovery shifts effort target to 3–4 RIR (${recoveryState.reasons.join(', ')})`
      );
    } else if (minRIR === 3 && maxRIR === 4) {
      // Keep at 3-4 rather than expanding to 4-5
      reasons.push('Constrained recovery maintains conservative 3–4 RIR target');
    }
  }

  // 4. Bounded Invariants
  if (minRIR < 1) minRIR = 1;
  if (maxRIR < minRIR) maxRIR = minRIR;

  return {
    effort: { minRIR, maxRIR },
    reasons,
  };
}

/**
 * Resolves the starting training workload and effort strategy.
 *
 * @param profile - Validated canonical user profile
 * @param objective - Resolved training objective from T1
 * @param frequency - Resolved frequency from T2
 * @param structure - Resolved training structure from T3
 * @returns Deterministic TrainingLoadStrategy
 */
export function resolveTrainingLoad(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  frequency: FrequencyResolution,
  structure: TrainingStructure
): TrainingLoadStrategy {
  const recoveryState = evaluateRecoveryState(profile);

  const { volume: startingVolume, reasons: volumeReason } = resolveStartingVolume(
    profile,
    objective,
    frequency,
    structure,
    recoveryState
  );

  const { effort, reasons: effortReason } = resolveStartingEffort(
    profile,
    objective,
    structure,
    recoveryState
  );

  const decisionTrace: string[] = [
    `Programming complexity: ${structure.programmingComplexity}`,
    `Target frequency: ${frequency.targetDays} days/cycle`,
    `Session duration: ${profile.schedule.sessionDuration}`,
    `Volume preference: ${profile.trainingPreferences.volumePreference}`,
    `Preferred effort: ${profile.trainingPreferences.preferredEffort}`,
    `Onboarding recovery guardrail: ${recoveryState.isConstrained ? 'constrained (initial load moderated; ongoing adaptation deferred to T9)' : 'normal/favorable'}`,
  ];

  if (recoveryState.isConstrained) {
    decisionTrace.push(`Identified onboarding lifestyle recovery flags: ${recoveryState.reasons.join(', ')}`);
  }

  decisionTrace.push(`Starting volume resolved: ${startingVolume}`);
  decisionTrace.push(`Starting effort resolved: ${effort.minRIR}–${effort.maxRIR} RIR`);

  return {
    startingVolume,
    effort,
    volumeReason,
    effortReason,
    decisionTrace,
  };
}
