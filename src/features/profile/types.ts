/**
 * Canonical User Profile Types
 *
 * Defines the single, normalized, strongly-typed representation of the user
 * derived from raw onboarding signals.
 *
 * IMPORTANT:
 * This schema stores raw signals. Downstream engines (Training, Nutrition,
 * AI Coach) consume this representation. It strictly avoids premature
 * derivations (e.g. beginner/intermediate/advanced labels, calorie/macro targets,
 * recovery scores, workout splits, or exercise prescriptions).
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
  EquipmentAccessMode,
  CustomEquipment,
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
} from '../onboarding/onboardingState';

// Conceptual type aliases aligning with canonical domain terminology
export type TrainingHistory = TrainingHistoryId;
export type TrainingConsistency = ConsistencyId;
export type TrainingLocation = TrainingLocationId;
export type EquipmentMode = EquipmentAccessMode;
export type TrainingStyle = PreferredStyle;
export type TrainingEffort = PreferredEffort;
export type AccountabilityLevel = Accountability;

// Re-export existing primitive types to avoid duplication
export type {
  GoalId,
  DayOfWeek,
  ScheduleFlexibility,
  SessionDuration,
  PreferredTrainingTime,
  CustomEquipment,
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
  BiologicalSex,
};

export type CanonicalUserProfile = {
  schemaVersion: 1;

  goal: {
    primary: GoalId;
  };

  anthropometrics: {
    age: number;
    heightCm: number;
    weightKg: number;
    biologicalSex?: BiologicalSex;
  };

  trainingExperience: {
    trainingHistory: TrainingHistory;
    consistency: TrainingConsistency;
    exerciseConfidence: 1 | 2 | 3 | 4 | 5;
    programmingConfidence: 1 | 2 | 3 | 4 | 5;
  };

  schedule: {
    idealTrainingDays: number;
    realisticMinimumDays: number;
    availableDays: DayOfWeek[];
    flexibility: ScheduleFlexibility;
    sessionDuration: SessionDuration;
    preferredTrainingTime: PreferredTrainingTime;
  };

  trainingEnvironment: {
    location: TrainingLocation;
    equipmentMode: EquipmentMode;
    equipmentIds: string[];
    customEquipment: CustomEquipment[];
  };

  trainingPreferences: {
    preferredStyle: TrainingStyle;
    preferredEffort: TrainingEffort;
    volumePreference: VolumePreference;
    exerciseVariety: ExerciseVariety;
    structurePreference: StructurePreference;
  };

  exercisePreferences: {
    favorites: string[];
    dislikes: string[];
    avoid: string[];
    skippedBecauseUnsure: boolean;
  };

  recoveryLifestyle: {
    sleepDuration: SleepDuration;
    sleepQuality: 1 | 2 | 3 | 4 | 5;
    energyLevel: 1 | 2 | 3 | 4 | 5;
    stressLevel: 1 | 2 | 3 | 4 | 5;
    workoutRecovery: WorkoutRecovery;
    dailyActivity: DailyActivity;
    averageSteps: number | null;
  };

  nutrition: {
    dietType: DietType;
    dietaryRestrictions: string[];
    likedFoods: string[];
    dislikedFoods: string[];
    preferredMeals: PreferredMeals;
    mealSource: MealSource;
    eatingOutFrequency: EatingOutFrequency;
    nutritionStructure: NutritionStructure;
  };

  coachingPreferences: {
    communicationStyle: CommunicationStyle;
    decisionAutonomy: DecisionAutonomy;
    explanationDepth: ExplanationDepth;
    accountability: AccountabilityLevel;
  };

  metadata: {
    onboardingCompleted: boolean;
  };
};

export type ProfileValidationError = {
  field: string;
  code: string;
  message: string;
};

export type ProfileValidationResult = {
  valid: boolean;
  errors: ProfileValidationError[];
};
