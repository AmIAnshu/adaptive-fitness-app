/**
 * T5 — Exercise Selection Rules
 *
 * Deterministically filters, validates equipment compatibility, enforces hard exclusions,
 * and ranks eligible exercise candidates for downstream training-demand allocation (T6).
 *
 * RULES:
 * 1. Hard Exclusions (FIRST):
 *    - Avoid list (profile.exercisePreferences.avoid): absolute exclusion.
 *    - Equipment incompatibility: if required equipment is missing in custom equipment mode.
 *    - Incompatible exercises receive recorded exclusionReasons and are placed in excludedExerciseIds.
 *
 * 2. Equipment Compatibility:
 *    - Broad gym mode ('most_gym_equipment'): all standard gym equipment considered available.
 *    - Custom equipment mode ('custom'): exercise equipmentRequired must be satisfied by selected
 *      equipmentIds OR compatible customEquipments.
 *    - Bodyweight exercises (equipmentRequired is empty): always equipment compatible.
 *    - Cardio exercises requiring 'cardio_equipment' respect presence of 'cardio_equipment'.
 *
 * 3. Soft Preferences & Ranking:
 *    - Favorites (profile.exercisePreferences.favorites): strong positive ranking bonus.
 *      Cannot bypass hard avoid or equipment constraints.
 *    - Dislikes (profile.exercisePreferences.dislikes): negative ranking modifier, remains eligible.
 *    - Experience suitability:
 *      * foundational: favors foundational exercises; advanced-only heavily penalized / deprioritized.
 *      * standard: foundational and standard exercises prioritized; advanced permitted with modest weight.
 *      * advanced: all difficulties fully eligible.
 *    - Goal compatibility:
 *      * strength: favors primary compound movements.
 *      * hypertrophy: favors high-relevance compound and hypertrophy isolation movements.
 *      * body_composition: broad resistance coverage.
 *      * fat_loss_support: practical resistance coverage + conditioning support (not cardio-only).
 *      * general_fitness: broad multi-pattern coverage.
 *    - Variety preference:
 *      * 'repeat_key_exercises': favors stable setup exercises.
 *      * 'change_often': flattens penalties for broader pool.
 *    - Session duration / Time efficiency:
 *      * Short sessions ('20_30') favor time-efficient compound and bodyweight movements.
 *
 * INVARIANTS:
 * - Pure, deterministic, side-effect free, non-mutating.
 * - Does NOT assign workouts, exercises per workout, or weekly targets (belongs to T6).
 * - Does NOT create sets, reps, or RIR values.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  TrainingStructure,
  ExerciseSelectionStrategy,
  ExerciseCandidate,
  ExerciseSelectionReason,
} from './types';
import {
  type ExerciseDefinition,
  SEED_EXERCISE_CATALOG,
} from './exerciseCatalog';

/**
 * Checks whether an exercise is compatible with the user's equipment setup.
 */
export function isExerciseEquipmentCompatible(
  exercise: ExerciseDefinition,
  profile: CanonicalUserProfile
): boolean {
  // Bodyweight exercises require no equipment
  if (exercise.equipmentRequired.length === 0) {
    return true;
  }

  // Broad gym access provides all standard gym equipment
  if (profile.trainingEnvironment.equipmentMode === 'most_gym_equipment') {
    return true;
  }

  // Custom equipment mode: check selected equipment IDs and custom equipment definitions
  const selectedIds = new Set(profile.trainingEnvironment.equipmentIds);

  for (const requiredEq of exercise.equipmentRequired) {
    // 1. Direct ID match
    if (selectedIds.has(requiredEq)) {
      continue;
    }

    // 2. Custom equipment compatibility check
    // If user created custom equipment of matching type (e.g., barbell, dumbbell, machine, cable)
    const matchesCustom = profile.trainingEnvironment.customEquipment.some((custom) => {
      if (requiredEq === 'barbell' && custom.equipmentType === 'barbell') return true;
      if (
        (requiredEq === 'dumbbells' || requiredEq === 'adjustable_dumbbells') &&
        custom.equipmentType === 'dumbbell'
      )
        return true;
      if (requiredEq === 'cable_machine' && (custom.equipmentType === 'cable' || custom.loadingType === 'cable'))
        return true;
      if (
        requiredEq === 'machines' &&
        (custom.equipmentType === 'machine' ||
          custom.loadingType === 'weight_stack' ||
          custom.loadingType === 'plate_loaded')
      )
        return true;
      if (requiredEq === 'pullup_bar' && custom.equipmentType === 'bodyweight') return true;
      return false;
    });

    if (!matchesCustom) {
      return false;
    }
  }

  return true;
}

/**
 * Computes deterministic priority score and selection reasons for an eligible exercise.
 */
function evaluateExerciseCandidate(
  exercise: ExerciseDefinition,
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  structure: TrainingStructure
): { priority: number; reasons: ExerciseSelectionReason[] } {
  const reasons: ExerciseSelectionReason[] = ['equipment_compatible'];
  let score = 100; // Base score for all eligible exercises

  const { programmingComplexity } = structure;
  const primaryGoal = objective.primary;
  const { favorites, dislikes } = profile.exercisePreferences;
  const { volumePreference, exerciseVariety } = profile.trainingPreferences;
  const sessionDuration = profile.schedule.sessionDuration;

  // 1. Favorites & Dislikes Modifiers
  const isFavorite = favorites.includes(exercise.id);
  const isDisliked = dislikes.includes(exercise.id);

  if (isFavorite) {
    score += 50;
    reasons.push('favorite');
  }

  if (isDisliked) {
    score -= 35;
  }

  // 2. Experience Suitability
  if (programmingComplexity === 'foundational') {
    if (exercise.difficulty === 'foundational') {
      score += 25;
      reasons.push('experience_appropriate');
    } else if (exercise.difficulty === 'standard') {
      score += 10;
      reasons.push('experience_appropriate');
    } else if (exercise.difficulty === 'advanced') {
      score -= 40; // Deprioritized for foundational users
    }
  } else if (programmingComplexity === 'standard') {
    if (exercise.difficulty === 'standard' || exercise.difficulty === 'foundational') {
      score += 20;
      reasons.push('experience_appropriate');
    } else if (exercise.difficulty === 'advanced') {
      score += 5;
    }
  } else {
    // Advanced complexity
    score += 20;
    reasons.push('experience_appropriate');
  }

  // 3. Goal Compatibility
  let goalCompatible = false;
  if (primaryGoal === 'strength') {
    if (exercise.progressionProfile === 'primary_compound') {
      score += 35;
      goalCompatible = true;
    } else if (exercise.progressionProfile === 'secondary_compound') {
      score += 20;
      goalCompatible = true;
    }
  } else if (primaryGoal === 'hypertrophy') {
    if (exercise.progressionProfile === 'primary_compound' || exercise.progressionProfile === 'secondary_compound') {
      score += 25;
      goalCompatible = true;
    } else if (exercise.progressionProfile === 'isolation') {
      score += 20;
      goalCompatible = true;
    }
  } else if (primaryGoal === 'body_composition') {
    if (exercise.progressionProfile !== 'conditioning') {
      score += 20;
      goalCompatible = true;
    }
  } else if (primaryGoal === 'fat_loss_support') {
    // Broad resistance coverage with practical efficiency
    if (exercise.progressionProfile === 'secondary_compound' || exercise.progressionProfile === 'primary_compound') {
      score += 25;
      goalCompatible = true;
    } else if (exercise.exerciseType === 'cardio') {
      score += 15;
      goalCompatible = true;
    }
  } else if (primaryGoal === 'general_fitness') {
    // Broad movement pattern coverage
    score += 15;
    goalCompatible = true;
  }

  if (goalCompatible) {
    reasons.push('goal_compatible');
  }

  // 4. Variety Preference
  if (exerciseVariety === 'repeat_key_exercises') {
    if (exercise.stableSetup && (exercise.progressionProfile === 'primary_compound' || exercise.progressionProfile === 'secondary_compound')) {
      score += 15;
      reasons.push('variety');
    }
  } else if (exerciseVariety === 'change_often') {
    // Broaden eligibility of isolation and secondary options
    score += 10;
    reasons.push('variety');
  }

  // 5. Time Practicality
  if (sessionDuration === '20_30') {
    if (exercise.exerciseType === 'bodyweight' || exercise.exerciseType === 'machine') {
      score += 15;
      reasons.push('time_efficient');
    } else if (!exercise.stableSetup) {
      score -= 10; // complex setups less suitable for 20m sessions
    }
  } else if (sessionDuration === '30_45') {
    if (exercise.stableSetup) {
      score += 10;
      reasons.push('time_efficient');
    }
  }

  // Always at least 1 point for eligible candidates
  const priority = Math.max(1, score);

  return { priority, reasons };
}

/**
 * Resolves exercise selection strategy given user profile, objective, and structure.
 *
 * @param profile - Validated canonical user profile
 * @param objective - Resolved objective from T1
 * @param structure - Resolved training structure from T3
 * @param catalog - Optional exercise catalog (defaults to SEED_EXERCISE_CATALOG)
 * @returns Deterministic ExerciseSelectionStrategy
 */
export function resolveExerciseSelection(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  structure: TrainingStructure,
  catalog: readonly ExerciseDefinition[] = SEED_EXERCISE_CATALOG
): ExerciseSelectionStrategy {
  const candidates: ExerciseCandidate[] = [];
  const excludedExerciseIds: string[] = [];
  const exclusionReasons: Record<string, string[]> = {};

  const avoidSet = new Set(profile.exercisePreferences.avoid);

  for (const exercise of catalog) {
    const reasonsForExclusion: string[] = [];

    // 1. Hard Check: Avoid list
    if (avoidSet.has(exercise.id)) {
      reasonsForExclusion.push('Explicitly marked in avoid preferences');
    }

    // 2. Hard Check: Equipment compatibility
    const equipmentCompatible = isExerciseEquipmentCompatible(exercise, profile);
    if (!equipmentCompatible) {
      reasonsForExclusion.push(
        `Missing required equipment: ${exercise.equipmentRequired.join(', ')}`
      );
    }

    // Process exclusion if any hard check failed
    if (reasonsForExclusion.length > 0) {
      excludedExerciseIds.push(exercise.id);
      exclusionReasons[exercise.id] = reasonsForExclusion;
      continue;
    }

    // 3. Eligible Candidate: compute priority and reasons
    const { priority, reasons } = evaluateExerciseCandidate(
      exercise,
      profile,
      objective,
      structure
    );

    candidates.push({
      exerciseId: exercise.id,
      priority,
      reasons,
    });
  }

  // Deterministically sort candidates descending by priority, then ascending by exerciseId
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.exerciseId.localeCompare(b.exerciseId);
  });

  const decisionTrace: string[] = [
    `Total catalog exercises evaluated: ${catalog.length}`,
    `Eligible candidates identified: ${candidates.length}`,
    `Excluded exercises: ${excludedExerciseIds.length}`,
    `Equipment mode: ${profile.trainingEnvironment.equipmentMode}`,
    `Avoid count: ${profile.exercisePreferences.avoid.length}`,
    `Favorites count: ${profile.exercisePreferences.favorites.length}`,
    `Dislikes count: ${profile.exercisePreferences.dislikes.length}`,
    `Programming complexity filter: ${structure.programmingComplexity}`,
    `Primary objective alignment: ${objective.primary}`,
  ];

  if (candidates.length > 0) {
    decisionTrace.push(
      `Top ranked candidate: ${candidates[0].exerciseId} (priority ${candidates[0].priority})`
    );
  }

  return {
    candidates,
    excludedExerciseIds,
    exclusionReasons,
    decisionTrace,
  };
}
