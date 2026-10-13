/**
 * Workout Plan Generator Contracts & Boundary Test Suite (Stage W1)
 *
 * Verifies the foundational data contracts, schema validation, and generator boundary
 * for converting TrainingStrategy (v1) into WorkoutPlan (v1).
 *
 * TEST CATEGORIES:
 * A. WorkoutPlan Schema & Version Validation
 * B. Required-Field Validation
 * C. Session Validation
 * D. Exercise Prescription Validation
 * E. Set Prescription Validation
 * F. Immutability & Input Non-Mutation
 * G. Deterministic Validation Behavior
 * H. Upstream TrainingStrategy Handoff Integration
 * I. Youth Population Boundary Protection
 * J. Ineligible Population Boundary Protection
 * K. Qualitative Recovery Constraint Handoff (T9 Modifier Preservation)
 * L. Architectural Guardrails (No loads, weekdays, calories, or readiness scores)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { runStrategyPipeline } from '../../training-strategy';
import {
  validateWorkoutPlan,
  createInitialWorkoutPlanFromStrategy,
  handoffToWorkoutPlanGenerator,
} from '../index';
import type {
  WorkoutPlan,
  WorkoutSession,
  ExercisePrescription,
  SetPrescription,
} from '../types';

function createProfile(overrides: Partial<OnboardingData> = {}) {
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

describe('Stage W1 — Workout Plan Contract & Generator Boundary', () => {
  // Helper to obtain a valid reference WorkoutPlan (v1)
  function getValidSamplePlan(): WorkoutPlan {
    const profile = createProfile();
    const result = runStrategyPipeline(profile);
    assert.equal(result.status, 'completed');
    if (result.status !== 'completed') throw new Error('Expected completed adult pipeline');
    return createInitialWorkoutPlanFromStrategy(result.strategy);
  }

  // ==================================================
  // Category A: WorkoutPlan Schema & Version Validation
  // ==================================================
  describe('A. WorkoutPlan Schema & Version Validation', () => {
    it('A.1. Valid WorkoutPlan passes validation with zero errors', () => {
      const plan = getValidSamplePlan();
      const validation = validateWorkoutPlan(plan);

      assert.equal(validation.valid, true);
      assert.equal(validation.errors.length, 0);
    });

    it('A.2. Rejects invalid schemaVersion', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, schemaVersion: 2 };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'schemaVersion'));
    });

    it('A.3. Rejects non-adult population', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, population: 'youth' };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'population'));
    });

    it('A.4. Rejects invalid sourceStrategyVersion', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, sourceStrategyVersion: 99 };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'sourceStrategyVersion'));
    });
  });

  // ==================================================
  // Category B: Required-Field Validation
  // ==================================================
  describe('B. Required-Field Validation', () => {
    it('B.1. Rejects null or non-object plan', () => {
      const vNull = validateWorkoutPlan(null);
      assert.equal(vNull.valid, false);
      assert.ok(vNull.errors.length > 0);

      const vStr = validateWorkoutPlan('invalid_plan');
      assert.equal(vStr.valid, false);
    });

    it('B.2. Rejects missing objective context', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, objective: undefined };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'objective'));
    });

    it('B.3. Rejects missing structure context', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, structure: undefined };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'structure'));
    });

    it('B.4. Rejects missing recovery context', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, recoveryContext: undefined };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'recoveryContext'));
    });

    it('B.5. Rejects missing generation metadata or invalid generator version', () => {
      const plan = getValidSamplePlan();
      const corrupted = {
        ...plan,
        generationMetadata: {
          ...plan.generationMetadata,
          generatorVersion: '2.0.0' as any,
        },
      };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'generationMetadata.generatorVersion'));
    });

    it('B.6. Rejects empty decisionTrace', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, decisionTrace: [] };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'decisionTrace'));
    });
  });

  // ==================================================
  // Category C: Session Validation
  // ==================================================
  describe('C. Session Validation', () => {
    it('C.1. Rejects plan with empty sessions array', () => {
      const plan = getValidSamplePlan();
      const corrupted = { ...plan, sessions: [] };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field === 'sessions'));
    });

    it('C.2. Rejects session with missing sessionId or invalid sequenceIndex', () => {
      const plan = getValidSamplePlan();
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          sessionId: '',
          sequenceIndex: 0,
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('sessionId')));
      assert.ok(validation.errors.some((e) => e.field.includes('sequenceIndex')));
    });

    it('C.3. Rejects session with non-positive targetDurationMinutes', () => {
      const plan = getValidSamplePlan();
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          targetDurationMinutes: -10,
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('targetDurationMinutes')));
    });
  });

  // ==================================================
  // Category D: Exercise Prescription Validation
  // ==================================================
  describe('D. Exercise Prescription Validation', () => {
    it('D.1. Rejects session with zero exercise prescriptions', () => {
      const plan = getValidSamplePlan();
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          exercises: [],
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('exercises')));
    });

    it('D.2. Rejects exercise prescription with missing ID, name, or role', () => {
      const plan = getValidSamplePlan();
      const corruptedEx: ExercisePrescription = {
        ...plan.sessions[0].exercises[0],
        exerciseId: '',
        exerciseName: '',
        role: 'invalid_role' as any,
      };
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          exercises: [corruptedEx],
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('exerciseId')));
      assert.ok(validation.errors.some((e) => e.field.includes('exerciseName')));
      assert.ok(validation.errors.some((e) => e.field.includes('role')));
    });

    it('D.3. Rejects exercise prescription with missing repetition prescription', () => {
      const plan = getValidSamplePlan();
      const corruptedEx: ExercisePrescription = {
        ...plan.sessions[0].exercises[0],
        repetitionPrescription: { label: '' },
      };
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          exercises: [corruptedEx],
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('repetitionPrescription')));
    });

    it('D.4. Rejects exercise prescription with invalid effort RIR boundaries (minRIR > maxRIR)', () => {
      const plan = getValidSamplePlan();
      const corruptedEx: ExercisePrescription = {
        ...plan.sessions[0].exercises[0],
        effortPrescription: {
          minRIR: 4,
          maxRIR: 2,
          targetRIR: 3,
          effortGuidance: 'Invalid bounds',
        },
      };
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          exercises: [corruptedEx],
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('effortPrescription')));
    });
  });

  // ==================================================
  // Category E: Set Prescription Validation
  // ==================================================
  describe('E. Set Prescription Validation', () => {
    it('E.1. Rejects exercise with empty sets array', () => {
      const plan = getValidSamplePlan();
      const corruptedEx: ExercisePrescription = {
        ...plan.sessions[0].exercises[0],
        sets: [],
      };
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          exercises: [corruptedEx],
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('sets')));
    });

    it('E.2. Rejects set with non-positive setIndex or invalid setType', () => {
      const plan = getValidSamplePlan();
      const corruptedSet: SetPrescription = {
        setIndex: 0,
        setType: 'super_set' as any,
      };
      const corruptedEx: ExercisePrescription = {
        ...plan.sessions[0].exercises[0],
        sets: [corruptedSet],
      };
      const corruptedSessions: WorkoutSession[] = [
        {
          ...plan.sessions[0],
          exercises: [corruptedEx],
        },
      ];
      const corrupted = { ...plan, sessions: corruptedSessions };
      const validation = validateWorkoutPlan(corrupted);

      assert.equal(validation.valid, false);
      assert.ok(validation.errors.some((e) => e.field.includes('setIndex')));
      assert.ok(validation.errors.some((e) => e.field.includes('setType')));
    });
  });

  // ==================================================
  // Category F: Immutability & Input Non-Mutation
  // ==================================================
  describe('F. Immutability & Input Non-Mutation', () => {
    it('F.1. createInitialWorkoutPlanFromStrategy does not mutate incoming TrainingStrategy', () => {
      const profile = createProfile();
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;

      const snapshot = JSON.parse(JSON.stringify(result.strategy));

      createInitialWorkoutPlanFromStrategy(result.strategy);

      assert.deepEqual(result.strategy, snapshot);
    });

    it('F.2. validateWorkoutPlan does not mutate candidate plan', () => {
      const plan = getValidSamplePlan();
      const snapshot = JSON.parse(JSON.stringify(plan));

      validateWorkoutPlan(plan);

      assert.deepEqual(plan, snapshot);
    });
  });

  // ==================================================
  // Category G: Deterministic Validation Behavior
  // ==================================================
  describe('G. Deterministic Validation Behavior', () => {
    it('G.1. Validating identical plans produces identical validation results', () => {
      const plan1 = getValidSamplePlan();
      const plan2 = getValidSamplePlan();

      const v1 = validateWorkoutPlan(plan1);
      const v2 = validateWorkoutPlan(plan2);

      assert.deepEqual(v1, v2);
    });
  });

  // ==================================================
  // Category H: Upstream Strategy Handoff Integration
  // ==================================================
  describe('H. Upstream Strategy Handoff Integration', () => {
    it('H.1. Valid adult TrainingStrategy directly produces valid WorkoutPlan', () => {
      const profile = createProfile({ goal: 'hypertrophy', trainingHistory: '2_to_3_years' });
      const pipelineResult = runStrategyPipeline(profile);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = createInitialWorkoutPlanFromStrategy(pipelineResult.strategy);
      const validation = validateWorkoutPlan(plan);

      assert.equal(validation.valid, true);
      assert.equal(plan.population, 'adult');
      assert.equal(plan.schemaVersion, 1);
      assert.equal(plan.sourceStrategyVersion, 1);
      assert.equal(plan.objective.primary, 'hypertrophy');
      assert.equal(plan.structure.sessionsPerCycle, pipelineResult.strategy.structure.sessionsPerCycle);
      assert.equal(plan.sessions.length, pipelineResult.strategy.trainingDemand.sessions.length);
      assert.ok(plan.decisionTrace.some((t) => t.includes('W1 Generator Handoff')));
    });

    it('H.2. handoffToWorkoutPlanGenerator returns ready status with valid plan for adult', () => {
      const profile = createProfile({ age: 30 });
      const pipelineResult = runStrategyPipeline(profile);

      const handoff = handoffToWorkoutPlanGenerator(pipelineResult);

      assert.equal(handoff.status, 'ready');
      if (handoff.status === 'ready') {
        assert.equal(handoff.population, 'adult');
        assert.ok(handoff.plan);
        const validation = validateWorkoutPlan(handoff.plan);
        assert.equal(validation.valid, true);
      }
    });
  });

  // ==================================================
  // Category I: Youth Population Boundary Protection
  // ==================================================
  describe('I. Youth Population Boundary Protection', () => {
    it('I.1. Youth trainee (ages 13-17) strictly stops at pending and receives zero adult WorkoutPlan', () => {
      const youthAges = [13, 14, 15, 16, 17];
      for (const age of youthAges) {
        const profile = createProfile({ age });
        const pipelineResult = runStrategyPipeline(profile);

        assert.equal(pipelineResult.status, 'pending');
        assert.equal(pipelineResult.path, 'youth_strategy_pending');

        const handoff = handoffToWorkoutPlanGenerator(pipelineResult);

        assert.equal(handoff.status, 'pending');
        if (handoff.status === 'pending') {
          assert.equal(handoff.population, 'youth');
          assert.equal(handoff.path, 'youth_strategy_pending');
          const raw = handoff as Record<string, unknown>;
          assert.equal('plan' in raw, false, `Youth age ${age} must never have a plan property`);
          assert.ok(handoff.decisionTrace.some((t) => t.includes('Youth trainee halted safely')));
        }
      }
    });
  });

  // ==================================================
  // Category J: Ineligible Population Boundary Protection
  // ==================================================
  describe('J. Ineligible Population Boundary Protection', () => {
    it('J.1. Ineligible trainee (<13 or >100) strictly blocked and receives zero WorkoutPlan', () => {
      const ineligibleAges = [10, 12, 102];
      for (const age of ineligibleAges) {
        const profile = createProfile({ age });
        const pipelineResult = runStrategyPipeline(profile);

        assert.equal(pipelineResult.status, 'ineligible');

        const handoff = handoffToWorkoutPlanGenerator(pipelineResult);

        assert.equal(handoff.status, 'ineligible');
        const raw = handoff as Record<string, unknown>;
        assert.equal('plan' in raw, false, `Ineligible age ${age} must never have a plan property`);
        assert.ok(handoff.decisionTrace.some((t) => t.includes('Ineligible trainee blocked')));
      }
    });
  });

  // ==================================================
  // Category K: Qualitative Recovery Constraint Handoff
  // ==================================================
  describe('K. Qualitative Recovery Constraint Handoff', () => {
    it('K.1. Stable recovery context preserves maintain modifiers and standard RIR', () => {
      const profile = createProfile({ age: 25 });
      const pipelineResult = runStrategyPipeline(profile);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = createInitialWorkoutPlanFromStrategy(pipelineResult.strategy);

      assert.equal(plan.recoveryContext.level, 'stable');
      assert.equal(plan.recoveryContext.volumeModifier, 'maintain');
      assert.equal(plan.recoveryContext.effortModifier, 'maintain');
      assert.equal(plan.recoveryContext.deloadDecision, 'none');

      // Exercises reflect baseline RIR from T4
      const firstExercise = plan.sessions[0].exercises[0];
      assert.equal(firstExercise.effortPrescription.minRIR, pipelineResult.strategy.trainingLoad.effort.minRIR);
      assert.equal(firstExercise.effortPrescription.maxRIR, pipelineResult.strategy.trainingLoad.effort.maxRIR);
    });

    it('K.2. Constrained recovery with easier effort modifier shifts target RIR conservatively', () => {
      const profile = createProfile({ age: 30 });
      const runtimeState = {
        sleepDuration: '5_to_6' as const,
        stressLevel: 4 as const,
      };
      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = createInitialWorkoutPlanFromStrategy(pipelineResult.strategy);

      assert.equal(plan.recoveryContext.level, 'constrained');
      assert.equal(plan.recoveryContext.effortModifier, 'easier');

      // Conservative shift away from failure (+1 RIR buffer)
      const firstExercise = plan.sessions[0].exercises[0];
      assert.equal(
        firstExercise.effortPrescription.minRIR,
        pipelineResult.strategy.trainingLoad.effort.minRIR + 1
      );
      assert.equal(
        firstExercise.effortPrescription.maxRIR,
        pipelineResult.strategy.trainingLoad.effort.maxRIR + 1
      );
      assert.ok(firstExercise.effortPrescription.effortGuidance.includes('Recovery-buffered'));
    });

    it('K.3. Strongly constrained recovery with deload recommendation produces validation warning', () => {
      const profile = createProfile({ age: 32 });
      const runtimeState = {
        sleepDuration: 'under_5' as const,
        stressLevel: 5 as const,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = createInitialWorkoutPlanFromStrategy(pipelineResult.strategy);
      const validation = validateWorkoutPlan(plan);

      assert.equal(validation.valid, true);
      assert.equal(plan.recoveryContext.level, 'strongly_constrained');
      assert.equal(plan.recoveryContext.deloadDecision, 'recommend');
      assert.ok(validation.warnings.some((w) => w.includes('recommended deload')));
    });
  });

  // ==================================================
  // Category L: Architectural Guardrails
  // ==================================================
  describe('L. Architectural Guardrails', () => {
    it('L.1. WorkoutPlan contains NO load weights in kg/lbs', () => {
      const plan = getValidSamplePlan();
      const raw = plan as Record<string, unknown>;

      assert.equal('loadKg' in raw, false);
      assert.equal('weightPrescriptions' in raw, false);
      assert.equal('workingWeight' in raw, false);

      const firstExerciseRaw = plan.sessions[0].exercises[0] as Record<string, unknown>;
      assert.equal('load' in firstExerciseRaw, false);
      assert.equal('weight' in firstExerciseRaw, false);
    });

    it('L.2. WorkoutPlan contains NO calendar weekday assignments', () => {
      const plan = getValidSamplePlan();
      const raw = plan as Record<string, unknown>;

      assert.equal('calendar' in raw, false);
      assert.equal('weekdays' in raw, false);
      assert.equal('dayAssignments' in raw, false);

      const firstSessionRaw = plan.sessions[0] as Record<string, unknown>;
      assert.equal('assignedWeekday' in firstSessionRaw, false);
      assert.equal('scheduledDate' in firstSessionRaw, false);
    });

    it('L.3. WorkoutPlan contains NO calories, macros, or nutrition prescriptions', () => {
      const plan = getValidSamplePlan();
      const raw = plan as Record<string, unknown>;

      assert.equal('calories' in raw, false);
      assert.equal('macros' in raw, false);
      assert.equal('protein' in raw, false);
      assert.equal('mealPlan' in raw, false);
    });

    it('L.4. WorkoutPlan contains NO numeric readiness or recovery score', () => {
      const plan = getValidSamplePlan();
      const raw = plan as Record<string, unknown>;

      assert.equal('recoveryScore' in raw, false);
      assert.equal('readinessScore' in raw, false);
      assert.equal('readinessPercent' in raw, false);
    });
  });
});
