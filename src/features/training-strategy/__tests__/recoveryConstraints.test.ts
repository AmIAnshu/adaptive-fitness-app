/**
 * T9 — Recovery Constraints Test Suite
 *
 * Verifies all required runtime recovery adaptation invariants:
 * A. Baseline / Neutral State (missing or empty runtime state -> stable, maintain all, no deload)
 * B. Missing & Partial Data Handling (missing fields are neutral, never penalize the trainee)
 * C. Isolated Negative Signal (single bad night, isolated soreness -> mildly_constrained, maintain volume & frequency, no deload)
 * D. Repeated Negative Signals (2+ moderate signals, repeated fatigue -> constrained, volume reduced, effort easier, deload considered)
 * E. Precedence Hierarchy (conditioning yields before resistance; conditioning reduced or omitted first)
 * F. Persistent Multi-Signal Convergence (3+ signals, chronic under-recovery -> strongly_constrained, volume strongly reduced, conditioning omitted, frequency reduced, deload recommended)
 * G. Recovery Release (returning to healthy signals immediately restores stable status)
 * H. Progression Performance Signal Integration (T7 regression signal reinforces recovery constraints)
 * I. Determinism & Immutability (pure function, inputs unmodified)
 * J. Scope & Safety (no numeric scores, no medical diagnoses, no workout prescriptions)
 * K. Pipeline Integration & Population Guard (adult reaches T9, youth strictly halted, ineligible blocked)
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
import { resolveConditioningStrategy } from '../conditioningStrategy';
import { resolveRecoveryConstraints } from '../recoveryConstraints';
import { runStrategyPipeline } from '../strategyPipeline';
import type { RecoveryRuntimeState } from '../types';

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
    workoutRecovery: 'usually_recovered',
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
 * Helper: generates full pipeline prerequisites up through T8.
 */
function resolvePrerequisites(profile: CanonicalUserProfile) {
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
  const conditioning = resolveConditioningStrategy(
    profile,
    objective,
    frequency,
    structure,
    trainingLoad,
    trainingDemand,
    progression
  );

  return {
    objective,
    frequency,
    structure,
    trainingLoad,
    exerciseSelection,
    trainingDemand,
    progression,
    conditioning,
  };
}

describe('T9 — Recovery Constraints', () => {
  // ==================================================
  // Category A: Baseline / Neutral State
  // ==================================================
  describe('A. Baseline / Neutral State', () => {
    it('A.1. Omitted runtimeState results in stable level and maintain modifiers', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.conditioningModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
      assert.ok(constraints.reasons.length > 0);
      assert.ok(constraints.decisionTrace.length > 0);
    });

    it('A.2. Empty runtimeState object results in stable level and maintain modifiers', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        {}
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.conditioningModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });

    it('A.3. Fully healthy runtimeState results in stable status', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '7_to_8',
        sleepQuality: 5,
        energyLevel: 5,
        stressLevel: 1,
        workoutRecovery: 'usually_recovered',
        sorenessLevel: 'none',
        recentMissedSessionsCount: 0,
        recentDegradedSessionsCount: 0,
        consecutiveUnderRecoveredSessions: 0,
        accumulatedFatigueCycles: 0,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.conditioningModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });
  });

  // ==================================================
  // Category B: Missing & Partial Data Treated As Neutral
  // ==================================================
  describe('B. Missing & Partial Data Handling', () => {
    it('B.1. Partial state with only 1 healthy field is not penalized for missing fields', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '7_to_8',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.deloadDecision, 'none');
    });

    it('B.2. Single mild soreness within normal limits remains stable without penalty', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sorenessLevel: 'mild',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });
  });

  // ==================================================
  // Category C: Isolated Negative Signal (Mildly Constrained)
  // ==================================================
  describe('C. Isolated Negative Signal', () => {
    it('C.1. Single moderate sleep deficit produces mildly_constrained with volume maintained and NO deload', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'mildly_constrained');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.conditioningModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
      assert.ok(constraints.reasons.some((r) => r.includes('5–6 hours')));
    });

    it('C.2. Single acute bad night (< 5 hours) does NOT trigger deload or volume reduction', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: 'under_5',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'mildly_constrained');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });

    it('C.3. Single isolated missed session does NOT trigger deload', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        recentMissedSessionsCount: 1,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      // Single missed session is mild, stable/mildly_constrained, no deload
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });

    it('C.4. Acute severe soreness moderates effort and trims conditioning without deload', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sorenessLevel: 'severe',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'mildly_constrained');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.conditioningModifier, 'reduce');
      assert.equal(constraints.deloadDecision, 'none');
    });
  });

  // ==================================================
  // Category D: Repeated Negative Signals (Constrained)
  // ==================================================
  describe('D. Repeated Negative Signals', () => {
    it('D.1. Two moderate signals (short sleep + high stress) produce constrained state with volume reduction', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.volumeModifier, 'reduce');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.frequencyModifier, 'maintain');
    });

    it('D.2. Two consecutive under-recovered sessions triggers consider deload', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 2,
        energyLevel: 2,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.volumeModifier, 'reduce');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.deloadDecision, 'consider');
      assert.equal(constraints.frequencyModifier, 'maintain');
    });

    it('D.3. Two recent degraded sessions triggers consider deload', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        recentDegradedSessionsCount: 2,
        workoutRecovery: 'often_fatigued',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.volumeModifier, 'reduce');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.deloadDecision, 'consider');
    });
  });

  // ==================================================
  // Category E: Precedence Hierarchy: Conditioning Yields Before Resistance
  // ==================================================
  describe('E. Precedence Hierarchy', () => {
    it('E.1. Under constrained state, conditioning is reduced before resistance volume is stripped', () => {
      const profile = createProfile({ goal: 'general_fitness' });
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        energyLevel: 2,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.volumeModifier, 'reduce');
      assert.ok(
        constraints.conditioningModifier === 'reduce' || constraints.conditioningModifier === 'omit'
      );
    });

    it('E.2. High interference sensitivity causes conditioning to be omitted entirely under constrained state', () => {
      // Hypertrophy trainee with low-priority conditioning has high interference sensitivity
      const profile = createProfile({ goal: 'build_muscle' });
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      if (prereqs.conditioning.demand !== 'none') {
        assert.equal(constraints.conditioningModifier, 'omit');
      }
    });
  });

  // ==================================================
  // Category F: Persistent Multi-Signal Convergence (Strongly Constrained)
  // ==================================================
  describe('F. Persistent Multi-Signal Convergence', () => {
    it('F.1. 3+ consecutive under-recovered sessions produces strongly_constrained with deload recommended', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 3,
        energyLevel: 2,
        sleepQuality: 2,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'strongly_constrained');
      assert.equal(constraints.volumeModifier, 'strongly_reduce');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.frequencyModifier, 'reduce');
      assert.equal(constraints.deloadDecision, 'recommend');
      if (prereqs.conditioning.demand !== 'none') {
        assert.equal(constraints.conditioningModifier, 'omit');
      }
    });

    it('F.2. Multiple severe signals (< 5h sleep + exhaustion rating 1) triggers strongly_constrained', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: 'under_5',
        energyLevel: 1,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'strongly_constrained');
      assert.equal(constraints.volumeModifier, 'strongly_reduce');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.frequencyModifier, 'reduce');
      assert.equal(constraints.deloadDecision, 'recommend');
    });

    it('F.3. 2 accumulated fatigue cycles triggers deload recommendation', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        accumulatedFatigueCycles: 2,
        workoutRecovery: 'often_fatigued',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'strongly_constrained');
      assert.equal(constraints.deloadDecision, 'recommend');
    });
  });

  // ==================================================
  // Category G: Recovery Release / Hysteresis
  // ==================================================
  describe('G. Recovery Release', () => {
    it('G.1. Normalized healthy signals immediately restore stable status', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      // Trainee checks in after recovery period with fully healthy markers
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '7_to_8',
        sleepQuality: 4,
        energyLevel: 4,
        stressLevel: 2,
        workoutRecovery: 'usually_recovered',
        sorenessLevel: 'none',
        consecutiveUnderRecoveredSessions: 0,
        recentDegradedSessionsCount: 0,
        accumulatedFatigueCycles: 0,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.conditioningModifier, 'maintain');
      assert.equal(constraints.frequencyModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });
  });

  // ==================================================
  // Category H: Progression Performance Signal Integration
  // ==================================================
  describe('H. Progression Performance Signal Integration', () => {
    it('H.1. Observed progression regression reinforces deload consideration with fatigue', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        workoutRecovery: 'often_fatigued',
        performanceRegressionObserved: true,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.deloadDecision, 'consider');
      assert.ok(constraints.decisionTrace.some((t) => t.includes('T7 performance regression')));
    });
  });

  // ==================================================
  // Category I: Determinism & Immutability
  // ==================================================
  describe('I. Determinism & Immutability', () => {
    it('I.1. Same input produces identical result', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        energyLevel: 2,
      };

      const res1 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );
      const res2 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.deepEqual(res1, res2);
    });

    it('I.2. Inputs are not mutated', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
      };

      const profileSnapshot = JSON.parse(JSON.stringify(profile));
      const prereqsSnapshot = JSON.parse(JSON.stringify(prereqs));
      const runtimeSnapshot = JSON.parse(JSON.stringify(runtimeState));

      resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.deepEqual(profile, profileSnapshot);
      assert.deepEqual(prereqs, prereqsSnapshot);
      assert.deepEqual(runtimeState, runtimeSnapshot);
    });
  });

  // ==================================================
  // Category J: Scope & Safety Guards
  // ==================================================
  describe('J. Scope & Safety Guards', () => {
    it('J.1. No numeric readiness or recovery scores produced', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        energyLevel: 2,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      const raw = constraints as Record<string, unknown>;
      assert.equal('recoveryScore' in raw, false);
      assert.equal('readinessScore' in raw, false);
      assert.equal('readiness' in raw, false);
      assert.equal('score' in raw, false);
    });

    it('J.2. No medical or clinical diagnoses in reasons or decision traces', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: 'under_5',
        energyLevel: 1,
        consecutiveUnderRecoveredSessions: 4,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      const allText = [...constraints.reasons, ...constraints.decisionTrace].join(' ').toLowerCase();
      assert.equal(allText.includes('overtraining syndrome'), false);
      assert.equal(allText.includes('clinical depression'), false);
      assert.equal(allText.includes('insomnia diagnosis'), false);
      assert.equal(allText.includes('injury diagnosis'), false);
      assert.equal(allText.includes('pathology'), false);
      assert.equal(allText.includes('disease'), false);
    });

    it('J.3. No workout sessions, sets, reps, or calendar days produced', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning
      );

      const raw = constraints as Record<string, unknown>;
      assert.equal('workouts' in raw, false);
      assert.equal('exercises' in raw, false);
      assert.equal('sets' in raw, false);
      assert.equal('reps' in raw, false);
      assert.equal('calendar' in raw, false);
    });
  });

  // ==================================================
  // Category K: Pipeline Integration & Population Guard
  // ==================================================
  describe('K. Pipeline Integration & Population Guard', () => {
    it('K.1. Adult reaches T9 recovery constraints through runStrategyPipeline', () => {
      const profile = createProfile({ age: 25 });
      const pipeline = runStrategyPipeline(profile);

      assert.equal(pipeline.status, 'completed');
      assert.equal(pipeline.path, 'adult_strategy');
      if (pipeline.status === 'completed') {
        assert.ok(pipeline.recoveryConstraints);
        assert.equal(pipeline.recoveryConstraints.level, 'stable');
        assert.equal(pipeline.recoveryConstraints.volumeModifier, 'maintain');
        assert.equal(pipeline.recoveryConstraints.deloadDecision, 'none');
        assert.ok(pipeline.decisionTrace.some((t) => t.includes('T9 Recovery Constraints')));
      }
    });

    it('K.2. Adult with runtimeState receives modified recovery constraints via pipeline', () => {
      const profile = createProfile({ age: 30 });
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
      };
      const pipeline = runStrategyPipeline(profile, undefined, runtimeState);

      assert.equal(pipeline.status, 'completed');
      if (pipeline.status === 'completed') {
        assert.equal(pipeline.recoveryConstraints.level, 'constrained');
        assert.equal(pipeline.recoveryConstraints.volumeModifier, 'reduce');
      }
    });

    it('K.3. Youth profile (age 13-17) strictly stops at youth_strategy_pending with zero T9 constraints', () => {
      const profile = createProfile({ age: 16 });
      const pipeline = runStrategyPipeline(profile);

      assert.equal(pipeline.status, 'pending');
      assert.equal(pipeline.path, 'youth_strategy_pending');

      const raw = pipeline as Record<string, unknown>;
      assert.equal('recoveryConstraints' in raw, false);
      assert.ok(pipeline.decisionTrace.some((t) => t.includes('Adult T9 (Recovery Constraints) SKIPPED')));
    });

    it('K.4. Ineligible profile never reaches T9', () => {
      const profile = createProfile({ age: 11 });
      const pipeline = runStrategyPipeline(profile);

      assert.equal(pipeline.status, 'ineligible');
      const raw = pipeline as Record<string, unknown>;
      assert.equal('recoveryConstraints' in raw, false);
    });
  });

  // ==================================================
  // Category L: Hysteresis & Conservative Release Mechanics
  // ==================================================
  describe('L. Hysteresis & Conservative Release', () => {
    it('L.1. Constrained + healthy observation does not jump directly to stable; releases to mildly_constrained', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        previousConstraintLevel: 'constrained',
        sleepDuration: '7_to_8',
        sleepQuality: 5,
        energyLevel: 5,
        stressLevel: 1,
        workoutRecovery: 'fully_recovered',
        sorenessLevel: 'none',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      // Must release at most 1 tier: constrained -> mildly_constrained
      assert.equal(constraints.level, 'mildly_constrained');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.effortModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
      assert.ok(constraints.reasons.some((r) => r.includes('Conservative recovery release')));
      assert.ok(constraints.decisionTrace.some((t) => t.includes('Hysteresis engaged')));
    });

    it('L.2. Strongly constrained + healthy observation releases gradually to constrained', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        previousConstraintLevel: 'strongly_constrained',
        sleepDuration: '7_to_8',
        sleepQuality: 4,
        energyLevel: 4,
        stressLevel: 2,
        workoutRecovery: 'usually_recovered',
        sorenessLevel: 'none',
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      // Must release at most 1 tier: strongly_constrained -> constrained
      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.volumeModifier, 'reduce');
      assert.equal(constraints.effortModifier, 'easier');
      assert.equal(constraints.deloadDecision, 'none');
      assert.ok(constraints.decisionTrace.some((t) => t.includes('Hysteresis engaged')));
    });

    it('L.3. Consecutive healthy observations progressively release from strongly_constrained to stable', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      const healthyCheckIn = {
        sleepDuration: '7_to_8' as const,
        sleepQuality: 5 as const,
        energyLevel: 5 as const,
        stressLevel: 1 as const,
        workoutRecovery: 'fully_recovered' as const,
        sorenessLevel: 'none' as const,
      };

      // Observation 1: starting from strongly_constrained
      const res1 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        { ...healthyCheckIn, previousConstraintLevel: 'strongly_constrained' }
      );
      assert.equal(res1.level, 'constrained', 'Step 1 must release to constrained');

      // Observation 2: caller tracks previous level as constrained
      const res2 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        { ...healthyCheckIn, previousConstraintLevel: res1.level }
      );
      assert.equal(res2.level, 'mildly_constrained', 'Step 2 must release to mildly_constrained');

      // Observation 3: caller tracks previous level as mildly_constrained
      const res3 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        { ...healthyCheckIn, previousConstraintLevel: res2.level }
      );
      assert.equal(res3.level, 'stable', 'Step 3 must safely reach stable');
      assert.equal(res3.volumeModifier, 'maintain');
      assert.equal(res3.deloadDecision, 'none');
    });

    it('L.4. Repeated unhealthy/healthy alternation does not cause unstable flip-flopping', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      // Trainee was constrained. Alternates between healthy and unhealthy.
      // Session 1: Healthy check-in -> releases to mildly_constrained
      const res1 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        { previousConstraintLevel: 'constrained', sleepDuration: '7_to_8' }
      );
      assert.equal(res1.level, 'mildly_constrained');

      // Session 2: Unhealthy check-in (stress 4, sleep 5-6) -> immediate safety escalation back to constrained
      const res2 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        { previousConstraintLevel: res1.level, sleepDuration: '5_to_6', stressLevel: 4 }
      );
      assert.equal(res2.level, 'constrained');

      // Session 3: Healthy check-in -> releases to mildly_constrained (never swings wildly to stable)
      const res3 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        { previousConstraintLevel: res2.level, sleepDuration: '7_to_8' }
      );
      assert.equal(res3.level, 'mildly_constrained');
    });

    it('L.5. Immediate safety escalation when risk rises (stable -> strongly_constrained directly)', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      // Previous was stable, but trainee suddenly experiences multi-signal severe deficit
      const runtimeState: RecoveryRuntimeState = {
        previousConstraintLevel: 'stable',
        sleepDuration: 'under_5',
        energyLevel: 1,
        consecutiveUnderRecoveredSessions: 3,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      // Safety rule: immediate escalation, no clamping when risk rises
      assert.equal(constraints.level, 'strongly_constrained');
      assert.equal(constraints.volumeModifier, 'strongly_reduce');
      assert.equal(constraints.deloadDecision, 'recommend');
      assert.ok(constraints.decisionTrace.some((t) => t.includes('Immediate safety escalation')));
    });
  });

  // ==================================================
  // Category M: History Ownership & Statelessness
  // ==================================================
  describe('M. History Ownership & Statelessness', () => {
    it('M.1. Repeated calls with identical inputs produce identical outputs (pure referential transparency)', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const state: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
        consecutiveUnderRecoveredSessions: 2,
      };

      const run1 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        state
      );
      const run2 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        state
      );
      const run3 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        state
      );

      assert.deepEqual(run1, run2);
      assert.deepEqual(run2, run3);
    });

    it('M.2. Interleaved evaluations retain zero internal state between calls', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      const severeState: RecoveryRuntimeState = {
        sleepDuration: 'under_5',
        energyLevel: 1,
        consecutiveUnderRecoveredSessions: 3,
      };

      const healthyState: RecoveryRuntimeState = {
        sleepDuration: '7_to_8',
        sleepQuality: 5,
        energyLevel: 5,
      };

      // Call severe, then healthy, then severe again
      const severeRun1 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        severeState
      );
      const healthyRun = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        healthyState
      );
      const severeRun2 = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        severeState
      );

      assert.equal(severeRun1.level, 'strongly_constrained');
      assert.equal(healthyRun.level, 'stable');
      assert.deepEqual(severeRun1, severeRun2, 'Severe evaluation must not be altered by intervening healthy call');
    });
  });

  // ==================================================
  // Category N: Evidence Classification & Terminology
  // ==================================================
  describe('N. Evidence Classification & Terminology', () => {
    it('N.1. Two simultaneous negative signals in current observation map to converging_current_signals with deload none', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
        consecutiveUnderRecoveredSessions: 0,
        recentDegradedSessionsCount: 0,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.volumeModifier, 'reduce');
      assert.equal(constraints.effortModifier, 'easier');
      // Converging acute observation does not trigger deload
      assert.equal(constraints.deloadDecision, 'none');
      assert.ok(constraints.decisionTrace.some((t) => t.includes('CONVERGING_CURRENT_SIGNALS')));
    });

    it('N.2. Repeated negative history across observations maps to repeated_history_evidence with deload consider', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 2,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'constrained');
      assert.equal(constraints.deloadDecision, 'consider');
      assert.ok(constraints.decisionTrace.some((t) => t.includes('REPEATED_HISTORY_EVIDENCE')));
    });

    it('N.3. Persistent multi-signal history maps to persistent_multi_signal_history with deload recommend', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);
      const runtimeState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'strongly_constrained');
      assert.equal(constraints.deloadDecision, 'recommend');
      assert.ok(constraints.decisionTrace.some((t) => t.includes('PERSISTENT_MULTI_SIGNAL_HISTORY')));
    });

    it('N.4. Explicit distinction between single acute event and repeated history', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      // Single acute event: 1 night of < 5h sleep
      const singleEventState: RecoveryRuntimeState = {
        sleepDuration: 'under_5',
        consecutiveUnderRecoveredSessions: 0,
      };
      const singleRes = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        singleEventState
      );
      assert.equal(singleRes.level, 'mildly_constrained');
      assert.equal(singleRes.volumeModifier, 'maintain');
      assert.equal(singleRes.deloadDecision, 'none');

      // Repeated history: 2 consecutive under-recovered sessions
      const repeatedHistoryState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 2,
      };
      const repeatedRes = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        repeatedHistoryState
      );
      assert.equal(repeatedRes.level, 'constrained');
      assert.equal(repeatedRes.volumeModifier, 'reduce');
      assert.equal(repeatedRes.deloadDecision, 'consider');
    });
  });

  // ==================================================
  // Category O: Onboarding <-> Runtime Enum Boundary
  // ==================================================
  describe('O. Onboarding <-> Runtime Enum Boundary', () => {
    it('O.1. All 5 canonical onboarding sleep durations map deterministically to valid runtime states', async () => {
      const { mapOnboardingRecoveryToRuntimeState } = await import('../recoveryConstraints');
      const baseRecovery = createProfile().recoveryLifestyle;

      const sleepDurations = ['under_5', '5_to_6', '6_to_7', '7_to_8', '8_plus'] as const;
      for (const sleep of sleepDurations) {
        const mapped = mapOnboardingRecoveryToRuntimeState({
          ...baseRecovery,
          sleepDuration: sleep,
        });
        assert.equal(mapped.sleepDuration, sleep, `Sleep duration ${sleep} must map identically`);
      }
    });

    it('O.2. All 5 canonical onboarding workout recovery values map deterministically (not_sure maps to neutral)', async () => {
      const { mapOnboardingRecoveryToRuntimeState } = await import('../recoveryConstraints');
      const baseRecovery = createProfile().recoveryLifestyle;

      const definedRecoveries = [
        'fully_recovered',
        'mostly_recovered',
        'sometimes_fatigued',
        'often_fatigued',
      ] as const;
      for (const wr of definedRecoveries) {
        const mapped = mapOnboardingRecoveryToRuntimeState({
          ...baseRecovery,
          workoutRecovery: wr,
        });
        assert.equal(mapped.workoutRecovery, wr, `Workout recovery ${wr} must map identically`);
      }

      // 'not_sure' must map to undefined to remain neutral without penalizing user
      const mappedNotSure = mapOnboardingRecoveryToRuntimeState({
        ...baseRecovery,
        workoutRecovery: 'not_sure',
      });
      assert.equal(mappedNotSure.workoutRecovery, undefined, 'not_sure must map to undefined neutral');
    });

    it('O.3. Direct evaluation of mapped onboarding recovery state produces stable baseline', async () => {
      const { mapOnboardingRecoveryToRuntimeState } = await import('../recoveryConstraints');
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      const runtimeState = mapOnboardingRecoveryToRuntimeState(profile.recoveryLifestyle);
      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        runtimeState
      );

      assert.equal(constraints.level, 'stable');
      assert.equal(constraints.volumeModifier, 'maintain');
      assert.equal(constraints.deloadDecision, 'none');
    });
  });

  // ==================================================
  // Category P: Counter Validation & Boundary Handling
  // ==================================================
  describe('P. Counter Validation & Boundary Handling', () => {
    it('P.1. sanitizeCounter handles 0, minimum positive, normal positive, and maximum boundary', async () => {
      const { sanitizeCounter, MAX_SESSION_COUNTER, MAX_FATIGUE_CYCLES } = await import(
        '../recoveryConstraints'
      );

      assert.equal(sanitizeCounter(0), 0);
      assert.equal(sanitizeCounter(1), 1);
      assert.equal(sanitizeCounter(2), 2);
      assert.equal(sanitizeCounter(5), 5);
      assert.equal(sanitizeCounter(MAX_SESSION_COUNTER), MAX_SESSION_COUNTER);
      assert.equal(sanitizeCounter(MAX_FATIGUE_CYCLES, MAX_FATIGUE_CYCLES), MAX_FATIGUE_CYCLES);
    });

    it('P.2. Negative counter values are sanitized to 0', async () => {
      const { sanitizeCounter } = await import('../recoveryConstraints');

      assert.equal(sanitizeCounter(-1), 0);
      assert.equal(sanitizeCounter(-10), 0);
      assert.equal(sanitizeCounter(-999), 0);
    });

    it('P.3. Decimal counter values are floored to non-negative integers', async () => {
      const { sanitizeCounter } = await import('../recoveryConstraints');

      assert.equal(sanitizeCounter(2.5), 2);
      assert.equal(sanitizeCounter(3.9), 3);
      assert.equal(sanitizeCounter(0.8), 0);
    });

    it('P.4. Excessive values exceeding maximum bounds are clamped safely', async () => {
      const { sanitizeCounter, MAX_SESSION_COUNTER, MAX_FATIGUE_CYCLES } = await import(
        '../recoveryConstraints'
      );

      assert.equal(sanitizeCounter(999), MAX_SESSION_COUNTER);
      assert.equal(sanitizeCounter(500, MAX_FATIGUE_CYCLES), MAX_FATIGUE_CYCLES);
    });

    it('P.5. Invalid non-finite values are sanitized safely to 0', async () => {
      const { sanitizeCounter } = await import('../recoveryConstraints');

      assert.equal(sanitizeCounter(NaN), 0);
      assert.equal(sanitizeCounter(Infinity), 0);
      assert.equal(sanitizeCounter(-Infinity), 0);
      assert.equal(sanitizeCounter(undefined), 0);
      assert.equal(sanitizeCounter(null), 0);
      assert.equal(sanitizeCounter('3' as unknown as number), 0);
    });

    it('P.6. Evaluator safely handles corrupted or extreme counters in runtimeState', () => {
      const profile = createProfile();
      const prereqs = resolvePrerequisites(profile);

      // Trainee object has negative, decimal, or extreme counters
      const corruptedState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: -5 as unknown as number,
        recentDegradedSessionsCount: 2.7 as unknown as number,
        recentMissedSessionsCount: 9999 as unknown as number,
        accumulatedFatigueCycles: NaN as unknown as number,
      };

      const constraints = resolveRecoveryConstraints(
        profile,
        prereqs.objective,
        prereqs.structure,
        prereqs.trainingLoad,
        prereqs.trainingDemand,
        prereqs.progression,
        prereqs.conditioning,
        corruptedState
      );

      // Must execute cleanly without crashing and produce valid domain output
      assert.ok(constraints.level);
      assert.ok(constraints.volumeModifier);
      assert.ok(constraints.decisionTrace.length > 0);
    });
  });
});

