/**
 * Canonical User Profile Validation
 *
 * Validates that a CanonicalUserProfile satisfies all constraints and requirements
 * established by the 10-screen onboarding flow.
 */

import {
  CanonicalUserProfile,
  ProfileValidationError,
  ProfileValidationResult,
  GoalId,
  TrainingHistory,
  TrainingConsistency,
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
  BiologicalSex,
} from './types';

const VALID_GOALS: GoalId[] = [
  'build_muscle',
  'lose_fat',
  'build_muscle_lose_fat',
  'get_stronger',
  'improve_fitness',
  'not_sure',
];

const VALID_TRAINING_HISTORIES: TrainingHistory[] = [
  'never',
  'under_3_months',
  '3_to_6_months',
  '6_to_12_months',
  '1_to_2_years',
  '2_plus_years',
];

const VALID_CONSISTENCIES: TrainingConsistency[] = [
  'rarely',
  'sometimes',
  'mostly_consistent',
  'very_consistent',
];

const VALID_FLEXIBILITIES: ScheduleFlexibility[] = [
  'fixed',
  'sometimes_changes',
  'often_changes',
];

const VALID_SESSION_DURATIONS: SessionDuration[] = [
  '20_30',
  '30_45',
  '45_60',
  '60_75',
  '75_plus',
];

const VALID_TRAINING_TIMES: PreferredTrainingTime[] = [
  'morning',
  'afternoon',
  'evening',
  'no_preference',
];

const VALID_LOCATIONS: TrainingLocation[] = [
  'commercial_gym',
  'small_local_gym',
  'home_gym',
  'mostly_home',
  'multiple_places',
];

const VALID_EQUIPMENT_MODES: EquipmentMode[] = ['most_gym_equipment', 'custom'];

const VALID_STYLES: TrainingStyle[] = [
  'hypertrophy',
  'strength',
  'high_intensity',
  'balanced',
  'general_fitness',
  'not_sure',
];

const VALID_EFFORTS: TrainingEffort[] = [
  'moderate',
  'hard',
  'very_hard',
  'not_sure',
];

const VALID_VOLUMES: VolumePreference[] = [
  'fewer_high_effort',
  'more_volume',
  'balanced',
  'not_sure',
];

const VALID_VARIETIES: ExerciseVariety[] = [
  'repeat_key_exercises',
  'some_variety',
  'change_often',
  'no_preference',
];

const VALID_STRUCTURE_PREFERENCES: StructurePreference[] = [
  'full_body',
  'upper_lower',
  'ppl',
  'body_part_focused',
  'coach_decides',
];

const VALID_SLEEP_DURATIONS: SleepDuration[] = [
  'under_5',
  '5_to_6',
  '6_to_7',
  '7_to_8',
  '8_plus',
];

const VALID_WORKOUT_RECOVERIES: WorkoutRecovery[] = [
  'fully_recovered',
  'mostly_recovered',
  'sometimes_fatigued',
  'often_fatigued',
  'not_sure',
];

const VALID_DAILY_ACTIVITIES: DailyActivity[] = [
  'mostly_sedentary',
  'light',
  'moderate',
  'very_active',
];

const VALID_DIET_TYPES: DietType[] = [
  'vegetarian',
  'eggetarian',
  'non_vegetarian',
  'vegan',
  'no_preference',
  'other',
];

const VALID_PREFERRED_MEALS: PreferredMeals[] = [
  '2',
  '3',
  '4',
  '5_plus',
  'flexible',
];

const VALID_MEAL_SOURCES: MealSource[] = [
  'mostly_cook',
  'family_prepares',
  'mixed',
  'mostly_outside',
];

const VALID_EATING_OUT_FREQUENCIES: EatingOutFrequency[] = [
  'rarely',
  '1_2_week',
  '3_5_week',
  'almost_daily',
];

const VALID_NUTRITION_STRUCTURES: NutritionStructure[] = [
  'very_structured',
  'mostly_structured',
  'flexible',
  'coach_decides',
];

const VALID_COMMUNICATION_STYLES: CommunicationStyle[] = [
  'direct',
  'educational',
  'motivational',
  'data_driven',
  'minimal',
  'adaptive',
];

const VALID_DECISION_AUTONOMIES: DecisionAutonomy[] = [
  'coach_leads',
  'recommend',
  'user_controls',
];

const VALID_EXPLANATION_DEPTHS: ExplanationDepth[] = [
  'action_only',
  'brief',
  'detailed',
  'contextual',
];

const VALID_ACCOUNTABILITIES: AccountabilityLevel[] = [
  'high',
  'gentle',
  'important_only',
  'self_managed',
];

const VALID_BIOLOGICAL_SEXES: BiologicalSex[] = [
  'female',
  'male',
  'prefer_not_to_say',
];

/**
 * Validates a CanonicalUserProfile against onboarding domain constraints.
 */
export function validateCanonicalUserProfile(
  profile: CanonicalUserProfile
): ProfileValidationResult {
  const errors: ProfileValidationError[] = [];

  // 1. Goal
  if (!profile.goal || !profile.goal.primary) {
    errors.push({
      field: 'goal.primary',
      code: 'REQUIRED',
      message: 'Primary goal is required',
    });
  } else if (!VALID_GOALS.includes(profile.goal.primary)) {
    errors.push({
      field: 'goal.primary',
      code: 'INVALID',
      message: `Invalid primary goal: ${profile.goal.primary}`,
    });
  }

  // 2. Anthropometrics
  if (
    profile.anthropometrics?.age == null ||
    typeof profile.anthropometrics.age !== 'number' ||
    isNaN(profile.anthropometrics.age)
  ) {
    errors.push({
      field: 'anthropometrics.age',
      code: 'REQUIRED',
      message: 'Age is required',
    });
  } else if (profile.anthropometrics.age < 13 || profile.anthropometrics.age > 100) {
    errors.push({
      field: 'anthropometrics.age',
      code: 'INVALID_RANGE',
      message: 'Age must be between 13 and 100',
    });
  }

  if (
    profile.anthropometrics?.heightCm == null ||
    typeof profile.anthropometrics.heightCm !== 'number' ||
    isNaN(profile.anthropometrics.heightCm)
  ) {
    errors.push({
      field: 'anthropometrics.heightCm',
      code: 'REQUIRED',
      message: 'Height is required',
    });
  } else if (
    profile.anthropometrics.heightCm < 90 ||
    profile.anthropometrics.heightCm > 250
  ) {
    errors.push({
      field: 'anthropometrics.heightCm',
      code: 'INVALID_RANGE',
      message: 'Height must be between 90 and 250 cm',
    });
  }

  if (
    profile.anthropometrics?.weightKg == null ||
    typeof profile.anthropometrics.weightKg !== 'number' ||
    isNaN(profile.anthropometrics.weightKg)
  ) {
    errors.push({
      field: 'anthropometrics.weightKg',
      code: 'REQUIRED',
      message: 'Weight is required',
    });
  } else if (
    profile.anthropometrics.weightKg < 30 ||
    profile.anthropometrics.weightKg > 300
  ) {
    errors.push({
      field: 'anthropometrics.weightKg',
      code: 'INVALID_RANGE',
      message: 'Weight must be between 30 and 300 kg',
    });
  }

  if (
    profile.anthropometrics?.biologicalSex !== undefined &&
    !VALID_BIOLOGICAL_SEXES.includes(profile.anthropometrics.biologicalSex)
  ) {
    errors.push({
      field: 'anthropometrics.biologicalSex',
      code: 'INVALID',
      message: `Invalid biological sex: ${profile.anthropometrics.biologicalSex}`,
    });
  }

  // 3. Training Experience
  if (
    !profile.trainingExperience?.trainingHistory ||
    !VALID_TRAINING_HISTORIES.includes(profile.trainingExperience.trainingHistory)
  ) {
    errors.push({
      field: 'trainingExperience.trainingHistory',
      code: 'REQUIRED',
      message: 'Training history is required',
    });
  }

  if (
    !profile.trainingExperience?.consistency ||
    !VALID_CONSISTENCIES.includes(profile.trainingExperience.consistency)
  ) {
    errors.push({
      field: 'trainingExperience.consistency',
      code: 'REQUIRED',
      message: 'Training consistency is required',
    });
  }

  const exConf = profile.trainingExperience?.exerciseConfidence;
  if (exConf == null || ![1, 2, 3, 4, 5].includes(exConf)) {
    errors.push({
      field: 'trainingExperience.exerciseConfidence',
      code: 'REQUIRED',
      message: 'Exercise confidence rating (1-5) is required',
    });
  }

  const progConf = profile.trainingExperience?.programmingConfidence;
  if (progConf == null || ![1, 2, 3, 4, 5].includes(progConf)) {
    errors.push({
      field: 'trainingExperience.programmingConfidence',
      code: 'REQUIRED',
      message: 'Programming confidence rating (1-5) is required',
    });
  }

  // 4. Schedule
  const idealDays = profile.schedule?.idealTrainingDays;
  const minDays = profile.schedule?.realisticMinimumDays;

  if (idealDays == null || typeof idealDays !== 'number' || idealDays < 1) {
    errors.push({
      field: 'schedule.idealTrainingDays',
      code: 'REQUIRED',
      message: 'Ideal training days is required',
    });
  }

  if (minDays == null || typeof minDays !== 'number' || minDays < 1) {
    errors.push({
      field: 'schedule.realisticMinimumDays',
      code: 'REQUIRED',
      message: 'Realistic minimum training days is required',
    });
  }

  if (
    typeof idealDays === 'number' &&
    typeof minDays === 'number' &&
    minDays > idealDays
  ) {
    errors.push({
      field: 'schedule.realisticMinimumDays',
      code: 'INVALID_RANGE',
      message: 'Realistic minimum training days cannot exceed ideal training days',
    });
  }

  if (
    !profile.schedule?.availableDays ||
    !Array.isArray(profile.schedule.availableDays) ||
    profile.schedule.availableDays.length < 1
  ) {
    errors.push({
      field: 'schedule.availableDays',
      code: 'REQUIRED',
      message: 'At least one available training day must be selected',
    });
  }

  if (
    !profile.schedule?.flexibility ||
    !VALID_FLEXIBILITIES.includes(profile.schedule.flexibility)
  ) {
    errors.push({
      field: 'schedule.flexibility',
      code: 'REQUIRED',
      message: 'Schedule flexibility is required',
    });
  }

  if (
    !profile.schedule?.sessionDuration ||
    !VALID_SESSION_DURATIONS.includes(profile.schedule.sessionDuration)
  ) {
    errors.push({
      field: 'schedule.sessionDuration',
      code: 'REQUIRED',
      message: 'Session duration is required',
    });
  }

  if (
    !profile.schedule?.preferredTrainingTime ||
    !VALID_TRAINING_TIMES.includes(profile.schedule.preferredTrainingTime)
  ) {
    errors.push({
      field: 'schedule.preferredTrainingTime',
      code: 'REQUIRED',
      message: 'Preferred training time is required',
    });
  }

  // 5. Training Environment
  if (
    !profile.trainingEnvironment?.location ||
    !VALID_LOCATIONS.includes(profile.trainingEnvironment.location)
  ) {
    errors.push({
      field: 'trainingEnvironment.location',
      code: 'REQUIRED',
      message: 'Training location is required',
    });
  }

  if (
    !profile.trainingEnvironment?.equipmentMode ||
    !VALID_EQUIPMENT_MODES.includes(profile.trainingEnvironment.equipmentMode)
  ) {
    errors.push({
      field: 'trainingEnvironment.equipmentMode',
      code: 'REQUIRED',
      message: 'Equipment mode is required',
    });
  }

  if (profile.trainingEnvironment?.equipmentMode === 'custom') {
    const hasEquipmentIds =
      Array.isArray(profile.trainingEnvironment.equipmentIds) &&
      profile.trainingEnvironment.equipmentIds.length >= 1;
    if (!hasEquipmentIds) {
      errors.push({
        field: 'trainingEnvironment.equipmentIds',
        code: 'REQUIRED',
        message: 'At least one equipment item is required when equipment mode is custom',
      });
    }
  }

  // 6. Training Preferences
  if (
    !profile.trainingPreferences?.preferredStyle ||
    !VALID_STYLES.includes(profile.trainingPreferences.preferredStyle)
  ) {
    errors.push({
      field: 'trainingPreferences.preferredStyle',
      code: 'REQUIRED',
      message: 'Preferred training style is required',
    });
  }

  if (
    !profile.trainingPreferences?.preferredEffort ||
    !VALID_EFFORTS.includes(profile.trainingPreferences.preferredEffort)
  ) {
    errors.push({
      field: 'trainingPreferences.preferredEffort',
      code: 'REQUIRED',
      message: 'Preferred training effort is required',
    });
  }

  if (
    !profile.trainingPreferences?.volumePreference ||
    !VALID_VOLUMES.includes(profile.trainingPreferences.volumePreference)
  ) {
    errors.push({
      field: 'trainingPreferences.volumePreference',
      code: 'REQUIRED',
      message: 'Volume preference is required',
    });
  }

  if (
    !profile.trainingPreferences?.exerciseVariety ||
    !VALID_VARIETIES.includes(profile.trainingPreferences.exerciseVariety)
  ) {
    errors.push({
      field: 'trainingPreferences.exerciseVariety',
      code: 'REQUIRED',
      message: 'Exercise variety preference is required',
    });
  }

  if (
    !profile.trainingPreferences?.structurePreference ||
    !VALID_STRUCTURE_PREFERENCES.includes(profile.trainingPreferences.structurePreference)
  ) {
    errors.push({
      field: 'trainingPreferences.structurePreference',
      code: 'REQUIRED',
      message: 'Workout structure preference is required',
    });
  }

  // 7. Exercise Preferences
  const favorites = profile.exercisePreferences?.favorites ?? [];
  const dislikes = profile.exercisePreferences?.dislikes ?? [];
  const avoid = profile.exercisePreferences?.avoid ?? [];
  const skippedBecauseUnsure = Boolean(
    profile.exercisePreferences?.skippedBecauseUnsure
  );

  // Consistency & Completion: must have selections OR skipped because unsure
  if (!skippedBecauseUnsure && favorites.length === 0 && dislikes.length === 0 && avoid.length === 0) {
    errors.push({
      field: 'exercisePreferences',
      code: 'REQUIRED',
      message: 'Exercise preferences must either specify exercises or indicate unsure',
    });
  }

  // Mutual Exclusivity
  const favSet = new Set(favorites);
  const dislikeSet = new Set(dislikes);
  const avoidSet = new Set(avoid);

  for (const id of favorites) {
    if (dislikeSet.has(id)) {
      errors.push({
        field: 'exercisePreferences.favorites',
        code: 'CONFLICT',
        message: `Exercise '${id}' cannot be in both favorites and dislikes`,
      });
      break;
    }
    if (avoidSet.has(id)) {
      errors.push({
        field: 'exercisePreferences.favorites',
        code: 'CONFLICT',
        message: `Exercise '${id}' cannot be in both favorites and avoid`,
      });
      break;
    }
  }

  for (const id of dislikes) {
    if (avoidSet.has(id)) {
      errors.push({
        field: 'exercisePreferences.dislikes',
        code: 'CONFLICT',
        message: `Exercise '${id}' cannot be in both dislikes and avoid`,
      });
      break;
    }
  }

  // 8. Recovery & Lifestyle
  if (
    !profile.recoveryLifestyle?.sleepDuration ||
    !VALID_SLEEP_DURATIONS.includes(profile.recoveryLifestyle.sleepDuration)
  ) {
    errors.push({
      field: 'recoveryLifestyle.sleepDuration',
      code: 'REQUIRED',
      message: 'Sleep duration is required',
    });
  }

  const sleepQual = profile.recoveryLifestyle?.sleepQuality;
  if (sleepQual == null || ![1, 2, 3, 4, 5].includes(sleepQual)) {
    errors.push({
      field: 'recoveryLifestyle.sleepQuality',
      code: 'REQUIRED',
      message: 'Sleep quality rating (1-5) is required',
    });
  }

  const energy = profile.recoveryLifestyle?.energyLevel;
  if (energy == null || ![1, 2, 3, 4, 5].includes(energy)) {
    errors.push({
      field: 'recoveryLifestyle.energyLevel',
      code: 'REQUIRED',
      message: 'Daily energy rating (1-5) is required',
    });
  }

  const stress = profile.recoveryLifestyle?.stressLevel;
  if (stress == null || ![1, 2, 3, 4, 5].includes(stress)) {
    errors.push({
      field: 'recoveryLifestyle.stressLevel',
      code: 'REQUIRED',
      message: 'Daily stress rating (1-5) is required',
    });
  }

  if (
    !profile.recoveryLifestyle?.workoutRecovery ||
    !VALID_WORKOUT_RECOVERIES.includes(profile.recoveryLifestyle.workoutRecovery)
  ) {
    errors.push({
      field: 'recoveryLifestyle.workoutRecovery',
      code: 'REQUIRED',
      message: 'Workout recovery status is required',
    });
  }

  if (
    !profile.recoveryLifestyle?.dailyActivity ||
    !VALID_DAILY_ACTIVITIES.includes(profile.recoveryLifestyle.dailyActivity)
  ) {
    errors.push({
      field: 'recoveryLifestyle.dailyActivity',
      code: 'REQUIRED',
      message: 'Daily activity level is required',
    });
  }

  if (
    profile.recoveryLifestyle?.averageSteps !== null &&
    profile.recoveryLifestyle?.averageSteps !== undefined &&
    (typeof profile.recoveryLifestyle.averageSteps !== 'number' ||
      isNaN(profile.recoveryLifestyle.averageSteps) ||
      profile.recoveryLifestyle.averageSteps < 0)
  ) {
    errors.push({
      field: 'recoveryLifestyle.averageSteps',
      code: 'INVALID',
      message: 'Average steps must be a non-negative number or null',
    });
  }

  // 9. Nutrition
  if (
    !profile.nutrition?.dietType ||
    !VALID_DIET_TYPES.includes(profile.nutrition.dietType)
  ) {
    errors.push({
      field: 'nutrition.dietType',
      code: 'REQUIRED',
      message: 'Diet type is required',
    });
  }

  const restrictions = profile.nutrition?.dietaryRestrictions;
  if (!restrictions || !Array.isArray(restrictions) || restrictions.length < 1) {
    errors.push({
      field: 'nutrition.dietaryRestrictions',
      code: 'REQUIRED',
      message: 'At least one dietary restriction (or None) is required',
    });
  } else if (restrictions.includes('none') && restrictions.length > 1) {
    errors.push({
      field: 'nutrition.dietaryRestrictions',
      code: 'CONFLICT',
      message: "Dietary restrictions cannot include 'none' alongside specific restrictions",
    });
  }

  if (
    !profile.nutrition?.preferredMeals ||
    !VALID_PREFERRED_MEALS.includes(profile.nutrition.preferredMeals)
  ) {
    errors.push({
      field: 'nutrition.preferredMeals',
      code: 'REQUIRED',
      message: 'Preferred meals per day is required',
    });
  }

  if (
    !profile.nutrition?.mealSource ||
    !VALID_MEAL_SOURCES.includes(profile.nutrition.mealSource)
  ) {
    errors.push({
      field: 'nutrition.mealSource',
      code: 'REQUIRED',
      message: 'Meal source is required',
    });
  }

  if (
    !profile.nutrition?.eatingOutFrequency ||
    !VALID_EATING_OUT_FREQUENCIES.includes(profile.nutrition.eatingOutFrequency)
  ) {
    errors.push({
      field: 'nutrition.eatingOutFrequency',
      code: 'REQUIRED',
      message: 'Eating out frequency is required',
    });
  }

  if (
    !profile.nutrition?.nutritionStructure ||
    !VALID_NUTRITION_STRUCTURES.includes(profile.nutrition.nutritionStructure)
  ) {
    errors.push({
      field: 'nutrition.nutritionStructure',
      code: 'REQUIRED',
      message: 'Nutrition structure preference is required',
    });
  }

  // Liked & Disliked Foods mutual exclusivity
  const likedFoods = profile.nutrition?.likedFoods ?? [];
  const dislikedFoods = profile.nutrition?.dislikedFoods ?? [];
  const likedSet = new Set(likedFoods);

  for (const food of dislikedFoods) {
    if (likedSet.has(food)) {
      errors.push({
        field: 'nutrition.foods',
        code: 'CONFLICT',
        message: `Food '${food}' cannot be in both liked and disliked lists`,
      });
      break;
    }
  }

  // 10. Coaching Preferences
  if (
    !profile.coachingPreferences?.communicationStyle ||
    !VALID_COMMUNICATION_STYLES.includes(profile.coachingPreferences.communicationStyle)
  ) {
    errors.push({
      field: 'coachingPreferences.communicationStyle',
      code: 'REQUIRED',
      message: 'Communication style is required',
    });
  }

  if (
    !profile.coachingPreferences?.decisionAutonomy ||
    !VALID_DECISION_AUTONOMIES.includes(profile.coachingPreferences.decisionAutonomy)
  ) {
    errors.push({
      field: 'coachingPreferences.decisionAutonomy',
      code: 'REQUIRED',
      message: 'Decision autonomy is required',
    });
  }

  if (
    !profile.coachingPreferences?.explanationDepth ||
    !VALID_EXPLANATION_DEPTHS.includes(profile.coachingPreferences.explanationDepth)
  ) {
    errors.push({
      field: 'coachingPreferences.explanationDepth',
      code: 'REQUIRED',
      message: 'Explanation depth is required',
    });
  }

  if (
    !profile.coachingPreferences?.accountability ||
    !VALID_ACCOUNTABILITIES.includes(profile.coachingPreferences.accountability)
  ) {
    errors.push({
      field: 'coachingPreferences.accountability',
      code: 'REQUIRED',
      message: 'Accountability level is required',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks whether a CanonicalUserProfile is complete and valid.
 */
export function isCanonicalUserProfileComplete(
  profile: CanonicalUserProfile
): boolean {
  return validateCanonicalUserProfile(profile).valid;
}
