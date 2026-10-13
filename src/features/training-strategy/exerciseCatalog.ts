/**
 * Exercise Metadata Contract & Deterministic Seed Catalog
 *
 * Defines the strongly typed developer-facing exercise metadata contract and a small,
 * balanced deterministic seed catalog for exercise selection testing and execution.
 *
 * DESIGN INVARIANTS:
 * 1. Strongly typed: zero `any`.
 * 2. Developer-facing metadata only; no biomechanical jargon exposed to user.
 * 3. An exercise may have multiple movement patterns and multiple primary/secondary muscles.
 * 4. Equipment matching uses exact IDs matching onboarding equipment options.
 * 5. Free from randomness and pure/deterministic.
 */

import type { MovementPattern, TrainingTarget } from './types';

export type ExerciseDifficulty = 'foundational' | 'standard' | 'advanced';

export type ExerciseType =
  | 'compound'
  | 'isolation'
  | 'machine'
  | 'bodyweight'
  | 'cardio';

export type ExerciseProgressionProfile =
  | 'primary_compound'
  | 'secondary_compound'
  | 'isolation'
  | 'bodyweight'
  | 'conditioning';

export type ExerciseDefinition = {
  id: string;
  name: string;

  movementPatterns: MovementPattern[];

  primaryMuscles: TrainingTarget[];
  secondaryMuscles: TrainingTarget[];

  equipmentRequired: string[];

  difficulty: ExerciseDifficulty;

  exerciseType: ExerciseType;

  progressionProfile: ExerciseProgressionProfile;

  stableSetup: boolean;
};

/**
 * Deterministic seed catalog covering all fundamental movement patterns,
 * muscle targets, equipment types, and difficulties.
 */
export const SEED_EXERCISE_CATALOG: readonly ExerciseDefinition[] = [
  // 1. Horizontal Push
  {
    id: 'bench_press',
    name: 'Barbell Bench Press',
    movementPatterns: ['horizontal_push'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    equipmentRequired: ['barbell', 'bench'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'primary_compound',
    stableSetup: true,
  },
  {
    id: 'dumbbell_bench_press',
    name: 'Dumbbell Bench Press',
    movementPatterns: ['horizontal_push'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    equipmentRequired: ['dumbbells', 'bench'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },
  {
    id: 'machine_chest_press',
    name: 'Machine Chest Press',
    movementPatterns: ['horizontal_push'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'shoulders'],
    equipmentRequired: ['machines'],
    difficulty: 'foundational',
    exerciseType: 'machine',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },
  {
    id: 'push_up',
    name: 'Push-Up',
    movementPatterns: ['horizontal_push'],
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps', 'core'],
    equipmentRequired: [], // Bodyweight
    difficulty: 'foundational',
    exerciseType: 'bodyweight',
    progressionProfile: 'bodyweight',
    stableSetup: true,
  },

  // 2. Horizontal Pull
  {
    id: 'barbell_row',
    name: 'Barbell Row',
    movementPatterns: ['horizontal_pull'],
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    equipmentRequired: ['barbell'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'primary_compound',
    stableSetup: false,
  },
  {
    id: 'cable_row',
    name: 'Seated Cable Row',
    movementPatterns: ['horizontal_pull'],
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    equipmentRequired: ['cable_machine'],
    difficulty: 'foundational',
    exerciseType: 'machine',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },

  // 3. Vertical Pull
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    movementPatterns: ['vertical_pull'],
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps'],
    equipmentRequired: ['cable_machine'],
    difficulty: 'foundational',
    exerciseType: 'machine',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },
  {
    id: 'pull_up',
    name: 'Pull-Up',
    movementPatterns: ['vertical_pull'],
    primaryMuscles: ['back'],
    secondaryMuscles: ['biceps', 'core'],
    equipmentRequired: ['pullup_bar'],
    difficulty: 'standard',
    exerciseType: 'bodyweight',
    progressionProfile: 'bodyweight',
    stableSetup: true,
  },

  // 4. Vertical Push
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    movementPatterns: ['vertical_push'],
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'core'],
    equipmentRequired: ['barbell'],
    difficulty: 'advanced',
    exerciseType: 'compound',
    progressionProfile: 'primary_compound',
    stableSetup: false,
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell Shoulder Press',
    movementPatterns: ['vertical_push'],
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps'],
    equipmentRequired: ['dumbbells', 'bench'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },

  // 5. Shoulder Isolation
  {
    id: 'lateral_raise',
    name: 'Dumbbell Lateral Raise',
    movementPatterns: ['vertical_push'], // isolation movement related to upper push
    primaryMuscles: ['shoulders'],
    secondaryMuscles: [],
    equipmentRequired: ['dumbbells'],
    difficulty: 'foundational',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },

  // 6. Squat
  {
    id: 'barbell_squat',
    name: 'Barbell Back Squat',
    movementPatterns: ['squat'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['core'],
    equipmentRequired: ['barbell', 'power_rack'],
    difficulty: 'advanced',
    exerciseType: 'compound',
    progressionProfile: 'primary_compound',
    stableSetup: false,
  },
  {
    id: 'goblet_squat',
    name: 'Dumbbell Goblet Squat',
    movementPatterns: ['squat'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['core'],
    equipmentRequired: ['dumbbells'],
    difficulty: 'foundational',
    exerciseType: 'compound',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },
  {
    id: 'leg_press',
    name: 'Leg Press',
    movementPatterns: ['squat'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: [],
    equipmentRequired: ['machines'],
    difficulty: 'foundational',
    exerciseType: 'machine',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },

  // 7. Hinge
  {
    id: 'deadlift',
    name: 'Barbell Deadlift',
    movementPatterns: ['hinge'],
    primaryMuscles: ['back', 'hamstrings', 'glutes'],
    secondaryMuscles: ['core'],
    equipmentRequired: ['barbell'],
    difficulty: 'advanced',
    exerciseType: 'compound',
    progressionProfile: 'primary_compound',
    stableSetup: false,
  },
  {
    id: 'romanian_deadlift',
    name: 'Romanian Deadlift',
    movementPatterns: ['hinge'],
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['back'],
    equipmentRequired: ['barbell'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },
  {
    id: 'hip_thrust',
    name: 'Barbell Hip Thrust',
    movementPatterns: ['hinge'],
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings'],
    equipmentRequired: ['barbell', 'bench'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'secondary_compound',
    stableSetup: true,
  },

  // 8. Lunge
  {
    id: 'split_squat',
    name: 'Dumbbell Split Squat',
    movementPatterns: ['lunge'],
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings'],
    equipmentRequired: ['dumbbells'],
    difficulty: 'standard',
    exerciseType: 'compound',
    progressionProfile: 'secondary_compound',
    stableSetup: false,
  },

  // 9. Leg Isolation (Hamstrings, Quads, Calves)
  {
    id: 'leg_curl',
    name: 'Hamstring Leg Curl',
    movementPatterns: ['hinge'],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    equipmentRequired: ['machines'],
    difficulty: 'foundational',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    movementPatterns: ['squat'],
    primaryMuscles: ['quads'],
    secondaryMuscles: [],
    equipmentRequired: ['machines'],
    difficulty: 'foundational',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },
  {
    id: 'calf_raise',
    name: 'Calf Raise',
    movementPatterns: ['squat'],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipmentRequired: ['dumbbells'],
    difficulty: 'foundational',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },

  // 10. Arm Isolation (Biceps, Triceps)
  {
    id: 'biceps_curl',
    name: 'Dumbbell Biceps Curl',
    movementPatterns: ['horizontal_pull'],
    primaryMuscles: ['biceps'],
    secondaryMuscles: [],
    equipmentRequired: ['dumbbells'],
    difficulty: 'foundational',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },
  {
    id: 'cable_triceps_pressdown',
    name: 'Cable Triceps Pressdown',
    movementPatterns: ['horizontal_push'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipmentRequired: ['cable_machine'],
    difficulty: 'foundational',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },

  // 11. Core
  {
    id: 'plank',
    name: 'Plank',
    movementPatterns: ['core'],
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    equipmentRequired: [], // Bodyweight
    difficulty: 'foundational',
    exerciseType: 'bodyweight',
    progressionProfile: 'bodyweight',
    stableSetup: true,
  },
  {
    id: 'cable_crunch',
    name: 'Cable Crunch',
    movementPatterns: ['core'],
    primaryMuscles: ['core'],
    secondaryMuscles: [],
    equipmentRequired: ['cable_machine'],
    difficulty: 'standard',
    exerciseType: 'isolation',
    progressionProfile: 'isolation',
    stableSetup: true,
  },

  // 12. Conditioning
  {
    id: 'walking',
    name: 'Brisk Walking',
    movementPatterns: ['conditioning'],
    primaryMuscles: ['conditioning'],
    secondaryMuscles: ['calves', 'quads'],
    equipmentRequired: [], // Bodyweight / outdoors
    difficulty: 'foundational',
    exerciseType: 'cardio',
    progressionProfile: 'conditioning',
    stableSetup: true,
  },
  {
    id: 'cycling',
    name: 'Stationary Cycling',
    movementPatterns: ['conditioning'],
    primaryMuscles: ['conditioning'],
    secondaryMuscles: ['quads'],
    equipmentRequired: ['cardio_equipment'],
    difficulty: 'foundational',
    exerciseType: 'cardio',
    progressionProfile: 'conditioning',
    stableSetup: true,
  },
];
