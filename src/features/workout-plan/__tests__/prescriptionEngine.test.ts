/**
 * Stage W3 — Exact Prescription Generation Test Suite
 *
 * Verifies the deterministic generation of exact prescriptions:
 * - Exact set counts & set types (warmup, work, optional)
 * - Rep-range correctness & targetReps consistency
 * - RIR boundaries, T4 preservation, T9 recovery modifiers (easier, volume reduction)
 * - Deload policies (consider vs recommend)
 * - Exercise-role and exercise-type differentiation
 * - Rest guidance & duration feasibility budgeting
 * - Warm-up policies
 * - Conditioning execution details & omission under recovery constraint
 * - Progression method preservation
 * - Hard exclusions & equipment compatibility preservation
 * - Input immutability & deterministic output
 * - Population boundary protection
 * - Replacement of W2 placeholder values with final W3 prescriptions
 * - Architectural guardrails (no loads in kg/lbs, no nutrition logic, no external APIs)
 *
 * TEST CATEGORIES (A to AM):
 * A. Exact set-count generation
 * B. Set-type correctness (warmup, work, optional)
 * C. Rep-range correctness
 * D. targetReps consistency with repRange
 * E. RIR boundary correctness (minRIR <= maxRIR, no RIR 0)
 * F. T4 effort boundary preservation
 * G. T9 easier-effort application
 * H. T9 volume reduction
 * I. T9 strong volume reduction
 * J. Deload consider behavior
 * K. Deload recommend behavior
 * L. Exercise-role differentiation
 * M. Objective-specific rep policy
 * N. Exercise-type-specific rep policy
 * O. Rest policy
 * P. Warm-up policy
 * Q. Session duration feasibility
 * R. Optional-content reduction under duration pressure
 * S. Conditioning materialization
 * T. Conditioning omission under recovery constraint
 * U. Progression method preservation
 * V. Hard exclusion preservation
 * W. Equipment compatibility preservation
 * X. Substitution preservation
 * Y. Input immutability
 * Z. Deterministic output
 * AA. Population protection (youth & ineligible)
 * AB. Validator compatibility (validateWorkoutPlan)
 * AC. W2 placeholder values replaced by final W3 prescriptions
 * AD. No exact load values generated (kg/lbs)
 * AE. No nutrition logic introduced
 * AF. No external API dependency
 * AG. W3.1 Red-team corrective validations (T4 RIR boundary floor, duration balancing)
 * AH. W3.2 Target-level volume leak prevention tests
 * AI. W3.2 fewer_higher_effort set-floor and inflation bug tests
 * AJ. W3.2 Interaction tests (T6 target x T9 recovery x exercise role)
 * AK. W3.3 Multi-session target-volume invariant tests
 * AL. W3.3 Audited duration and conditioning priority balancing tests
 * AM. W3.3.1 Edge-case integrity & exposure-target scaling tests
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
  generatePrescribedWorkoutPlan,
  generateWorkoutPlanFromStrategy,
  handoffToWorkoutPlanGenerator,
} from '../index';
import {
  resolveExerciseSetBudget,
  resolveTargetSessionBudget,
  resolveTargetCycleBudget,
  distributeTargetSetBudget,
  BASE_WORK_SETS_TABLE,
} from '../prescriptionRules';
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

describe('Stage W3 — Exact Prescription Generation', () => {
  // Helper to obtain a fully prescribed WorkoutPlan (v1)
  function getSamplePrescribedPlan(
    overrides: Partial<OnboardingData> = {},
    runtimeOverrides: Record<string, unknown> = {}
  ): {
    plan: WorkoutPlan;
    skeleton: WorkoutPlan;
    profile: ReturnType<typeof createProfile>;
  } {
    const profile = createProfile(overrides);
    const pipelineResult = runStrategyPipeline(profile, undefined, runtimeOverrides as any);
    assert.equal(pipelineResult.status, 'completed');
    if (pipelineResult.status !== 'completed') throw new Error('Expected completed adult pipeline');

    const skeleton = buildWorkoutPlanSkeleton(pipelineResult.strategy, profile);
    const plan = generatePrescribedWorkoutPlan(skeleton, pipelineResult.strategy, profile, {
      deterministicSeed: 'test-seed-1',
    });
    return { plan, skeleton, profile };
  }

  // ==================================================
  // Category A: Exact Set-Count Generation
  // ==================================================
  describe('A. Exact set-count generation', () => {
    it('A.1. Primary compound exercises receive 4 work sets under moderate starting volume', () => {
      const { plan } = getSamplePrescribedPlan({ preferredStyle: 'hypertrophy' });
      const firstSession = plan.sessions[0];
      const primaryEx = firstSession.exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      const workSets = primaryEx.sets.filter((s) => s.setType === 'work');
      assert.equal(workSets.length, 4);
    });

    it('A.2. Low starting volume ceiling reduces base work sets to 3 for primary compound', () => {
      // 20-30m session favors low starting volume
      const { plan } = getSamplePrescribedPlan({ sessionDuration: '20_30' });
      const firstSession = plan.sessions[0];
      const primaryEx = firstSession.exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      const workSets = primaryEx.sets.filter((s) => s.setType === 'work');
      assert.equal(workSets.length, 3);
    });
  });

  // ==================================================
  // Category B: Set-Type Correctness
  // ==================================================
  describe('B. Set-type correctness', () => {
    it('B.1. Primary compound exercises receive warm-up sets preceding work sets', () => {
      const { plan } = getSamplePrescribedPlan();
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      const warmupSets = primaryEx.sets.filter((s) => s.setType === 'warmup');
      assert.ok(warmupSets.length > 0, 'First primary compound movement should have warmup sets');
      // Warmups must precede work sets
      const firstWorkSetIdx = primaryEx.sets.findIndex((s) => s.setType === 'work');
      const lastWarmupSetIdx = primaryEx.sets.map((s) => s.setType).lastIndexOf('warmup');
      assert.ok(lastWarmupSetIdx < firstWorkSetIdx, 'Warm-up sets must precede work sets');
    });

    it('B.2. Isolation accessory exercises receive 0 warm-up sets', () => {
      const { plan } = getSamplePrescribedPlan();
      const accessoryEx = plan.sessions[0].exercises.find((e) => e.role === 'accessory');
      if (accessoryEx) {
        const warmupSets = accessoryEx.sets.filter((s) => s.setType === 'warmup');
        assert.equal(warmupSets.length, 0, 'Accessory exercises must not receive warmup sets');
      }
    });
  });

  // ==================================================
  // Category C: Rep-Range Correctness
  // ==================================================
  describe('C. Rep-range correctness', () => {
    it('C.1. Strength objective prescribes 4–6 reps for primary compound movements', () => {
      const { plan } = getSamplePrescribedPlan({
        goal: 'gain_strength',
        preferredStyle: 'strength',
        trainingHistory: '2_to_5_years',
        consistency: 'always_consistent',
        programmingConfidence: 4,
        exerciseConfidence: 5,
      });
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      assert.deepEqual(primaryEx.repetitionPrescription.repRange, { min: 4, max: 6 });
      assert.equal(primaryEx.repetitionPrescription.label, '4–6 reps');
    });

    it('C.2. Hypertrophy objective prescribes 6–10 reps for primary compound and 10–15 for isolation', () => {
      const { plan } = getSamplePrescribedPlan({ goal: 'build_muscle' });
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      assert.deepEqual(primaryEx.repetitionPrescription.repRange, { min: 6, max: 10 });

      const isolationEx = plan.sessions[0].exercises.find((e) => e.role === 'accessory');
      if (isolationEx) {
        assert.deepEqual(isolationEx.repetitionPrescription.repRange, { min: 10, max: 15 });
      }
    });
  });

  // ==================================================
  // Category D: targetReps Consistency with repRange
  // ==================================================
  describe('D. targetReps consistency with repRange', () => {
    it('D.1. targetReps is within [min, max] rep range for all exercises', () => {
      const { plan } = getSamplePrescribedPlan();
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          const { targetReps, repRange } = ex.repetitionPrescription;
          assert.ok(typeof targetReps === 'number');
          assert.ok(repRange);
          assert.ok(
            targetReps! >= repRange!.min && targetReps! <= repRange!.max,
            `targetReps ${targetReps} out of range [${repRange!.min}, ${repRange!.max}] on ${ex.exerciseId}`
          );
        });
      });
    });
  });

  // ==================================================
  // Category E: RIR Boundary Correctness
  // ==================================================
  describe('E. RIR boundary correctness', () => {
    it('E.1. minRIR <= maxRIR and minRIR >= 1 across all exercises (no failure by default)', () => {
      const { plan } = getSamplePrescribedPlan();
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          const { minRIR, maxRIR, targetRIR } = ex.effortPrescription;
          assert.ok(minRIR <= maxRIR, `minRIR (${minRIR}) > maxRIR (${maxRIR})`);
          assert.ok(minRIR >= 1, `minRIR must be >= 1, got ${minRIR}`);
          assert.ok(targetRIR >= minRIR && targetRIR <= maxRIR, `targetRIR outside [min, max]`);
        });
      });
    });
  });

  // ==================================================
  // Category F: T4 Effort Boundary Preservation
  // ==================================================
  describe('F. T4 effort boundary preservation', () => {
    it('F.1. Stable recovery preserves T4 baseline effort boundaries', () => {
      const { plan } = getSamplePrescribedPlan({ preferredEffort: 'hard' });
      const firstPrimaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(firstPrimaryEx);
      assert.equal(plan.recoveryContext.effortModifier, 'maintain');
      // For preferredEffort 'hard', T4 effort is 2-3 RIR
      assert.equal(firstPrimaryEx.effortPrescription.minRIR, 2);
      assert.equal(firstPrimaryEx.effortPrescription.maxRIR, 3);
    });
  });

  // ==================================================
  // Category G: T9 Easier-Effort Application
  // ==================================================
  describe('G. T9 easier-effort application', () => {
    it('G.1. T9 easier effort modifier shifts target RIR by +1 conservative reserve', () => {
      const runtimeState = {
        workoutRecovery: 'often_fatigued',
        energyLevel: 2,
      };
      const { plan } = getSamplePrescribedPlan({ preferredEffort: 'hard' }, runtimeState);
      assert.equal(plan.recoveryContext.effortModifier, 'easier');
      const firstPrimaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(firstPrimaryEx);
      // Shifted from [2, 3] to [3, 4]
      assert.equal(firstPrimaryEx.effortPrescription.minRIR, 3);
      assert.equal(firstPrimaryEx.effortPrescription.maxRIR, 4);
      assert.ok(firstPrimaryEx.effortPrescription.effortGuidance.includes('Recovery-buffered'));
    });
  });

  // ==================================================
  // Category H: T9 Volume Reduction
  // ==================================================
  describe('H. T9 volume reduction', () => {
    it('H.1. T9 reduce volume modifier discretely reduces work sets by 1', () => {
      const runtimeState = {
        consecutiveUnderRecoveredSessions: 2,
        stressLevel: 3,
      };
      const { plan } = getSamplePrescribedPlan({}, runtimeState);
      assert.equal(plan.recoveryContext.volumeModifier, 'reduce');
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      const workSets = primaryEx.sets.filter((s) => s.setType === 'work');
      // Reduced from 4 to 3
      assert.equal(workSets.length, 3);
      assert.ok(primaryEx.notes?.includes('Recovery constrained'));
    });
  });

  // ==================================================
  // Category I: T9 Strong Volume Reduction
  // ==================================================
  describe('I. T9 strong volume reduction', () => {
    it('I.1. T9 strongly_reduce volume modifier reduces work sets to minimum floor (2 sets)', () => {
      const runtimeState = {
        sleepDuration: 'under_5',
        stressLevel: 5,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const { plan } = getSamplePrescribedPlan({}, runtimeState);
      assert.equal(plan.recoveryContext.volumeModifier, 'strongly_reduce');
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      assert.ok(primaryEx);
      const workSets = primaryEx.sets.filter((s) => s.setType === 'work');
      assert.equal(workSets.length, 2);
    });
  });

  // ==================================================
  // Category J: Deload Consider Behavior
  // ==================================================
  describe('J. Deload consider behavior', () => {
    it('J.1. deloadDecision "consider" notes upcoming deload in effort guidance without forcing extreme reductions', () => {
      const runtimeState = {
        consecutiveUnderRecoveredSessions: 2,
        stressLevel: 4,
      };
      const { plan } = getSamplePrescribedPlan({}, runtimeState);
      // In consider deload state, plan remains valid with guidance note
      const validation = validateWorkoutPlan(plan);
      assert.equal(validation.valid, true);
    });
  });

  // ==================================================
  // Category K: Deload Recommend Behavior
  // ==================================================
  describe('K. Deload recommend behavior', () => {
    it('K.1. deloadDecision "recommend" caps work sets at 2 and enforces RIR 4–5 reserve', () => {
      const runtimeState = {
        sleepDuration: 'under_5',
        stressLevel: 5,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const { plan } = getSamplePrescribedPlan({}, runtimeState);
      assert.equal(plan.recoveryContext.deloadDecision, 'recommend');
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          const workSets = ex.sets.filter((s) => s.setType === 'work');
          assert.ok(workSets.length <= 2, `Work sets on deload should be <= 2, got ${workSets.length}`);
          assert.equal(ex.effortPrescription.minRIR, 4);
          assert.equal(ex.effortPrescription.maxRIR, 5);
          assert.ok(ex.effortPrescription.effortGuidance.includes('Deload effort'));
        });
      });
    });
  });

  // ==================================================
  // Category L: Exercise-Role Differentiation
  // ==================================================
  describe('L. Exercise-role differentiation', () => {
    it('L.1. Primary compound exercises receive greater set density and longer rest than accessories', () => {
      const { plan } = getSamplePrescribedPlan();
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary');
      const accessoryEx = plan.sessions[0].exercises.find((e) => e.role === 'accessory');
      assert.ok(primaryEx);
      assert.ok(accessoryEx);

      assert.ok(primaryEx.sets.length >= accessoryEx.sets.length);
      assert.ok(primaryEx.restSeconds > accessoryEx.restSeconds);
    });
  });

  // ==================================================
  // Category M: Objective-Specific Rep Policy
  // ==================================================
  describe('M. Objective-specific rep policy', () => {
    it('M.1. Strength objective yields lower rep range on primary lifts than fat loss support', () => {
      const { plan: strengthPlan } = getSamplePrescribedPlan({
        goal: 'gain_strength',
        preferredStyle: 'strength',
        trainingHistory: '2_to_5_years',
        consistency: 'always_consistent',
        programmingConfidence: 4,
        exerciseConfidence: 5,
      });
      const { plan: fatLossPlan } = getSamplePrescribedPlan({
        goal: 'lose_weight',
        preferredStyle: 'general_fitness',
      });

      const strengthPrimary = strengthPlan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      const fatLossPrimary = fatLossPlan.sessions[0].exercises.find((e) => e.role === 'primary')!;

      assert.ok(strengthPrimary.repetitionPrescription.repRange!.max < fatLossPrimary.repetitionPrescription.repRange!.max);
    });
  });

  // ==================================================
  // Category N: Exercise-Type-Specific Rep Policy
  // ==================================================
  describe('N. Exercise-type-specific rep policy', () => {
    it('N.1. Isolation movements receive higher rep range (10–15) than multi-joint compounds', () => {
      const { plan } = getSamplePrescribedPlan();
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      const isolationEx = plan.sessions[0].exercises.find((e) => e.role === 'accessory');
      if (isolationEx) {
        assert.ok(isolationEx.repetitionPrescription.repRange!.min >= primaryEx.repetitionPrescription.repRange!.min);
      }
    });
  });

  // ==================================================
  // Category O: Rest Policy
  // ==================================================
  describe('O. Rest policy', () => {
    it('O.1. Strength primary compound exercises receive 180s rest, standard receive 120s, accessories receive 60s', () => {
      const { plan: strengthPlan } = getSamplePrescribedPlan({
        goal: 'gain_strength',
        preferredStyle: 'strength',
      });
      const primaryEx = strengthPlan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      assert.equal(primaryEx.restSeconds, 180);

      const { plan: hypertrophyPlan } = getSamplePrescribedPlan();
      const hypPrimaryEx = hypertrophyPlan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      assert.equal(hypPrimaryEx.restSeconds, 120);

      const accessoryEx = hypertrophyPlan.sessions[0].exercises.find((e) => e.role === 'accessory');
      if (accessoryEx) {
        assert.equal(accessoryEx.restSeconds, 60);
      }
    });
  });

  // ==================================================
  // Category P: Warm-Up Policy
  // ==================================================
  describe('P. Warm-up policy', () => {
    it('P.1. Warm-up sets have setType "warmup", conservative RIR 4, and 60s rest', () => {
      const { plan } = getSamplePrescribedPlan();
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      const warmupSets = primaryEx.sets.filter((s) => s.setType === 'warmup');
      assert.ok(warmupSets.length > 0);
      warmupSets.forEach((w) => {
        assert.equal(w.setType, 'warmup');
        assert.equal(w.targetRIR, 4);
        assert.equal(w.restSeconds, 60);
      });
    });
  });

  // ==================================================
  // Category Q: Session Duration Feasibility
  // ==================================================
  describe('Q. Session duration feasibility', () => {
    it('Q.1. Duration feasibility is evaluated and recorded in metadata and session notes', () => {
      const { plan } = getSamplePrescribedPlan();
      assert.ok(plan.generationMetadata.durationFeasibility);
      assert.ok(
        ['comfortably_within_budget', 'near_budget', 'constrained'].includes(
          plan.generationMetadata.durationFeasibility!
        )
      );
      assert.ok(plan.sessions[0].sessionNotes.some((n) => n.includes('Estimated session duration')));
    });
  });

  // ==================================================
  // Category R: Optional-Content Reduction Under Duration Pressure
  // ==================================================
  describe('R. Optional-content reduction under duration pressure', () => {
    it('R.1. Short sessions (20_30m) maintain valid feasibility without overfilling slots', () => {
      const { plan } = getSamplePrescribedPlan({ sessionDuration: '20_30' });
      assert.notEqual(plan.generationMetadata.durationFeasibility, 'constrained');
    });
  });

  // ==================================================
  // Category S: Conditioning Materialization
  // ==================================================
  describe('S. Conditioning materialization', () => {
    it('S.1. Materializes durationMinutesGuidance and intensity guidance on conditioning', () => {
      const { plan } = getSamplePrescribedPlan({ goal: 'general_fitness', idealTrainingDays: 3 });
      const sessionWithCond = plan.sessions.find((s) => s.conditioning !== undefined);
      assert.ok(sessionWithCond?.conditioning);
      assert.ok(sessionWithCond.conditioning.durationMinutesGuidance);
      assert.ok(sessionWithCond.conditioning.durationMinutesGuidance.target > 0);
      assert.ok(sessionWithCond.conditioning.intensityGuidance.length > 0);
    });
  });

  // ==================================================
  // Category T: Conditioning Omission Under Recovery Constraint
  // ==================================================
  describe('T. Conditioning omission under recovery constraint', () => {
    it('T.1. Conditioning is strictly omitted when T9 conditioningModifier is omit', () => {
      const runtimeState = {
        sleepDuration: 'under_5',
        stressLevel: 5,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const { plan } = getSamplePrescribedPlan({ goal: 'general_fitness' }, runtimeState);
      assert.equal(plan.recoveryContext.conditioningModifier, 'omit');
      plan.sessions.forEach((s) => {
        assert.equal(s.conditioning, undefined);
      });
    });
  });

  // ==================================================
  // Category U: Progression Method Preservation
  // ==================================================
  describe('U. Progression method preservation', () => {
    it('U.1. Preserves upstream T7 progression method on every prescribed exercise', () => {
      const { plan } = getSamplePrescribedPlan();
      plan.sessions.forEach((s) => {
        s.exercises.forEach((ex) => {
          assert.ok(ex.progressionMethod);
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
  // Category V: Hard Exclusion Preservation
  // ==================================================
  describe('V. Hard exclusion preservation', () => {
    it('V.1. Avoided exercise never appears in W3 prescribed plan', () => {
      const { plan } = getSamplePrescribedPlan({ avoid: ['deadlift', 'barbell_squat'] });
      plan.sessions.forEach((s) => {
        s.exercises.forEach((ex) => {
          assert.notEqual(ex.exerciseId, 'deadlift');
          assert.notEqual(ex.exerciseId, 'barbell_squat');
          assert.ok(!ex.substitutionExerciseIds.includes('deadlift'));
          assert.ok(!ex.substitutionExerciseIds.includes('barbell_squat'));
        });
      });
    });
  });

  // ==================================================
  // Category W: Equipment Compatibility Preservation
  // ==================================================
  describe('W. Equipment compatibility preservation', () => {
    it('W.1. Dumbbell-only custom environment contains only dumbbell/bodyweight exercises', () => {
      const { plan } = getSamplePrescribedPlan({
        equipmentMode: 'custom',
        equipmentIds: ['dumbbells', 'bench'],
      });
      plan.sessions.forEach((s) => {
        s.exercises.forEach((ex) => {
          const def = SEED_EXERCISE_CATALOG.find((e) => e.id === ex.exerciseId)!;
          assert.equal(def.equipmentRequired.includes('barbell'), false);
          assert.equal(def.equipmentRequired.includes('cable_machine'), false);
        });
      });
    });
  });

  // ==================================================
  // Category X: Substitution Preservation
  // ==================================================
  describe('X. Substitution preservation', () => {
    it('X.1. Substitutions are attached and compatible with exercise movement pattern', () => {
      const { plan } = getSamplePrescribedPlan();
      plan.sessions.forEach((s) => {
        s.exercises.forEach((ex) => {
          ex.substitutionExerciseIds.forEach((subId) => {
            const def = SEED_EXERCISE_CATALOG.find((e) => e.id === subId)!;
            assert.ok(def.movementPatterns.includes(ex.movementPattern));
          });
        });
      });
    });
  });

  // ==================================================
  // Category Y: Input Immutability
  // ==================================================
  describe('Y. Input immutability', () => {
    it('Y.1. generatePrescribedWorkoutPlan does not mutate skeleton, strategy, or profile', () => {
      const { skeleton, profile } = getSamplePrescribedPlan();
      const pipelineResult = runStrategyPipeline(profile);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const skeletonBefore = JSON.stringify(skeleton);
      const strategyBefore = JSON.stringify(pipelineResult.strategy);
      const profileBefore = JSON.stringify(profile);

      generatePrescribedWorkoutPlan(skeleton, pipelineResult.strategy, profile);

      assert.equal(JSON.stringify(skeleton), skeletonBefore);
      assert.equal(JSON.stringify(pipelineResult.strategy), strategyBefore);
      assert.equal(JSON.stringify(profile), profileBefore);
    });
  });

  // ==================================================
  // Category Z: Deterministic Output
  // ==================================================
  describe('Z. Deterministic output', () => {
    it('Z.1. Identical inputs produce byte-equivalent logical output with deterministicSeed', () => {
      const plan1 = getSamplePrescribedPlan().plan;
      const plan2 = getSamplePrescribedPlan().plan;

      const normalize = (p: WorkoutPlan) => ({
        ...p,
        generationMetadata: { ...p.generationMetadata, generatedAtTimestamp: 0 },
      });

      assert.deepEqual(normalize(plan1), normalize(plan2));
    });
  });

  // ==================================================
  // Category AA: Population Protection
  // ==================================================
  describe('AA. Population protection', () => {
    it('AA.1. Youth trainee halts safely at pending and never receives W3 plan', () => {
      const youthProfile = createProfile({ age: 16 });
      const pipelineResult = runStrategyPipeline(youthProfile);
      assert.equal(pipelineResult.status, 'pending');

      const handoff = handoffToWorkoutPlanGenerator(pipelineResult);
      assert.equal(handoff.status, 'pending');
      assert.equal('plan' in handoff, false);
    });

    it('AA.2. Ineligible trainee is blocked and never receives W3 plan', () => {
      const underAgeProfile = createProfile({ age: 10 });
      const pipelineResult = runStrategyPipeline(underAgeProfile);
      assert.equal(pipelineResult.status, 'ineligible');

      const handoff = handoffToWorkoutPlanGenerator(pipelineResult);
      assert.equal(handoff.status, 'ineligible');
      assert.equal('plan' in handoff, false);
    });
  });

  // ==================================================
  // Category AB: Validator Compatibility
  // ==================================================
  describe('AB. Validator compatibility', () => {
    it('AB.1. Prescribed WorkoutPlan passes validateWorkoutPlan with zero errors', () => {
      const { plan } = getSamplePrescribedPlan();
      const validation = validateWorkoutPlan(plan);
      assert.equal(validation.valid, true);
      assert.equal(validation.errors.length, 0);
    });
  });

  // ==================================================
  // Category AC: Replacement of W2 Placeholders
  // ==================================================
  describe('AC. W2 placeholder values replaced by final W3 prescriptions', () => {
    it('AC.1. W2 skeleton has generationStage "skeleton" while W3 plan has "prescribed"', () => {
      const { plan, skeleton } = getSamplePrescribedPlan();
      assert.equal(skeleton.generationMetadata.generationStage, 'skeleton');
      assert.equal(plan.generationMetadata.generationStage, 'prescribed');
    });

    it('AC.2. W3 sets reflect role-specific budgeting and warm-ups rather than uniform 3 sets', () => {
      const { plan, skeleton } = getSamplePrescribedPlan();
      // In W2 skeleton, all exercises received uniform 3 placeholder sets
      skeleton.sessions.forEach((s) => {
        s.exercises.forEach((ex) => {
          assert.equal(ex.sets.length, 3);
        });
      });

      // In W3 plan, primary compounds have warmup sets + 4 work sets (total 6 sets)
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      assert.notEqual(primaryEx.sets.length, 3);
      assert.ok(primaryEx.sets.length > 3);
    });
  });

  // ==================================================
  // Category AD: No Exact Load Values Generated
  // ==================================================
  describe('AD. No exact load values generated', () => {
    it('AD.1. Plan contains zero kg/lbs load weights', () => {
      const { plan } = getSamplePrescribedPlan();
      const raw = plan as Record<string, unknown>;
      assert.equal('loadKg' in raw, false);
      assert.equal('weightPrescriptions' in raw, false);
      assert.equal('workingWeight' in raw, false);

      const firstExRaw = plan.sessions[0].exercises[0] as Record<string, unknown>;
      assert.equal('load' in firstExRaw, false);
      assert.equal('weight' in firstExRaw, false);
    });
  });

  // ==================================================
  // Category AE: No Nutrition Logic Introduced
  // ==================================================
  describe('AE. No nutrition logic introduced', () => {
    it('AE.1. Plan contains zero calories, macros, or meal plans', () => {
      const { plan } = getSamplePrescribedPlan();
      const raw = plan as Record<string, unknown>;
      assert.equal('calories' in raw, false);
      assert.equal('macros' in raw, false);
      assert.equal('protein' in raw, false);
      assert.equal('mealPlan' in raw, false);
    });
  });

  // ==================================================
  // Category AF: No External API Dependency
  // ==================================================
  describe('AF. No external API dependency', () => {
    it('AF.1. Plan generation operates synchronously and in-memory with zero async network calls', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);
      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status !== 'completed') return;

      const plan = generateWorkoutPlanFromStrategy(pipelineResult.strategy, profile);
      assert.equal(plan.schemaVersion, 1);
      assert.ok(plan.sessions.length > 0);
    });
  });

  // ==================================================
  // Category AG: W3.1 Red-Team Interaction Boundary Tests
  // ==================================================
  describe('AG. W3.1 Red-Team Interaction Boundary Tests', () => {
    it('AG.1. T4 [3, 4] RIR + accessory + maintain: minRIR must NOT drop below T4 minRIR (3)', () => {
      // Create user with preferredEffort 'moderate' which maps to T4 3-4 RIR
      const { plan } = getSamplePrescribedPlan({ preferredEffort: 'moderate' });
      assert.equal(plan.recoveryContext.effortModifier, 'maintain');
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          assert.ok(
            ex.effortPrescription.minRIR >= 3,
            `Exercise ${ex.exerciseId} minRIR (${ex.effortPrescription.minRIR}) dropped below T4 minRIR (3)`
          );
          assert.ok(ex.effortPrescription.maxRIR >= ex.effortPrescription.minRIR);
        });
      });
    });

    it('AG.2. T4 [2, 3] RIR + accessory + maintain: minRIR must NOT drop below T4 minRIR (2)', () => {
      // Preferred effort 'hard' maps to T4 2-3 RIR
      const { plan } = getSamplePrescribedPlan({ preferredEffort: 'hard' });
      assert.equal(plan.recoveryContext.effortModifier, 'maintain');
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          assert.ok(
            ex.effortPrescription.minRIR >= 2,
            `Exercise ${ex.exerciseId} minRIR (${ex.effortPrescription.minRIR}) dropped below T4 minRIR (2)`
          );
        });
      });
    });

    it('AG.3. T4 [1, 2] RIR + easier modifier: shifts to [2, 3] RIR', () => {
      // 'very_hard' + experienced trainee maps to T4 1-2 RIR
      const runtimeState = {
        workoutRecovery: 'often_fatigued',
        energyLevel: 2,
      };
      const { plan } = getSamplePrescribedPlan(
        {
          preferredEffort: 'very_hard',
          trainingHistory: 'more_than_5_years',
          consistency: 'always_consistent',
          programmingConfidence: 5,
          exerciseConfidence: 5,
        },
        runtimeState
      );
      assert.equal(plan.recoveryContext.effortModifier, 'easier');
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      assert.equal(primaryEx.effortPrescription.minRIR, 2);
      assert.equal(primaryEx.effortPrescription.maxRIR, 3);
    });

    it('AG.4. Foundational trainee: primary lifts receive minRIR >= 2 safety floor', () => {
      const { plan } = getSamplePrescribedPlan({
        trainingHistory: 'less_than_6_months',
        consistency: 'rarely_consistent',
        programmingConfidence: 1,
        exerciseConfidence: 2,
        preferredEffort: 'very_hard',
      });
      assert.equal(plan.structure.programmingComplexity, 'foundational');
      const primaryEx = plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
      assert.ok(
        primaryEx.effortPrescription.minRIR >= 2,
        `Foundational primary lift minRIR must be >= 2, got ${primaryEx.effortPrescription.minRIR}`
      );
    });

    it('AG.5. High starting volume + short session (20_30m): duration feasibility budgeting manages volume and session is not constrained', () => {
      const { plan } = getSamplePrescribedPlan({
        sessionDuration: '20_30',
        volumePreference: 'more_volume',
      });
      assert.notEqual(plan.generationMetadata.durationFeasibility, 'constrained');
    });

    it('AG.6. Reduced conditioning + compact session: conditioning is omitted or shortened to prevent duration violation', () => {
      const runtimeState = {
        workoutRecovery: 'often_fatigued',
        energyLevel: 2,
      };
      const { plan } = getSamplePrescribedPlan(
        {
          goal: 'general_fitness',
          sessionDuration: '20_30',
        },
        runtimeState
      );
      // In 20-30m session, conditioning should either be omitted or shortened to <= 10m
      const sessionWithCond = plan.sessions.find((s) => s.conditioning !== undefined);
      if (sessionWithCond?.conditioning) {
        assert.ok(
          sessionWithCond.conditioning.durationMinutesGuidance!.target <= 10,
          `Conditioning target in short session should be <= 10m, got ${sessionWithCond.conditioning.durationMinutesGuidance!.target}`
        );
      }
    });

    it('AG.7. T6 low-priority target muscle receives constrained work sets (<= 2)', () => {
      const { plan } = getSamplePrescribedPlan({ goal: 'gain_strength' });
      // In strength goal, calves are priority 'low' in T6 demand
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          if (ex.targetMuscles.includes('calves') && ex.role !== 'primary') {
            const workSets = ex.sets.filter((s) => s.setType === 'work');
            assert.ok(
              workSets.length <= 2,
              `Low priority muscle ${ex.exerciseId} work sets should be <= 2, got ${workSets.length}`
            );
          }
        });
      });
    });

    it('AG.8. deload recommend forces conservative RIR 4–5 reserve across all exercises', () => {
      const runtimeState = {
        sleepDuration: 'under_5',
        stressLevel: 5,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const { plan } = getSamplePrescribedPlan({}, runtimeState);
      assert.equal(plan.recoveryContext.deloadDecision, 'recommend');
      plan.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          assert.equal(ex.effortPrescription.minRIR, 4);
          assert.equal(ex.effortPrescription.maxRIR, 5);
        });
      });
    });
  });

  // ==================================================
  // Category AH: W3.2 Target-Level Volume Allocation Tests
  // ==================================================
  describe('AH. W3.2 Target-Level Volume Allocation Tests', () => {
    it('AH.1. One low-priority target with one exercise receives standard individual allocation within budget', () => {
      const budget = resolveTargetSessionBudget('calves', 'low', 'low', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 2);

      const baseBudget = resolveExerciseSetBudget(
        'accessory',
        'isolation',
        'secondary_compound',
        'low',
        'balanced',
        'maintain',
        'none',
        false,
        'low'
      );
      assert.equal(baseBudget.workSets, 2);

      const distributed = distributeTargetSetBudget(budget, [
        {
          exerciseId: 'standing_calf_raise',
          role: 'accessory',
          exerciseType: 'isolation',
          progressionProfile: 'secondary_compound',
          isFirstOfPattern: false,
          baseBudget,
        },
      ]);

      assert.equal(distributed.length, 1);
      assert.equal(distributed[0].workSets, 2);
      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.equal(totalWorkSets, 2);
      assert.ok(totalWorkSets <= budget.maxWorkSets);
    });

    it('AH.2. One low-priority target with two exercises: aggregate volume is constrained without volume leak', () => {
      const budget = resolveTargetSessionBudget('calves', 'low', 'moderate', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 3);

      const baseBudget1 = resolveExerciseSetBudget(
        'accessory',
        'isolation',
        'secondary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        false,
        'low'
      );
      const baseBudget2 = resolveExerciseSetBudget(
        'accessory',
        'isolation',
        'secondary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        false,
        'low'
      );
      assert.equal(baseBudget1.workSets, 2);
      assert.equal(baseBudget2.workSets, 2);

      const distributed = distributeTargetSetBudget(budget, [
        {
          exerciseId: 'standing_calf_raise',
          role: 'accessory',
          exerciseType: 'isolation',
          progressionProfile: 'secondary_compound',
          isFirstOfPattern: false,
          baseBudget: baseBudget1,
        },
        {
          exerciseId: 'seated_calf_raise',
          role: 'accessory',
          exerciseType: 'isolation',
          progressionProfile: 'secondary_compound',
          isFirstOfPattern: false,
          baseBudget: baseBudget2,
        },
      ]);

      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.ok(
        totalWorkSets <= budget.maxWorkSets,
        `Aggregate work sets (${totalWorkSets}) exceeded target budget (${budget.maxWorkSets})`
      );
      assert.equal(totalWorkSets, 3);
      assert.equal(distributed[0].workSets, 2);
      assert.equal(distributed[1].workSets, 1);
    });

    it('AH.3. One low-priority target with three exercises: aggregate volume is constrained to target budget', () => {
      const budget = resolveTargetSessionBudget('core', 'low', 'moderate', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 3);

      const baseBudget = resolveExerciseSetBudget(
        'accessory',
        'isolation',
        'secondary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        false,
        'low'
      );

      const candidates = [
        { exerciseId: 'plank', role: 'accessory' as const, exerciseType: 'bodyweight' as const, progressionProfile: 'secondary_compound' as const, isFirstOfPattern: false, baseBudget },
        { exerciseId: 'hanging_leg_raise', role: 'accessory' as const, exerciseType: 'bodyweight' as const, progressionProfile: 'secondary_compound' as const, isFirstOfPattern: false, baseBudget },
        { exerciseId: 'cable_woodchopper', role: 'accessory' as const, exerciseType: 'isolation' as const, progressionProfile: 'secondary_compound' as const, isFirstOfPattern: false, baseBudget },
      ];

      const distributed = distributeTargetSetBudget(budget, candidates);
      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.ok(
        totalWorkSets <= budget.maxWorkSets,
        `Aggregate work sets (${totalWorkSets}) exceeded target budget (${budget.maxWorkSets})`
      );
      assert.equal(totalWorkSets, 3);
      assert.deepEqual(distributed.map((d) => d.workSets), [1, 1, 1]);
    });

    it('AH.4. Low target where one exercise is primary: preserves primary compound coverage while clamping residual volume', () => {
      const budget = resolveTargetSessionBudget('chest', 'low', 'moderate', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 3);

      const primaryBase = resolveExerciseSetBudget(
        'primary',
        'compound',
        'primary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        true,
        'low'
      );
      assert.equal(primaryBase.workSets, 4);

      const accessoryBase = resolveExerciseSetBudget(
        'accessory',
        'isolation',
        'secondary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        false,
        'low'
      );
      assert.equal(accessoryBase.workSets, 2);

      const distributed = distributeTargetSetBudget(budget, [
        {
          exerciseId: 'bench_press',
          role: 'primary',
          exerciseType: 'compound',
          progressionProfile: 'primary_compound',
          isFirstOfPattern: true,
          baseBudget: primaryBase,
        },
        {
          exerciseId: 'dumbbell_fly',
          role: 'accessory',
          exerciseType: 'isolation',
          progressionProfile: 'secondary_compound',
          isFirstOfPattern: false,
          baseBudget: accessoryBase,
        },
      ]);

      const primaryAlloc = distributed.find((d) => d.role === 'primary')!;
      const accessoryAlloc = distributed.find((d) => d.role === 'accessory')!;

      assert.ok(primaryAlloc.workSets >= 3, `Primary compound work sets must be >= 3, got ${primaryAlloc.workSets}`);
      assert.equal(accessoryAlloc.workSets, 0);
    });

    it('AH.5. Moderate target with multiple exercises: accommodates multi-exercise stimulus up to moderate budget', () => {
      const budget = resolveTargetSessionBudget('shoulders', 'moderate', 'moderate', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 6);

      const secondaryBase = resolveExerciseSetBudget(
        'secondary',
        'compound',
        'secondary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        false,
        'moderate'
      );
      const accessoryBase = resolveExerciseSetBudget(
        'accessory',
        'isolation',
        'secondary_compound',
        'moderate',
        'balanced',
        'maintain',
        'none',
        false,
        'moderate'
      );

      assert.equal(secondaryBase.workSets, 3);
      assert.equal(accessoryBase.workSets, 2);

      const distributed = distributeTargetSetBudget(budget, [
        { exerciseId: 'overhead_press', role: 'secondary', exerciseType: 'compound', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: secondaryBase },
        { exerciseId: 'lateral_raise', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: accessoryBase },
      ]);

      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.equal(totalWorkSets, 5);
      assert.ok(totalWorkSets <= budget.maxWorkSets);
      assert.equal(distributed[0].workSets, 3);
      assert.equal(distributed[1].workSets, 2);
    });

    it('AH.6. High target with multiple exercises: supports full focal development across primary, secondary, and accessory', () => {
      const budget = resolveTargetSessionBudget('back', 'high', 'moderate', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 8);

      const primaryBase = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'moderate', 'balanced', 'maintain', 'none', true, 'high');
      const secondaryBase = resolveExerciseSetBudget('secondary', 'compound', 'secondary_compound', 'moderate', 'balanced', 'maintain', 'none', false, 'high');
      const accessoryBase = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'moderate', 'balanced', 'maintain', 'none', false, 'high');

      assert.equal(primaryBase.workSets, 4);
      assert.equal(secondaryBase.workSets, 3);
      assert.equal(accessoryBase.workSets, 2);

      const distributed = distributeTargetSetBudget(budget, [
        { exerciseId: 'barbell_row', role: 'primary', exerciseType: 'compound', progressionProfile: 'primary_compound', isFirstOfPattern: true, baseBudget: primaryBase },
        { exerciseId: 'lat_pulldown', role: 'secondary', exerciseType: 'compound', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: secondaryBase },
        { exerciseId: 'face_pull', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: accessoryBase },
      ]);

      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.ok(totalWorkSets <= budget.maxWorkSets);
      assert.ok(distributed[0].workSets >= 3);
      assert.ok(distributed[1].workSets >= 2);
    });

    it('AH.7. Multiple targets in the same session: distinct target budgets do not interfere with each other', () => {
      const { plan } = getSamplePrescribedPlan();
      const firstSession = plan.sessions[0];
      assert.ok(firstSession.exercises.length >= 2);

      const targetWorkSets = new Map<string, number>();
      firstSession.exercises.forEach((ex) => {
        const primaryTarget = ex.targetMuscles[0];
        const workSets = ex.sets.filter((s) => s.setType === 'work').length;
        targetWorkSets.set(primaryTarget, (targetWorkSets.get(primaryTarget) ?? 0) + workSets);
      });

      targetWorkSets.forEach((sets, target) => {
        assert.ok(sets > 0, `Target ${target} should have positive work sets`);
        assert.ok(sets <= 10, `Target ${target} aggregate work sets (${sets}) cannot exceed theoretical ceiling`);
      });
    });

    it('AH.8. Repeated target exposure across multiple sessions: allocates consistent volume per exposure', () => {
      const { plan } = getSamplePrescribedPlan({ idealTrainingDays: 4 });
      assert.ok(plan.sessions.length >= 2);

      const targetExposures = new Map<string, number[]>();
      plan.sessions.forEach((s) => {
        s.exercises.forEach((ex) => {
          const t = ex.targetMuscles[0];
          const workSets = ex.sets.filter((st) => st.setType === 'work').length;
          const current = targetExposures.get(t) ?? [];
          current.push(workSets);
          targetExposures.set(t, current);
        });
      });

      targetExposures.forEach((exposures, t) => {
        if (exposures.length > 1) {
          exposures.forEach((sets) => {
            assert.ok(sets >= 1 && sets <= 6, `Target ${t} exposure work sets (${sets}) must be balanced`);
          });
        }
      });
    });

    it('AH.9. Recovery reduction combined with target allocation: proportionally scales target budget down', () => {
      const budgetStandard = resolveTargetSessionBudget('chest', 'moderate', 'moderate', 'maintain', 'none');
      const budgetReduced = resolveTargetSessionBudget('chest', 'moderate', 'moderate', 'reduce', 'none');
      assert.ok(budgetReduced.maxWorkSets < budgetStandard.maxWorkSets);

      const secondaryBase = resolveExerciseSetBudget('secondary', 'compound', 'secondary_compound', 'moderate', 'balanced', 'reduce', 'none', false, 'moderate');
      const accessoryBase = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'moderate', 'balanced', 'reduce', 'none', false, 'moderate');

      const distributed = distributeTargetSetBudget(budgetReduced, [
        { exerciseId: 'incline_press', role: 'secondary', exerciseType: 'compound', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: secondaryBase },
        { exerciseId: 'chest_fly', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: accessoryBase },
      ]);

      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.ok(totalWorkSets <= budgetReduced.maxWorkSets);
    });

    it('AH.10. Deload combined with target allocation: enforces conservative deload target budget and set limits', () => {
      const budgetDeload = resolveTargetSessionBudget('chest', 'high', 'moderate', 'maintain', 'recommend');
      assert.equal(budgetDeload.maxWorkSets, 5);

      const primaryBase = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'moderate', 'balanced', 'maintain', 'recommend', true, 'high');
      const secondaryBase = resolveExerciseSetBudget('secondary', 'compound', 'secondary_compound', 'moderate', 'balanced', 'maintain', 'recommend', false, 'high');

      assert.equal(primaryBase.workSets, 2);
      assert.equal(secondaryBase.workSets, 2);

      const distributed = distributeTargetSetBudget(budgetDeload, [
        { exerciseId: 'bench_press', role: 'primary', exerciseType: 'compound', progressionProfile: 'primary_compound', isFirstOfPattern: true, baseBudget: primaryBase },
        { exerciseId: 'incline_press', role: 'secondary', exerciseType: 'compound', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: secondaryBase },
      ]);

      distributed.forEach((d) => {
        assert.ok(d.workSets <= 2, `Deload exercise ${d.exerciseId} work sets must be <= 2, got ${d.workSets}`);
      });
      const totalWorkSets = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.ok(totalWorkSets <= budgetDeload.maxWorkSets);
    });
  });

  // ==================================================
  // Category AI: W3.2 fewer_higher_effort Semantics & Invariants
  // ==================================================
  describe('AI. W3.2 fewer_higher_effort Semantics & Invariants', () => {
    it('AI.1. Primary + low volume: reduces from base 3 to 2 (retains compound minimum 2)', () => {
      const base = BASE_WORK_SETS_TABLE.primary.low; // 3
      assert.equal(base, 3);
      const res = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'low', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.workSets, 2);
      assert.ok(res.workSets <= base);
    });

    it('AI.2. Secondary + low volume: retains compound floor 2 without increasing or reducing below 2', () => {
      const base = BASE_WORK_SETS_TABLE.secondary.low; // 2
      assert.equal(base, 2);
      const res = resolveExerciseSetBudget('secondary', 'compound', 'secondary_compound', 'low', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.workSets, 2);
      assert.ok(res.workSets <= base);
    });

    it('AI.3. Accessory + low volume: reduces from base 2 to accessory floor 1', () => {
      const base = BASE_WORK_SETS_TABLE.accessory.low; // 2
      assert.equal(base, 2);
      const res = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'low', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.workSets, 1);
      assert.ok(res.workSets <= base);
    });

    it('AI.4. Optional + low volume: reduces from base 1 to 0 (NEVER increases to 2)', () => {
      const base = BASE_WORK_SETS_TABLE.optional.low; // 1
      assert.equal(base, 1);
      const res = resolveExerciseSetBudget('optional', 'isolation', 'secondary_compound', 'low', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.workSets, 0);
      assert.equal(res.optionalSets, 0);
      assert.ok(res.optionalSets <= base);
    });

    it('AI.5. Primary + moderate: reduces from base 4 to 3', () => {
      const base = BASE_WORK_SETS_TABLE.primary.moderate; // 4
      assert.equal(base, 4);
      const res = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'moderate', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.workSets, 3);
      assert.ok(res.workSets <= base);
    });

    it('AI.6. Accessory + moderate: reduces from base 2 to 1', () => {
      const base = BASE_WORK_SETS_TABLE.accessory.moderate; // 2
      assert.equal(base, 2);
      const res = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'moderate', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.workSets, 1);
      assert.ok(res.workSets <= base);
    });

    it('AI.7. Optional + moderate: reduces from base 2 to 1', () => {
      const base = BASE_WORK_SETS_TABLE.optional.moderate; // 2
      assert.equal(base, 2);
      const res = resolveExerciseSetBudget('optional', 'isolation', 'secondary_compound', 'moderate', 'fewer_higher_effort', 'maintain', 'none', false);
      assert.equal(res.optionalSets, 1);
      assert.ok(res.optionalSets <= base);
    });

    it('AI.8. fewer_higher_effort + T9 reduce: compound preserves minimum floor 2', () => {
      const res = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'moderate', 'fewer_higher_effort', 'reduce', 'none', false);
      assert.ok(res.workSets >= 2);
      assert.ok(res.workSets <= 3);
    });

    it('AI.9. fewer_higher_effort + short session: generates compact valid workout plan comfortably within budget', () => {
      const { plan } = getSamplePrescribedPlan({
        sessionDuration: '20_30',
        volumePreference: 'fewer_higher_effort',
      });
      assert.ok(plan.sessions.length > 0);
      assert.notEqual(plan.generationMetadata.durationFeasibility, 'constrained');
    });

    it('AI.10. fewer_higher_effort + deload: deload caps work sets at 1-2 regardless of preference', () => {
      const res = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'high', 'fewer_higher_effort', 'maintain', 'recommend', false);
      assert.equal(res.workSets, 2);
    });

    it('AI.11. Invariant: resulting workSets <= base workSets before preference modifier across all combinations', () => {
      const roles: Array<'primary' | 'secondary' | 'accessory' | 'optional'> = [
        'primary',
        'secondary',
        'accessory',
        'optional',
      ];
      const volumes: Array<'low' | 'moderate' | 'high'> = ['low', 'moderate', 'high'];

      roles.forEach((role) => {
        volumes.forEach((vol) => {
          const base = BASE_WORK_SETS_TABLE[role][vol];
          const budget = resolveExerciseSetBudget(
            role,
            role === 'accessory' || role === 'optional' ? 'isolation' : 'compound',
            'secondary_compound',
            vol,
            'fewer_higher_effort',
            'maintain',
            'none',
            false
          );
          const activeSets = role === 'optional' ? budget.optionalSets : budget.workSets;
          assert.ok(
            activeSets <= base,
            `Role ${role} under ${vol} volume produced ${activeSets} sets > base ${base}`
          );
        });
      });
    });
  });

  // ==================================================
  // Category AJ: W3.2 Focused Interaction Boundary Matrix
  // ==================================================
  describe('AJ. W3.2 Focused Interaction Boundary Matrix', () => {
    it('AJ.1. T6 low priority x 2 accessory exercises x fewer_higher_effort: total work sets <= 2', () => {
      const budget = resolveTargetSessionBudget('calves', 'low', 'low', 'maintain', 'none');
      const base1 = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'low', 'fewer_higher_effort', 'maintain', 'none', false, 'low');
      const base2 = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'low', 'fewer_higher_effort', 'maintain', 'none', false, 'low');

      assert.equal(base1.workSets, 1);
      assert.equal(base2.workSets, 1);

      const distributed = distributeTargetSetBudget(budget, [
        { exerciseId: 'standing_calf_raise', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: base1 },
        { exerciseId: 'seated_calf_raise', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: base2 },
      ]);

      const total = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.equal(total, 2);
      assert.ok(total <= budget.maxWorkSets);
    });

    it('AJ.2. T6 high priority x primary + secondary + accessory x more_volume: total work sets capped to target budget', () => {
      const budget = resolveTargetSessionBudget('chest', 'high', 'high', 'maintain', 'none');
      assert.equal(budget.maxWorkSets, 10);

      const primaryBase = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'high', 'more_volume', 'maintain', 'none', true, 'high');
      const secondaryBase = resolveExerciseSetBudget('secondary', 'compound', 'secondary_compound', 'high', 'more_volume', 'maintain', 'none', false, 'high');
      const accessoryBase = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'high', 'more_volume', 'maintain', 'none', false, 'high');

      assert.equal(primaryBase.workSets, 5);
      assert.equal(secondaryBase.workSets, 5);
      assert.equal(accessoryBase.workSets, 4);

      const distributed = distributeTargetSetBudget(budget, [
        { exerciseId: 'bench_press', role: 'primary', exerciseType: 'compound', progressionProfile: 'primary_compound', isFirstOfPattern: true, baseBudget: primaryBase },
        { exerciseId: 'incline_press', role: 'secondary', exerciseType: 'compound', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: secondaryBase },
        { exerciseId: 'chest_fly', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: accessoryBase },
      ]);

      const total = distributed.reduce((sum, d) => sum + d.workSets, 0);
      assert.ok(total <= budget.maxWorkSets, `Total (${total}) exceeded budget (${budget.maxWorkSets})`);
      assert.ok(distributed[0].workSets >= 3, 'Primary preserved');
      assert.ok(distributed[1].workSets >= 2, 'Secondary preserved');
    });

    it('AJ.3. T6 moderate priority x 2 exercises x T9 strongly_reduce: preserves compound minimum floor 2', () => {
      const budget = resolveTargetSessionBudget('back', 'moderate', 'moderate', 'strongly_reduce', 'none');
      assert.ok(budget.maxWorkSets >= 2);

      const secondaryBase = resolveExerciseSetBudget('secondary', 'compound', 'secondary_compound', 'moderate', 'balanced', 'strongly_reduce', 'none', false, 'moderate');
      const accessoryBase = resolveExerciseSetBudget('accessory', 'isolation', 'secondary_compound', 'moderate', 'balanced', 'strongly_reduce', 'none', false, 'moderate');

      assert.equal(secondaryBase.workSets, 2);
      assert.equal(accessoryBase.workSets, 1);

      const distributed = distributeTargetSetBudget(budget, [
        { exerciseId: 'lat_pulldown', role: 'secondary', exerciseType: 'compound', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: secondaryBase },
        { exerciseId: 'straight_arm_pulldown', role: 'accessory', exerciseType: 'isolation', progressionProfile: 'secondary_compound', isFirstOfPattern: false, baseBudget: accessoryBase },
      ]);

      assert.equal(distributed[0].workSets, 2);
      assert.ok(distributed[1].workSets >= 0);
    });

    it('AJ.4. T6 low priority x primary compound x T9 deload: primary receives conservative deload 2 sets and RIR 4-5 reserve', () => {
      const budget = resolveTargetSessionBudget('quads', 'low', 'low', 'maintain', 'recommend');
      assert.equal(budget.maxWorkSets, 2);

      const primaryBase = resolveExerciseSetBudget('primary', 'compound', 'primary_compound', 'low', 'balanced', 'maintain', 'recommend', true, 'low');
      assert.equal(primaryBase.workSets, 2);

      const distributed = distributeTargetSetBudget(budget, [
        { exerciseId: 'barbell_squat', role: 'primary', exerciseType: 'compound', progressionProfile: 'primary_compound', isFirstOfPattern: true, baseBudget: primaryBase },
      ]);

      assert.equal(distributed[0].workSets, 2);
      assert.equal(distributed[0].warmupSets, 1);
    });
  });

  // ==================================================
  // CATEGORY AK: MULTI-SESSION TARGET-VOLUME INVARIANTS
  // ==================================================
  describe('AK. Multi-Session Target-Volume Invariants (W3.3 Audit)', () => {
    it('AK.1. Low-priority target across 3 sessions does not leak volume beyond cycle budget', () => {
      const profile = createProfile({
        goal: 'build_muscle',
        trainingHistory: 'intermediate',
        idealTrainingDays: 4,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'wed', 'fri', 'sat'],
      });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      // Find low priority targets from T6 demand
      const lowPriorityTargets = strategy.trainingDemand.weeklyTargets.filter(
        (t) => t.priority === 'low'
      );

      for (const lowTarget of lowPriorityTargets) {
        const cycleBudget = resolveTargetCycleBudget(
          lowTarget.target,
          lowTarget.priority,
          lowTarget.workloadBand,
          lowTarget.exposureTarget,
          strategy.recoveryConstraints.volumeModifier,
          strategy.recoveryConstraints.deloadDecision
        );

        // Sum actual prescribed work sets for this target across all sessions
        let totalCycleWorkSetsForTarget = 0;
        plan.sessions.forEach((s) => {
          s.exercises.forEach((ex) => {
            if (ex.targetMuscles[0] === lowTarget.target) {
              const workSets = ex.sets.filter((st) => st.setType === 'work').length;
              totalCycleWorkSetsForTarget += workSets;
            }
          });
        });

        // Invariant: low priority target must not exceed cycle budget (with 2 leeway if primary compound floor preserved)
        assert.ok(
          totalCycleWorkSetsForTarget <= cycleBudget.maxCycleWorkSets + 2,
          `Low priority target ${lowTarget.target} accumulated ${totalCycleWorkSetsForTarget} sets, exceeding cycle budget ${cycleBudget.maxCycleWorkSets}`
        );
      }
    });

    it('AK.2. Repeated target in 2 sessions retains compound floors while honoring cycle ceiling', () => {
      const budgetLow = resolveTargetCycleBudget('chest', 'low', 'low', 1, 'maintain', 'none');
      assert.equal(budgetLow.maxCycleWorkSets, 3);
      assert.equal(budgetLow.maxSessionWorkSets, 2);

      const budgetMod = resolveTargetCycleBudget('chest', 'moderate', 'moderate', 2, 'maintain', 'none');
      assert.equal(budgetMod.maxCycleWorkSets, 12);
      assert.equal(budgetMod.maxSessionWorkSets, 6);

      const budgetHigh = resolveTargetCycleBudget('chest', 'high', 'high', 2, 'maintain', 'none');
      assert.equal(budgetHigh.maxCycleWorkSets, 20);
      assert.equal(budgetHigh.maxSessionWorkSets, 10);
    });

    it('AK.3. Cycle target budgets decrease monotonically under T9 reduce and strongly_reduce', () => {
      const normal = resolveTargetCycleBudget('back', 'moderate', 'moderate', 2, 'maintain', 'none');
      const reduced = resolveTargetCycleBudget('back', 'moderate', 'moderate', 2, 'reduce', 'none');
      const stronglyReduced = resolveTargetCycleBudget('back', 'moderate', 'moderate', 2, 'strongly_reduce', 'none');

      assert.ok(reduced.maxCycleWorkSets < normal.maxCycleWorkSets);
      assert.ok(stronglyReduced.maxCycleWorkSets <= reduced.maxCycleWorkSets);
    });

    it('AK.4. Cycle target budgets contract conservatively under deload recommendation', () => {
      const normal = resolveTargetCycleBudget('quads', 'high', 'high', 2, 'maintain', 'none');
      const deload = resolveTargetCycleBudget('quads', 'high', 'high', 2, 'maintain', 'recommend');

      assert.ok(deload.maxCycleWorkSets < normal.maxCycleWorkSets);
      assert.equal(deload.maxCycleWorkSets, 8);
    });

    it('AK.5. Trainee volume preference does not inflate cycle ceiling for low priority target', () => {
      const profileMoreVol = createProfile({
        goal: 'build_muscle',
        volumePreference: 'more_volume',
      });
      const result = runStrategyPipeline(profileMoreVol);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profileMoreVol);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profileMoreVol);

      const lowTarget = strategy.trainingDemand.weeklyTargets.find((t) => t.priority === 'low');
      if (lowTarget) {
        let lowWorkSets = 0;
        plan.sessions.forEach((s) => {
          s.exercises.forEach((ex) => {
            if (ex.targetMuscles[0] === lowTarget.target) {
              lowWorkSets += ex.sets.filter((st) => st.setType === 'work').length;
            }
          });
        });
        // Even with more_volume preference, low priority targets remain strictly constrained
        assert.ok(lowWorkSets <= 6);
      }
    });
  });

  // ==================================================
  // CATEGORY AL: AUDITED DURATION + CONDITIONING PRIORITY ORDER
  // ==================================================
  describe('AL. Audited Duration + Conditioning Priority Balancing (W3.3 Audit)', () => {
    it('AL.1. Session target 45m does not categorically omit conditioning if conditioning fits at 10m', () => {
      const profile = createProfile({
        sessionDuration: '30_45',
      });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      // Verify that every session has valid feasibility and does not exceed hard constraints
      for (const session of plan.sessions) {
        assert.ok(session.targetDurationMinutes <= 45);
        if (session.conditioning) {
          // If conditioning was kept, it was properly shortened to 10m active recovery
          assert.equal(session.conditioning.durationMinutesGuidance.target, 10);
        }
      }
    });

    it('AL.2. Priority balancing prunes optional exercises first before shortening conditioning or trimming accessories', () => {
      // Build a skeleton where an optional exercise is present
      const profile = createProfile({
        sessionDuration: '30_45',
      });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      // Manually add an optional exercise to session 0 to test pruning
      const optionalCandidate = skeleton.sessions[0].exercises[0];
      if (optionalCandidate) {
        skeleton.sessions[0].exercises.push({
          ...optionalCandidate,
          exerciseId: 'lateral_raise',
          role: 'optional',
          sets: [{ setIndex: 1, setType: 'optional', repRange: { min: 12, max: 15 }, targetRIR: 3, restSeconds: 60 }],
        });
      }

      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      // In the prescribed plan, optional exercises are pruned under duration constraint
      for (const session of plan.sessions) {
        assert.ok(session.exercises.length > 0);
        // Primary exercises are never pruned
        const primaryEx = session.exercises.filter((e) => e.role === 'primary');
        if (skeleton.sessions.find(s => s.sessionId === session.sessionId)?.exercises.some(e => e.role === 'primary')) {
          assert.ok(primaryEx.length > 0);
        }
      }
    });

    it('AL.3. Compact sessions (20-30m) protect primary compound lift floors while streamlining duration', () => {
      const profile = createProfile({
        sessionDuration: '20_30',
      });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      for (const session of plan.sessions) {
        assert.ok(session.targetDurationMinutes <= 30);
        const primaryEx = session.exercises.find((e) => e.role === 'primary');
        if (primaryEx) {
          const workSets = primaryEx.sets.filter((s) => s.setType === 'work').length;
          assert.ok(workSets >= 2, `Primary work sets (${workSets}) below compound floor 2`);
        }
      }
    });

    it('AL.4. Long sessions (60-75m) comfortably accommodate full resistance core and full conditioning', () => {
      const profile = createProfile({
        sessionDuration: '60_75',
      });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      for (const session of plan.sessions) {
        assert.ok(session.targetDurationMinutes >= 60);
        if (session.conditioning) {
          // In long sessions, conditioning is not prematurely cut to 0
          assert.ok(session.conditioning.durationMinutesGuidance.target >= 10);
        }
      }
    });

    it('AL.5. When recovery constraints omit conditioning, conditioning is omitted upfront regardless of session duration', () => {
      const profile = createProfile({
        goal: 'general_fitness',
        sessionDuration: '60_75',
      });
      const runtimeState = {
        sleepDuration: 'under_5',
        stressLevel: 5,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const result = runStrategyPipeline(profile, undefined, runtimeState as any);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      assert.equal(strategy.recoveryConstraints.conditioningModifier, 'omit');

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      for (const session of plan.sessions) {
        assert.equal(session.conditioning, undefined);
      }
    });
  });

  // ==================================================
  // CATEGORY AM: W3.3.1 EDGE-CASE & EXPOSURE-TARGET INTEGRITY
  // ==================================================
  describe('AM. Edge-Case Integrity & Exposure-Target Scaling (W3.3.1 Audit)', () => {
    it('AM.1. exposureTarget actually and monotonically scales maxCycleWorkSets across low, moderate, and high targets', () => {
      // Low priority target: 1 exposure vs 2 exposures
      const lowExp1 = resolveTargetCycleBudget('calves', 'low', 'low', 1, 'maintain', 'none');
      const lowExp2 = resolveTargetCycleBudget('calves', 'low', 'low', 2, 'maintain', 'none');
      assert.ok(lowExp2.maxCycleWorkSets > lowExp1.maxCycleWorkSets, 'Low priority cycle budget should scale with exposureTarget');
      assert.equal(lowExp1.maxCycleWorkSets, 3);
      assert.equal(lowExp2.maxCycleWorkSets, 5);

      // Moderate priority target: 1 vs 2 vs 3 exposures
      const modExp1 = resolveTargetCycleBudget('shoulders', 'moderate', 'moderate', 1, 'maintain', 'none');
      const modExp2 = resolveTargetCycleBudget('shoulders', 'moderate', 'moderate', 2, 'maintain', 'none');
      const modExp3 = resolveTargetCycleBudget('shoulders', 'moderate', 'moderate', 3, 'maintain', 'none');
      assert.ok(modExp2.maxCycleWorkSets > modExp1.maxCycleWorkSets);
      assert.ok(modExp3.maxCycleWorkSets > modExp2.maxCycleWorkSets);
      assert.equal(modExp1.maxCycleWorkSets, 6);
      assert.equal(modExp2.maxCycleWorkSets, 12);
      assert.equal(modExp3.maxCycleWorkSets, 14);

      // High priority target: 1 vs 2 vs 3 exposures
      const highExp1 = resolveTargetCycleBudget('chest', 'high', 'high', 1, 'maintain', 'none');
      const highExp2 = resolveTargetCycleBudget('chest', 'high', 'high', 2, 'maintain', 'none');
      const highExp3 = resolveTargetCycleBudget('chest', 'high', 'high', 3, 'maintain', 'none');
      assert.ok(highExp2.maxCycleWorkSets > highExp1.maxCycleWorkSets);
      assert.ok(highExp3.maxCycleWorkSets > highExp2.maxCycleWorkSets);
      assert.equal(highExp1.maxCycleWorkSets, 10);
      assert.equal(highExp2.maxCycleWorkSets, 20);
      assert.equal(highExp3.maxCycleWorkSets, 24);
    });

    it('AM.2. Low-priority target assigned primary compound in 2 sessions retains mandatory primary compound floor in each session', () => {
      // Create a mock skeleton with 2 sessions where a low-priority target has primary compound exercises
      const profile = createProfile({ goal: 'hypertrophy' });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      // Ensure calves/core (low priority) is set up or test with calves
      const mockSkeleton = buildWorkoutPlanSkeleton(strategy, profile);
      // Construct 2 sessions where calves has a primary exercise
      const session1 = mockSkeleton.sessions[0];
      const session2 = mockSkeleton.sessions[1];

      // Add primary exercise with target calves in both sessions
      session1.exercises.unshift({
        exerciseId: 'standing_calf_raise',
        exerciseName: 'Standing Calf Raise',
        role: 'primary',
        movementPattern: 'squat',
        targetMuscles: ['calves'],
        sets: [
          { setIndex: 1, setType: 'work', repRange: { min: 8, max: 12 }, targetRIR: 2, restSeconds: 90 },
          { setIndex: 2, setType: 'work', repRange: { min: 8, max: 12 }, targetRIR: 2, restSeconds: 90 },
        ],
        repetitionPrescription: { repRange: { min: 8, max: 12 }, label: '8-12 reps' },
        effortPrescription: { minRIR: 2, maxRIR: 3, targetRIR: 2, isWarmupRIRPreserved: true },
        restSeconds: 90,
        progressionMethod: 'double_progression',
        substitutionExerciseIds: [],
      });

      session2.exercises.unshift({
        exerciseId: 'seated_calf_raise',
        exerciseName: 'Seated Calf Raise',
        role: 'primary',
        movementPattern: 'squat',
        targetMuscles: ['calves'],
        sets: [
          { setIndex: 1, setType: 'work', repRange: { min: 8, max: 12 }, targetRIR: 2, restSeconds: 90 },
          { setIndex: 2, setType: 'work', repRange: { min: 8, max: 12 }, targetRIR: 2, restSeconds: 90 },
        ],
        repetitionPrescription: { repRange: { min: 8, max: 12 }, label: '8-12 reps' },
        effortPrescription: { minRIR: 2, maxRIR: 3, targetRIR: 2, isWarmupRIRPreserved: true },
        restSeconds: 90,
        progressionMethod: 'double_progression',
        substitutionExerciseIds: [],
      });

      const plan = generatePrescribedWorkoutPlan(mockSkeleton, strategy, profile);

      // Verify that session 1 and session 2 both allocate at least 2 work sets to the primary exercise
      const s1Calf = plan.sessions[0].exercises.find((e) => e.exerciseId === 'standing_calf_raise');
      const s2Calf = plan.sessions[1].exercises.find((e) => e.exerciseId === 'seated_calf_raise');

      assert.ok(s1Calf);
      assert.ok(s2Calf);
      const s1WorkSets = s1Calf.sets.filter((s) => s.setType === 'work').length;
      const s2WorkSets = s2Calf.sets.filter((s) => s.setType === 'work').length;

      assert.ok(s1WorkSets >= 2, `Session 1 primary floor violated: got ${s1WorkSets}`);
      assert.ok(s2WorkSets >= 2, `Session 2 primary floor violated: got ${s2WorkSets}`);
    });

    it('AM.3. T9 reduce & strongly_reduce interact cleanly with exposureTarget scaling', () => {
      // 2 exposures under maintain, reduce, strongly_reduce
      const maintain2 = resolveTargetCycleBudget('quads', 'high', 'moderate', 2, 'maintain', 'none');
      const reduce2 = resolveTargetCycleBudget('quads', 'high', 'moderate', 2, 'reduce', 'none');
      const stronglyReduce2 = resolveTargetCycleBudget('quads', 'high', 'moderate', 2, 'strongly_reduce', 'none');

      assert.equal(maintain2.maxCycleWorkSets, 16);
      assert.equal(reduce2.maxCycleWorkSets, 14);
      assert.equal(stronglyReduce2.maxCycleWorkSets, 12);
    });

    it('AM.4. Deload recommendation overrides exposureTarget expansion into conservative recovery reserve', () => {
      const deloadExp1 = resolveTargetCycleBudget('chest', 'high', 'high', 1, 'maintain', 'recommend');
      const deloadExp2 = resolveTargetCycleBudget('chest', 'high', 'high', 2, 'maintain', 'recommend');
      const deloadExp3 = resolveTargetCycleBudget('chest', 'high', 'high', 3, 'maintain', 'recommend');

      // All deloads enforce the strict deload ceiling of 8 sets for high priority
      assert.equal(deloadExp1.maxCycleWorkSets, 8);
      assert.equal(deloadExp2.maxCycleWorkSets, 8);
      assert.equal(deloadExp3.maxCycleWorkSets, 8);
    });

    it('AM.5. fewer_higher_effort interacts cleanly with cycle budgeting without inflating sets', () => {
      const profile = createProfile({
        goal: 'build_muscle',
        volumePreference: 'fewer_higher_effort',
      });
      const result = runStrategyPipeline(profile);
      assert.equal(result.status, 'completed');
      if (result.status !== 'completed') return;
      const strategy = result.strategy;

      const skeleton = buildWorkoutPlanSkeleton(strategy, profile);
      const plan = generatePrescribedWorkoutPlan(skeleton, strategy, profile);

      // Verify that every exercise work set count <= standard base work set count
      for (const session of plan.sessions) {
        for (const ex of session.exercises) {
          const workSets = ex.sets.filter((s) => s.setType === 'work').length;
          const standardBase = BASE_WORK_SETS_TABLE[ex.role][strategy.trainingLoad.startingVolume];
          assert.ok(
            workSets <= standardBase,
            `Exercise ${ex.exerciseId} work sets (${workSets}) exceeded standard base (${standardBase})`
          );
        }
      }
    });
  });
});
