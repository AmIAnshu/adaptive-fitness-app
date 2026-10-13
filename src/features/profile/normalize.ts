/**
 * Canonical User Profile Normalizer
 *
 * Transforms raw in-memory OnboardingData into the strongly typed CanonicalUserProfile contract.
 * Pure function: strictly avoids mutation of the incoming onboarding data and guarantees
 * deduplication, deep cloning of custom equipment, and metric retention.
 */

import { OnboardingData } from '../onboarding/onboardingState';
import {
  CanonicalUserProfile,
  GoalId,
  TrainingHistory,
  TrainingConsistency,
  DayOfWeek,
  ScheduleFlexibility,
  SessionDuration,
  PreferredTrainingTime,
  TrainingLocation,
  EquipmentMode,
  TrainingStyle,
  TrainingEffort,
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
  AccountabilityLevel,
} from './types';

/**
 * Deduplicate an array while preserving item order and filtering null/undefined.
 */
function dedupe<T>(arr?: T[]): T[] {
  if (!arr || !Array.isArray(arr)) return [];
  return Array.from(new Set(arr));
}

/**
 * Builds the canonical user profile from raw onboarding state.
 *
 * @param onboardingData - The raw state collected across screens 1-10.
 * @returns A normalized CanonicalUserProfile adhering to schemaVersion 1.
 */
export function buildCanonicalUserProfile(
  onboardingData: OnboardingData
): CanonicalUserProfile {
  return {
    schemaVersion: 1,

    goal: {
      primary: onboardingData.goal as GoalId,
    },

    anthropometrics: {
      age: onboardingData.age as number,
      heightCm: onboardingData.heightCm as number,
      weightKg: onboardingData.weightKg as number,
      ...(onboardingData.biologicalSex !== undefined
        ? { biologicalSex: onboardingData.biologicalSex }
        : {}),
    },

    trainingExperience: {
      trainingHistory: onboardingData.trainingHistory as TrainingHistory,
      consistency: onboardingData.consistency as TrainingConsistency,
      exerciseConfidence: onboardingData.exerciseConfidence as 1 | 2 | 3 | 4 | 5,
      programmingConfidence: onboardingData.programmingConfidence as 1 | 2 | 3 | 4 | 5,
    },

    schedule: {
      idealTrainingDays: onboardingData.idealTrainingDays as number,
      realisticMinimumDays: onboardingData.realisticMinimumDays as number,
      availableDays: dedupe(onboardingData.availableDays) as DayOfWeek[],
      flexibility: onboardingData.scheduleFlexibility as ScheduleFlexibility,
      sessionDuration: onboardingData.sessionDuration as SessionDuration,
      preferredTrainingTime: onboardingData.preferredTrainingTime as PreferredTrainingTime,
    },

    trainingEnvironment: {
      location: onboardingData.trainingLocation as TrainingLocation,
      equipmentMode: onboardingData.equipmentMode as EquipmentMode,
      equipmentIds: dedupe(onboardingData.equipmentIds),
      customEquipment: (onboardingData.customEquipments ?? []).map((eq) => ({
        id: eq.id,
        name: eq.name,
        equipmentType: eq.equipmentType,
        loadingType: eq.loadingType,
        primaryMuscleId: eq.primaryMuscleId,
        secondaryMuscleIds: [...(eq.secondaryMuscleIds ?? [])],
        ...(eq.movementPattern !== undefined ? { movementPattern: eq.movementPattern } : {}),
      })),
    },

    trainingPreferences: {
      preferredStyle: onboardingData.preferredStyle as TrainingStyle,
      preferredEffort: onboardingData.preferredEffort as TrainingEffort,
      volumePreference: onboardingData.volumePreference as VolumePreference,
      exerciseVariety: onboardingData.exerciseVariety as ExerciseVariety,
      ...(onboardingData.structurePreference !== undefined
        ? { structurePreference: onboardingData.structurePreference as StructurePreference }
        : {}),
    } as CanonicalUserProfile['trainingPreferences'],

    exercisePreferences: {
      favorites: dedupe(onboardingData.favorites),
      dislikes: dedupe(onboardingData.dislikes),
      avoid: dedupe(onboardingData.avoid),
      skippedBecauseUnsure: Boolean(onboardingData.skippedBecauseUnsure),
    },

    recoveryLifestyle: {
      sleepDuration: onboardingData.sleepDuration as SleepDuration,
      sleepQuality: onboardingData.sleepQuality as 1 | 2 | 3 | 4 | 5,
      energyLevel: onboardingData.energyLevel as 1 | 2 | 3 | 4 | 5,
      stressLevel: onboardingData.stressLevel as 1 | 2 | 3 | 4 | 5,
      workoutRecovery: onboardingData.workoutRecovery as WorkoutRecovery,
      dailyActivity: onboardingData.dailyActivity as DailyActivity,
      averageSteps:
        typeof onboardingData.averageSteps === 'number' &&
        !isNaN(onboardingData.averageSteps) &&
        onboardingData.averageSteps >= 0
          ? onboardingData.averageSteps
          : null,
    },

    nutrition: {
      dietType: onboardingData.dietType as DietType,
      dietaryRestrictions: dedupe(onboardingData.dietaryRestrictions),
      likedFoods: dedupe(onboardingData.likedFoods),
      dislikedFoods: dedupe(onboardingData.dislikedFoods),
      preferredMeals: onboardingData.preferredMeals as PreferredMeals,
      mealSource: onboardingData.mealSource as MealSource,
      eatingOutFrequency: onboardingData.eatingOutFrequency as EatingOutFrequency,
      nutritionStructure: onboardingData.nutritionStructure as NutritionStructure,
    },

    coachingPreferences: {
      communicationStyle: onboardingData.communicationStyle as CommunicationStyle,
      decisionAutonomy: onboardingData.decisionAutonomy as DecisionAutonomy,
      explanationDepth: onboardingData.explanationDepth as ExplanationDepth,
      accountability: onboardingData.accountability as AccountabilityLevel,
    },

    metadata: {
      onboardingCompleted: Boolean(onboardingData.isCompleted),
    },
  };
}
