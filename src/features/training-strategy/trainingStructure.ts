/**
 * T3 — Training Structure / Split Resolution
 *
 * Deterministically resolves programming complexity, sessions per cycle, and
 * the foundational split family from the CanonicalUserProfile, ResolvedObjective,
 * and FrequencyResolution.
 *
 * RULES:
 * 1. Programming Complexity:
 *    - Derived internally from experience, consistency, and execution/programming confidence.
 *    - Never added to CanonicalUserProfile.
 *    - Foundational: limited experience (<3 mo / never), rare consistency, or low confidence (<=2).
 *    - Advanced: requires 2+ years AND very_consistent AND execution confidence >=4 AND programming confidence >=4.
 *    - Standard: remaining cases.
 * 2. Split Family:
 *    - 2 days: Always full_body.
 *    - 3 days: full_body default; advanced with long sessions & hypertrophy may use hybrid.
 *    - 4 days: upper_lower standard; foundational uses upper_lower (or full_body if short sessions); advanced with long sessions may use hybrid.
 *    - 5 days: upper_lower or hybrid for foundational/standard; hybrid or specialization for advanced.
 *    - 6 days: foundational uses upper_lower (never PPL); standard uses ppl or upper_lower; advanced uses ppl, upper_lower, or specialization.
 * 3. sessionsPerCycle MUST strictly equal frequency.targetDays.
 * 4. Schedule Mode:
 *    - flexible_sequence preserves split family while noting weekday independence in decision trace.
 *    - No weekday assignments or workout objects are created here.
 *
 * INVARIANTS:
 * - Pure, deterministic, side-effect free, non-mutating.
 * - Does not create workout objects, exercise IDs, sets, reps, or RIR.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  FrequencyResolution,
  TrainingStructure,
  ProgrammingComplexity,
  SplitFamily,
} from './types';

/**
 * Resolves programming complexity from raw user signals.
 */
function resolveProgrammingComplexity(profile: CanonicalUserProfile): {
  complexity: ProgrammingComplexity;
  reason: string;
} {
  const { trainingHistory, consistency, exerciseConfidence, programmingConfidence } =
    profile.trainingExperience;

  // 1. Foundational signals
  const isFoundationalHistory =
    trainingHistory === 'never' || trainingHistory === 'under_3_months';
  const isRareConsistency = consistency === 'rarely';
  const isLowConfidence = exerciseConfidence <= 2 || programmingConfidence <= 2;

  if (isFoundationalHistory || isRareConsistency || isLowConfidence) {
    const reasons: string[] = [];
    if (isFoundationalHistory) reasons.push(`experience is ${trainingHistory}`);
    if (isRareConsistency) reasons.push('consistency is rarely');
    if (isLowConfidence) reasons.push('confidence is low (<=2)');
    return {
      complexity: 'foundational',
      reason: `Foundational complexity: ${reasons.join(', ')}`,
    };
  }

  // 2. Advanced signals: requires ALL 4 criteria
  const isSubstantialHistory = trainingHistory === '2_plus_years';
  const isVeryConsistent = consistency === 'very_consistent';
  const isHighConfidence = exerciseConfidence >= 4 && programmingConfidence >= 4;

  if (isSubstantialHistory && isVeryConsistent && isHighConfidence) {
    return {
      complexity: 'advanced',
      reason:
        'Advanced complexity: 2+ years consistent training with high execution and programming confidence (>=4)',
    };
  }

  // 3. Standard: remaining cases
  return {
    complexity: 'standard',
    reason: 'Standard complexity: moderate experience, consistency, and confidence profile',
  };
}

/**
 * Selects the appropriate split family based on target days, complexity, session duration, objective,
 * and user structure preference, adhering to the strict precedence hierarchy.
 */
function resolveSplitFamily(
  targetDays: number,
  complexity: ProgrammingComplexity,
  sessionDuration: CanonicalUserProfile['schedule']['sessionDuration'],
  objective: ResolvedObjective['primary'],
  preference?: CanonicalUserProfile['trainingPreferences']['structurePreference']
): { split: SplitFamily; reason: string; preferenceTrace?: string } {
  const isShortDuration = sessionDuration === '20_30';
  const isLongDuration = sessionDuration === '60_75' || sessionDuration === '75_plus';
  const pref = preference ?? 'coach_decides';

  // =========================================================================
  // 1 & 2 DAYS: Feasibility & recovery mandate full_body unconditionally
  // =========================================================================
  if (targetDays <= 2) {
    let preferenceTrace: string | undefined;
    if (pref !== 'coach_decides' && pref !== 'full_body') {
      preferenceTrace = `Structure preference: ${pref}; constrained because ${targetDays}-day schedule requires full_body for feasibility and frequency distribution.`;
    } else if (pref === 'full_body') {
      preferenceTrace = `Structure preference: full_body; honored within ${targetDays}-day schedule.`;
    }
    return {
      split: 'full_body',
      reason: `${targetDays} training days: full_body distributes systemic stimulus with appropriate rest`,
      preferenceTrace,
    };
  }

  // =========================================================================
  // 3 DAYS: Feasibility default full_body; evaluate preference within safety
  // =========================================================================
  if (targetDays === 3) {
    // Foundational protection: always full_body for 3 days
    if (complexity === 'foundational') {
      let preferenceTrace: string | undefined;
      if (pref !== 'coach_decides' && pref !== 'full_body') {
        preferenceTrace = `Structure preference: ${pref}; constrained because current trainee structure is foundational and 3-day frequency requires full_body for foundational motor learning.`;
      } else if (pref === 'full_body') {
        preferenceTrace = 'Structure preference: full_body; honored for 3-day foundational trainee.';
      }
      return {
        split: 'full_body',
        reason: '3 days foundational: full_body provides balanced stimulus across weekly cycle',
        preferenceTrace,
      };
    }

    // Standard / Advanced:
    if (pref === 'full_body') {
      return {
        split: 'full_body',
        reason: '3 days: full_body provides balanced stimulus across weekly cycle',
        preferenceTrace: 'Structure preference: full_body; strongly favored and honored for 3-day frequency.',
      };
    }

    if (pref === 'body_part_focused') {
      // Body-part focused on 3 days requires advanced + long duration + hypertrophy to support hybrid
      if (complexity === 'advanced' && isLongDuration && objective === 'hypertrophy') {
        return {
          split: 'hybrid',
          reason: '3 days advanced with long sessions and hypertrophy objective: hybrid split accommodates body-part focus',
          preferenceTrace: 'Structure preference: body_part_focused; selected hybrid within feasible 3-day frequency for advanced trainee with long sessions.',
        };
      }
      return {
        split: 'full_body',
        reason: '3 days: full_body provides balanced stimulus across weekly cycle',
        preferenceTrace: `Structure preference: body_part_focused; constrained to full_body because 3-day frequency requires advanced experience, long sessions, and hypertrophy to support body-part hybrid.`,
      };
    }

    if (pref === 'ppl') {
      // 3-day PPL request: infeasible without rotating/hybrid interpretation; constrained to full_body
      return {
        split: 'full_body',
        reason: '3 days: full_body provides balanced stimulus across weekly cycle',
        preferenceTrace: 'Structure preference: ppl; constrained to full_body because 3-day frequency cannot support dedicated push/pull/legs without compromised frequency per muscle group.',
      };
    }

    if (pref === 'upper_lower') {
      return {
        split: 'full_body',
        reason: '3 days: full_body provides balanced stimulus across weekly cycle',
        preferenceTrace: 'Structure preference: upper_lower; constrained to full_body because 3-day frequency cannot balance a 2-way upper/lower split evenly across weeks.',
      };
    }

    // coach_decides (or undefined)
    if (complexity === 'advanced' && isLongDuration && objective === 'hypertrophy') {
      return {
        split: 'hybrid',
        reason: '3 days advanced with long sessions and hypertrophy objective: hybrid split',
      };
    }
    return {
      split: 'full_body',
      reason: '3 days: full_body provides balanced stimulus across weekly cycle',
    };
  }

  // =========================================================================
  // 4 DAYS: Standard is upper_lower; full_body or hybrid feasible
  // =========================================================================
  if (targetDays === 4) {
    if (complexity === 'foundational') {
      if (isShortDuration) {
        let preferenceTrace: string | undefined;
        if (pref !== 'coach_decides' && pref !== 'full_body') {
          preferenceTrace = `Structure preference: ${pref}; constrained because foundational trainee with short sessions (20-30 min) requires full_body for minimal session complexity.`;
        } else if (pref === 'full_body') {
          preferenceTrace = 'Structure preference: full_body; honored for 4-day foundational trainee with short sessions.';
        }
        return {
          split: 'full_body',
          reason: '4 days foundational with short sessions (20-30 min): full_body keeps session complexity minimal',
          preferenceTrace,
        };
      }

      // Foundational standard duration: upper_lower
      let preferenceTrace: string | undefined;
      if (pref === 'full_body') {
        return {
          split: 'full_body',
          reason: '4 days foundational with full_body preference: full_body distributes manageable sessions',
          preferenceTrace: 'Structure preference: full_body; honored for 4-day foundational trainee.',
        };
      }
      if (pref === 'upper_lower') {
        preferenceTrace = 'Structure preference: upper_lower; honored for 4-day foundational trainee.';
      } else if (pref !== 'coach_decides') {
        preferenceTrace = `Structure preference: ${pref}; constrained because current trainee structure is foundational; upper_lower selected for safe movement balance.`;
      }
      return {
        split: 'upper_lower',
        reason: '4 days foundational: upper_lower cleanly balances movement patterns',
        preferenceTrace,
      };
    }

    // Standard & Advanced 4-day:
    if (pref === 'full_body') {
      return {
        split: 'full_body',
        reason: '4 days with full_body preference: full_body structure distributes stimulus across 4 days',
        preferenceTrace: 'Structure preference: full_body; honored for 4-day schedule.',
      };
    }

    if (pref === 'upper_lower') {
      return {
        split: 'upper_lower',
        reason: '4 days: upper_lower provides optimal frequency and volume distribution',
        preferenceTrace: 'Structure preference: upper_lower; strongly favored and honored as ideal 4-day structure.',
      };
    }

    if (pref === 'body_part_focused') {
      if (complexity === 'advanced' && isLongDuration && objective === 'hypertrophy') {
        return {
          split: 'hybrid',
          reason: '4 days advanced with long sessions and hypertrophy objective: hybrid split accommodates body-part focus',
          preferenceTrace: 'Structure preference: body_part_focused; selected hybrid within 4-day schedule for advanced trainee with long sessions.',
        };
      }
      return {
        split: 'upper_lower',
        reason: '4 days: upper_lower provides optimal frequency and volume distribution',
        preferenceTrace: 'Structure preference: body_part_focused; constrained to upper_lower because 4-day frequency requires advanced experience, long sessions, and hypertrophy to support body-part hybrid.',
      };
    }

    if (pref === 'ppl') {
      // 4 days + PPL preference: cannot fit complete 6-day PPL; select upper_lower
      return {
        split: 'upper_lower',
        reason: '4 days: upper_lower provides optimal frequency and volume distribution',
        preferenceTrace: 'Structure preference: ppl; constrained to upper_lower because 4-day frequency cannot accommodate a complete push/pull/legs rotation without uneven cycle coverage.',
      };
    }

    // coach_decides
    if (complexity === 'advanced' && isLongDuration && objective === 'hypertrophy') {
      return {
        split: 'hybrid',
        reason: '4 days advanced with long sessions and hypertrophy objective: hybrid split',
      };
    }
    return {
      split: 'upper_lower',
      reason: '4 days standard: upper_lower provides optimal frequency and volume distribution',
    };
  }

  // =========================================================================
  // 5 DAYS: upper_lower, hybrid, specialization feasible
  // =========================================================================
  if (targetDays === 5) {
    if (complexity === 'foundational') {
      let preferenceTrace: string | undefined;
      if (pref === 'upper_lower') {
        preferenceTrace = 'Structure preference: upper_lower; honored for 5-day foundational trainee.';
      } else if (pref !== 'coach_decides') {
        preferenceTrace = `Structure preference: ${pref}; constrained because current trainee structure is foundational; upper_lower rotation selected for safe recovery.`;
      }
      return {
        split: 'upper_lower',
        reason: '5 days foundational: upper_lower rotation avoids excessive split complexity',
        preferenceTrace,
      };
    }

    // Standard / Advanced 5-day:
    if (pref === 'upper_lower') {
      return {
        split: 'upper_lower',
        reason: '5 days: upper_lower rotation balances recovery and session simplicity',
        preferenceTrace: 'Structure preference: upper_lower; honored for 5-day schedule.',
      };
    }

    if (pref === 'full_body') {
      // 5 days full body is excessive systemic frequency; upper_lower or hybrid is safer
      return {
        split: 'upper_lower',
        reason: '5 days: upper_lower rotation balances recovery and session simplicity',
        preferenceTrace: 'Structure preference: full_body; constrained to upper_lower because 5-day full body creates excessive systemic fatigue and inadequate inter-session recovery.',
      };
    }

    if (pref === 'body_part_focused') {
      if (complexity === 'advanced' && isLongDuration && objective === 'hypertrophy') {
        return {
          split: 'specialization',
          reason: '5 days advanced with long sessions and hypertrophy objective: specialization split',
          preferenceTrace: 'Structure preference: body_part_focused; selected specialization within feasible 5-day frequency and long sessions.',
        };
      }
      return {
        split: 'hybrid',
        reason: '5 days: hybrid split balances volume distribution',
        preferenceTrace: 'Structure preference: body_part_focused; selected hybrid within feasible 5-day frequency.',
      };
    }

    if (pref === 'ppl') {
      // 5 days + PPL preference: 5 days can run a hybrid/modified rotation or upper_lower
      // In existing T3, 5 days has hybrid (or upper_lower); PPL is an exact 3-session block that requires 6 days for full 2x coverage
      return {
        split: 'hybrid',
        reason: '5 days: hybrid split balances volume distribution',
        preferenceTrace: 'Structure preference: ppl; adapted to hybrid split because 5-day frequency accommodates a modified push/pull emphasis without an incomplete 6-day PPL cycle.',
      };
    }

    // coach_decides
    if (complexity === 'standard') {
      if (isShortDuration || objective === 'general_fitness' || objective === 'strength') {
        return {
          split: 'upper_lower',
          reason: '5 days standard: upper_lower rotation balances recovery and session simplicity',
        };
      }
      return {
        split: 'hybrid',
        reason: '5 days standard: hybrid split balances volume distribution',
      };
    }

    // Advanced coach_decides
    if (isLongDuration && objective === 'hypertrophy') {
      return {
        split: 'specialization',
        reason: '5 days advanced with long sessions and hypertrophy objective: specialization split',
      };
    }
    return {
      split: 'hybrid',
      reason: '5 days advanced: hybrid split accommodates targeted volume',
    };
  }

  // =========================================================================
  // 6 DAYS (or more): ppl, upper_lower, specialization feasible
  // =========================================================================
  if (complexity === 'foundational') {
    let preferenceTrace: string | undefined;
    if (pref === 'ppl') {
      preferenceTrace = 'Structure preference: ppl; constrained because current trainee structure is foundational; upper_lower selected to avoid excessive split complexity.';
    } else if (pref === 'upper_lower') {
      preferenceTrace = 'Structure preference: upper_lower; honored for 6-day foundational trainee.';
    } else if (pref !== 'coach_decides') {
      preferenceTrace = `Structure preference: ${pref}; constrained because current trainee structure is foundational; upper_lower selected for recovery safety.`;
    }
    return {
      split: 'upper_lower',
      reason: '6 days foundational: upper_lower rotation; high frequency does not force PPL on foundational users',
      preferenceTrace,
    };
  }

  // Standard / Advanced 6-day:
  if (pref === 'upper_lower') {
    return {
      split: 'upper_lower',
      reason: '6 days: upper_lower provides frequent pattern exposure and balanced recovery',
      preferenceTrace: 'Structure preference: upper_lower; honored for 6-day schedule.',
    };
  }

  if (pref === 'full_body') {
    return {
      split: 'upper_lower',
      reason: '6 days: upper_lower rotation balances recovery across high weekly frequency',
      preferenceTrace: 'Structure preference: full_body; constrained to upper_lower because 6-day full body creates excessive systemic fatigue and zero whole-body rest days.',
    };
  }

  if (pref === 'ppl') {
    // PPL preference on 6 days: check feasibility
    // Infeasible if short sessions AND objective is strength / general fitness favoring upper_lower
    if (isShortDuration && objective === 'general_fitness') {
      return {
        split: 'upper_lower',
        reason: '6 days with short sessions and general fitness: upper_lower rotation for simplicity',
        preferenceTrace: 'Structure preference: ppl; constrained to upper_lower because short sessions and general fitness require simpler pattern exposure.',
      };
    }
    return {
      split: 'ppl',
      reason: '6 days: push/pull/legs (PPL) accommodates 6-day training frequency',
      preferenceTrace: `Structure preference: ppl; compatible with 6-day availability and ${complexity} experience.`,
    };
  }

  if (pref === 'body_part_focused') {
    if (complexity === 'advanced' && isLongDuration && objective === 'hypertrophy') {
      return {
        split: 'specialization',
        reason: '6 days advanced with long sessions and hypertrophy objective: specialization split',
        preferenceTrace: 'Structure preference: body_part_focused; selected specialization within feasible 6-day frequency and advanced hypertrophy context.',
      };
    }
    if (complexity === 'advanced') {
      return {
        split: 'specialization',
        reason: '6 days advanced: specialization split accommodates targeted muscle group exposure',
        preferenceTrace: 'Structure preference: body_part_focused; selected specialization within feasible 6-day frequency for advanced trainee.',
      };
    }
    // Standard complexity with body-part focused preference on 6 days: PPL provides practical muscle group focus
    return {
      split: 'ppl',
      reason: '6 days standard: push/pull/legs (PPL) provides targeted muscle group exposure across 6 days',
      preferenceTrace: 'Structure preference: body_part_focused; selected ppl within feasible 6-day frequency to provide practical muscle-group exposure.',
    };
  }

  // coach_decides (or undefined)
  if (complexity === 'standard') {
    if (isShortDuration || objective === 'general_fitness') {
      return {
        split: 'upper_lower',
        reason: '6 days standard with short sessions or general fitness: upper_lower rotation for simplicity',
      };
    }
    return {
      split: 'ppl',
      reason: '6 days standard: push/pull/legs (PPL) accommodates 6-day training frequency',
    };
  }

  // Advanced coach_decides
  if (isLongDuration && objective === 'hypertrophy') {
    return {
      split: 'specialization',
      reason: '6 days advanced with long sessions and hypertrophy objective: specialization split',
    };
  }
  if (objective === 'strength' || isShortDuration) {
    return {
      split: 'upper_lower',
      reason: '6 days advanced for strength or shorter sessions: upper_lower provides frequent pattern exposure',
    };
  }
  return {
    split: 'ppl',
    reason: '6 days advanced: push/pull/legs (PPL) structure',
  };
}

/**
 * Resolves training structure, split family, and programming complexity.
 *
 * @param profile - Validated canonical user profile
 * @param objective - Resolved training objective from T1
 * @param frequency - Resolved frequency from T2
 * @returns Deterministic TrainingStructure with decision trace
 */
export function resolveTrainingStructure(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  frequency: FrequencyResolution
): TrainingStructure {
  const { complexity, reason: complexityReason } = resolveProgrammingComplexity(profile);
  const structurePref = profile.trainingPreferences?.structurePreference;
  const { split: splitFamily, reason: splitReason, preferenceTrace } = resolveSplitFamily(
    frequency.targetDays,
    complexity,
    profile.schedule.sessionDuration,
    objective.primary,
    structurePref
  );

  const decisionTrace: string[] = [
    `Target frequency: ${frequency.targetDays} days`,
    `Programming complexity: ${complexity}`,
    `Session duration: ${profile.schedule.sessionDuration}`,
    `Primary objective: ${objective.primary}`,
  ];

  if (frequency.targetDays >= 5 && complexity === 'foundational') {
    decisionTrace.push('High frequency did not increase programming complexity');
  }

  decisionTrace.push(`Selected split family: ${splitFamily}`);
  decisionTrace.push(splitReason);

  if (preferenceTrace) {
    decisionTrace.push(preferenceTrace);
  }

  // Schedule mode context
  if (frequency.structureMode === 'flexible_sequence') {
    decisionTrace.push('Schedule mode: flexible_sequence');
    decisionTrace.push('Workout sequencing must remain independent of fixed weekdays');
  } else if (frequency.structureMode === 'hybrid') {
    decisionTrace.push('Schedule mode: hybrid');
    decisionTrace.push('Day-based structure with flexibility to adjust session placement');
  } else {
    decisionTrace.push('Schedule mode: fixed_split');
    decisionTrace.push('Recurring day-based schedule structure');
  }

  return {
    splitFamily,
    sessionsPerCycle: frequency.targetDays,
    programmingComplexity: complexity,
    decisionTrace,
  };
}
