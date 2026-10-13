/**
 * Deterministic Development Fixture for Stage W4.2 Workout Player
 *
 * Provides a clean, valid, deterministic prescribed WorkoutPlan instance
 * generated from standard canonical profile parameters for UI development and testing.
 *
 * NOTE: This is clearly marked as a development fixture and is NOT production data.
 */

import { buildCanonicalUserProfile } from '../profile';
import { runStrategyPipeline } from '../training-strategy';
import {
  buildWorkoutPlanSkeleton,
  generatePrescribedWorkoutPlan,
  type WorkoutPlan,
  type WorkoutSession,
} from '../workout-plan';
import type { OnboardingData } from '../onboarding/onboardingState';

export function createDeterministicDevWorkoutPlan(): WorkoutPlan {
  const sampleData: OnboardingData = {
    goal: 'build_muscle',
    age: 28,
    heightCm: 180,
    weightKg: 78.5,
    trainingHistory: '1_to_2_years',
    consistency: 'mostly_consistent',
    exerciseConfidence: 4,
    programmingConfidence: 3,
    idealTrainingDays: 3,
    realisticMinimumDays: 3,
    availableDays: ['mon', 'wed', 'fri'],
    scheduleFlexibility: 'sometimes_changes',
    sessionDuration: '45_60',
    preferredTrainingTime: 'evening',
    trainingLocation: 'commercial_gym',
    equipmentMode: 'most_gym_equipment',
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'pull_up_bar'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'some_variety',
    favorites: ['bench_press', 'barbell_squat'],
    dislikes: [],
    avoid: [],
    skippedBecauseUnsure: false,
    sleepDuration: '7_to_8',
    sleepQuality: 4,
    energyLevel: 4,
    stressLevel: 2,
    workoutRecovery: 'mostly_recovered',
    dailyActivity: 'moderate',
    averageSteps: 8500,
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
  };

  const profile = buildCanonicalUserProfile(sampleData);
  const result = runStrategyPipeline(profile);
  if (result.status !== 'completed') {
    throw new Error('Strategy pipeline failed to generate adult strategy.');
  }

  const skeleton = buildWorkoutPlanSkeleton(result.strategy, profile);
  const prescribedPlan = generatePrescribedWorkoutPlan(skeleton, result.strategy, profile, {
    deterministicSeed: 'dev-fixture-seed-w4',
  });

  return prescribedPlan;
}

/**
 * Returns a specific WorkoutSession by sessionId from the deterministic dev plan,
 * or the first session if sessionId is 'first' or not found.
 */
export function getDevWorkoutSession(sessionId?: string): WorkoutSession {
  const plan = createDeterministicDevWorkoutPlan();
  if (!sessionId || sessionId === 'first') {
    return plan.sessions[0];
  }
  const match = plan.sessions.find((s) => s.sessionId === sessionId);
  return match ?? plan.sessions[0];
}
