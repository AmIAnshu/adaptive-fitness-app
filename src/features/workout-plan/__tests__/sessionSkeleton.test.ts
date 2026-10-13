/**
 * Stage W2 — Session Skeleton & Exercise Assignment Test Suite
 *
 * Verifies the deterministic construction of workout session skeletons,
 * exercise assignment, ordering, redundancy protection, variety behavior,
 * and constraint preservation.
 *
 * TEST CATEGORIES (A to W):
 * A. Session count matches strategy
 * B. Sequence indexes are contiguous and 1-based
 * C. Split family is respected
 * D. Session structure is deterministic
 * E. Exercise IDs exist in the catalog
 * F. Excluded exercises never appear
 * G. Unavailable equipment never appears
 * H. Target demand is represented
 * I. Movement-pattern requirements are represented
 * J. Redundancy protection
 * K. Exercise ordering (primary -> secondary -> isolation/accessory)
 * L. Exercise preference behavior (favorites vs dislikes)
 * M. Substitution compatibility
 * N. repeat_key_exercises behavior
 * O. change_often behavior
 * P. Short-session behavior
 * Q. Conditioning placement
 * R. Recovery constraint preservation
 * S. Progression metadata preservation
 * T. Input immutability
 * U. Deterministic output
 * V. Youth never receives an adult workout plan
 * W. Ineligible never receives a workout plan
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { runStrategyPipeline } from '../../training-strategy';
import { SEED_EXERCISE_CATALOG } from '../../training-strategy/exerciseCatalog';
import {
  validateWorkoutPlan,
  buildWorkoutPlanSkeleton,
  handoffToWorkoutPlanGenerator,
} from '../index';
import type { WorkoutPlan } from '../types';

const CATALOG_ID_SET = new Set(SEED_EXERCISE_CATALOG.map((ex) => ex.id));

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

describe('Stage W2 — Session Skeleton & Exercise Assignment', () => {
  // Helper to obtain a valid reference WorkoutPlan built via W2
  function getSampleW2Plan(overrides: Partial<OnboardingData> = {}): {
    plan: WorkoutPlan;
    profile: ReturnType<typeof createProfile>;
  } {
    const profile = createProfile(overrides);
    const result = runStrategyPipeline(profile);
    assert.equal(result.status, 'completed');
    if (result.status !== 'completed') throw new Error('Expected completed adult pipeline');
    const plan = buildWorkoutPlanSkeleton(result.strategy, profile);
    return { plan, profile };
  }

  // ==================================================
  // Category A: Session Count Matches Strategy
  // ==================================================
  describe('A. Session count matches strategy', () => {
    it('A.1. 3-day frequency produces exactly 3 sessions', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 3, realisticMinimumDays: 3 });
      assert.equal(plan.sessions.length, 3);
      assert.equal(plan.structure.sessionsPerCycle, 3);
    });

    it('A.2. 4-day frequency produces exactly 4 sessions', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4, realisticMinimumDays: 4 });
      assert.equal(plan.sessions.length, 4);
      assert.equal(plan.structure.sessionsPerCycle, 4);
    });

    it('A.3. 5-day frequency produces exactly 5 sessions', () => {
      const { plan } = getSampleW2Plan({
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
      });
      assert.equal(plan.sessions.length, 5);
      assert.equal(plan.structure.sessionsPerCycle, 5);
    });
  });

  // ==================================================
  // Category B: Sequence Indexes are Contiguous and 1-based
  // ==================================================
  describe('B. Sequence indexes are contiguous and 1-based', () => {
    it('B.1. All sessions have contiguous 1-based sequence indexes', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((session, idx) => {
        assert.equal(session.sequenceIndex, idx + 1);
        assert.equal(session.sessionId, `session_${idx + 1}`);
      });
    });
  });

  // ==================================================
  // Category C: Split Family is Respected
  // ==================================================
  describe('C. Split family is respected', () => {
    it('C.1. Upper/lower split names sessions with user-friendly upper and lower designations', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4, realisticMinimumDays: 4 });
      assert.equal(plan.structure.splitFamily, 'upper_lower');
      assert.ok(plan.sessions[0].sessionName.includes('Upper Body'));
      assert.ok(plan.sessions[1].sessionName.includes('Lower Body'));
      assert.ok(plan.sessions[2].sessionName.includes('Upper Body'));
      assert.ok(plan.sessions[3].sessionName.includes('Lower Body'));
    });

    it('C.2. Full body split names sessions with user-friendly Full Body A/B', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 3, realisticMinimumDays: 3 });
      assert.equal(plan.structure.splitFamily, 'full_body');
      assert.equal(plan.sessions[0].sessionName, 'Full Body A');
      assert.equal(plan.sessions[1].sessionName, 'Full Body B');
      assert.equal(plan.sessions[2].sessionName, 'Full Body C');
    });

    it('C.3. Does not expose internal programming complexity jargon in session name', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((s) => {
        assert.equal(s.sessionName.toLowerCase().includes('foundational'), false);
        assert.equal(s.sessionName.toLowerCase().includes('standard'), false);
        assert.equal(s.sessionName.toLowerCase().includes('advanced'), false);
        assert.equal(s.sessionName.toLowerCase().includes('complexity'), false);
      });
    });
  });

  // ==================================================
  // Category D: Session Structure is Deterministic
  // ==================================================
  describe('D. Session structure is deterministic', () => {
    it('D.1. Repeated invocations produce identical session names, focus areas, and movement patterns', () => {
      const plan1 = getSampleW2Plan({ idealTrainingDays: 4 }).plan;
      const plan2 = getSampleW2Plan({ idealTrainingDays: 4 }).plan;

      assert.equal(plan1.sessions.length, plan2.sessions.length);
      plan1.sessions.forEach((s1, idx) => {
        const s2 = plan2.sessions[idx];
        assert.equal(s1.sessionId, s2.sessionId);
        assert.equal(s1.sessionName, s2.sessionName);
        assert.deepEqual(s1.focusAreas, s2.focusAreas);
        assert.deepEqual(s1.primaryMovementPatterns, s2.primaryMovementPatterns);
        assert.equal(s1.exercises.length, s2.exercises.length);
      });
    });
  });

  // ==================================================
  // Category E: Exercise IDs Exist in Catalog
  // ==================================================
  describe('E. Exercise IDs exist in the catalog', () => {
    it('E.1. Every prescribed exercise ID exists in SEED_EXERCISE_CATALOG', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          assert.ok(
            CATALOG_ID_SET.has(ex.exerciseId),
            `Exercise ${ex.exerciseId} must exist in seed catalog`
          );
        });
      });
    });
  });

  // ==================================================
  // Category F: Excluded Exercises Never Appear
  // ==================================================
  describe('F. Excluded exercises never appear', () => {
    it('F.1. Avoided exercises never appear in any session', () => {
      const { plan } = getSampleW2Plan({ avoid: ['deadlift', 'barbell_squat'] });
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          assert.notEqual(ex.exerciseId, 'deadlift');
          assert.notEqual(ex.exerciseId, 'barbell_squat');
          assert.ok(!ex.substitutionExerciseIds.includes('deadlift'));
          assert.ok(!ex.substitutionExerciseIds.includes('barbell_squat'));
        });
      });
    });
  });

  // ==================================================
  // Category G: Unavailable Equipment Never Appears
  // ==================================================
  describe('G. Unavailable equipment never appears', () => {
    it('G.1. Dumbbell-only custom environment never includes barbell exercises', () => {
      const { plan } = getSampleW2Plan({
        equipmentMode: 'custom',
        equipmentIds: ['dumbbells', 'bench'],
      });

      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          const def = SEED_EXERCISE_CATALOG.find((e) => e.id === ex.exerciseId);
          assert.ok(def, `Exercise ${ex.exerciseId} not found`);
          assert.equal(
            def.equipmentRequired.includes('barbell'),
            false,
            `Barbell exercise ${ex.exerciseId} assigned in dumbbell-only setup`
          );
          assert.equal(
            def.equipmentRequired.includes('cable_machine'),
            false,
            `Cable exercise ${ex.exerciseId} assigned in dumbbell-only setup`
          );
        });
      });
    });
  });

  // ==================================================
  // Category H: Target Demand is Represented
  // ==================================================
  describe('H. Target demand is represented', () => {
    it('H.1. Session exercises align with session focus areas', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((session) => {
        const sessionTargets = new Set(session.focusAreas);
        const hasAlignedExercise = session.exercises.some((ex) =>
          ex.targetMuscles.some((m) => sessionTargets.has(m))
        );
        assert.ok(hasAlignedExercise, `Session ${session.sessionId} has no exercises matching focus areas`);
      });
    });
  });

  // ==================================================
  // Category I: Movement-Pattern Requirements are Represented
  // ==================================================
  describe('I. Movement-pattern requirements are represented', () => {
    it('I.1. Upper body sessions cover push and pull patterns', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      const upperSession = plan.sessions[0];
      const patterns = new Set(upperSession.exercises.map((e) => e.movementPattern));
      assert.ok(
        patterns.has('horizontal_push') || patterns.has('vertical_push'),
        'Upper session must contain push pattern'
      );
      assert.ok(
        patterns.has('horizontal_pull') || patterns.has('vertical_pull'),
        'Upper session must contain pull pattern'
      );
    });
  });

  // ==================================================
  // Category J: Redundancy Protection
  // ==================================================
  describe('J. Redundancy protection', () => {
    it('J.1. No duplicate identical exercise IDs within the same session', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((session) => {
        const exerciseIds = session.exercises.map((e) => e.exerciseId);
        const uniqueIds = new Set(exerciseIds);
        assert.equal(exerciseIds.length, uniqueIds.size, `Session ${session.sessionId} contains duplicate exercises`);
      });
    });
  });

  // ==================================================
  // Category K: Exercise Ordering
  // ==================================================
  describe('K. Exercise ordering', () => {
    it('K.1. Primary compound exercises precede isolation/accessory exercises', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((session) => {
        let seenAccessoryOrIsolation = false;
        session.exercises.forEach((ex) => {
          if (ex.role === 'accessory' || ex.role === 'optional') {
            seenAccessoryOrIsolation = true;
          }
          if (ex.role === 'primary') {
            assert.equal(
              seenAccessoryOrIsolation,
              false,
              `Primary exercise ${ex.exerciseId} placed after accessory/isolation in ${session.sessionId}`
            );
          }
        });
      });
    });
  });

  // ==================================================
  // Category L: Exercise Preference Behavior
  // ==================================================
  describe('L. Exercise preference behavior', () => {
    it('L.1. Favorite exercise is successfully assigned when eligible and not excluded', () => {
      const { plan } = getSampleW2Plan({ favorites: ['bench_press'] });
      const allAssignedIds = plan.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
      assert.ok(
        allAssignedIds.includes('bench_press'),
        'Favorite bench_press should be assigned'
      );
    });

    it('L.2. Favorite CANNOT override hard avoid exclusion', () => {
      const { plan } = getSampleW2Plan({
        favorites: ['bench_press'],
        avoid: ['bench_press'],
      });
      const allAssignedIds = plan.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
      assert.equal(
        allAssignedIds.includes('bench_press'),
        false,
        'Avoided bench_press must NEVER be assigned even if favorite'
      );
    });
  });

  // ==================================================
  // Category M: Substitution Compatibility
  // ==================================================
  describe('M. Substitution compatibility', () => {
    it('M.1. Substitutions share movement pattern and exclude avoided exercises', () => {
      const { plan } = getSampleW2Plan({ avoid: ['deadlift'] });
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          ex.substitutionExerciseIds.forEach((subId) => {
            assert.notEqual(subId, ex.exerciseId);
            assert.notEqual(subId, 'deadlift');
            const subDef = SEED_EXERCISE_CATALOG.find((e) => e.id === subId);
            assert.ok(subDef, `Sub exercise ${subId} must exist`);
            assert.ok(
              subDef.movementPatterns.includes(ex.movementPattern),
              `Substitution ${subId} must share pattern ${ex.movementPattern}`
            );
          });
        });
      });
    });
  });

  // ==================================================
  // Category N: repeat_key_exercises Behavior
  // ==================================================
  describe('N. repeat_key_exercises behavior', () => {
    it('N.1. repeat_key_exercises creates stable recurring exercise assignments across sessions', () => {
      const { plan } = getSampleW2Plan({ exerciseVariety: 'repeat_key_exercises', idealTrainingDays: 4 });
      const upperSessions = [plan.sessions[0], plan.sessions[2]];
      // Both upper sessions should have bench press if available
      assert.ok(upperSessions[0].exercises.some((e) => e.exerciseId === 'bench_press'));
      assert.ok(upperSessions[1].exercises.some((e) => e.exerciseId === 'bench_press'));
    });
  });

  // ==================================================
  // Category O: change_often Behavior
  // ==================================================
  describe('O. change_often behavior', () => {
    it('O.1. change_often maintains valid movement coverage without violating exclusions', () => {
      const { plan } = getSampleW2Plan({ exerciseVariety: 'change_often', idealTrainingDays: 4 });
      assert.ok(plan.sessions.length === 4);
      const validation = validateWorkoutPlan(plan);
      assert.equal(validation.valid, true);
    });
  });

  // ==================================================
  // Category P: Short-Session Behavior
  // ==================================================
  describe('P. Short-session behavior', () => {
    it('P.1. 20–30m session duration produces compact exercise slots (3-4 exercises) and ~30m target', () => {
      const { plan } = getSampleW2Plan({ sessionDuration: '20_30', idealTrainingDays: 3 });
      plan.sessions.forEach((session) => {
        assert.equal(session.targetDurationMinutes, 30);
        assert.ok(
          session.exercises.length <= 4,
          `Short session should have <= 4 exercises, got ${session.exercises.length}`
        );
      });
    });

    it('P.2. 60–75m session duration budgets ~70m target duration', () => {
      const { plan } = getSampleW2Plan({ sessionDuration: '60_75', idealTrainingDays: 3 });
      plan.sessions.forEach((session) => {
        assert.equal(session.targetDurationMinutes, 70);
      });
    });
  });

  // ==================================================
  // Category Q: Conditioning Placement
  // ==================================================
  describe('Q. Conditioning placement', () => {
    it('Q.1. Integrated conditioning attaches to session when guidance is post_resistance', () => {
      const { plan } = getSampleW2Plan({ goal: 'general_fitness', idealTrainingDays: 3 });
      const hasConditioning = plan.sessions.some((s) => s.conditioning !== undefined);
      assert.ok(hasConditioning, 'General fitness should attach conditioning block');
      const sessionWithCond = plan.sessions.find((s) => s.conditioning !== undefined);
      assert.ok(sessionWithCond?.conditioning?.modalityFamily);
      assert.ok(sessionWithCond?.conditioning?.intensityGuidance);
    });

    it('Q.2. Conditioning omitted when recovery modifier is omit', () => {
      const profile = createProfile({ age: 35 });
      const runtimeState = {
        sleepDuration: 'under_5' as const,
        stressLevel: 5 as const,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = buildWorkoutPlanSkeleton(pipelineResult.strategy, profile);
      assert.equal(plan.recoveryContext.conditioningModifier, 'omit');
      plan.sessions.forEach((session) => {
        assert.equal(session.conditioning, undefined);
      });
    });
  });

  // ==================================================
  // Category R: Recovery Constraint Preservation
  // ==================================================
  describe('R. Recovery constraint preservation', () => {
    it('R.1. Easier effort modifier shifts target RIR conservatively in W2 skeleton', () => {
      const profile = createProfile({ age: 30 });
      const runtimeState = {
        workoutRecovery: 'often_fatigued' as const,
        energyLevel: 2 as const,
      };
      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = buildWorkoutPlanSkeleton(pipelineResult.strategy, profile);
      assert.equal(plan.recoveryContext.effortModifier, 'easier');
      const firstExercise = plan.sessions[0].exercises[0];
      assert.equal(
        firstExercise.effortPrescription.minRIR,
        pipelineResult.strategy.trainingLoad.effort.minRIR + 1
      );
      assert.ok(firstExercise.effortPrescription.effortGuidance.includes('Recovery-buffered'));
    });
  });

  // ==================================================
  // Category S: Progression Metadata Preservation
  // ==================================================
  describe('S. Progression metadata preservation', () => {
    it('S.1. Assigned exercises receive valid progressionMethod from T7 strategy', () => {
      const { plan } = getSampleW2Plan({ idealTrainingDays: 4 });
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          assert.ok(ex.progressionMethod, 'Exercise must have progressionMethod');
          assert.ok(
            [
              'double_progression',
              'load_progression',
              'performance_progression',
              'conservative_progression',
            ].includes(ex.progressionMethod)
          );
        });
      });
    });
  });

  // ==================================================
  // Category T: Input Immutability
  // ==================================================
  describe('T. Input immutability', () => {
    it('T.1. buildWorkoutPlanSkeleton does not mutate incoming TrainingStrategy or profile', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const strategyBefore = JSON.stringify(pipelineResult.strategy);
      const profileBefore = JSON.stringify(profile);

      buildWorkoutPlanSkeleton(pipelineResult.strategy, profile);

      assert.equal(JSON.stringify(pipelineResult.strategy), strategyBefore);
      assert.equal(JSON.stringify(profile), profileBefore);
    });
  });

  // ==================================================
  // Category U: Deterministic Output
  // ==================================================
  describe('U. Deterministic output', () => {
    it('U.1. Identical inputs produce identical WorkoutPlan skeletons (excluding timestamp)', () => {
      const plan1 = getSampleW2Plan().plan;
      const plan2 = getSampleW2Plan().plan;

      const normalize = (p: WorkoutPlan) => ({
        ...p,
        generationMetadata: { ...p.generationMetadata, generatedAtTimestamp: 0 },
      });

      assert.deepEqual(normalize(plan1), normalize(plan2));
    });
  });

  // ==================================================
  // Category V: Youth Population Protection
  // ==================================================
  describe('V. Youth never receives an adult workout plan', () => {
    it('V.1. Youth trainee halts safely at pending and receives zero workout plan', () => {
      const youthProfile = createProfile({ age: 15 });
      const pipelineResult = runStrategyPipeline(youthProfile);
      assert.equal(pipelineResult.status, 'pending');

      const handoff = handoffToWorkoutPlanGenerator(pipelineResult);
      assert.equal(handoff.status, 'pending');
      assert.equal('plan' in handoff, false);
    });
  });

  // ==================================================
  // Category W: Ineligible Population Protection
  // ==================================================
  describe('W. Ineligible never receives a workout plan', () => {
    it('W.1. Trainee aged 11 is blocked at boundary and receives zero workout plan', () => {
      const underAgeProfile = createProfile({ age: 11 });
      const pipelineResult = runStrategyPipeline(underAgeProfile);
      assert.equal(pipelineResult.status, 'ineligible');

      const handoff = handoffToWorkoutPlanGenerator(pipelineResult);
      assert.equal(handoff.status, 'ineligible');
      assert.equal('plan' in handoff, false);
    });
  });
});
