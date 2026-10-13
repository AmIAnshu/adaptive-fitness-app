/**
 * T8 — Conditioning Strategy
 *
 * Deterministically establishes the user's baseline conditioning strategy based on
 * resolved objective (T1), frequency (T2), split structure (T3), starting load (T4),
 * activity and lifestyle context, equipment constraints, and user preferences.
 *
 * DESIGN INVARIANTS:
 * 1. T8 is NOT a workout generator:
 *    - Does NOT output exact conditioning workouts, calendar days, durations (minutes),
 *      interval lengths, distances, speeds, heart-rate targets, calories, or sets/reps.
 * 2. Interference & Resistance Protection:
 *    - Explicitly models resistance protection and interference sensitivity to prevent
 *      unnecessary interference with primary resistance adaptations.
 * 3. Scope & Safety:
 *    - Does NOT make recovery scores or deload decisions (reserved for T9).
 *    - Does NOT reduce T6 training demand or override T4 volume.
 *    - Does NOT diagnose overtraining or medical/injury conditions.
 * 4. Pure, deterministic, non-mutating, zero dependencies.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  FrequencyResolution,
  TrainingStructure,
  TrainingLoadStrategy,
  ConditioningStrategy,
  ConditioningPriority,
  ConditioningDemand,
  ConditioningMode,
  ConditioningModalityFamily,
  ResistanceProtection,
  InterferenceSensitivity,
  SessionPlacementGuidance,
  MinimumViableFallback,
  ConditioningFrequencyRelationship,
} from './types';
import type { ComprehensiveTrainingDemandAllocation } from './trainingDemand';
import type { ComprehensiveProgressionStrategy } from './progressionStrategy';

/**
 * Deterministic product heuristic for high non-exercise physical activity.
 * This is a product heuristic subject to future evidence review, NOT a physiological or medical cutoff.
 */
export const HIGH_ACTIVITY_STEPS_THRESHOLD = 12000;
export const LOW_ACTIVITY_STEPS_REFERENCE = 5000;

/**
 * Resolves the deterministic baseline conditioning strategy for an adult trainee.
 *
 * @param profile - Validated CanonicalUserProfile
 * @param objective - ResolvedObjective from T1
 * @param frequency - FrequencyResolution from T2
 * @param structure - TrainingStructure from T3
 * @param trainingLoad - TrainingLoadStrategy from T4
 * @param trainingDemand - ComprehensiveTrainingDemandAllocation from T6
 * @param progression - ComprehensiveProgressionStrategy from T7
 * @returns ConditioningStrategy
 */
export function resolveConditioningStrategy(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  frequency: FrequencyResolution,
  structure: TrainingStructure,
  trainingLoad: TrainingLoadStrategy,
  trainingDemand: ComprehensiveTrainingDemandAllocation,
  progression: ComprehensiveProgressionStrategy
): ConditioningStrategy {
  const decisionTrace: string[] = [];

  // =========================================================================
  // 1. T1 OBJECTIVE INTEGRATION & INTERFERENCE SENSITIVITY
  // =========================================================================
  const priority: ConditioningPriority = objective.conditioningPriority;

  let resistanceProtection: ResistanceProtection = 'high';
  let interferenceSensitivity: InterferenceSensitivity = 'high';
  let interferenceRationale = '';

  switch (objective.primary) {
    case 'hypertrophy':
      resistanceProtection = 'high';
      interferenceSensitivity = 'high';
      interferenceRationale =
        'High resistance protection: prioritize muscle tension and mechanical stimulus; conditioning kept low-impact and low-interference to prevent blunting muscle hypertrophy.';
      break;
    case 'strength':
      resistanceProtection = 'high';
      interferenceSensitivity = 'high';
      interferenceRationale =
        'High resistance protection: preserve neuromuscular freshness and recovery capacity for compound resistance training performance.';
      break;
    case 'body_composition':
      resistanceProtection = 'moderate';
      interferenceSensitivity = 'moderate';
      interferenceRationale =
        'Balanced protection: conditioning supports energy turnover and cardiovascular health while preserving adequate capacity for resistance volume to maintain lean mass.';
      break;
    case 'fat_loss_support':
      resistanceProtection = 'moderate';
      interferenceSensitivity = 'moderate';
      interferenceRationale =
        'Balanced protection: conditioning serves a supportive role for general conditioning and energy balance, with resistance training remaining the foundational core.';
      break;
    case 'general_fitness':
      resistanceProtection = 'moderate';
      interferenceSensitivity = 'low';
      interferenceRationale =
        'Low interference sensitivity: broad conditioning development harmoniously complements resistance training for well-rounded athletic capacity and health.';
      break;
  }

  decisionTrace.push(
    `T8 Objective Integration: ${objective.primary} -> conditioningPriority=${priority}, resistanceProtection=${resistanceProtection}, interferenceSensitivity=${interferenceSensitivity}.`
  );

  // =========================================================================
  // 2. QUALITATIVE CONDITIONING DEMAND DETERMINATION
  // =========================================================================
  // Base demand from objective priority
  let demand: ConditioningDemand = priority === 'low' ? 'minimal' : 'moderate';
  decisionTrace.push(
    `Initial baseline demand from priority (${priority}): ${demand}.`
  );

  // Screen 8 Activity context
  const dailyActivity = profile.recoveryLifestyle.dailyActivity;
  const averageSteps = profile.recoveryLifestyle.averageSteps;

  if (dailyActivity === 'very_active') {
    if (demand === 'moderate') {
      demand = 'minimal';
      decisionTrace.push(
        'Daily activity outside gym is very active; conditioning demand moderated from moderate to minimal to prevent fatigue accumulation.'
      );
    } else if (demand === 'minimal' && profile.schedule.sessionDuration === '20_30') {
      demand = 'none';
      decisionTrace.push(
        'Very active daily activity combined with very short session duration (20–30 min); conditioning demand reduced to none.'
      );
    } else {
      decisionTrace.push(
        'Daily activity outside gym is very active; minimal baseline conditioning maintained without adding excess volume.'
      );
    }
  } else if (dailyActivity === 'mostly_sedentary') {
    decisionTrace.push(
      'Daily activity outside gym is mostly sedentary; conditioning provides beneficial supplemental physical activity.'
    );
  }

  // Steps signal (optional contextual product heuristic)
  if (averageSteps !== null && averageSteps !== undefined) {
    if (averageSteps >= HIGH_ACTIVITY_STEPS_THRESHOLD) {
      if (demand === 'moderate') {
        demand = 'minimal';
        decisionTrace.push(
          `Average daily steps (${averageSteps} >= ${HIGH_ACTIVITY_STEPS_THRESHOLD}) matches high-activity heuristic; baseline conditioning demand moderated to minimal.`
        );
      } else {
        decisionTrace.push(
          `Average daily steps (${averageSteps} >= ${HIGH_ACTIVITY_STEPS_THRESHOLD}) matches high-activity heuristic; active movement baseline recognized.`
        );
      }
    } else if (averageSteps < LOW_ACTIVITY_STEPS_REFERENCE) {
      decisionTrace.push(
        `Average daily steps (${averageSteps} < ${LOW_ACTIVITY_STEPS_REFERENCE}) indicates low baseline movement; supportive conditioning is reinforced.`
      );
    }
  } else {
    decisionTrace.push(
      'Average daily steps not reported; neutral baseline maintained without assuming high or low non-exercise activity.'
    );
  }

  // Recovery signal context (neutral context only: T8 establishes baseline conditioning intent only;
  // recovery-state constraints and volume/demand modifications are strictly deferred to T9)
  const recoveryState = profile.recoveryLifestyle.workoutRecovery;
  const sleepDuration = profile.recoveryLifestyle.sleepDuration;
  decisionTrace.push(
    `Recovery Context: sleep=${sleepDuration}, recoveryState=${recoveryState}. (Recovery-state constraints deferred to T9; T8 baseline demand unmodified).`
  );

  // Short session protection
  const sessionDuration = profile.schedule.sessionDuration;
  if (sessionDuration === '20_30') {
    if (priority === 'low') {
      demand = 'none';
      decisionTrace.push(
        'Short session duration (20–30 min) with low conditioning priority; conditioning demand set to none to preserve all time for resistance slots.'
      );
    } else {
      demand = 'minimal';
      decisionTrace.push(
        'Short session duration (20–30 min) with moderate conditioning priority; conditioning demand capped at minimal so resistance slots are not crowded out.'
      );
    }
  } else if (sessionDuration === '30_45' && demand === 'moderate' && dailyActivity === 'very_active') {
    demand = 'minimal';
    decisionTrace.push(
      'Session duration (30–45 min) with very active lifestyle; demand moderated to minimal.'
    );
  }

  // Low training frequency protection (e.g. 2-day total schedule)
  if (frequency.targetDays <= 2 && priority === 'low') {
    demand = 'none';
    decisionTrace.push(
      'Low target frequency (<= 2 days) with low conditioning priority; conditioning demand set to none to protect full-body resistance coverage.'
    );
  }

  // User training style preference guard:
  // "High intensity" training style preference does NOT convert to high conditioning demand
  if (profile.trainingPreferences.preferredStyle === 'high_intensity') {
    decisionTrace.push(
      'User expressed high intensity training style preference; treated as modality/effort preference only, NOT as an expansion of conditioning demand.'
    );
  }

  decisionTrace.push(`Resolved Qualitative Conditioning Demand: ${demand}.`);

  // =========================================================================
  // 3. CONDITIONING MODE DETERMINATION
  // =========================================================================
  let mode: ConditioningMode = 'none';

  if (demand === 'none') {
    mode = 'none';
  } else if (demand === 'minimal') {
    if (sessionDuration === '20_30' || resistanceProtection === 'high') {
      mode = 'optional';
    } else {
      mode = 'integrated';
    }
  } else {
    // demand === 'moderate'
    if (frequency.targetDays >= 5 && structure.splitFamily !== 'full_body') {
      mode = 'dedicated';
    } else {
      mode = 'integrated';
    }
  }

  decisionTrace.push(`Resolved Conditioning Mode: ${mode}.`);

  // =========================================================================
  // 4. EQUIPMENT & CONSTRAINT CONTEXT
  // =========================================================================
  const hasCardioEquipment =
    profile.trainingEnvironment.equipmentMode === 'most_gym_equipment' ||
    profile.trainingEnvironment.equipmentIds.includes('cardio_equipment');

  const hasBandsOrWeights =
    profile.trainingEnvironment.equipmentMode === 'most_gym_equipment' ||
    profile.trainingEnvironment.equipmentIds.includes('resistance_bands') ||
    profile.trainingEnvironment.equipmentIds.includes('dumbbells') ||
    profile.trainingEnvironment.equipmentIds.includes('kettlebell');

  decisionTrace.push(
    `Equipment Context: cardioEquipment=${hasCardioEquipment}, bandsOrWeights=${hasBandsOrWeights}.`
  );

  // =========================================================================
  // 5. MODALITY FAMILIES SELECTION & EXPERIENCE SENSITIVITY
  // =========================================================================
  const complexity = structure.programmingComplexity;
  const stylePreference = profile.trainingPreferences.preferredStyle;
  const varietyPreference = profile.trainingPreferences.exerciseVariety;

  const preferredModalityFamilies: ConditioningModalityFamily[] = [];
  const optionalModalityAlternatives: ConditioningModalityFamily[] = [];

  if (demand === 'none') {
    // When demand is none, optional low-impact alternatives remain accessible if user chooses
    optionalModalityAlternatives.push('walking_low_intensity');
    decisionTrace.push(
      'Conditioning demand is none; walking_low_intensity provided as an optional non-demanding alternative.'
    );
  } else if (complexity === 'foundational') {
    // Foundational trainees: simple, repeatable conditioning, avoid unnecessary complexity
    preferredModalityFamilies.push('walking_low_intensity');
    if (hasCardioEquipment) {
      preferredModalityFamilies.push('steady_state');
    }
    optionalModalityAlternatives.push('recreational_activity');
    decisionTrace.push(
      'Foundational programming complexity: simple, repeatable modalities selected (walking_low_intensity, steady_state); complex intervals avoided.'
    );
  } else if (complexity === 'advanced') {
    // Advanced trainees: broader modality options including intervals and mixed conditioning
    if (stylePreference === 'high_intensity' && interferenceSensitivity !== 'high') {
      preferredModalityFamilies.push('intervals');
      if (hasBandsOrWeights) {
        preferredModalityFamilies.push('mixed_conditioning');
      } else {
        preferredModalityFamilies.push('steady_state');
      }
    } else if (objective.primary === 'general_fitness') {
      preferredModalityFamilies.push('steady_state');
      if (hasBandsOrWeights) {
        preferredModalityFamilies.push('mixed_conditioning');
      }
      optionalModalityAlternatives.push('intervals');
    } else {
      // Hypertrophy, strength, or body composition
      if (hasCardioEquipment) {
        preferredModalityFamilies.push('steady_state');
      }
      preferredModalityFamilies.push('walking_low_intensity');
      if (hasBandsOrWeights) {
        optionalModalityAlternatives.push('mixed_conditioning');
      }
    }
    optionalModalityAlternatives.push('recreational_activity');
    if (!preferredModalityFamilies.includes('walking_low_intensity')) {
      optionalModalityAlternatives.push('walking_low_intensity');
    }
    decisionTrace.push(
      'Advanced programming complexity: broader modality spectrum configured with high-skill tolerance.'
    );
  } else {
    // Standard trainees: normal variety and progression possibilities
    if (objective.primary === 'hypertrophy' || objective.primary === 'strength') {
      preferredModalityFamilies.push('walking_low_intensity');
      if (hasCardioEquipment) {
        preferredModalityFamilies.push('steady_state');
      }
      if (hasBandsOrWeights) {
        optionalModalityAlternatives.push('mixed_conditioning');
      }
      optionalModalityAlternatives.push('recreational_activity');
    } else if (objective.primary === 'general_fitness') {
      if (hasCardioEquipment) {
        preferredModalityFamilies.push('steady_state');
      } else {
        preferredModalityFamilies.push('walking_low_intensity');
      }
      if (hasBandsOrWeights) {
        preferredModalityFamilies.push('mixed_conditioning');
      }
      optionalModalityAlternatives.push('recreational_activity');
      if (stylePreference === 'high_intensity') {
        optionalModalityAlternatives.push('intervals');
      }
    } else {
      // Body composition or fat loss support
      if (hasCardioEquipment) {
        preferredModalityFamilies.push('steady_state');
        preferredModalityFamilies.push('walking_low_intensity');
      } else {
        preferredModalityFamilies.push('walking_low_intensity');
        if (hasBandsOrWeights) {
          preferredModalityFamilies.push('mixed_conditioning');
        }
      }
      if (stylePreference === 'high_intensity' && !preferredModalityFamilies.includes('intervals')) {
        optionalModalityAlternatives.push('intervals');
      }
      optionalModalityAlternatives.push('recreational_activity');
    }
    decisionTrace.push(
      'Standard programming complexity: balanced modality families configured.'
    );
  }

  // Modality adjustment when NO cardio equipment is available
  if (!hasCardioEquipment) {
    // Ensure machine-based steady state is not stranded as the sole primary modality
    const steadyIndex = preferredModalityFamilies.indexOf('steady_state');
    if (steadyIndex !== -1 && !preferredModalityFamilies.includes('walking_low_intensity')) {
      preferredModalityFamilies.splice(steadyIndex, 1, 'walking_low_intensity');
      decisionTrace.push(
        'No dedicated cardio equipment available; steady_state substituted with walking_low_intensity in preferred modalities.'
      );
    }
  }

  // Variety preference tuning
  if (varietyPreference === 'repeat_key_exercises') {
    // Keep preferred modalities focused (max 1 or 2), prune alternatives
    if (preferredModalityFamilies.length > 2) {
      preferredModalityFamilies.length = 2;
    }
    if (optionalModalityAlternatives.length > 1) {
      optionalModalityAlternatives.length = 1;
    }
    decisionTrace.push(
      'User prefers repeating key routines; focused modality families maintained.'
    );
  } else if (varietyPreference === 'change_often') {
    if (!optionalModalityAlternatives.includes('recreational_activity')) {
      optionalModalityAlternatives.push('recreational_activity');
    }
    decisionTrace.push(
      'User prefers variety; broader alternative modality options offered.'
    );
  }

  // Deduplicate modality arrays
  const uniquePreferred = Array.from(new Set(preferredModalityFamilies));
  const uniqueOptional = Array.from(
    new Set(optionalModalityAlternatives.filter((m) => !uniquePreferred.includes(m)))
  );

  decisionTrace.push(
    `Selected Modality Families: preferred=[${uniquePreferred.join(', ')}], optional=[${uniqueOptional.join(', ')}].`
  );

  // =========================================================================
  // 6. FREQUENCY RELATIONSHIP & MINIMUM-VIABLE FALLBACK
  // =========================================================================
  let minimumViableFallback: MinimumViableFallback = 'prioritize_resistance_omit_conditioning';
  let fallbackGuidance = '';

  if (demand === 'none') {
    minimumViableFallback = 'prioritize_resistance_omit_conditioning';
    fallbackGuidance =
      'Conditioning is not active; minimum viable frequency focuses 100% of schedule capacity on resistance training.';
  } else if (demand === 'minimal') {
    minimumViableFallback = 'prioritize_resistance_omit_conditioning';
    fallbackGuidance = `When training availability drops to minimum viable frequency (${frequency.minimumViableDays} days), resistance training slots are fully protected; conditioning is omitted from training sessions.`;
  } else {
    // demand === 'moderate'
    minimumViableFallback = 'prioritize_resistance_reduce_conditioning';
    fallbackGuidance = `When training availability drops to minimum viable frequency (${frequency.minimumViableDays} days), primary resistance volume is preserved; conditioning demand scales down to minimal or optional walking.`;
  }

  const targetAvailabilityGuidance =
    demand === 'none'
      ? `At target frequency (${frequency.targetDays} days), all training capacity is dedicated to resistance objectives.`
      : `At target frequency (${frequency.targetDays} days), conditioning is integrated within available schedule capacity without displacing resistance training slots.`;

  const frequencyRelationship: ConditioningFrequencyRelationship = {
    targetAvailabilityGuidance,
    minimumViableFallback,
    fallbackGuidance,
  };

  decisionTrace.push(
    `Frequency Relationship: target=${frequency.targetDays}d, minViable=${frequency.minimumViableDays}d, fallback=${minimumViableFallback}.`
  );

  // =========================================================================
  // 7. SESSION PLACEMENT GUIDANCE (ABSTRACT)
  // =========================================================================
  let placementGuidance: SessionPlacementGuidance = 'none';
  let placementRationale = '';

  if (demand === 'none') {
    placementGuidance = 'none';
    placementRationale =
      'Conditioning demand is none; zero conditioning session placement required.';
  } else if (sessionDuration === '20_30') {
    placementGuidance = 'flexible';
    placementRationale =
      'Session duration is very short (20–30 min); any conditioning must occur flexibly outside the resistance workout to avoid compressing lifting sets.';
  } else if (mode === 'integrated') {
    placementGuidance = 'post_resistance';
    placementRationale =
      'Conditioning is placed at the end of the resistance workout to ensure heavy compound lifting is completed without cardiovascular pre-fatigue.';
  } else if (mode === 'dedicated') {
    placementGuidance = 'separate_session';
    placementRationale =
      'Conditioning is scheduled in separate sessions or on non-lifting days to allow full neuromuscular recovery between resistance workouts.';
  } else {
    // mode === 'optional'
    placementGuidance = 'flexible';
    placementRationale =
      'Conditioning is optional and placed flexibly post-workout or on active recovery days at the trainee’s discretion.';
  }

  decisionTrace.push(
    `Placement Guidance: ${placementGuidance} (${placementRationale})`
  );

  return {
    priority,
    demand,
    mode,
    preferredModalityFamilies: uniquePreferred,
    optionalModalityAlternatives: uniqueOptional,
    interferenceConsiderations: {
      resistanceProtection,
      interferenceSensitivity,
      rationale: interferenceRationale,
    },
    frequencyRelationship,
    placement: {
      guidance: placementGuidance,
      rationale: placementRationale,
    },
    decisionTrace,
  };
}
