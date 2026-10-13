/**
 * Onboarding constants — goal options for the first screen.
 */

import {
  GoalId,
  TrainingHistoryId,
  ConsistencyId,
  DayOfWeek,
  ScheduleFlexibility,
  SessionDuration,
  PreferredTrainingTime,
  TrainingLocationId,
  EquipmentId,
  EquipmentAccessMode,
  PreferredStyle,
  PreferredEffort,
  VolumePreference,
  ExerciseVariety,
  StructurePreference,
  SleepDuration,
  WorkoutRecovery,
  DailyActivity,
  DietType,
  PreferredMeals,
  MealSource,
  EatingOutFrequency,
  NutritionStructure,
  CommunicationStyle,
  DecisionAutonomy,
  ExplanationDepth,
  Accountability,
  BiologicalSex,
} from './onboardingState';

export interface GoalOption {
  id: GoalId;
  label: string;
  description: string;
  icon: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'build_muscle',
    label: 'Build muscle',
    description: 'Increase size and lean mass',
    icon: 'build_muscle',
  },
  {
    id: 'lose_fat',
    label: 'Lose fat',
    description: 'Reduce body fat while preserving muscle',
    icon: 'lose_fat',
  },
  {
    id: 'build_muscle_lose_fat',
    label: 'Build muscle + lose fat',
    description: 'Improve body composition',
    icon: 'build_muscle_lose_fat',
  },
  {
    id: 'get_stronger',
    label: 'Get stronger',
    description: 'Build strength and performance',
    icon: 'get_stronger',
  },
  {
    id: 'improve_fitness',
    label: 'Improve fitness',
    description: 'Improve strength, conditioning and health',
    icon: 'improve_fitness',
  },
  {
    id: 'not_sure',
    label: "I'm not sure yet",
    description: "We'll help you find a direction",
    icon: 'not_sure',
  },
];

export interface TrainingHistoryOption {
  id: TrainingHistoryId;
  label: string;
}

export const TRAINING_HISTORY_OPTIONS: TrainingHistoryOption[] = [
  { id: 'never', label: 'Never' },
  { id: 'under_3_months', label: 'Less than 3 months' },
  { id: '3_to_6_months', label: '3–6 months' },
  { id: '6_to_12_months', label: '6–12 months' },
  { id: '1_to_2_years', label: '1–2 years' },
  { id: '2_plus_years', label: '2+ years' },
];

export interface ConsistencyOption {
  id: ConsistencyId;
  label: string;
}

export const CONSISTENCY_OPTIONS: ConsistencyOption[] = [
  { id: 'rarely', label: 'Rarely' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'mostly_consistent', label: 'Mostly consistent' },
  { id: 'very_consistent', label: 'Very consistent' },
];

export interface DayOption {
  id: DayOfWeek;
  label: string;
  shortLabel: string;
}

export const DAYS_OF_WEEK: DayOption[] = [
  { id: 'mon', label: 'Monday', shortLabel: 'Mon' },
  { id: 'tue', label: 'Tuesday', shortLabel: 'Tue' },
  { id: 'wed', label: 'Wednesday', shortLabel: 'Wed' },
  { id: 'thu', label: 'Thursday', shortLabel: 'Thu' },
  { id: 'fri', label: 'Friday', shortLabel: 'Fri' },
  { id: 'sat', label: 'Saturday', shortLabel: 'Sat' },
  { id: 'sun', label: 'Sunday', shortLabel: 'Sun' },
];

export interface ScheduleFlexibilityOption {
  id: ScheduleFlexibility;
  label: string;
}

export const SCHEDULE_FLEXIBILITY_OPTIONS: ScheduleFlexibilityOption[] = [
  { id: 'fixed', label: 'Mostly fixed' },
  { id: 'sometimes_changes', label: 'Changes sometimes' },
  { id: 'often_changes', label: 'Changes a lot' },
];

export interface SessionDurationOption {
  id: SessionDuration;
  label: string;
}

export const SESSION_DURATION_OPTIONS: SessionDurationOption[] = [
  { id: '20_30', label: '20–30 min' },
  { id: '30_45', label: '30–45 min' },
  { id: '45_60', label: '45–60 min' },
  { id: '60_75', label: '60–75 min' },
  { id: '75_plus', label: '75+ min' },
];

export interface PreferredTrainingTimeOption {
  id: PreferredTrainingTime;
  label: string;
}

export const PREFERRED_TRAINING_TIME_OPTIONS: PreferredTrainingTimeOption[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'no_preference', label: 'No preference' },
];

export interface TrainingLocationOption {
  id: TrainingLocationId;
  label: string;
  description?: string;
}

export const TRAINING_LOCATION_OPTIONS: TrainingLocationOption[] = [
  { id: 'commercial_gym', label: 'Commercial gym', description: 'Full-service gym with broad machines & free weights' },
  { id: 'small_local_gym', label: 'Small/local gym', description: 'Studio or local facility with core equipment' },
  { id: 'home_gym', label: 'Home gym', description: 'Dedicated home setup with weights or rack' },
  { id: 'mostly_home', label: 'Mostly at home', description: 'Living space with minimal or bodyweight equipment' },
  { id: 'multiple_places', label: 'Multiple places', description: 'Mix of gym, home, or travel training' },
];

export interface EquipmentOption {
  id: EquipmentId;
  label: string;
}

export const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'adjustable_dumbbells', label: 'Adjustable dumbbells' },
  { id: 'cable_machine', label: 'Cable machine' },
  { id: 'smith_machine', label: 'Smith machine' },
  { id: 'power_rack', label: 'Power rack' },
  { id: 'bench', label: 'Bench' },
  { id: 'machines', label: 'Machines' },
  { id: 'pullup_bar', label: 'Pull-up bar' },
  { id: 'resistance_bands', label: 'Resistance bands' },
  { id: 'cardio_equipment', label: 'Cardio equipment' },
];

export interface CustomOptionItem {
  id: string;
  label: string;
}

export const EQUIPMENT_TYPES: CustomOptionItem[] = [
  { id: 'machine', label: 'Machine' },
  { id: 'cable', label: 'Cable' },
  { id: 'free_weight', label: 'Free weight' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'resistance_band', label: 'Resistance band' },
  { id: 'other', label: 'Other' },
];

export const LOADING_TYPES: CustomOptionItem[] = [
  { id: 'weight_stack', label: 'Weight stack' },
  { id: 'plate_loaded', label: 'Plate loaded' },
  { id: 'free_weight', label: 'Free weight' },
  { id: 'cable', label: 'Cable' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'resistance_band', label: 'Resistance band' },
  { id: 'unknown', label: 'Unknown' },
];

export const MUSCLE_GROUPS: CustomOptionItem[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
  { id: 'core', label: 'Core / Abs' },
  { id: 'forearms', label: 'Forearms' },
];

export const MOVEMENT_PATTERNS: CustomOptionItem[] = [
  { id: 'unknown', label: "Not sure — we'll figure it out" },
  { id: 'horizontal_push', label: 'Horizontal push' },
  { id: 'vertical_push', label: 'Vertical push' },
  { id: 'horizontal_pull', label: 'Horizontal pull' },
  { id: 'vertical_pull', label: 'Vertical pull' },
  { id: 'squat', label: 'Squat' },
  { id: 'hinge', label: 'Hinge' },
  { id: 'lunge', label: 'Lunge' },
  { id: 'shoulder_isolation', label: 'Shoulder isolation' },
  { id: 'arm_isolation', label: 'Arm isolation' },
  { id: 'calf_isolation', label: 'Calf isolation' },
  { id: 'core', label: 'Core' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'other', label: 'Other' },
];

export interface PreferredStyleOption {
  id: PreferredStyle;
  label: string;
  description: string;
}

export const PREFERRED_STYLE_OPTIONS: PreferredStyleOption[] = [
  {
    id: 'hypertrophy',
    label: 'Hypertrophy',
    description: 'Build muscle and size',
  },
  {
    id: 'strength',
    label: 'Strength',
    description: 'Improve strength and performance',
  },
  {
    id: 'high_intensity',
    label: 'High intensity',
    description: 'Fewer sets, high effort',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'A mix of strength, muscle and fitness',
  },
  {
    id: 'general_fitness',
    label: 'General fitness',
    description: 'Build strength, conditioning and overall fitness',
  },
  {
    id: 'not_sure',
    label: "I'm not sure yet",
    description: "We'll help choose a starting approach",
  },
];

export interface PreferredEffortOption {
  id: PreferredEffort;
  label: string;
  description: string;
}

export const PREFERRED_EFFORT_OPTIONS: PreferredEffortOption[] = [
  {
    id: 'moderate',
    label: 'Moderate',
    description: 'Leave some reps in reserve',
  },
  {
    id: 'hard',
    label: 'Hard',
    description: 'Push most working sets',
  },
  {
    id: 'very_hard',
    label: 'Very hard',
    description: 'Often train close to failure',
  },
  {
    id: 'not_sure',
    label: "I'm not sure yet",
    description: 'Let the coach decide',
  },
];

export interface VolumePreferenceOption {
  id: VolumePreference;
  label: string;
}

export const VOLUME_PREFERENCE_OPTIONS: VolumePreferenceOption[] = [
  {
    id: 'fewer_high_effort',
    label: 'Fewer exercises, higher effort',
  },
  {
    id: 'more_volume',
    label: 'More exercises, more volume',
  },
  {
    id: 'balanced',
    label: 'Balanced',
  },
  {
    id: 'not_sure',
    label: "I'm not sure yet",
  },
];

export interface ExerciseVarietyOption {
  id: ExerciseVariety;
  label: string;
}

export const EXERCISE_VARIETY_OPTIONS: ExerciseVarietyOption[] = [
  {
    id: 'repeat_key_exercises',
    label: 'I like repeating key exercises',
  },
  {
    id: 'some_variety',
    label: 'Some variety',
  },
  {
    id: 'change_often',
    label: 'I like changing exercises often',
  },
  {
    id: 'no_preference',
    label: 'No preference',
  },
];

export interface StructurePreferenceOption {
  id: StructurePreference;
  label: string;
  description: string;
}

export const STRUCTURE_PREFERENCE_OPTIONS: StructurePreferenceOption[] = [
  {
    id: 'full_body',
    label: 'Full body',
    description: 'Train your whole body each session',
  },
  {
    id: 'upper_lower',
    label: 'Upper / Lower',
    description: 'Alternate upper-body and lower-body sessions',
  },
  {
    id: 'ppl',
    label: 'Push / Pull / Legs',
    description: 'Organize sessions around pushing, pulling and legs',
  },
  {
    id: 'body_part_focused',
    label: 'Body-part focused',
    description: 'Give more focus to specific muscle groups across sessions',
  },
  {
    id: 'coach_decides',
    label: 'Let the coach decide',
    description: 'Choose the structure that best fits me',
  },
];

export type ExercisePreferenceCategory = 'favorites' | 'dislikes' | 'avoid';

export type ExerciseMuscleCategory =
  | 'All'
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core';

export interface SeedExercise {
  id: string;
  name: string;
  category: 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core';
  subCategory?: string;
}

export const EXERCISE_CATEGORY_FILTERS: ExerciseMuscleCategory[] = [
  'All',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
];

export const MAX_PREFERENCE_LIMITS: Record<ExercisePreferenceCategory, number> = {
  favorites: 8,
  dislikes: 5,
  avoid: 5,
};

export const SEED_EXERCISES: SeedExercise[] = [
  // CHEST
  { id: 'bench_press', name: 'Bench Press', category: 'Chest' },
  { id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press', category: 'Chest' },
  { id: 'machine_chest_press', name: 'Machine Chest Press', category: 'Chest' },
  { id: 'cable_fly', name: 'Cable Fly', category: 'Chest' },
  { id: 'dumbbell_fly', name: 'Dumbbell Fly', category: 'Chest' },
  { id: 'push_up', name: 'Push-Up', category: 'Chest' },

  // BACK
  { id: 'lat_pulldown', name: 'Lat Pulldown', category: 'Back' },
  { id: 'pull_up', name: 'Pull-Up', category: 'Back' },
  { id: 'chest_supported_row', name: 'Chest-Supported Row', category: 'Back' },
  { id: 'seated_cable_row', name: 'Seated Cable Row', category: 'Back' },
  { id: 'one_arm_dumbbell_row', name: 'One-Arm Dumbbell Row', category: 'Back' },

  // SHOULDERS
  { id: 'overhead_press', name: 'Overhead Press', category: 'Shoulders' },
  { id: 'dumbbell_shoulder_press', name: 'Dumbbell Shoulder Press', category: 'Shoulders' },
  { id: 'lateral_raise', name: 'Lateral Raise', category: 'Shoulders' },
  { id: 'cable_lateral_raise', name: 'Cable Lateral Raise', category: 'Shoulders' },
  { id: 'rear_delt_fly', name: 'Rear Delt Fly', category: 'Shoulders' },

  // ARMS (Biceps & Triceps)
  { id: 'dumbbell_curl', name: 'Dumbbell Curl', category: 'Arms', subCategory: 'Biceps' },
  { id: 'ez_bar_curl', name: 'EZ-Bar Curl', category: 'Arms', subCategory: 'Biceps' },
  { id: 'hammer_curl', name: 'Hammer Curl', category: 'Arms', subCategory: 'Biceps' },
  { id: 'cable_curl', name: 'Cable Curl', category: 'Arms', subCategory: 'Biceps' },
  { id: 'cable_pushdown', name: 'Cable Pushdown', category: 'Arms', subCategory: 'Triceps' },
  { id: 'overhead_cable_extension', name: 'Overhead Cable Extension', category: 'Arms', subCategory: 'Triceps' },
  { id: 'skull_crusher', name: 'Skull Crusher', category: 'Arms', subCategory: 'Triceps' },
  { id: 'dips', name: 'Dips', category: 'Arms', subCategory: 'Triceps' },

  // LEGS (Quads, Hamstrings / Glutes, Calves)
  { id: 'back_squat', name: 'Back Squat', category: 'Legs', subCategory: 'Quads' },
  { id: 'leg_press', name: 'Leg Press', category: 'Legs', subCategory: 'Quads' },
  { id: 'hack_squat', name: 'Hack Squat', category: 'Legs', subCategory: 'Quads' },
  { id: 'leg_extension', name: 'Leg Extension', category: 'Legs', subCategory: 'Quads' },
  { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', category: 'Legs', subCategory: 'Quads' },
  { id: 'romanian_deadlift', name: 'Romanian Deadlift', category: 'Legs', subCategory: 'Hamstrings / Glutes' },
  { id: 'leg_curl', name: 'Leg Curl', category: 'Legs', subCategory: 'Hamstrings / Glutes' },
  { id: 'hip_thrust', name: 'Hip Thrust', category: 'Legs', subCategory: 'Hamstrings / Glutes' },
  { id: 'glute_bridge', name: 'Glute Bridge', category: 'Legs', subCategory: 'Hamstrings / Glutes' },
  { id: 'good_morning', name: 'Good Morning', category: 'Legs', subCategory: 'Hamstrings / Glutes' },
  { id: 'standing_calf_raise', name: 'Standing Calf Raise', category: 'Legs', subCategory: 'Calves' },
  { id: 'seated_calf_raise', name: 'Seated Calf Raise', category: 'Legs', subCategory: 'Calves' },

  // CORE
  { id: 'cable_crunch', name: 'Cable Crunch', category: 'Core' },
  { id: 'hanging_knee_raise', name: 'Hanging Knee Raise', category: 'Core' },
  { id: 'plank', name: 'Plank', category: 'Core' },
];

export interface SleepDurationOption {
  id: SleepDuration;
  label: string;
}

export const SLEEP_DURATION_OPTIONS: SleepDurationOption[] = [
  { id: 'under_5', label: 'Less than 5 hours' },
  { id: '5_to_6', label: '5–6 hours' },
  { id: '6_to_7', label: '6–7 hours' },
  { id: '7_to_8', label: '7–8 hours' },
  { id: '8_plus', label: '8+ hours' },
];

export interface WorkoutRecoveryOption {
  id: WorkoutRecovery;
  label: string;
  description: string;
}

export const WORKOUT_RECOVERY_OPTIONS: WorkoutRecoveryOption[] = [
  {
    id: 'fully_recovered',
    label: 'Fully recovered',
    description: 'Ready to train again',
  },
  {
    id: 'mostly_recovered',
    label: 'Mostly recovered',
    description: 'Usually ready',
  },
  {
    id: 'sometimes_fatigued',
    label: 'Sometimes still fatigued',
    description: 'It depends on the workout',
  },
  {
    id: 'often_fatigued',
    label: 'Often fatigued',
    description: 'I often need more recovery',
  },
  {
    id: 'not_sure',
    label: "I'm not sure yet",
    description: "We'll learn from your training",
  },
];

export interface DailyActivityOption {
  id: DailyActivity;
  label: string;
  description: string;
}

export const DAILY_ACTIVITY_OPTIONS: DailyActivityOption[] = [
  {
    id: 'mostly_sedentary',
    label: 'Mostly sitting',
    description: 'Desk/study-based day',
  },
  {
    id: 'light',
    label: 'Lightly active',
    description: 'Some walking and movement',
  },
  {
    id: 'moderate',
    label: 'Moderately active',
    description: 'On your feet regularly',
  },
  {
    id: 'very_active',
    label: 'Very active',
    description: 'Physical job or lots of movement',
  },
];

export interface DietTypeOption {
  id: DietType;
  label: string;
}

export const DIET_TYPE_OPTIONS: DietTypeOption[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'eggetarian', label: 'Eggetarian' },
  { id: 'non_vegetarian', label: 'Non-vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'no_preference', label: 'No preference' },
  { id: 'other', label: 'Other' },
];

export interface DietaryRestrictionOption {
  id: string;
  label: string;
}

export const DIETARY_RESTRICTION_OPTIONS: DietaryRestrictionOption[] = [
  { id: 'dairy', label: 'Dairy' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'nuts', label: 'Nuts' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'other', label: 'Other' },
  { id: 'none', label: 'None' },
];

export interface PreferredMealsOption {
  id: PreferredMeals;
  label: string;
}

export const PREFERRED_MEALS_OPTIONS: PreferredMealsOption[] = [
  { id: '2', label: '2' },
  { id: '3', label: '3' },
  { id: '4', label: '4' },
  { id: '5_plus', label: '5+' },
  { id: 'flexible', label: 'Flexible' },
];

export interface MealSourceOption {
  id: MealSource;
  label: string;
  description: string;
}

export const MEAL_SOURCE_OPTIONS: MealSourceOption[] = [
  {
    id: 'mostly_cook',
    label: 'I mostly cook',
    description: 'I prepare most of my food',
  },
  {
    id: 'family_prepares',
    label: 'Family prepares most meals',
    description: 'Someone at home usually cooks',
  },
  {
    id: 'mixed',
    label: 'Mixed',
    description: 'I split between cooking and eating outside',
  },
  {
    id: 'mostly_outside',
    label: 'Mostly outside',
    description: 'Restaurants, canteen, delivery, etc.',
  },
];

export interface EatingOutFrequencyOption {
  id: EatingOutFrequency;
  label: string;
}

export const EATING_OUT_FREQUENCY_OPTIONS: EatingOutFrequencyOption[] = [
  { id: 'rarely', label: 'Rarely' },
  { id: '1_2_week', label: '1–2 times a week' },
  { id: '3_5_week', label: '3–5 times a week' },
  { id: 'almost_daily', label: 'Almost daily' },
];

export interface NutritionStructureOption {
  id: NutritionStructure;
  label: string;
  description: string;
}

export const NUTRITION_STRUCTURE_OPTIONS: NutritionStructureOption[] = [
  {
    id: 'very_structured',
    label: 'Very structured',
    description: 'Give me a clear meal-by-meal plan',
  },
  {
    id: 'mostly_structured',
    label: 'Mostly structured',
    description: 'Give me a plan with some flexibility',
  },
  {
    id: 'flexible',
    label: 'Flexible',
    description: 'Give me targets and food options',
  },
  {
    id: 'coach_decides',
    label: 'Let the coach decide',
    description: 'Choose what fits me best',
  },
];

export type FoodCategory =
  | 'All'
  | 'Grains'
  | 'Carbs'
  | 'Protein'
  | 'Dairy'
  | 'Fruits'
  | 'Vegetables'
  | 'Snacks';

export interface SeedFood {
  id: string;
  name: string;
  category: 'Grains' | 'Carbs' | 'Protein' | 'Dairy' | 'Fruits' | 'Vegetables' | 'Snacks';
}

export const FOOD_CATEGORY_FILTERS: FoodCategory[] = [
  'All',
  'Grains',
  'Carbs',
  'Protein',
  'Dairy',
  'Fruits',
  'Vegetables',
  'Snacks',
];

export const MAX_FOOD_PREFERENCE_LIMIT = 10;

export const SEED_FOODS: SeedFood[] = [
  // GRAINS
  { id: 'brown_rice', name: 'Brown Rice', category: 'Grains' },
  { id: 'white_rice', name: 'White Rice', category: 'Grains' },
  { id: 'roti', name: 'Roti / Flatbreads', category: 'Grains' },
  { id: 'oats', name: 'Oats', category: 'Grains' },
  { id: 'quinoa', name: 'Quinoa', category: 'Grains' },

  // CARBS
  { id: 'potatoes', name: 'Potatoes', category: 'Carbs' },
  { id: 'sweet_potatoes', name: 'Sweet Potatoes', category: 'Carbs' },
  { id: 'whole_wheat_bread', name: 'Whole Wheat Bread', category: 'Carbs' },

  // PROTEIN
  { id: 'chicken_breast', name: 'Chicken', category: 'Protein' },
  { id: 'eggs', name: 'Eggs', category: 'Protein' },
  { id: 'fish', name: 'Fish', category: 'Protein' },
  { id: 'paneer', name: 'Paneer', category: 'Protein' },
  { id: 'tofu', name: 'Tofu', category: 'Protein' },
  { id: 'lentils_dal', name: 'Lentils / Dal', category: 'Protein' },
  { id: 'beans_legumes', name: 'Beans / Legumes', category: 'Protein' },

  // DAIRY
  { id: 'milk', name: 'Milk', category: 'Dairy' },
  { id: 'yogurt_curd', name: 'Yogurt / Curd', category: 'Dairy' },
  { id: 'cheese', name: 'Cheese', category: 'Dairy' },

  // FRUITS
  { id: 'banana', name: 'Bananas', category: 'Fruits' },
  { id: 'apple', name: 'Apples', category: 'Fruits' },
  { id: 'berries', name: 'Berries', category: 'Fruits' },
  { id: 'orange', name: 'Oranges', category: 'Fruits' },

  // VEGETABLES
  { id: 'broccoli', name: 'Broccoli', category: 'Vegetables' },
  { id: 'spinach', name: 'Spinach', category: 'Vegetables' },
  { id: 'mixed_greens', name: 'Mixed Greens', category: 'Vegetables' },
  { id: 'carrots', name: 'Carrots', category: 'Vegetables' },
  { id: 'bell_peppers', name: 'Bell Peppers', category: 'Vegetables' },

  // SNACKS
  { id: 'nuts', name: 'Nuts / Almonds', category: 'Snacks' },
  { id: 'peanut_butter', name: 'Peanut Butter', category: 'Snacks' },
  { id: 'dark_chocolate', name: 'Dark Chocolate', category: 'Snacks' },
];

export interface CommunicationStyleOption {
  id: CommunicationStyle;
  label: string;
  description: string;
}

export const COMMUNICATION_STYLE_OPTIONS: CommunicationStyleOption[] = [
  {
    id: 'direct',
    label: 'Direct',
    description: 'Just tell me what to do.',
  },
  {
    id: 'educational',
    label: 'Educational',
    description: 'Explain the why when it matters.',
  },
  {
    id: 'motivational',
    label: 'Motivational',
    description: 'Keep me driven and accountable.',
  },
  {
    id: 'data_driven',
    label: 'Data-driven',
    description: 'Show me the numbers and trends.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Keep it simple and focused.',
  },
  {
    id: 'adaptive',
    label: 'A mix of these',
    description: 'Adapt the style to the situation.',
  },
];

export interface DecisionAutonomyOption {
  id: DecisionAutonomy;
  label: string;
  description: string;
}

export const DECISION_AUTONOMY_OPTIONS: DecisionAutonomyOption[] = [
  {
    id: 'coach_leads',
    label: 'Take the lead',
    description: 'You decide most training and nutrition changes.',
  },
  {
    id: 'recommend',
    label: 'Recommend changes',
    description: "Tell me what you'd change and why.",
  },
  {
    id: 'user_controls',
    label: 'Let me stay in control',
    description: "Suggest changes, but I'll decide.",
  },
];

export interface ExplanationDepthOption {
  id: ExplanationDepth;
  label: string;
  description: string;
}

export const EXPLANATION_DEPTH_OPTIONS: ExplanationDepthOption[] = [
  {
    id: 'action_only',
    label: 'Just the action',
    description: 'Keep it short.',
  },
  {
    id: 'brief',
    label: 'Brief explanation',
    description: 'Give me the reason in a sentence or two.',
  },
  {
    id: 'detailed',
    label: 'Detailed explanation',
    description: 'Teach me what is happening and why.',
  },
  {
    id: 'contextual',
    label: 'Depends on the situation',
    description: 'Keep simple things short and explain important decisions.',
  },
];

export interface AccountabilityOption {
  id: Accountability;
  label: string;
  description: string;
}

export const ACCOUNTABILITY_OPTIONS: AccountabilityOption[] = [
  {
    id: 'high',
    label: 'Keep me accountable',
    description: 'Call out missed workouts and help me get back on track.',
  },
  {
    id: 'gentle',
    label: 'Gentle reminders',
    description: 'Give me a nudge without being pushy.',
  },
  {
    id: 'important_only',
    label: 'Only remind me when something matters',
    description: 'Focus on important follow-ups.',
  },
  {
    id: 'self_managed',
    label: "I'll manage myself",
    description: "Don't build extra accountability into the experience.",
  },
];

export interface BiologicalSexOption {
  id: BiologicalSex;
  label: string;
}

export const BIOLOGICAL_SEX_OPTIONS: BiologicalSexOption[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];









