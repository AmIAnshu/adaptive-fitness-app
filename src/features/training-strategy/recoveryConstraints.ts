/**
 * Recovery Constraints Engine (Stage T9)
 *
 * Authoritative runtime recovery-adaptation layer for the Training Strategy Engine.
 *
 * ARCHITECTURAL ROLE:
 * - T4: Conservative Day-1 initialization based on onboarding context (starting-plan guardrail).
 * - T8: Baseline conditioning intent (demands, modalities, interference management).
 * - T9: ONGOING runtime recovery-state constraints and adaptive reductions/deload decisions.
 *
 * HISTORY OWNERSHIP BOUNDARY:
 * External runtime / session history layer
 *                 ↓
 *       RecoveryRuntimeState (snapshot)
 *                 ↓
 *    resolveRecoveryConstraints() (pure evaluator)
 *                 ↓
 *        RecoveryConstraints
 *
 * The caller / session history layer owns persistence and supplies historical counters
 * and previous constraint level. T9 is a pure, stateless evaluator that does NOT mutate
 * or retain historical state internally between invocations.
 *
 * PRECEDENCE & PRINCIPLES:
 * 1. Protect core resistance training first.
 * 2. Conditioning yields before core resistance volume (conditioning reduced or omitted first).
 * 3. Frequency is preserved where possible; reduced only under persistent multi-signal constraint.
 * 4. Deload requires repeated or persistent evidence across observations, never a single bad night or workout.
 * 5. Hysteresis & conservative release: releases at most one constraint tier per normalized healthy observation.
 * 6. Missing or uncertain signals are treated as neutral, never penalizing the trainee.
 * 7. Non-medical domain language only: zero medical or clinical diagnoses.
 * 8. Zero numeric readiness/recovery scores (no 0–100 pseudo-scientific ratings).
 * 9. Pure, deterministic, side-effect free, and non-mutating.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  TrainingStructure,
  TrainingLoadStrategy,
  ConditioningStrategy,
  RecoveryRuntimeState,
  RecoveryConstraints,
  RecoveryConstraintLevel,
  RecoveryVolumeModifier,
  RecoveryEffortModifier,
  RecoveryConditioningModifier,
  RecoveryFrequencyModifier,
  DeloadDecision,
  RecoveryEvidenceCategory,
} from './types';
import type { ComprehensiveTrainingDemandAllocation } from './trainingDemand';
import type { ComprehensiveProgressionStrategy } from './progressionStrategy';

export const MAX_SESSION_COUNTER = 30;
export const MAX_FATIGUE_CYCLES = 10;

const LEVEL_TIERS: Record<RecoveryConstraintLevel, number> = {
  stable: 0,
  mildly_constrained: 1,
  constrained: 2,
  strongly_constrained: 3,
};

const TIER_LEVELS: RecoveryConstraintLevel[] = [
  'stable',
  'mildly_constrained',
  'constrained',
  'strongly_constrained',
];

/**
 * Deterministically sanitizes and coerces historical counter inputs into safe integer bounds:
 * - Coerces decimal inputs by truncating to integer (Math.floor)
 * - Clamps negative numbers to 0
 * - Clamps excessive positive values to a deterministic maximum bound
 * - Coerces non-numeric, non-finite, NaN, null, or undefined inputs safely to 0
 *
 * NOTE: This is deterministic sanitization and coercion for resilient runtime evaluation,
 * rather than strict rejection-based integer validation.
 */
export function sanitizeCounter(
  value: unknown,
  maxBound: number = MAX_SESSION_COUNTER
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  const intVal = Math.floor(value);
  if (intVal <= 0) {
    return 0;
  }
  return Math.min(intVal, maxBound);
}

/**
 * Deterministic conversion boundary mapping onboarding profile recovery state
 * to a canonical RecoveryRuntimeState snapshot.
 *
 * Rules:
 * - sleepDuration maps directly across all 5 canonical values:
 *   under_5, 5_to_6, 6_to_7, 7_to_8, 8_plus
 * - sleepQuality (1-5), energyLevel (1-5), stressLevel (1-5) map directly
 * - workoutRecovery:
 *   'fully_recovered', 'mostly_recovered', 'sometimes_fatigued', 'often_fatigued' map directly;
 *   'not_sure' maps to undefined (treated as neutral, zero penalty)
 */
export function mapOnboardingRecoveryToRuntimeState(
  recovery: CanonicalUserProfile['recoveryLifestyle']
): RecoveryRuntimeState {
  return {
    sleepDuration: recovery.sleepDuration,
    sleepQuality: recovery.sleepQuality,
    energyLevel: recovery.energyLevel,
    stressLevel: recovery.stressLevel,
    workoutRecovery:
      recovery.workoutRecovery === 'not_sure' ? undefined : recovery.workoutRecovery,
  };
}

type SignalSeverity = 'none' | 'mild' | 'moderate' | 'severe';

interface EvaluatedSignal {
  category: string;
  severity: SignalSeverity;
  observation: string;
  isHistorical: boolean;
}

/**
 * Evaluates runtime signals into structured observations without medical diagnosis.
 */
function evaluateRuntimeSignals(
  runtimeState?: RecoveryRuntimeState
): EvaluatedSignal[] {
  if (!runtimeState) {
    return [];
  }

  const signals: EvaluatedSignal[] = [];

  // 1. Sleep Duration (Point-in-time observation)
  if (runtimeState.sleepDuration === 'under_5') {
    signals.push({
      category: 'sleep_duration',
      severity: 'severe',
      observation: 'Severe sleep duration deficit (< 5 hours)',
      isHistorical: false,
    });
  } else if (runtimeState.sleepDuration === '5_to_6') {
    signals.push({
      category: 'sleep_duration',
      severity: 'moderate',
      observation: 'Moderate sleep duration deficit (5–6 hours)',
      isHistorical: false,
    });
  }

  // 2. Sleep Quality (Point-in-time observation)
  if (runtimeState.sleepQuality === 1) {
    signals.push({
      category: 'sleep_quality',
      severity: 'severe',
      observation: 'Severely impaired sleep quality (rating 1/5)',
      isHistorical: false,
    });
  } else if (runtimeState.sleepQuality === 2) {
    signals.push({
      category: 'sleep_quality',
      severity: 'moderate',
      observation: 'Suboptimal sleep quality (rating 2/5)',
      isHistorical: false,
    });
  }

  // 3. Energy Level (Point-in-time observation)
  if (runtimeState.energyLevel === 1) {
    signals.push({
      category: 'energy',
      severity: 'severe',
      observation: 'Severe subjective exhaustion (rating 1/5)',
      isHistorical: false,
    });
  } else if (runtimeState.energyLevel === 2) {
    signals.push({
      category: 'energy',
      severity: 'moderate',
      observation: 'Low subjective energy availability (rating 2/5)',
      isHistorical: false,
    });
  }

  // 4. Stress Level (Point-in-time observation)
  if (runtimeState.stressLevel === 5) {
    signals.push({
      category: 'stress',
      severity: 'severe',
      observation: 'Extremely elevated non-training stress (rating 5/5)',
      isHistorical: false,
    });
  } else if (runtimeState.stressLevel === 4) {
    signals.push({
      category: 'stress',
      severity: 'moderate',
      observation: 'Elevated non-training stress (rating 4/5)',
      isHistorical: false,
    });
  }

  // 5. Between-Workout Recovery (Point-in-time observation)
  if (runtimeState.workoutRecovery === 'often_fatigued') {
    signals.push({
      category: 'inter_session_recovery',
      severity: 'moderate',
      observation: 'Persistent incomplete recovery between training sessions',
      isHistorical: false,
    });
  } else if (runtimeState.workoutRecovery === 'sometimes_fatigued') {
    signals.push({
      category: 'inter_session_recovery',
      severity: 'mild',
      observation: 'Occasional between-workout fatigue noted',
      isHistorical: false,
    });
  }

  // 6. Muscular Soreness (Point-in-time observation)
  if (runtimeState.sorenessLevel === 'severe') {
    signals.push({
      category: 'soreness',
      severity: 'severe',
      observation: 'Severe muscular soreness limiting movement execution',
      isHistorical: false,
    });
  } else if (runtimeState.sorenessLevel === 'moderate') {
    signals.push({
      category: 'soreness',
      severity: 'moderate',
      observation: 'Moderate muscular soreness across trained musculature',
      isHistorical: false,
    });
  } else if (runtimeState.sorenessLevel === 'mild') {
    signals.push({
      category: 'soreness',
      severity: 'mild',
      observation: 'Mild muscular soreness within normal training expectations',
      isHistorical: false,
    });
  }

  // 7. Recent Missed Sessions (Historical counter)
  const missedCount = sanitizeCounter(runtimeState.recentMissedSessionsCount, MAX_SESSION_COUNTER);
  if (missedCount >= 3) {
    signals.push({
      category: 'adherence_disruption',
      severity: 'severe',
      observation: `${missedCount} recent missed sessions indicating systemic schedule disruption`,
      isHistorical: true,
    });
  } else if (missedCount === 2) {
    signals.push({
      category: 'adherence_disruption',
      severity: 'moderate',
      observation: '2 recent missed sessions indicating temporary schedule disruption',
      isHistorical: true,
    });
  } else if (missedCount === 1) {
    signals.push({
      category: 'adherence_disruption',
      severity: 'mild',
      observation: '1 isolated missed session',
      isHistorical: true,
    });
  }

  // 8. Recent Degraded Sessions (Historical counter)
  const degradedCount = sanitizeCounter(runtimeState.recentDegradedSessionsCount, MAX_SESSION_COUNTER);
  if (degradedCount >= 3) {
    signals.push({
      category: 'performance_decline',
      severity: 'severe',
      observation: `${degradedCount} consecutive sessions with degraded performance`,
      isHistorical: true,
    });
  } else if (degradedCount === 2) {
    signals.push({
      category: 'performance_decline',
      severity: 'moderate',
      observation: '2 recent sessions with degraded performance',
      isHistorical: true,
    });
  } else if (degradedCount === 1) {
    signals.push({
      category: 'performance_decline',
      severity: 'mild',
      observation: '1 isolated session with degraded performance',
      isHistorical: true,
    });
  }

  // 9. Consecutive Under-Recovered Sessions (Historical counter)
  const consecutiveUnderRecovered = sanitizeCounter(
    runtimeState.consecutiveUnderRecoveredSessions,
    MAX_SESSION_COUNTER
  );
  if (consecutiveUnderRecovered >= 3) {
    signals.push({
      category: 'accumulated_recovery_deficit',
      severity: 'severe',
      observation: `${consecutiveUnderRecovered} consecutive sessions entering in under-recovered state`,
      isHistorical: true,
    });
  } else if (consecutiveUnderRecovered === 2) {
    signals.push({
      category: 'accumulated_recovery_deficit',
      severity: 'moderate',
      observation: '2 consecutive sessions entering in under-recovered state',
      isHistorical: true,
    });
  } else if (consecutiveUnderRecovered === 1) {
    signals.push({
      category: 'accumulated_recovery_deficit',
      severity: 'mild',
      observation: '1 session entering in under-recovered state',
      isHistorical: true,
    });
  }

  // 10. Accumulated Fatigue Cycles (Historical counter)
  const fatigueCycles = sanitizeCounter(runtimeState.accumulatedFatigueCycles, MAX_FATIGUE_CYCLES);
  if (fatigueCycles >= 2) {
    signals.push({
      category: 'fatigue_accumulation',
      severity: 'severe',
      observation: `${fatigueCycles} accumulated fatigue cycles without adequate recovery`,
      isHistorical: true,
    });
  } else if (fatigueCycles === 1) {
    signals.push({
      category: 'fatigue_accumulation',
      severity: 'moderate',
      observation: '1 accumulated fatigue cycle detected',
      isHistorical: true,
    });
  }

  // 11. Performance Regression Signal
  if (runtimeState.performanceRegressionObserved === true) {
    signals.push({
      category: 'performance_regression',
      severity: 'moderate',
      observation: 'Observed exercise performance regression or plateau',
      isHistorical: false,
    });
  }

  return signals;
}

/**
 * Resolves runtime recovery constraints and adaptive modifiers.
 *
 * @param profile - Validated CanonicalUserProfile
 * @param objective - Resolved training objective (T1)
 * @param structure - Training structure (T3)
 * @param trainingLoad - Starting training load (T4)
 * @param trainingDemand - Training demand allocation (T6)
 * @param progression - Progression strategy (T7)
 * @param conditioning - Baseline conditioning strategy (T8)
 * @param runtimeState - Optional dynamic runtime recovery state
 * @returns RecoveryConstraints
 */
export function resolveRecoveryConstraints(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  structure: TrainingStructure,
  trainingLoad: TrainingLoadStrategy,
  trainingDemand: ComprehensiveTrainingDemandAllocation,
  progression: ComprehensiveProgressionStrategy,
  conditioning: ConditioningStrategy,
  runtimeState?: RecoveryRuntimeState
): RecoveryConstraints {
  const decisionTrace: string[] = [];
  decisionTrace.push('T9 Recovery Constraints evaluation initialized.');

  // Check for performance progression signals from T7 or runtime state
  const hasProgressionRegression =
    runtimeState?.performanceRegressionObserved === true ||
    progression.decisionTrace.some(
      (t) =>
        t.toLowerCase().includes('confirmed regression') ||
        t.toLowerCase().includes('regression signaled') ||
        t.toLowerCase().includes('decision: regress') ||
        t.toLowerCase().includes('plateau confirmed')
    );

  const evaluatedSignals = evaluateRuntimeSignals(runtimeState);

  // Separate current observation signals from historical counters
  const currentSignals = evaluatedSignals.filter((s) => !s.isHistorical);
  const historicalSignals = evaluatedSignals.filter((s) => s.isHistorical);

  // Group by severity
  const severeSignals = evaluatedSignals.filter((s) => s.severity === 'severe');
  const moderateSignals = evaluatedSignals.filter((s) => s.severity === 'moderate');
  const mildSignals = evaluatedSignals.filter((s) => s.severity === 'mild');

  const severeCount = severeSignals.length;
  const moderateCount = moderateSignals.length;
  const mildCount = mildSignals.length;
  const totalNegativeSignals = severeCount + moderateCount + mildCount;

  const sanitizedConsecutive = sanitizeCounter(
    runtimeState?.consecutiveUnderRecoveredSessions,
    MAX_SESSION_COUNTER
  );
  const sanitizedDegraded = sanitizeCounter(
    runtimeState?.recentDegradedSessionsCount,
    MAX_SESSION_COUNTER
  );
  const sanitizedFatigueCycles = sanitizeCounter(
    runtimeState?.accumulatedFatigueCycles,
    MAX_FATIGUE_CYCLES
  );

  decisionTrace.push(
    `Runtime signals evaluated: ${severeCount} severe, ${moderateCount} moderate, ${mildCount} mild (total: ${totalNegativeSignals}; ${currentSignals.length} current, ${historicalSignals.length} historical).`
  );

  if (hasProgressionRegression) {
    decisionTrace.push(
      'T7 performance regression signal detected; will be factored into recovery constraint assessment.'
    );
  }

  // Determine Evidence Category and Raw Evaluated Level
  let evidenceCategory: RecoveryEvidenceCategory;
  let rawEvaluatedLevel: RecoveryConstraintLevel = 'stable';
  let rawVolumeModifier: RecoveryVolumeModifier = 'maintain';
  let rawEffortModifier: RecoveryEffortModifier = 'maintain';
  let rawConditioningModifier: RecoveryConditioningModifier = 'maintain';
  let rawFrequencyModifier: RecoveryFrequencyModifier = 'maintain';
  let rawDeloadDecision: DeloadDecision = 'none';
  const rawReasons: string[] = [];

  // ==================================================
  // CATEGORY D: PERSISTENT MULTI-SIGNAL EVIDENCE ACROSS OBSERVATIONS (Tier 4)
  // ==================================================
  if (
    sanitizedConsecutive >= 3 ||
    sanitizedFatigueCycles >= 2 ||
    severeCount >= 2 ||
    (severeCount >= 1 && moderateCount >= 2) ||
    moderateCount >= 3 ||
    (sanitizedDegraded >= 3 && (moderateCount >= 1 || severeCount >= 1))
  ) {
    evidenceCategory = 'persistent_multi_signal_history';
    rawEvaluatedLevel = 'strongly_constrained';
    rawVolumeModifier = 'strongly_reduce';
    rawEffortModifier = 'easier';
    rawFrequencyModifier = 'reduce';
    rawDeloadDecision = 'recommend';

    // Precedence: Conditioning omitted first
    rawConditioningModifier = conditioning.demand !== 'none' ? 'omit' : 'maintain';

    rawReasons.push(
      'Persistent multi-signal recovery deficit detected across multiple indicators.'
    );
    for (const s of [...severeSignals, ...moderateSignals]) {
      rawReasons.push(s.observation);
    }
    rawReasons.push(
      'Deload recommended: core resistance volume strongly reduced, conditioning omitted, and training frequency reduced to allow systemic restoration.'
    );

    decisionTrace.push('Evidence Classification: PERSISTENT_MULTI_SIGNAL_HISTORY.');
    decisionTrace.push('Status: STRONGLY_CONSTRAINED.');
    decisionTrace.push('Precedence Rule 1: Conditioning omitted to remove metabolic interference.');
    decisionTrace.push('Precedence Rule 2: Core resistance volume strongly reduced.');
    decisionTrace.push('Precedence Rule 3: Training frequency reduced to grant additional full rest days.');
    decisionTrace.push('Deload Decision: RECOMMEND.');
  }

  // ==================================================
  // CATEGORY C: REPEATED NEGATIVE EVIDENCE ACROSS OBSERVATIONS (Tier 3)
  // ==================================================
  else if (
    sanitizedConsecutive >= 2 ||
    sanitizedDegraded >= 2 ||
    sanitizedFatigueCycles === 1 ||
    (historicalSignals.some((s) => s.severity === 'moderate' || s.severity === 'severe') &&
      currentSignals.length >= 1)
  ) {
    evidenceCategory = 'repeated_history_evidence';
    rawEvaluatedLevel = 'constrained';
    rawVolumeModifier = 'reduce';
    rawEffortModifier = 'easier';
    rawFrequencyModifier = 'maintain';
    rawDeloadDecision = 'consider';

    // Precedence: Conditioning yields before resistance volume
    if (conditioning.demand !== 'none') {
      if (
        conditioning.interferenceConsiderations.interferenceSensitivity === 'high' ||
        conditioning.priority === 'low'
      ) {
        rawConditioningModifier = 'omit';
        decisionTrace.push(
          'Precedence: High conditioning interference sensitivity prompts omitting conditioning to preserve resistance stimulus.'
        );
      } else {
        rawConditioningModifier = 'reduce';
        decisionTrace.push(
          'Precedence: Conditioning demand reduced to lower metabolic fatigue while preserving resistance core.'
        );
      }
    } else {
      rawConditioningModifier = 'maintain';
    }

    rawReasons.push('Repeated negative recovery evidence observed across consecutive sessions.');
    for (const s of [...severeSignals, ...moderateSignals, ...mildSignals]) {
      rawReasons.push(s.observation);
    }
    rawReasons.push(
      'Adaptive response: conditioning reduced/omitted, core volume trimmed, effort buffer increased, and deload considered while maintaining weekly frequency.'
    );

    decisionTrace.push('Evidence Classification: REPEATED_HISTORY_EVIDENCE.');
    decisionTrace.push('Status: CONSTRAINED.');
    decisionTrace.push('Deload Decision: CONSIDER.');
  }

  // ==================================================
  // CATEGORY B: MULTIPLE CONVERGING SIGNALS IN CURRENT OBSERVATION (Tier 3)
  // ==================================================
  else if (totalNegativeSignals >= 2) {
    evidenceCategory = 'converging_current_signals';
    rawEvaluatedLevel = 'constrained';
    rawVolumeModifier = 'reduce';
    rawEffortModifier = 'easier';
    rawFrequencyModifier = 'maintain';
    // Deload only considered if performance regression observed in current observation
    rawDeloadDecision = hasProgressionRegression ? 'consider' : 'none';

    // Precedence: Conditioning yields before resistance volume
    if (conditioning.demand !== 'none') {
      if (
        conditioning.interferenceConsiderations.interferenceSensitivity === 'high' ||
        conditioning.priority === 'low'
      ) {
        rawConditioningModifier = 'omit';
      } else {
        rawConditioningModifier = 'reduce';
      }
    } else {
      rawConditioningModifier = 'maintain';
    }

    rawReasons.push(
      'Multiple converging recovery signals observed in current observation without multi-session persistence.'
    );
    for (const s of [...severeSignals, ...moderateSignals, ...mildSignals]) {
      rawReasons.push(s.observation);
    }
    rawReasons.push(
      'Adaptive response: conditioning reduced/omitted, core volume trimmed, and effort buffer increased while preserving training frequency.'
    );

    decisionTrace.push('Evidence Classification: CONVERGING_CURRENT_SIGNALS.');
    decisionTrace.push('Status: CONSTRAINED.');
    decisionTrace.push(`Deload Decision: ${rawDeloadDecision.toUpperCase()}.`);
  }

  // ==================================================
  // CATEGORY A: SINGLE ISOLATED SIGNAL (Tier 2 or Tier 1)
  // ==================================================
  else if (totalNegativeSignals === 1) {
    evidenceCategory = 'isolated_signal';
    const singleSignal = evaluatedSignals[0];

    // Single mild soreness within normal limits is treated as stable
    if (singleSignal.category === 'soreness' && singleSignal.severity === 'mild') {
      rawEvaluatedLevel = 'stable';
      rawVolumeModifier = 'maintain';
      rawEffortModifier = 'maintain';
      rawConditioningModifier = 'maintain';
      rawFrequencyModifier = 'maintain';
      rawDeloadDecision = 'none';

      rawReasons.push(
        `Isolated mild signal noted (${singleSignal.observation}); baseline training demands maintained.`
      );
      decisionTrace.push('Evidence Classification: ISOLATED_SIGNAL (mild).');
      decisionTrace.push('Status: STABLE. Single mild signal does not justify training reduction.');
    } else {
      rawEvaluatedLevel = 'mildly_constrained';
      rawVolumeModifier = 'maintain';
      rawFrequencyModifier = 'maintain';
      rawDeloadDecision = 'none';

      rawReasons.push(
        `Isolated recovery strain observed: ${singleSignal.observation}. Core training demands maintained.`
      );
      decisionTrace.push('Evidence Classification: ISOLATED_SIGNAL.');
      decisionTrace.push(
        `Status: MILDLY_CONSTRAINED. Isolated signal (${singleSignal.category}: ${singleSignal.observation}).`
      );
      decisionTrace.push(
        'Invariance: Isolated temporary signal does NOT trigger volume reduction, frequency reduction, or deload.'
      );

      // Severe muscular soreness moderates acute session effort
      if (singleSignal.category === 'soreness' && singleSignal.severity === 'severe') {
        rawEffortModifier = 'easier';
        rawConditioningModifier = conditioning.demand !== 'none' ? 'reduce' : 'maintain';
        rawReasons.push('Severe acute soreness prompts precautionary effort moderation.');
      } else {
        rawEffortModifier = 'maintain';
        rawConditioningModifier = 'maintain';
      }
    }
  }

  // ==================================================
  // BASELINE: STABLE (Tier 1)
  // ==================================================
  else {
    evidenceCategory = 'isolated_signal';
    rawEvaluatedLevel = 'stable';
    rawVolumeModifier = 'maintain';
    rawEffortModifier = 'maintain';
    rawConditioningModifier = 'maintain';
    rawFrequencyModifier = 'maintain';
    rawDeloadDecision = 'none';

    rawReasons.push('Recovery markers are stable; training demands maintained without constraint.');
    decisionTrace.push('Evidence Classification: ZERO_NEGATIVE_SIGNALS.');
    decisionTrace.push('Status: STABLE. No ongoing recovery constraints indicated.');
  }

  // ==================================================
  // HYSTERESIS / CONSERVATIVE RELEASE EVALUATION
  // ==================================================
  let level = rawEvaluatedLevel;
  let volumeModifier = rawVolumeModifier;
  let effortModifier = rawEffortModifier;
  let conditioningModifier = rawConditioningModifier;
  let frequencyModifier = rawFrequencyModifier;
  let deloadDecision = rawDeloadDecision;
  const reasons = [...rawReasons];

  const previousLevel = runtimeState?.previousConstraintLevel;

  if (previousLevel !== undefined) {
    const prevTier = LEVEL_TIERS[previousLevel];
    const targetTier = LEVEL_TIERS[rawEvaluatedLevel];

    decisionTrace.push(
      `Hysteresis evaluation: previousLevel=${previousLevel} (tier ${prevTier}), evaluatedLevel=${rawEvaluatedLevel} (tier ${targetTier}).`
    );

    // Rule: Escalation is immediate (targetTier >= prevTier); Release is bounded by at most 1 tier (targetTier < prevTier)
    if (targetTier < prevTier) {
      const allowedReleaseTier = prevTier - 1;
      if (allowedReleaseTier > targetTier) {
        // Hysteresis applies: step down by at most 1 tier
        level = TIER_LEVELS[allowedReleaseTier];
        decisionTrace.push(
          `Hysteresis engaged: stepping down from ${previousLevel} to ${level} (1 tier release) instead of jumping directly to ${rawEvaluatedLevel}.`
        );
        reasons.unshift(
          `Conservative recovery release: stepping down from ${previousLevel} to ${level} to avoid training state oscillation.`
        );

        // Align modifiers to the clamped stepped-down tier
        if (level === 'constrained') {
          volumeModifier = 'reduce';
          effortModifier = 'easier';
          conditioningModifier = conditioning.demand !== 'none' ? 'reduce' : 'maintain';
          frequencyModifier = 'maintain';
          deloadDecision = 'none'; // Healthy current observation removes active deload recommendation
        } else if (level === 'mildly_constrained') {
          volumeModifier = 'maintain';
          effortModifier = 'maintain';
          conditioningModifier = 'maintain';
          frequencyModifier = 'maintain';
          deloadDecision = 'none';
        }
      } else {
        decisionTrace.push(
          `Hysteresis release: stepping down from ${previousLevel} to ${level} allowed without intermediate clamping.`
        );
      }
    } else if (targetTier > prevTier) {
      decisionTrace.push(
        `Immediate safety escalation: escalating from ${previousLevel} to ${level} without delay.`
      );
    }
  }

  decisionTrace.push(
    `Summary: level=${level}, volume=${volumeModifier}, effort=${effortModifier}, conditioning=${conditioningModifier}, frequency=${frequencyModifier}, deload=${deloadDecision}, evidence=${evidenceCategory}.`
  );

  return {
    level,
    volumeModifier,
    effortModifier,
    conditioningModifier,
    frequencyModifier,
    deloadDecision,
    reasons,
    decisionTrace,
  };
}
