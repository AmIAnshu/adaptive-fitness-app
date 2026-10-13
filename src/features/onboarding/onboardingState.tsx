/**
 * Onboarding State Management
 *
 * Provides a clean in-memory state store for the multi-step onboarding flow.
 * Structured so that a persistent storage or Supabase backend can easily
 * replace or sync with this layer in later steps.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type GoalId =
  | 'build_muscle'
  | 'lose_fat'
  | 'build_muscle_lose_fat'
  | 'get_stronger'
  | 'improve_fitness'
  | 'not_sure';

export type HeightUnit = 'cm' | 'ft_in';
export type WeightUnit = 'kg' | 'lb';
export type BiologicalSex = 'female' | 'male' | 'prefer_not_to_say';

export type TrainingHistoryId =
  | 'never'
  | 'under_3_months'
  | '3_to_6_months'
  | '6_to_12_months'
  | '1_to_2_years'
  | '2_plus_years';

export type ConsistencyId =
  | 'rarely'
  | 'sometimes'
  | 'mostly_consistent'
  | 'very_consistent';

export type ConfidenceRating = 1 | 2 | 3 | 4 | 5;

export type DayOfWeek =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun';

export type IdealTrainingDays = 2 | 3 | 4 | 5 | 6;
export type RealisticMinimumDays = 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleFlexibility =
  | 'fixed'
  | 'sometimes_changes'
  | 'often_changes';

export type SessionDuration =
  | '20_30'
  | '30_45'
  | '45_60'
  | '60_75'
  | '75_plus';

export type PreferredTrainingTime =
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'no_preference';

export type TrainingLocationId =
  | 'commercial_gym'
  | 'small_local_gym'
  | 'home_gym'
  | 'mostly_home'
  | 'multiple_places';

export type EquipmentAccessMode =
  | 'most_gym_equipment'
  | 'custom';

export type EquipmentId =
  | 'barbell'
  | 'dumbbells'
  | 'adjustable_dumbbells'
  | 'cable_machine'
  | 'smith_machine'
  | 'power_rack'
  | 'bench'
  | 'machines'
  | 'pullup_bar'
  | 'resistance_bands'
  | 'cardio_equipment'
  | string;

export interface CustomEquipment {
  id: string;
  name: string;
  equipmentType: string;
  loadingType: string;
  primaryMuscleId: string;
  secondaryMuscleIds: string[];
  movementPattern?: string;
}

export type PreferredStyle =
  | 'hypertrophy'
  | 'strength'
  | 'high_intensity'
  | 'balanced'
  | 'general_fitness'
  | 'not_sure';

export type PreferredEffort =
  | 'moderate'
  | 'hard'
  | 'very_hard'
  | 'not_sure';

export type VolumePreference =
  | 'fewer_high_effort'
  | 'more_volume'
  | 'balanced'
  | 'not_sure';

export type ExerciseVariety =
  | 'repeat_key_exercises'
  | 'some_variety'
  | 'change_often'
  | 'no_preference';

export type StructurePreference =
  | 'full_body'
  | 'upper_lower'
  | 'ppl'
  | 'body_part_focused'
  | 'coach_decides';

export type TrainingStyleData = {
  preferredStyle: PreferredStyle;
  preferredEffort: PreferredEffort;
  volumePreference: VolumePreference;
  exerciseVariety: ExerciseVariety;
  structurePreference: StructurePreference;
};

export type ExercisePreferencesData = {
  favorites: string[];
  dislikes: string[];
  avoid: string[];
  skippedBecauseUnsure: boolean;
};

export type SleepDuration =
  | 'under_5'
  | '5_to_6'
  | '6_to_7'
  | '7_to_8'
  | '8_plus';

export type WorkoutRecovery =
  | 'fully_recovered'
  | 'mostly_recovered'
  | 'sometimes_fatigued'
  | 'often_fatigued'
  | 'not_sure';

export type DailyActivity =
  | 'mostly_sedentary'
  | 'light'
  | 'moderate'
  | 'very_active';

export type RecoveryLifestyleData = {
  sleepDuration:
    | 'under_5'
    | '5_to_6'
    | '6_to_7'
    | '7_to_8'
    | '8_plus';
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  energyLevel: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  workoutRecovery:
    | 'fully_recovered'
    | 'mostly_recovered'
    | 'sometimes_fatigued'
    | 'often_fatigued'
    | 'not_sure';
  dailyActivity:
    | 'mostly_sedentary'
    | 'light'
    | 'moderate'
    | 'very_active';
  averageSteps?: number;
};

export type DietType =
  | 'vegetarian'
  | 'eggetarian'
  | 'non_vegetarian'
  | 'vegan'
  | 'no_preference'
  | 'other';

export type PreferredMeals =
  | '2'
  | '3'
  | '4'
  | '5_plus'
  | 'flexible';

export type MealSource =
  | 'mostly_cook'
  | 'family_prepares'
  | 'mixed'
  | 'mostly_outside';

export type EatingOutFrequency =
  | 'rarely'
  | '1_2_week'
  | '3_5_week'
  | 'almost_daily';

export type NutritionStructure =
  | 'very_structured'
  | 'mostly_structured'
  | 'flexible'
  | 'coach_decides';

export type NutritionProfileData = {
  dietType: DietType;
  dietaryRestrictions: string[];
  likedFoods: string[];
  dislikedFoods: string[];
  preferredMeals: PreferredMeals;
  mealSource: MealSource;
  eatingOutFrequency: EatingOutFrequency;
  nutritionStructure: NutritionStructure;
};

export type CommunicationStyle =
  | 'direct'
  | 'educational'
  | 'motivational'
  | 'data_driven'
  | 'minimal'
  | 'adaptive';

export type DecisionAutonomy =
  | 'coach_leads'
  | 'recommend'
  | 'user_controls';

export type ExplanationDepth =
  | 'action_only'
  | 'brief'
  | 'detailed'
  | 'contextual';

export type Accountability =
  | 'high'
  | 'gentle'
  | 'important_only'
  | 'self_managed';

export type CoachingPreferencesData = {
  communicationStyle: CommunicationStyle;
  decisionAutonomy: DecisionAutonomy;
  explanationDepth: ExplanationDepth;
  accountability: Accountability;
};

export interface OnboardingData {
  goal?: GoalId;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  biologicalSex?: BiologicalSex;
  trainingHistory?: TrainingHistoryId;
  consistency?: ConsistencyId;
  exerciseConfidence?: ConfidenceRating;
  programmingConfidence?: ConfidenceRating;
  idealTrainingDays?: IdealTrainingDays;
  realisticMinimumDays?: RealisticMinimumDays;
  availableDays?: DayOfWeek[];
  scheduleFlexibility?: ScheduleFlexibility;
  sessionDuration?: SessionDuration;
  preferredTrainingTime?: PreferredTrainingTime;
  trainingLocation?: TrainingLocationId;
  equipmentMode?: EquipmentAccessMode;
  equipmentIds?: string[];
  customEquipments?: CustomEquipment[];
  preferredStyle?: PreferredStyle;
  preferredEffort?: PreferredEffort;
  volumePreference?: VolumePreference;
  exerciseVariety?: ExerciseVariety;
  structurePreference?: StructurePreference;
  favorites?: string[];
  dislikes?: string[];
  avoid?: string[];
  skippedBecauseUnsure?: boolean;
  sleepDuration?: SleepDuration;
  sleepQuality?: ConfidenceRating;
  energyLevel?: ConfidenceRating;
  stressLevel?: ConfidenceRating;
  workoutRecovery?: WorkoutRecovery;
  dailyActivity?: DailyActivity;
  averageSteps?: number;
  dietType?: DietType;
  dietaryRestrictions?: string[];
  likedFoods?: string[];
  dislikedFoods?: string[];
  preferredMeals?: PreferredMeals;
  mealSource?: MealSource;
  eatingOutFrequency?: EatingOutFrequency;
  nutritionStructure?: NutritionStructure;
  communicationStyle?: CommunicationStyle;
  decisionAutonomy?: DecisionAutonomy;
  explanationDepth?: ExplanationDepth;
  accountability?: Accountability;
  isCompleted?: boolean;
}

interface OnboardingContextValue {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  setGoal: (goal: GoalId) => void;
  heightUnit: HeightUnit;
  setHeightUnit: (unit: HeightUnit) => void;
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function getInitialOnboardingData(): OnboardingData {
  if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || (typeof __DEV__ !== 'undefined' && __DEV__))) {
    try {
      const stored = window.sessionStorage?.getItem('__E2E_ONBOARDING_DATA__');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Safe fallback if JSON parsing fails
    }
  }
  return {};
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(getInitialOnboardingData);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || (typeof __DEV__ !== 'undefined' && __DEV__))) {
      (window as any).__E2E_SET_ONBOARDING_DATA__ = (newData: OnboardingData) => {
        setData(newData);
        try {
          window.sessionStorage?.setItem('__E2E_ONBOARDING_DATA__', JSON.stringify(newData));
        } catch {
          // ignore
        }
      };
      (window as any).__E2E_GET_ONBOARDING_DATA__ = () => data;
    }
  }, [data]);

  const updateData = React.useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || (typeof __DEV__ !== 'undefined' && __DEV__))) {
        try {
          window.sessionStorage?.setItem('__E2E_ONBOARDING_DATA__', JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  }, []);

  const setGoal = React.useCallback((goal: GoalId) => {
    updateData({ goal });
  }, [updateData]);

  const resetOnboarding = React.useCallback(() => {
    setData({});
    setHeightUnit('cm');
    setWeightUnit('kg');
    if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production' || (typeof __DEV__ !== 'undefined' && __DEV__))) {
      try {
        window.sessionStorage?.removeItem('__E2E_ONBOARDING_DATA__');
      } catch {
        // ignore
      }
    }
  }, []);

  const contextValue = React.useMemo<OnboardingContextValue>(
    () => ({
      data,
      updateData,
      setGoal,
      heightUnit,
      setHeightUnit,
      weightUnit,
      setWeightUnit,
      resetOnboarding,
    }),
    [data, updateData, setGoal, heightUnit, weightUnit, resetOnboarding]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
