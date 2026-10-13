/**
 * Canonical User Profile & Normalization Test Suite
 *
 * Verifies all 16 required invariants from Milestone 1:
 * 1. Complete onboarding data produces a complete canonical profile.
 * 2. Height is stored as heightCm.
 * 3. Weight is stored as weightKg.
 * 4. Optional averageSteps becomes null when absent.
 * 5. Arrays are deduplicated.
 * 6. Original OnboardingData is not mutated.
 * 7. Custom equipment metadata is preserved.
 * 8. realisticMinimumDays > idealTrainingDays fails validation.
 * 9. Empty availableDays fails validation.
 * 10. Custom equipment mode with zero equipment fails validation.
 * 11. Mutually conflicting exercise preference arrays fail validation.
 * 12. All required Screen 8 fields are required.
 * 13. All six Screen 9 required fields are required.
 * 14. All four Screen 10 coaching fields are required.
 * 15. No derived beginner/intermediate/advanced label is created.
 * 16. No calorie/macro/recovery score is created.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OnboardingData } from '../../onboarding/onboardingState';
import { ftInToCm, lbToKg } from '../../onboarding/validation';
import { buildCanonicalUserProfile } from '../normalize';
import {
  validateCanonicalUserProfile,
  isCanonicalUserProfileComplete,
} from '../validate';

/**
 * Fixture: Fully completed 10-screen onboarding state
 */
function getValidCompleteOnboardingData(): OnboardingData {
  return {
    // Screen 1: Goal
    goal: 'build_muscle',

    // Screen 2: About You (Anthropometrics)
    age: 28,
    heightCm: 180,
    weightKg: 78.5,

    // Screen 3: Training Experience
    trainingHistory: '1_to_2_years',
    consistency: 'mostly_consistent',
    exerciseConfidence: 4,
    programmingConfidence: 3,

    // Screen 4: Schedule
    idealTrainingDays: 4,
    realisticMinimumDays: 3,
    availableDays: ['mon', 'wed', 'fri', 'sat'],
    scheduleFlexibility: 'sometimes_changes',
    sessionDuration: '45_60',
    preferredTrainingTime: 'evening',

    // Screen 5: Environment
    trainingLocation: 'commercial_gym',
    equipmentMode: 'most_gym_equipment',
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench'],
    customEquipments: [
      {
        id: 'custom_lat_raise_1',
        name: 'Lateral Raise Machine',
        equipmentType: 'Machine',
        loadingType: 'Weight stack',
        primaryMuscleId: 'shoulders',
        secondaryMuscleIds: ['arms'],
        movementPattern: 'unknown',
      },
    ],

    // Screen 6: Training Style
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'repeat_key_exercises',
    structurePreference: 'full_body',

    // Screen 7: Exercise Preferences
    favorites: ['bench_press', 'barbell_squat'],
    dislikes: ['burpees'],
    avoid: ['behind_neck_press'],
    skippedBecauseUnsure: false,

    // Screen 8: Recovery & Lifestyle
    sleepDuration: '7_to_8',
    sleepQuality: 4,
    energyLevel: 4,
    stressLevel: 2,
    workoutRecovery: 'mostly_recovered',
    dailyActivity: 'moderate',
    averageSteps: 8500,

    // Screen 9: Nutrition & Eating Habits
    dietType: 'non_vegetarian',
    dietaryRestrictions: ['none'],
    likedFoods: ['chicken_breast', 'rice', 'eggs'],
    dislikedFoods: ['celery'],
    preferredMeals: '3',
    mealSource: 'mostly_cook',
    eatingOutFrequency: '1_2_week',
    nutritionStructure: 'mostly_structured',

    // Screen 10: Coaching Preferences
    communicationStyle: 'educational',
    decisionAutonomy: 'recommend',
    explanationDepth: 'detailed',
    accountability: 'gentle',

    // Completion Flag
    isCompleted: true,
  };
}

describe('Canonical User Profile & Normalization', () => {
  it('1. Complete onboarding data produces a complete canonical profile', () => {
    const raw = getValidCompleteOnboardingData();
    const profile = buildCanonicalUserProfile(raw);
    const result = validateCanonicalUserProfile(profile);

    assert.equal(result.valid, true, `Validation failed: ${JSON.stringify(result.errors)}`);
    assert.equal(result.errors.length, 0);
    assert.equal(isCanonicalUserProfileComplete(profile), true);
    assert.equal(profile.schemaVersion, 1);
    assert.equal(profile.metadata.onboardingCompleted, true);
  });

  it('2. Height is stored as heightCm', () => {
    const raw = getValidCompleteOnboardingData();
    raw.heightCm = 175;
    const profile = buildCanonicalUserProfile(raw);

    assert.equal(profile.anthropometrics.heightCm, 175);
    // Explicitly verify no imperial height fields exist in canonical profile
    assert.equal('heightFt' in profile.anthropometrics, false);
    assert.equal('heightIn' in profile.anthropometrics, false);
  });

  it('3. Weight is stored as weightKg', () => {
    const raw = getValidCompleteOnboardingData();
    raw.weightKg = 82.4;
    const profile = buildCanonicalUserProfile(raw);

    assert.equal(profile.anthropometrics.weightKg, 82.4);
    // Explicitly verify no imperial weight fields exist in canonical profile
    assert.equal('weightLb' in profile.anthropometrics, false);
  });

  it('3b. Imperial height/weight normalize correctly to heightCm and weightKg', () => {
    // Example: 5 ft 10 in -> 178 cm, 170 lb -> 77.1 kg
    const normalizedCm = ftInToCm(5, 10);
    const normalizedKg = lbToKg(170);

    const raw = getValidCompleteOnboardingData();
    raw.heightCm = normalizedCm;
    raw.weightKg = normalizedKg;

    const profile = buildCanonicalUserProfile(raw);

    assert.equal(profile.anthropometrics.heightCm, 178);
    assert.equal(profile.anthropometrics.weightKg, 77.1);
    assert.equal(typeof profile.anthropometrics.heightCm, 'number');
    assert.equal(typeof profile.anthropometrics.weightKg, 'number');
    assert.equal('heightFt' in profile.anthropometrics, false);
    assert.equal('heightIn' in profile.anthropometrics, false);
    assert.equal('weightLb' in profile.anthropometrics, false);
  });

  it('4. Optional averageSteps becomes null when absent, undefined, or negative', () => {
    const rawWithoutSteps = getValidCompleteOnboardingData();
    delete rawWithoutSteps.averageSteps;
    const profile1 = buildCanonicalUserProfile(rawWithoutSteps);
    assert.equal(profile1.recoveryLifestyle.averageSteps, null);

    const rawWithNegative = getValidCompleteOnboardingData();
    rawWithNegative.averageSteps = -500;
    const profile2 = buildCanonicalUserProfile(rawWithNegative);
    assert.equal(profile2.recoveryLifestyle.averageSteps, null);

    const rawWithValid = getValidCompleteOnboardingData();
    rawWithValid.averageSteps = 10000;
    const profile3 = buildCanonicalUserProfile(rawWithValid);
    assert.equal(profile3.recoveryLifestyle.averageSteps, 10000);
  });

  it('5. Arrays are deduplicated in normalization', () => {
    const raw = getValidCompleteOnboardingData();
    raw.availableDays = ['mon', 'wed', 'mon', 'fri', 'wed'];
    raw.equipmentIds = ['barbell', 'dumbbells', 'barbell'];
    raw.favorites = ['bench_press', 'squat', 'bench_press'];
    raw.dislikes = ['burpees', 'burpees'];
    raw.avoid = ['crunches', 'crunches'];
    raw.dietaryRestrictions = ['dairy', 'dairy', 'gluten'];
    raw.likedFoods = ['eggs', 'rice', 'eggs'];
    raw.dislikedFoods = ['kale', 'kale'];

    const profile = buildCanonicalUserProfile(raw);

    assert.deepEqual(profile.schedule.availableDays, ['mon', 'wed', 'fri']);
    assert.deepEqual(profile.trainingEnvironment.equipmentIds, ['barbell', 'dumbbells']);
    assert.deepEqual(profile.exercisePreferences.favorites, ['bench_press', 'squat']);
    assert.deepEqual(profile.exercisePreferences.dislikes, ['burpees']);
    assert.deepEqual(profile.exercisePreferences.avoid, ['crunches']);
    assert.deepEqual(profile.nutrition.dietaryRestrictions, ['dairy', 'gluten']);
    assert.deepEqual(profile.nutrition.likedFoods, ['eggs', 'rice']);
    assert.deepEqual(profile.nutrition.dislikedFoods, ['kale']);
  });

  it('6. Original OnboardingData is not mutated during normalization', () => {
    const raw = getValidCompleteOnboardingData();
    const frozen = JSON.parse(JSON.stringify(raw));

    buildCanonicalUserProfile(raw);

    assert.deepEqual(raw, frozen);
  });

  it('7. Custom equipment metadata is preserved completely', () => {
    const raw = getValidCompleteOnboardingData();
    raw.customEquipments = [
      {
        id: 'cust_plate_press_1',
        name: 'Incline Chest Press Plate Loaded',
        equipmentType: 'Plate loaded machine',
        loadingType: 'Plate loaded',
        primaryMuscleId: 'chest',
        secondaryMuscleIds: ['shoulders', 'arms'],
        movementPattern: 'horizontal_push',
      },
    ];

    const profile = buildCanonicalUserProfile(raw);

    assert.equal(profile.trainingEnvironment.customEquipment.length, 1);
    const item = profile.trainingEnvironment.customEquipment[0];
    assert.equal(item.id, 'cust_plate_press_1');
    assert.equal(item.name, 'Incline Chest Press Plate Loaded');
    assert.equal(item.equipmentType, 'Plate loaded machine');
    assert.equal(item.loadingType, 'Plate loaded');
    assert.equal(item.primaryMuscleId, 'chest');
    assert.deepEqual(item.secondaryMuscleIds, ['shoulders', 'arms']);
    assert.equal(item.movementPattern, 'horizontal_push');

    // Mutating the returned array should not affect raw
    profile.trainingEnvironment.customEquipment[0].name = 'Modified Name';
    assert.equal(raw.customEquipments[0].name, 'Incline Chest Press Plate Loaded');
  });

  it('8. realisticMinimumDays > idealTrainingDays fails validation', () => {
    const raw = getValidCompleteOnboardingData();
    raw.idealTrainingDays = 3;
    raw.realisticMinimumDays = 5;

    const profile = buildCanonicalUserProfile(raw);
    const result = validateCanonicalUserProfile(profile);

    assert.equal(result.valid, false);
    const error = result.errors.find((e) => e.field === 'schedule.realisticMinimumDays');
    assert.ok(error);
    assert.equal(error?.code, 'INVALID_RANGE');
  });

  it('9. Empty availableDays fails validation', () => {
    const raw = getValidCompleteOnboardingData();
    raw.availableDays = [];

    const profile = buildCanonicalUserProfile(raw);
    const result = validateCanonicalUserProfile(profile);

    assert.equal(result.valid, false);
    const error = result.errors.find((e) => e.field === 'schedule.availableDays');
    assert.ok(error);
    assert.equal(error?.code, 'REQUIRED');
  });

  it('10. Custom equipment mode with zero equipment fails validation', () => {
    const raw = getValidCompleteOnboardingData();
    raw.equipmentMode = 'custom';
    raw.equipmentIds = [];

    const profile = buildCanonicalUserProfile(raw);
    const result = validateCanonicalUserProfile(profile);

    assert.equal(result.valid, false);
    const error = result.errors.find((e) => e.field === 'trainingEnvironment.equipmentIds');
    assert.ok(error);
    assert.equal(error?.code, 'REQUIRED');
  });

  it('11. Mutually conflicting exercise preference arrays fail validation', () => {
    // Conflict 1: item in both favorites and dislikes
    const raw1 = getValidCompleteOnboardingData();
    raw1.favorites = ['bench_press', 'deadlift'];
    raw1.dislikes = ['deadlift'];

    const profile1 = buildCanonicalUserProfile(raw1);
    const result1 = validateCanonicalUserProfile(profile1);
    assert.equal(result1.valid, false);
    assert.ok(result1.errors.some((e) => e.code === 'CONFLICT'));

    // Conflict 2: item in both favorites and avoid
    const raw2 = getValidCompleteOnboardingData();
    raw2.favorites = ['bench_press'];
    raw2.avoid = ['bench_press'];

    const profile2 = buildCanonicalUserProfile(raw2);
    const result2 = validateCanonicalUserProfile(profile2);
    assert.equal(result2.valid, false);
    assert.ok(result2.errors.some((e) => e.code === 'CONFLICT'));

    // Conflict 3: item in both dislikes and avoid
    const raw3 = getValidCompleteOnboardingData();
    raw3.dislikes = ['burpees'];
    raw3.avoid = ['burpees'];

    const profile3 = buildCanonicalUserProfile(raw3);
    const result3 = validateCanonicalUserProfile(profile3);
    assert.equal(result3.valid, false);
    assert.ok(result3.errors.some((e) => e.code === 'CONFLICT'));
  });

  it('12. All required Screen 8 (Recovery & Lifestyle) fields are required', () => {
    const requiredFields = [
      'sleepDuration',
      'sleepQuality',
      'energyLevel',
      'stressLevel',
      'workoutRecovery',
      'dailyActivity',
    ] as const;

    for (const field of requiredFields) {
      const raw = getValidCompleteOnboardingData();
      delete (raw as Record<string, unknown>)[field];

      const profile = buildCanonicalUserProfile(raw);
      const result = validateCanonicalUserProfile(profile);

      assert.equal(result.valid, false, `Expected ${field} to fail when missing`);
      const error = result.errors.find((e) => e.field === `recoveryLifestyle.${field}`);
      assert.ok(error, `Expected error for recoveryLifestyle.${field}`);
    }
  });

  it('13. All six Screen 9 (Nutrition) required fields are required', () => {
    const requiredFields = [
      { rawKey: 'dietType', profileField: 'nutrition.dietType' },
      { rawKey: 'dietaryRestrictions', profileField: 'nutrition.dietaryRestrictions' },
      { rawKey: 'preferredMeals', profileField: 'nutrition.preferredMeals' },
      { rawKey: 'mealSource', profileField: 'nutrition.mealSource' },
      { rawKey: 'eatingOutFrequency', profileField: 'nutrition.eatingOutFrequency' },
      { rawKey: 'nutritionStructure', profileField: 'nutrition.nutritionStructure' },
    ];

    for (const { rawKey, profileField } of requiredFields) {
      const raw = getValidCompleteOnboardingData();
      delete (raw as Record<string, unknown>)[rawKey];

      const profile = buildCanonicalUserProfile(raw);
      const result = validateCanonicalUserProfile(profile);

      assert.equal(result.valid, false, `Expected ${rawKey} to fail when missing`);
      const error = result.errors.find((e) => e.field === profileField);
      assert.ok(error, `Expected error for ${profileField}`);
    }

    // Also test "none" with other restrictions fails
    const rawConflict = getValidCompleteOnboardingData();
    rawConflict.dietaryRestrictions = ['none', 'gluten'];
    const profileConflict = buildCanonicalUserProfile(rawConflict);
    const resultConflict = validateCanonicalUserProfile(profileConflict);
    assert.equal(resultConflict.valid, false);
    assert.ok(resultConflict.errors.some((e) => e.field === 'nutrition.dietaryRestrictions' && e.code === 'CONFLICT'));
  });

  it('14. All four Screen 10 (Coaching Preferences) fields are required', () => {
    const requiredFields = [
      { rawKey: 'communicationStyle', profileField: 'coachingPreferences.communicationStyle' },
      { rawKey: 'decisionAutonomy', profileField: 'coachingPreferences.decisionAutonomy' },
      { rawKey: 'explanationDepth', profileField: 'coachingPreferences.explanationDepth' },
      { rawKey: 'accountability', profileField: 'coachingPreferences.accountability' },
    ];

    for (const { rawKey, profileField } of requiredFields) {
      const raw = getValidCompleteOnboardingData();
      delete (raw as Record<string, unknown>)[rawKey];

      const profile = buildCanonicalUserProfile(raw);
      const result = validateCanonicalUserProfile(profile);

      assert.equal(result.valid, false, `Expected ${rawKey} to fail when missing`);
      const error = result.errors.find((e) => e.field === profileField);
      assert.ok(error, `Expected error for ${profileField}`);
    }
  });

  it('15. No derived beginner/intermediate/advanced label is created', () => {
    const raw = getValidCompleteOnboardingData();
    const profile = buildCanonicalUserProfile(raw);
    const profileObj = profile as Record<string, unknown>;

    assert.equal('experienceLevel' in profileObj, false);
    assert.equal('fitnessLevel' in profileObj, false);
    assert.equal('tier' in profileObj, false);
    assert.equal('userLevel' in profileObj, false);

    const trainingExp = profile.trainingExperience as Record<string, unknown>;
    assert.equal('level' in trainingExp, false);
    assert.equal('category' in trainingExp, false);
  });

  it('16. No calorie/macro/recovery score is created', () => {
    const raw = getValidCompleteOnboardingData();
    const profile = buildCanonicalUserProfile(raw);
    const profileObj = profile as Record<string, unknown>;

    // No top-level or nutrition calorie/macro derivations
    assert.equal('calories' in profileObj, false);
    assert.equal('macros' in profileObj, false);
    assert.equal('tdee' in profileObj, false);

    const nutrition = profile.nutrition as Record<string, unknown>;
    assert.equal('targetCalories' in nutrition, false);
    assert.equal('proteinGrams' in nutrition, false);
    assert.equal('carbGrams' in nutrition, false);
    assert.equal('fatGrams' in nutrition, false);

    // No recovery score derivation
    const recovery = profile.recoveryLifestyle as Record<string, unknown>;
    assert.equal('recoveryScore' in recovery, false);
    assert.equal('readiness' in recovery, false);
  });
});
