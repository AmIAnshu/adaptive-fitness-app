/**
 * Deterministic Test Personas for Adaptive Fitness E2E QA Harness
 *
 * Each persona is an immutable, strictly valid OnboardingData profile designed to
 * exercise specific branches of the T1–T10 strategy engine, W1–W3 prescription rules,
 * W4 runtime execution, and W6.2 performance & recovery adaptation loop.
 */

import type { OnboardingData, DayOfWeek } from '../features/onboarding/onboardingState';

/**
 * PERSONA_A_BASELINE
 * - Adult (28 yo)
 * - Stable 3-day schedule (Mon, Wed, Fri)
 * - Standard recovery (7-8h sleep, good energy, low stress, recovered)
 * - Deterministic commercial gym equipment
 * - No unusual constraints or avoids
 * - Suitable for normal workout generation and baseline verification
 */
export const PERSONA_A_BASELINE: Readonly<OnboardingData> = Object.freeze({
  goal: 'build_muscle',
  age: 28,
  heightCm: 180,
  weightKg: 80,
  trainingHistory: '1_to_2_years',
  consistency: 'mostly_consistent',
  exerciseConfidence: 4,
  programmingConfidence: 3,
  idealTrainingDays: 3,
  realisticMinimumDays: 3,
  availableDays: ['mon', 'wed', 'fri'] as DayOfWeek[],
  scheduleFlexibility: 'sometimes_changes',
  sessionDuration: '45_60',
  preferredTrainingTime: 'evening',
  trainingLocation: 'commercial_gym',
  equipmentMode: 'most_gym_equipment',
  equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'pullup_bar'],
  customEquipments: [],
  preferredStyle: 'hypertrophy',
  preferredEffort: 'hard',
  volumePreference: 'balanced',
  exerciseVariety: 'some_variety',
  structurePreference: 'coach_decides',
  favorites: ['bench_press'],
  dislikes: [],
  avoid: [],
  skippedBecauseUnsure: false,
  sleepDuration: '7_to_8',
  sleepQuality: 4,
  energyLevel: 4,
  stressLevel: 2,
  workoutRecovery: 'mostly_recovered',
  dailyActivity: 'moderate',
  averageSteps: 8000,
  dietType: 'non_vegetarian',
  dietaryRestrictions: ['none'],
  likedFoods: [],
  dislikedFoods: [],
  preferredMeals: '3',
  mealSource: 'mostly_cook',
  eatingOutFrequency: '1_2_week',
  nutritionStructure: 'mostly_structured',
  communicationStyle: 'educational',
  decisionAutonomy: 'recommend',
  explanationDepth: 'detailed',
  accountability: 'gentle',
  isCompleted: true,
});

/**
 * PERSONA_B_ADVANCED_PPL
 * - Adult (26 yo)
 * - Advanced experience (2+ years, very consistent, max confidence)
 * - 6 available training days (Mon-Sat)
 * - Long sessions (60-75 min)
 * - Hypertrophy preference with PPL structure preference
 */
export const PERSONA_B_ADVANCED_PPL: Readonly<OnboardingData> = Object.freeze({
  goal: 'build_muscle',
  age: 26,
  heightCm: 182,
  weightKg: 84,
  trainingHistory: '2_plus_years',
  consistency: 'very_consistent',
  exerciseConfidence: 5,
  programmingConfidence: 5,
  idealTrainingDays: 6,
  realisticMinimumDays: 5,
  availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as DayOfWeek[],
  scheduleFlexibility: 'fixed',
  sessionDuration: '60_75',
  preferredTrainingTime: 'morning',
  trainingLocation: 'commercial_gym',
  equipmentMode: 'most_gym_equipment',
  equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'pullup_bar', 'machines'],
  customEquipments: [],
  preferredStyle: 'hypertrophy',
  preferredEffort: 'very_hard',
  volumePreference: 'more_volume',
  exerciseVariety: 'repeat_key_exercises',
  structurePreference: 'ppl',
  favorites: ['barbell_bench_press', 'barbell_back_squat'],
  dislikes: [],
  avoid: [],
  skippedBecauseUnsure: false,
  sleepDuration: '8_plus',
  sleepQuality: 5,
  energyLevel: 5,
  stressLevel: 1,
  workoutRecovery: 'fully_recovered',
  dailyActivity: 'moderate',
  averageSteps: 10000,
  dietType: 'non_vegetarian',
  dietaryRestrictions: ['none'],
  likedFoods: [],
  dislikedFoods: [],
  preferredMeals: '4',
  mealSource: 'mostly_cook',
  eatingOutFrequency: 'rarely',
  nutritionStructure: 'very_structured',
  communicationStyle: 'data_driven',
  decisionAutonomy: 'user_controls',
  explanationDepth: 'detailed',
  accountability: 'high',
  isCompleted: true,
});

/**
 * PERSONA_C_RECOVERY_CONSTRAINED
 * - Adult (32 yo)
 * - Same training baseline as Persona A but severe lifestyle recovery constraints:
 *   poor sleep (<5h), poor sleep quality (1), high stress (5), low energy (1), often fatigued
 * - Used to validate T9 constraint elevation and recovery adaptations
 */
export const PERSONA_C_RECOVERY_CONSTRAINED: Readonly<OnboardingData> = Object.freeze({
  goal: 'build_muscle',
  age: 32,
  heightCm: 175,
  weightKg: 78,
  trainingHistory: '1_to_2_years',
  consistency: 'mostly_consistent',
  exerciseConfidence: 4,
  programmingConfidence: 3,
  idealTrainingDays: 4,
  realisticMinimumDays: 3,
  availableDays: ['mon', 'tue', 'thu', 'fri'] as DayOfWeek[],
  scheduleFlexibility: 'sometimes_changes',
  sessionDuration: '45_60',
  preferredTrainingTime: 'evening',
  trainingLocation: 'commercial_gym',
  equipmentMode: 'most_gym_equipment',
  equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'pullup_bar'],
  customEquipments: [],
  preferredStyle: 'hypertrophy',
  preferredEffort: 'moderate',
  volumePreference: 'fewer_high_effort',
  exerciseVariety: 'some_variety',
  structurePreference: 'coach_decides',
  favorites: [],
  dislikes: [],
  avoid: [],
  skippedBecauseUnsure: true,
  sleepDuration: 'under_5',
  sleepQuality: 1,
  energyLevel: 1,
  stressLevel: 5,
  workoutRecovery: 'often_fatigued',
  dailyActivity: 'mostly_sedentary',
  averageSteps: 3500,
  dietType: 'non_vegetarian',
  dietaryRestrictions: ['none'],
  likedFoods: [],
  dislikedFoods: [],
  preferredMeals: '3',
  mealSource: 'mostly_outside',
  eatingOutFrequency: '3_5_week',
  nutritionStructure: 'flexible',
  communicationStyle: 'educational',
  decisionAutonomy: 'coach_leads',
  explanationDepth: 'brief',
  accountability: 'gentle',
  isCompleted: true,
});

/**
 * PERSONA_D_EQUIPMENT_RESTRICTED
 * - Adult (29 yo)
 * - Custom limited home gym equipment (only dumbbells & bench)
 * - Explicit avoid list (barbell exercises)
 * - Used to verify exercise exclusions and equipment compatibility invariants
 */
export const PERSONA_D_EQUIPMENT_RESTRICTED: Readonly<OnboardingData> = Object.freeze({
  goal: 'get_stronger',
  age: 29,
  heightCm: 178,
  weightKg: 75,
  trainingHistory: '6_to_12_months',
  consistency: 'mostly_consistent',
  exerciseConfidence: 3,
  programmingConfidence: 3,
  idealTrainingDays: 3,
  realisticMinimumDays: 2,
  availableDays: ['tue', 'thu', 'sat'] as DayOfWeek[],
  scheduleFlexibility: 'sometimes_changes',
  sessionDuration: '30_45',
  preferredTrainingTime: 'morning',
  trainingLocation: 'mostly_home',
  equipmentMode: 'custom',
  equipmentIds: ['dumbbells', 'bench'],
  customEquipments: [],
  preferredStyle: 'strength',
  preferredEffort: 'hard',
  volumePreference: 'balanced',
  exerciseVariety: 'repeat_key_exercises',
  structurePreference: 'full_body',
  favorites: ['dumbbell_bench_press'],
  dislikes: [],
  avoid: ['barbell_bench_press', 'barbell_back_squat', 'deadlift', 'barbell_overhead_press'],
  skippedBecauseUnsure: false,
  sleepDuration: '7_to_8',
  sleepQuality: 4,
  energyLevel: 4,
  stressLevel: 2,
  workoutRecovery: 'mostly_recovered',
  dailyActivity: 'moderate',
  averageSteps: 7000,
  dietType: 'vegetarian',
  dietaryRestrictions: ['none'],
  likedFoods: [],
  dislikedFoods: [],
  preferredMeals: '3',
  mealSource: 'mostly_cook',
  eatingOutFrequency: 'rarely',
  nutritionStructure: 'mostly_structured',
  communicationStyle: 'direct',
  decisionAutonomy: 'recommend',
  explanationDepth: 'action_only',
  accountability: 'important_only',
  isCompleted: true,
});

/**
 * PERSONA_E_BEGINNER
 * - Adult (24 yo)
 * - Beginner / foundational profile (zero experience, rarely consistent, low confidence)
 * - Conservative full body structure and moderate effort
 */
export const PERSONA_E_BEGINNER: Readonly<OnboardingData> = Object.freeze({
  goal: 'improve_fitness',
  age: 24,
  heightCm: 170,
  weightKg: 68,
  trainingHistory: 'never',
  consistency: 'rarely',
  exerciseConfidence: 1,
  programmingConfidence: 1,
  idealTrainingDays: 2,
  realisticMinimumDays: 2,
  availableDays: ['tue', 'fri'] as DayOfWeek[],
  scheduleFlexibility: 'often_changes',
  sessionDuration: '20_30',
  preferredTrainingTime: 'afternoon',
  trainingLocation: 'small_local_gym',
  equipmentMode: 'most_gym_equipment',
  equipmentIds: ['dumbbells', 'bench', 'cardio_equipment'],
  customEquipments: [],
  preferredStyle: 'general_fitness',
  preferredEffort: 'moderate',
  volumePreference: 'fewer_high_effort',
  exerciseVariety: 'some_variety',
  structurePreference: 'full_body',
  favorites: [],
  dislikes: [],
  avoid: [],
  skippedBecauseUnsure: true,
  sleepDuration: '6_to_7',
  sleepQuality: 3,
  energyLevel: 3,
  stressLevel: 3,
  workoutRecovery: 'sometimes_fatigued',
  dailyActivity: 'light',
  averageSteps: 5000,
  dietType: 'no_preference',
  dietaryRestrictions: ['none'],
  likedFoods: [],
  dislikedFoods: [],
  preferredMeals: '3',
  mealSource: 'mixed',
  eatingOutFrequency: '1_2_week',
  nutritionStructure: 'flexible',
  communicationStyle: 'educational',
  decisionAutonomy: 'coach_leads',
  explanationDepth: 'detailed',
  accountability: 'gentle',
  isCompleted: true,
});

/**
 * PERSONA_F_VEGAN_STRUCTURED
 * - Adult (27 yo)
 * - Vegan diet with nuts restriction
 * - Liked foods: tofu, oats, quinoa; Disliked foods: dark_chocolate
 * - Highly structured meal preference, 4 meals per day, home cook
 * - Exercises strict nutrition compatibility validation
 */
export const PERSONA_F_VEGAN_STRUCTURED: Readonly<OnboardingData> = Object.freeze({
  goal: 'build_muscle',
  age: 27,
  heightCm: 175,
  weightKg: 72,
  trainingHistory: '1_to_2_years',
  consistency: 'mostly_consistent',
  exerciseConfidence: 4,
  programmingConfidence: 3,
  idealTrainingDays: 4,
  realisticMinimumDays: 3,
  availableDays: ['mon', 'tue', 'thu', 'fri'] as DayOfWeek[],
  scheduleFlexibility: 'sometimes_changes',
  sessionDuration: '45_60',
  preferredTrainingTime: 'evening',
  trainingLocation: 'commercial_gym',
  equipmentMode: 'most_gym_equipment',
  equipmentIds: ['barbell', 'dumbbells', 'bench', 'cable_machine', 'pullup_bar'],
  customEquipments: [],
  preferredStyle: 'hypertrophy',
  preferredEffort: 'hard',
  volumePreference: 'balanced',
  exerciseVariety: 'some_variety',
  structurePreference: 'upper_lower',
  favorites: ['bench_press'],
  dislikes: [],
  avoid: [],
  skippedBecauseUnsure: false,
  sleepDuration: '7_to_8',
  sleepQuality: 4,
  energyLevel: 4,
  stressLevel: 2,
  workoutRecovery: 'mostly_recovered',
  dailyActivity: 'moderate',
  averageSteps: 9000,
  dietType: 'vegan',
  dietaryRestrictions: ['nuts'],
  likedFoods: ['tofu', 'oats', 'quinoa'],
  dislikedFoods: ['dark_chocolate'],
  preferredMeals: '4',
  mealSource: 'mostly_cook',
  eatingOutFrequency: 'rarely',
  nutritionStructure: 'very_structured',
  communicationStyle: 'educational',
  decisionAutonomy: 'recommend',
  explanationDepth: 'detailed',
  accountability: 'important_only',
  isCompleted: true,
});

/**
 * PERSONA_G_QUANTITATIVE_READY
 * - Adult male (28 yo, 180 cm, 80 kg)
 * - Explicit biological sex provided: 'male'
 * - Goal: build_muscle, 3 days/week, moderate activity (8,000 steps)
 * - Complete input readiness for quantitative nutrition targeting
 */
export const PERSONA_G_QUANTITATIVE_READY: Readonly<OnboardingData> = Object.freeze({
  ...PERSONA_A_BASELINE,
  biologicalSex: 'male',
});

/**
 * PERSONA_H_FEMALE_READY
 * - Adult female (26 yo, 168 cm, 65 kg)
 * - Explicit biological sex provided: 'female'
 * - Complete input readiness for quantitative nutrition targeting
 */
export const PERSONA_H_FEMALE_READY: Readonly<OnboardingData> = Object.freeze({
  ...PERSONA_A_BASELINE,
  age: 26,
  heightCm: 168,
  weightKg: 65,
  biologicalSex: 'female',
});

/**
 * PERSONA_I_PREFER_NOT_TO_SAY
 * - Adult trainee with explicit 'prefer_not_to_say' for biological sex
 * - Quantitative targets deferred without fabricated assumptions
 */
export const PERSONA_I_PREFER_NOT_TO_SAY: Readonly<OnboardingData> = Object.freeze({
  ...PERSONA_A_BASELINE,
  biologicalSex: 'prefer_not_to_say',
});

export const QA_PERSONAS = {
  PERSONA_A_BASELINE,
  PERSONA_B_ADVANCED_PPL,
  PERSONA_C_RECOVERY_CONSTRAINED,
  PERSONA_D_EQUIPMENT_RESTRICTED,
  PERSONA_E_BEGINNER,
  PERSONA_F_VEGAN_STRUCTURED,
  PERSONA_G_QUANTITATIVE_READY,
  PERSONA_H_FEMALE_READY,
  PERSONA_I_PREFER_NOT_TO_SAY,
} as const;

export type QAPersonaId = keyof typeof QA_PERSONAS;

export function getQAPersona(id: QAPersonaId): OnboardingData {
  const persona = QA_PERSONAS[id];
  if (!persona) {
    throw new Error(`Unknown QA persona: "${id}". Available: ${Object.keys(QA_PERSONAS).join(', ')}`);
  }
  return JSON.parse(JSON.stringify(persona));
}
