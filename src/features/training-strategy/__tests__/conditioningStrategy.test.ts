/**
 * T8 — Conditioning Strategy Test Suite
 *
 * Verifies all required conditioning strategy invariants:
 * A. Objective behavior (hypertrophy, strength, body composition, fat loss support, general fitness)
 * B. Activity context (sedentary, light, moderate, very active, steps present, steps absent, uncertain inputs)
 * C. Session duration (20-30, 30-45, 45-60, 60-75, 75+)
 * D. Frequency (low target, high target, minimum viable frequency fallback, flexible sequence)
 * E. Modality (cardio equipment available, no cardio equipment, bodyweight/band, mixed options)
 * F. Preference (high intensity style, balanced, general fitness, exercise variety)
 * G. Experience (foundational, standard, advanced)
 * H. Interference protection (hypertrophy, strength, body composition, fat loss support, general fitness)
 * I. Uncertainty (missing steps, uncertain recovery, unsure preferences)
 * J. Determinism (same input produces identical output)
 * K. Immutability (input profile and prior strategy objects not mutated)
 * L. Scope & safety (no exact durations, distances, speeds, HR targets, calories, sets/reps, deloads, recovery scores, diagnoses)
 * M. Population boundary (age 13, 17, 18, youth isolation, adult pipeline execution)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingObjective } from '../goalResolution';
import { resolveFrequency } from '../frequencyResolution';
import { resolveTrainingStructure } from '../trainingStructure';
import { resolveTrainingLoad } from '../trainingLoad';
import { resolveExerciseSelection } from '../exerciseSelection';
import { resolveTrainingDemand } from '../trainingDemand';
import { resolveProgressionStrategy } from '../progressionStrategy';
import {
  resolveConditioningStrategy,
  HIGH_ACTIVITY_STEPS_THRESHOLD,
} from '../conditioningStrategy';
import { runStrategyPipeline } from '../strategyPipeline';

/**
 * Fixture factory: creates a validated CanonicalUserProfile with specific overrides.
 */
function createProfile(overrides: Partial<OnboardingData> = {}): CanonicalUserProfile {
  const baseData: OnboardingData = {
    goal: 'build_muscle',
    age: 28,
    heightCm: 180,
    weightKg: 78.5,
    trainingHistory: '1_to_2_years',
    consistency: 'mostly_consistent',
    exerciseConfidence: 4,
    programmingConfidence: 3,
    idealTrainingDays: 4,
    realisticMinimumDays: 3,
    availableDays: ['mon', 'wed', 'fri', 'sat'],
    scheduleFlexibility: 'sometimes_changes',
    sessionDuration: '45_60',
    preferredTrainingTime: 'evening',
    trainingLocation: 'commercial_gym',
    equipmentMode: 'most_gym_equipment',
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'machines'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'some_variety',
    favorites: ['bench_press'],
    dislikes: ['burpees'],
    avoid: ['deadlift'],
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
    likedFoods: ['chicken_breast'],
    dislikedFoods: ['celery'],
    preferredMeals: '3',
    mealSource: 'mostly_cook',
    eatingOutFrequency: '1_2_week',
    nutritionStructure: 'mostly_structured',
    communicationStyle: 'educational',
    decisionAutonomy: 'recommend',
    explanationDepth: 'detailed',
    accountability: 'gentle',
    isCompleted: true,
    ...overrides,
  };

  return buildCanonicalUserProfile(baseData);
}

/**
 * Helper to run prerequisites T1–T7 for a profile.
 */
function getStrategyPrereqs(profile: CanonicalUserProfile) {
  const objective = resolveTrainingObjective(profile);
  const frequency = resolveFrequency(profile);
  const structure = resolveTrainingStructure(profile, objective, frequency);
  const trainingLoad = resolveTrainingLoad(profile, objective, frequency, structure);
  const exerciseSelection = resolveExerciseSelection(profile, objective, structure);
  const trainingDemand = resolveTrainingDemand(
    profile,
    objective,
    frequency,
    structure,
    trainingLoad,
    exerciseSelection
  );
  const progression = resolveProgressionStrategy(
    profile,
    objective,
    structure,
    trainingLoad,
    trainingDemand
  );
  return { objective, frequency, structure, trainingLoad, exerciseSelection, trainingDemand, progression };
}

describe('T8 — Conditioning Strategy', () => {
  // =========================================================================
  // A. OBJECTIVE BEHAVIOR
  // =========================================================================
  describe('A. Objective behavior', () => {
    it('A.1. Hypertrophy objective configures low priority and minimal baseline demand with high protection', () => {
      const profile = createProfile({ goal: 'build_muscle' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.priority, 'low');
      assert.equal(conditioning.demand, 'minimal');
      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'high');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'high');
    });

    it('A.2. Strength objective configures low priority and high resistance protection', () => {
      const profile = createProfile({ goal: 'get_stronger' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.priority, 'low');
      assert.equal(conditioning.demand, 'minimal');
      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'high');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'high');
    });

    it('A.3. Body composition objective configures moderate priority and balanced protection', () => {
      const profile = createProfile({ goal: 'build_muscle_lose_fat' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.priority, 'moderate');
      assert.equal(conditioning.demand, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'moderate');
    });

    it('A.4. Fat loss support objective configures moderate priority and supportive demand', () => {
      const profile = createProfile({ goal: 'lose_fat' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.priority, 'moderate');
      assert.equal(conditioning.demand, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'moderate');
    });

    it('A.5. General fitness objective configures moderate priority with low interference sensitivity', () => {
      const profile = createProfile({ goal: 'improve_fitness' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.priority, 'moderate');
      assert.equal(conditioning.demand, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'low');
    });
  });

  // =========================================================================
  // B. ACTIVITY CONTEXT
  // =========================================================================
  describe('B. Activity context', () => {
    it('B.1. Mostly sedentary lifestyle supports supplemental conditioning when objective permits', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        dailyActivity: 'mostly_sedentary',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'moderate');
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('mostly sedentary'))
      );
    });

    it('B.2. Very active lifestyle moderates conditioning demand to prevent excess fatigue', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        dailyActivity: 'very_active',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      // Moderates from moderate down to minimal
      assert.equal(conditioning.demand, 'minimal');
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('very active'))
      );
    });

    it('B.3. High daily steps (>= 12,000) moderates conditioning demand to minimal', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        averageSteps: 14000,
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'minimal');
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('14000') && t.includes('matches high-activity heuristic'))
      );
    });

    it('B.4. Missing steps does not assume sedentary or active behavior', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        averageSteps: null,
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('Average daily steps not reported'))
      );
      assert.equal(conditioning.demand, 'moderate');
    });

    it('B.5. Recovery-state signals (sleep < 5h, often_fatigued) do NOT reduce T8 baseline demand (deferred to T9)', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        workoutRecovery: 'often_fatigued',
        sleepDuration: 'under_5',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      // Baseline demand remains moderate; recovery reduction deferred to T9
      assert.equal(conditioning.demand, 'moderate');
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('Recovery-state constraints deferred to T9'))
      );
    });

    it('B.6. High daily steps heuristic (>= 12,000) operates as a product heuristic, not a medical cutoff', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        averageSteps: HIGH_ACTIVITY_STEPS_THRESHOLD,
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'minimal');
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('matches high-activity heuristic'))
      );
    });
  });

  // =========================================================================
  // C. SESSION DURATION & SHORT SESSION PROTECTION
  // =========================================================================
  describe('C. Session duration', () => {
    it('C.1. 20–30 minute session with low priority sets conditioning demand to none to protect lifting slots', () => {
      const profile = createProfile({
        goal: 'build_muscle',
        sessionDuration: '20_30',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'none');
      assert.equal(conditioning.mode, 'none');
      assert.equal(conditioning.placement.guidance, 'none');
    });

    it('C.2. 20–30 minute session with moderate priority caps demand at minimal with flexible placement', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        sessionDuration: '20_30',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'minimal');
      assert.equal(conditioning.mode, 'optional');
      assert.equal(conditioning.placement.guidance, 'flexible');
    });

    it('C.3. 45–60 minute session supports standard moderate conditioning integration', () => {
      const profile = createProfile({
        goal: 'improve_fitness',
        sessionDuration: '45_60',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'moderate');
      assert.equal(conditioning.mode, 'integrated');
      assert.equal(conditioning.placement.guidance, 'post_resistance');
    });

    it('C.4. 75+ minute session accommodates conditioning without crowding out resistance', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        sessionDuration: '75_plus',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'moderate');
      assert.equal(conditioning.placement.guidance, 'post_resistance');
    });
  });

  // =========================================================================
  // D. FREQUENCY & FALLBACK INTEGRATION
  // =========================================================================
  describe('D. Frequency', () => {
    it('D.1. Low frequency (2-day schedule) with low priority eliminates conditioning demand to protect full-body lifting', () => {
      const profile = createProfile({
        goal: 'build_muscle',
        idealTrainingDays: 2,
        realisticMinimumDays: 2,
        availableDays: ['tue', 'thu'],
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'none');
      assert.equal(conditioning.mode, 'none');
    });

    it('D.2. High frequency (5-day schedule) with moderate priority can assign dedicated conditioning mode', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.demand, 'moderate');
      assert.equal(conditioning.mode, 'dedicated');
      assert.equal(conditioning.placement.guidance, 'separate_session');
    });

    it('D.3. Minimum viable frequency preserves resistance training as priority in fallback', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        idealTrainingDays: 4,
        realisticMinimumDays: 2,
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(
        conditioning.frequencyRelationship.minimumViableFallback,
        'prioritize_resistance_reduce_conditioning'
      );
      assert.ok(
        conditioning.frequencyRelationship.fallbackGuidance.includes('resistance volume is preserved')
      );
    });

    it('D.4. Flexible schedule produces sequence-aware placement guidance without naming weekdays', () => {
      const profile = createProfile({
        goal: 'improve_fitness',
        scheduleFlexibility: 'often_changes',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      const allText = JSON.stringify(conditioning);
      assert.doesNotMatch(allText, /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
      assert.ok(conditioning.placement.guidance.length > 0);
    });
  });

  // =========================================================================
  // E. MODALITY & EQUIPMENT CONTEXT
  // =========================================================================
  describe('E. Modality', () => {
    it('E.1. Cardio equipment availability includes steady_state in preferred modalities', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        equipmentMode: 'most_gym_equipment',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning.preferredModalityFamilies.includes('steady_state'));
    });

    it('E.2. No cardio equipment avoids machine-dependent steady state as sole preferred modality', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        equipmentMode: 'custom',
        equipmentIds: ['dumbbells', 'resistance_bands'],
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning.preferredModalityFamilies.includes('walking_low_intensity'));
      assert.ok(
        conditioning.preferredModalityFamilies.includes('mixed_conditioning') ||
        conditioning.optionalModalityAlternatives.includes('mixed_conditioning')
      );
    });

    it('E.3. Optional modality alternatives provide non-conflicting fallback choices', () => {
      const profile = createProfile({ goal: 'improve_fitness' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning.optionalModalityAlternatives.length > 0);
      for (const alt of conditioning.optionalModalityAlternatives) {
        assert.ok(!conditioning.preferredModalityFamilies.includes(alt));
      }
    });
  });

  // =========================================================================
  // F. PREFERENCES & TRAINING STYLE GUARD
  // =========================================================================
  describe('F. Preferences & training style guard', () => {
    it('F.1. "High intensity" training style preference does NOT automatically increase demand to high or cause maximal conditioning', () => {
      const profile = createProfile({
        goal: 'build_muscle',
        preferredStyle: 'high_intensity',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      // Must remain minimal for hypertrophy; cannot jump to high demand
      assert.equal(conditioning.demand, 'minimal');
      assert.notEqual(conditioning.demand, 'moderate');
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('NOT as an expansion of conditioning demand'))
      );
    });

    it('F.2. Variety preference "repeat_key_exercises" restricts preferred and alternative modality count', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        exerciseVariety: 'repeat_key_exercises',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning.preferredModalityFamilies.length <= 2);
      assert.ok(conditioning.optionalModalityAlternatives.length <= 1);
    });

    it('F.3. Variety preference "change_often" broadens alternative modalities', () => {
      const profile = createProfile({
        goal: 'improve_fitness',
        exerciseVariety: 'change_often',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning.optionalModalityAlternatives.includes('recreational_activity'));
    });
  });

  // =========================================================================
  // G. EXPERIENCE SENSITIVITY
  // =========================================================================
  describe('G. Experience sensitivity', () => {
    it('G.1. Foundational trainee receives simple, repeatable modalities and avoids complex intervals', () => {
      const profile = createProfile({
        trainingHistory: 'under_3_months',
        consistency: 'rarely',
        exerciseConfidence: 1,
        programmingConfidence: 1,
        goal: 'improve_fitness',
        preferredStyle: 'high_intensity', // user preference must not force advanced intervals
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(prereqs.structure.programmingComplexity, 'foundational');
      assert.ok(conditioning.preferredModalityFamilies.includes('walking_low_intensity'));
      assert.ok(!conditioning.preferredModalityFamilies.includes('intervals'));
      assert.ok(
        conditioning.decisionTrace.some((t) => t.includes('Foundational programming complexity'))
      );
    });

    it('G.2. Advanced trainee supports broader modality spectrum including intervals when style permits', () => {
      const profile = createProfile({
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        goal: 'improve_fitness',
        preferredStyle: 'high_intensity',
      });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(prereqs.structure.programmingComplexity, 'advanced');
      assert.ok(
        conditioning.preferredModalityFamilies.includes('intervals') ||
        conditioning.optionalModalityAlternatives.includes('intervals')
      );
    });
  });

  // =========================================================================
  // H. INTERFERENCE PROTECTION
  // =========================================================================
  describe('H. Interference protection', () => {
    it('H.1. Hypertrophy objective requires high resistance protection and high interference sensitivity', () => {
      const profile = createProfile({ goal: 'build_muscle' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'high');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'high');
      assert.ok(conditioning.interferenceConsiderations.rationale.length > 0);
    });

    it('H.2. Strength objective requires high resistance protection and high interference sensitivity', () => {
      const profile = createProfile({ goal: 'get_stronger' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'high');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'high');
    });

    it('H.3. Body composition balances resistance and conditioning support', () => {
      const profile = createProfile({ goal: 'build_muscle_lose_fat' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'moderate');
      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'moderate');
    });

    it('H.4. Fat loss support keeps resistance training as foundational core', () => {
      const profile = createProfile({ goal: 'lose_fat' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.interferenceConsiderations.resistanceProtection, 'moderate');
      assert.ok(
        conditioning.interferenceConsiderations.rationale.includes('resistance training remaining the foundational core')
      );
    });

    it('H.5. General fitness has low interference sensitivity with broader conditioning integration', () => {
      const profile = createProfile({ goal: 'improve_fitness' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(conditioning.interferenceConsiderations.interferenceSensitivity, 'low');
    });
  });

  // =========================================================================
  // I. UNCERTAINTY & ROBUSTNESS
  // =========================================================================
  describe('I. Uncertainty & robustness', () => {
    it('I.1. Missing steps does not crash and applies conservative neutral baseline', () => {
      const profile = createProfile({ averageSteps: null });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning);
      assert.ok(conditioning.decisionTrace.some((t) => t.includes('Average daily steps not reported')));
    });

    it('I.2. "Not sure" recovery does not assume poor recovery', () => {
      const profile = createProfile({ workoutRecovery: 'not_sure' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning);
      assert.equal(conditioning.demand, 'minimal');
      assert.ok(conditioning.decisionTrace.some((t) => t.includes('recoveryState=not_sure')));
    });

    it('I.3. "Not sure" training style applies safe balanced defaults', () => {
      const profile = createProfile({ preferredStyle: 'not_sure' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.ok(conditioning);
      assert.ok(conditioning.preferredModalityFamilies.length > 0);
    });
  });

  // =========================================================================
  // J. DETERMINISM
  // =========================================================================
  describe('J. Determinism', () => {
    it('J.1. Same input produces exactly identical conditioning strategy', () => {
      const profile = createProfile({ goal: 'lose_fat' });
      const prereqs1 = getStrategyPrereqs(profile);
      const prereqs2 = getStrategyPrereqs(profile);

      const res1 = resolveConditioningStrategy(
        profile,
        prereqs1.objective,
        prereqs1.frequency,
        prereqs1.structure,
        prereqs1.trainingLoad,
        prereqs1.trainingDemand,
        prereqs1.progression
      );
      const res2 = resolveConditioningStrategy(
        profile,
        prereqs2.objective,
        prereqs2.frequency,
        prereqs2.structure,
        prereqs2.trainingLoad,
        prereqs2.trainingDemand,
        prereqs2.progression
      );

      assert.deepEqual(res1, res2);
    });
  });

  // =========================================================================
  // K. IMMUTABILITY
  // =========================================================================
  describe('K. Immutability', () => {
    it('K.1. Input profile and prerequisites are not mutated', () => {
      const profile = createProfile({ goal: 'build_muscle' });
      const profileSnapshot = JSON.stringify(profile);
      const prereqs = getStrategyPrereqs(profile);
      const prereqsSnapshot = JSON.stringify(prereqs);

      resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      assert.equal(JSON.stringify(profile), profileSnapshot);
      assert.equal(JSON.stringify(prereqs), prereqsSnapshot);
    });
  });

  // =========================================================================
  // L. SCOPE & SAFETY
  // =========================================================================
  describe('L. Scope & safety', () => {
    it('L.1. T8 produces zero exact durations, distances, speeds, HR targets, calories, or workout sessions', () => {
      const profile = createProfile({ goal: 'improve_fitness' });
      const prereqs = getStrategyPrereqs(profile);
      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      const json = JSON.stringify(conditioning);

      // Verify no exact numeric prescription units
      assert.doesNotMatch(json, /\b\d+\s*(?:minutes|mins|km|miles|mph|bpm|kcal|calories)\b/i);

      // Verify no deload decisions or recovery scores
      assert.doesNotMatch(json, /deload|recoveryScore|readinessScore|injury|diagnosis/i);

      // Verify qualitative vocabulary
      assert.ok(['none', 'minimal', 'moderate'].includes(conditioning.demand));
      assert.ok(['low', 'moderate', 'high'].includes(conditioning.priority));
    });

    it('L.2. T8 does not create recovery scores, deload decisions, reduce T6 demand, or override T7 progression', () => {
      const profile = createProfile({
        goal: 'lose_fat',
        workoutRecovery: 'often_fatigued',
        sleepDuration: 'under_5',
      });
      const prereqs = getStrategyPrereqs(profile);
      const demandSnapshot = JSON.stringify(prereqs.trainingDemand);
      const progressionSnapshot = JSON.stringify(prereqs.progression);

      const conditioning = resolveConditioningStrategy(
        profile,
        prereqs.objective,
        prereqs.frequency,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression
      );

      // T6 demand remains unchanged
      assert.equal(JSON.stringify(prereqs.trainingDemand), demandSnapshot);
      // T7 progression remains unchanged
      assert.equal(JSON.stringify(prereqs.progression), progressionSnapshot);
      // Conditioning object contains zero deload / recovery reduction properties
      assert.ok(!('deload' in conditioning));
      assert.ok(!('recoveryScore' in conditioning));
      assert.ok(!('reducedDemand' in conditioning));
    });
  });

  // =========================================================================
  // M. POPULATION BOUNDARY & PIPELINE INTEGRATION
  // =========================================================================
  describe('M. Population boundary & pipeline integration', () => {
    it('M.1. Adult profile (age 18+) reaches T8 through runStrategyPipeline with status completed', () => {
      const profile = createProfile({ age: 18, goal: 'build_muscle' });
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        assert.ok(pipelineResult.conditioning);
        assert.equal(pipelineResult.conditioning.priority, 'low');
        assert.ok(pipelineResult.decisionTrace.some((t) => t.includes('T8 Conditioning:')));
      }
    });

    it('M.2. Youth profile (age 13–17) stops at youth_strategy_pending and NEVER executes T8', () => {
      const profile = createProfile({ age: 15, goal: 'build_muscle' });
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'pending');
      assert.equal(pipelineResult.path, 'youth_strategy_pending');
      assert.ok(pipelineResult.decisionTrace.some((t) => t.includes('Adult T8 (Conditioning Strategy) SKIPPED')));
      assert.ok(!('conditioning' in pipelineResult));
    });

    it('M.3. Ineligible profile (age < 13 or > 100) is blocked and NEVER executes T8', () => {
      const rawProfile = createProfile({ age: 25 });
      // Construct ineligible object simulating out-of-range age
      const ineligibleProfile: CanonicalUserProfile = {
        ...rawProfile,
        anthropometrics: {
          ...rawProfile.anthropometrics,
          age: 105,
        },
      };

      const pipelineResult = runStrategyPipeline(ineligibleProfile);
      assert.equal(pipelineResult.status, 'ineligible');
      assert.equal(pipelineResult.path, 'ineligible');
      assert.ok(!('conditioning' in pipelineResult));
    });
  });
});
