/**
 * T2 — Frequency Resolution
 *
 * Deterministically resolves weekly target training frequency, minimum viable days,
 * and schedule structure mode from the CanonicalUserProfile.
 *
 * RULES:
 * 1. availableDayCount = profile.schedule.availableDays.length
 * 2. targetDays = Math.min(profile.schedule.idealTrainingDays, availableDayCount)
 * 3. minimumViableDays = Math.min(profile.schedule.realisticMinimumDays, targetDays)
 * 4. Invariants guaranteed:
 *    - targetDays >= 1
 *    - minimumViableDays >= 1
 *    - minimumViableDays <= targetDays
 *    - targetDays <= availableDayCount
 * 5. Flexibility Mapping:
 *    - "fixed" → "fixed_split"
 *    - "sometimes_changes" → "hybrid"
 *    - "often_changes" → "flexible_sequence"
 *
 * INVARIANTS:
 * - Pure, deterministic, side-effect free, non-mutating.
 * - Does not use sessionDuration.
 * - Does not create workout assignments, exercise selections, or splits.
 */

import type { CanonicalUserProfile } from '../profile';
import type { FrequencyResolution, ScheduleStructure } from './types';

/**
 * Maps schedule flexibility to the appropriate schedule structure mode.
 */
function resolveStructureMode(
  flexibility: CanonicalUserProfile['schedule']['flexibility']
): { mode: ScheduleStructure; description: string } {
  switch (flexibility) {
    case 'fixed':
      return { mode: 'fixed_split', description: 'fixed' };
    case 'sometimes_changes':
      return { mode: 'hybrid', description: 'sometimes changes' };
    case 'often_changes':
      return { mode: 'flexible_sequence', description: 'often changes' };
    default:
      return { mode: 'hybrid', description: 'flexible' };
  }
}

/**
 * Resolves training frequency and schedule structure mode from user availability.
 *
 * @param profile - Validated canonical user profile
 * @returns Deterministic FrequencyResolution with decision trace
 */
export function resolveFrequency(
  profile: CanonicalUserProfile
): FrequencyResolution {
  const ideal = profile.schedule.idealTrainingDays;
  const rawMinimum = profile.schedule.realisticMinimumDays;
  const availableDays = profile.schedule.availableDays;
  const availableDayCount = availableDays ? availableDays.length : 0;

  // Protect minimum bounds (at least 1 day)
  const safeAvailableCount = Math.max(1, availableDayCount);

  // Target frequency cannot exceed available days
  const targetDays = Math.max(1, Math.min(ideal, safeAvailableCount));

  // Minimum viable days cannot exceed target frequency
  const minimumViableDays = Math.max(1, Math.min(rawMinimum, targetDays));

  // Resolve structure mode from schedule flexibility
  const { mode: structureMode, description: flexibilityDesc } = resolveStructureMode(
    profile.schedule.flexibility
  );

  // Build concise, deterministic decision trace
  const decisionTrace: string[] = [
    `Ideal training frequency: ${ideal} days`,
    `Available training days: ${availableDayCount}`,
  ];

  if (targetDays < ideal) {
    decisionTrace.push(
      `Target frequency reduced to ${targetDays} days to fit availability`
    );
  } else {
    decisionTrace.push(`Target frequency remains ${targetDays} days`);
  }

  if (minimumViableDays < rawMinimum) {
    decisionTrace.push(
      `Realistic minimum frequency adjusted to ${minimumViableDays} days`
    );
  } else {
    decisionTrace.push(
      `Realistic minimum frequency: ${minimumViableDays} days`
    );
  }

  decisionTrace.push(`Schedule flexibility: ${flexibilityDesc}`);
  decisionTrace.push(`Structure mode: ${structureMode}`);

  return {
    targetDays,
    minimumViableDays,
    availableDayCount,
    structureMode,
    decisionTrace,
  };
}
