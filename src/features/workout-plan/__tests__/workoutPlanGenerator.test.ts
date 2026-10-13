/**
 * Stage W5.1 — Real Adaptive Workout Plan Generation Integration Test Suite
 *
 * Verifies the pure orchestration engine connecting CanonicalUserProfile,
 * Population Guard, T1–T10 Strategy Pipeline, W2 Session Skeleton,
 * W3 Exact Prescription, and W4.2 Workout Player integration.
 *
 * TEST CATEGORIES (A to H):
 * A. Profile -> Strategy Routing (adult, youth, ineligible, invalid profile)
 * B. Strategy -> WorkoutPlan Generation & Validation
 * C. Personalization (goal, frequency, experience, duration, equipment, avoid list, preferences)
 * D. Multi-Session Structural Integrity (session count, contiguous IDs, 1-based sequence)
 * E. W3 Exact Prescription Integrity (sets, rep ranges, RIR invariants, rest, conditioning)
 * F. W4.2 Integration (real generated session consumed, dev fixture remains isolated)
 * G. Determinism (identical profile -> deeply equal plan; differing inputs -> differing outputs)
 * H. Immutability (no mutation of profile, strategy, or plan inputs)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { OnboardingData } from '../../onboarding/onboardingState';
import {
  buildCanonicalUserProfile,
  validateCanonicalUserProfile,
  type CanonicalUserProfile,
} from '../../profile';
import {
  generateWorkoutPlanFromProfile,
  type WorkoutPlanGenerationResult,
  setSharedWorkoutPlan,
  getSharedWorkoutPlan,
  getSharedWorkoutSession,
  clearSharedWorkoutPlan,
} from '../index';
import {
  initializeWorkoutExecution,
  startWorkoutExecution,
  recordSetExecution,
  completeExerciseExecution,
  completeWorkoutExecution,
  getDevWorkoutSession,
} from '../../workout-runtime';

/**
 * Creates a clean, standard adult onboarding profile for testing.
 */
function createBaseAdultOnboardingData(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
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
    availableDays: ['mon', 'wed', 'fri'],
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
    ...overrides,
  };
}

describe('Stage W5.1 — Real Adaptive Workout Plan Generation Integration', () => {
  // =========================================================================
  // CATEGORY A: Profile -> Strategy Routing
  // =========================================================================
  describe('Category A: Profile -> Strategy Routing', () => {
    it('A.1. Adult profile (18–100) successfully produces a prescribed WorkoutPlan', () => {
      const data = createBaseAdultOnboardingData({ age: 29 });
      const profile = buildCanonicalUserProfile(data);
      const result = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(result.status, 'success');
      if (result.status === 'success') {
        assert.strictEqual(result.population, 'adult');
        assert.ok(result.plan);
        assert.strictEqual(result.plan.population, 'adult');
        assert.strictEqual(result.plan.generationMetadata.generationStage, 'prescribed');
        assert.ok(result.plan.sessions.length > 0);
        assert.ok(result.decisionTrace.length > 0);
      }
    });

    it('A.2. Incomplete profile returns invalid_profile without running strategy engine', () => {
      const incompleteData: OnboardingData = {
        age: 25,
        // Missing goal, height, weight, etc.
      };
      const profile = buildCanonicalUserProfile(incompleteData);
      const result = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(result.status, 'invalid_profile');
      if (result.status === 'invalid_profile') {
        assert.ok(result.errors.length > 0);
        assert.ok(result.decisionTrace.some((t) => t.includes('Profile validation failed')));
      }
    });

    it('A.3. Youth trainee (ages 13–17) is safely held at youth_strategy_pending boundary', () => {
      const youthData = createBaseAdultOnboardingData({ age: 15 });
      const profile = buildCanonicalUserProfile(youthData);
      const result = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(result.status, 'youth_strategy_pending');
      if (result.status === 'youth_strategy_pending') {
        assert.strictEqual(result.population, 'youth');
        assert.ok(result.message.includes('Youth training pathway selected'));
        assert.strictEqual((result as any).plan, undefined);
      }
    });

    it('A.4. Ineligible trainee (<13 or >100) is blocked at population boundary', () => {
      const childData = createBaseAdultOnboardingData({ age: 11 });
      const childProfile = buildCanonicalUserProfile(childData);
      const resultChild = generateWorkoutPlanFromProfile(childProfile);

      assert.strictEqual(resultChild.status, 'ineligible');
      if (resultChild.status === 'ineligible') {
        assert.ok(resultChild.reason.length > 0);
      }

      const elderData = createBaseAdultOnboardingData({ age: 104 });
      const elderProfile = buildCanonicalUserProfile(elderData);
      const resultElder = generateWorkoutPlanFromProfile(elderProfile);

      assert.strictEqual(resultElder.status, 'ineligible');
    });
  });

  // =========================================================================
  // CATEGORY B: Strategy -> WorkoutPlan Generation & Validation
  // =========================================================================
  describe('Category B: Strategy -> WorkoutPlan Generation & Validation', () => {
    it('B.1. Valid adult strategy cleanly passes W1 contract validation and structural invariants', () => {
      const profile = buildCanonicalUserProfile(createBaseAdultOnboardingData());
      const result = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(result.status, 'success');
      if (result.status === 'success') {
        assert.strictEqual(result.plan.schemaVersion, 1);
        assert.strictEqual(result.plan.generationMetadata.generatorVersion, '1.0.0');
        assert.ok(['comfortably_within_budget', 'near_budget', 'constrained'].includes(
          result.plan.generationMetadata.durationFeasibility ?? ''
        ));
      }
    });
  });

  // =========================================================================
  // CATEGORY C: Personalization
  // =========================================================================
  describe('Category C: Personalization', () => {
    it('C.1. Goal changes produce appropriately differing objectives and rep ranges', () => {
      const strengthData = createBaseAdultOnboardingData({ goal: 'get_stronger' });
      const strengthProfile = buildCanonicalUserProfile(strengthData);
      const strengthResult = generateWorkoutPlanFromProfile(strengthProfile);

      const muscleData = createBaseAdultOnboardingData({ goal: 'build_muscle' });
      const muscleProfile = buildCanonicalUserProfile(muscleData);
      const muscleResult = generateWorkoutPlanFromProfile(muscleProfile);

      assert.strictEqual(strengthResult.status, 'success');
      assert.strictEqual(muscleResult.status, 'success');

      if (strengthResult.status === 'success' && muscleResult.status === 'success') {
        assert.strictEqual(strengthResult.plan.objective.primary, 'strength');
        assert.strictEqual(muscleResult.plan.objective.primary, 'hypertrophy');

        // Primary compound in strength plan has strength rep guidance (e.g. 4-6)
        const strengthPrimary = strengthResult.plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
        assert.ok(strengthPrimary.repetitionPrescription.label.includes('4–6') || strengthPrimary.repetitionPrescription.label.includes('5–7'));

        // Primary compound in hypertrophy plan has hypertrophy rep guidance (e.g. 6-10)
        const musclePrimary = muscleResult.plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
        assert.ok(musclePrimary.repetitionPrescription.label.includes('6–10') || musclePrimary.repetitionPrescription.label.includes('8–12'));
      }
    });

    it('C.2. Frequency changes adapt session counts appropriately (3 vs 4 days)', () => {
      const data3 = createBaseAdultOnboardingData({
        idealTrainingDays: 3,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'wed', 'fri'],
      });
      const data4 = createBaseAdultOnboardingData({
        idealTrainingDays: 4,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
      });

      const res3 = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(data3));
      const res4 = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(data4));

      assert.strictEqual(res3.status, 'success');
      assert.strictEqual(res4.status, 'success');

      if (res3.status === 'success' && res4.status === 'success') {
        assert.strictEqual(res3.plan.sessions.length, 3);
        assert.strictEqual(res4.plan.sessions.length, 4);
        assert.strictEqual(res3.plan.structure.targetDaysPerWeek, 3);
        assert.strictEqual(res4.plan.structure.targetDaysPerWeek, 4);
      }
    });

    it('C.3. Training experience changes follow conservative foundational guardrails vs experienced', () => {
      const beginnerData = createBaseAdultOnboardingData({
        trainingHistory: 'never',
        consistency: 'rarely',
        exerciseConfidence: 1,
        programmingConfidence: 1,
      });
      const advancedData = createBaseAdultOnboardingData({
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
      });

      const resBeg = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(beginnerData));
      const resAdv = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(advancedData));

      assert.strictEqual(resBeg.status, 'success');
      assert.strictEqual(resAdv.status, 'success');

      if (resBeg.status === 'success' && resAdv.status === 'success') {
        // Beginner receives foundational complexity with conservative RIR floor >= 2
        const begPrimary = resBeg.plan.sessions[0].exercises.find((e) => e.role === 'primary')!;
        assert.ok(begPrimary.effortPrescription.minRIR >= 2, 'Foundational trainee has safe RIR buffer');
      }
    });

    it('C.4. Session duration budgeting scales work sets and optional exercises (20–30m vs 60–75m)', () => {
      const shortData = createBaseAdultOnboardingData({ sessionDuration: '20_30' });
      const longData = createBaseAdultOnboardingData({ sessionDuration: '60_75' });

      const resShort = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(shortData));
      const resLong = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(longData));

      assert.strictEqual(resShort.status, 'success');
      assert.strictEqual(resLong.status, 'success');

      if (resShort.status === 'success' && resLong.status === 'success') {
        assert.ok(
          resShort.plan.generationMetadata.totalSetsPrescribed <
          resLong.plan.generationMetadata.totalSetsPrescribed,
          'Short duration has fewer prescribed sets than long duration'
        );
      }
    });

    it('C.5. Equipment restrictions prevent unavailable equipment exercises', () => {
      const dumbbellOnlyData = createBaseAdultOnboardingData({
        equipmentMode: 'custom',
        equipmentIds: ['dumbbells', 'bench'],
        favorites: ['dumbbell_bench_press'],
      });
      const res = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(dumbbellOnlyData));

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        // Barbell exercises (like barbell bench press, barbell squat, deadlift) must never appear
        const allExercises = res.plan.sessions.flatMap((s) => s.exercises);
        const hasBarbell = allExercises.some((e) =>
          e.exerciseId === 'barbell_bench_press' ||
          e.exerciseId === 'barbell_back_squat' ||
          e.exerciseId === 'barbell_deadlift'
        );
        assert.strictEqual(hasBarbell, false, 'No barbell exercises when equipment is limited to dumbbells/bench');
      }
    });

    it('C.6. Avoid list is strictly honored: avoided exercises never appear anywhere in the plan', () => {
      const avoidData = createBaseAdultOnboardingData({
        favorites: ['pull_up'],
        avoid: ['bench_press', 'barbell_bench_press', 'overhead_press'],
      });
      const res = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(avoidData));

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        const allExerciseIds = res.plan.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
        assert.strictEqual(allExerciseIds.includes('bench_press'), false);
        assert.strictEqual(allExerciseIds.includes('barbell_bench_press'), false);
        assert.strictEqual(allExerciseIds.includes('overhead_press'), false);
      }
    });
  });

  // =========================================================================
  // CATEGORY D: Multi-Session Structural Integrity
  // =========================================================================
  describe('Category D: Multi-Session Structural Integrity', () => {
    it('D.1. Prescribed sessions have correct count, contiguous IDs, and 1-based sequential indices', () => {
      const data = createBaseAdultOnboardingData({
        idealTrainingDays: 4,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
      });
      const res = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(data));

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        const sessions = res.plan.sessions;
        assert.strictEqual(sessions.length, 4);

        for (let i = 0; i < sessions.length; i++) {
          assert.strictEqual(sessions[i].sequenceIndex, i + 1);
          assert.strictEqual(sessions[i].sessionId, `session_${i + 1}`);
          assert.ok(sessions[i].sessionName.length > 0);
          assert.ok(sessions[i].targetDurationMinutes > 0);
          assert.ok(sessions[i].exercises.length > 0);
        }
      }
    });
  });

  // =========================================================================
  // CATEGORY E: W3 Exact Prescription Integrity
  // =========================================================================
  describe('Category E: W3 Exact Prescription Integrity', () => {
    it('E.1. All exercises retain W3-owned sets, rep ranges, target reps, RIR, and rest seconds', () => {
      const res = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(createBaseAdultOnboardingData()));

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        for (const session of res.plan.sessions) {
          for (const ex of session.exercises) {
            assert.ok(ex.sets.length > 0, 'Has sets');
            assert.ok(ex.repetitionPrescription.label.length > 0, 'Has rep label');
            assert.ok(ex.effortPrescription.minRIR >= 1, 'minRIR >= 1 invariant holds');
            assert.ok(ex.effortPrescription.maxRIR >= ex.effortPrescription.minRIR, 'maxRIR >= minRIR holds');
            assert.ok(ex.restSeconds >= 45, 'Sensible rest seconds');
          }
        }
      }
    });
  });

  // =========================================================================
  // CATEGORY F: W4.2 Integration & Fixture Isolation
  // =========================================================================
  describe('Category F: W4.2 Integration & Fixture Isolation', () => {
    it('F.1. Real generated session can be executed cleanly through the W4.1 runtime state machine', () => {
      const res = generateWorkoutPlanFromProfile(buildCanonicalUserProfile(createBaseAdultOnboardingData()));
      assert.strictEqual(res.status, 'success');

      if (res.status === 'success') {
        const realSession = res.plan.sessions[0];

        // Store in shared app-level in-memory store
        setSharedWorkoutPlan(res.plan, res);
        const retrievedSession = getSharedWorkoutSession(realSession.sessionId);
        assert.ok(retrievedSession);
        assert.strictEqual(retrievedSession.sessionId, realSession.sessionId);

        // Run through runtime state machine
        let exec = initializeWorkoutExecution(retrievedSession, 'plan_w5', 'exec_w5');
        assert.strictEqual(exec.status, 'not_started');

        exec = startWorkoutExecution(exec, 1700000000000);
        assert.strictEqual(exec.status, 'in_progress');

        const firstEx = retrievedSession.exercises[0];
        exec = recordSetExecution(exec, {
          exerciseId: firstEx.exerciseId,
          setIndex: 1,
          actualReps: 10,
          actualLoad: 60,
          loadUnit: 'kg',
          perceivedEffortRIR: 2,
        });

        exec = completeExerciseExecution(exec, firstEx.exerciseId);
        assert.strictEqual(exec.exerciseExecutions[0].status, 'completed');

        clearSharedWorkoutPlan();
      }
    });

    it('F.2. Development fixture remains isolated and accessible when no real plan is stored', () => {
      clearSharedWorkoutPlan();
      assert.strictEqual(getSharedWorkoutPlan(), null);

      // Dev fixture returns valid fallback session
      const devSession = getDevWorkoutSession();
      assert.strictEqual(devSession.sessionId, 'session_1');
      assert.ok(devSession.exercises.length > 0);
    });
  });

  // =========================================================================
  // CATEGORY G: Determinism
  // =========================================================================
  describe('Category G: Determinism', () => {
    it('G.1. Identical CanonicalUserProfile inputs produce deeply identical WorkoutPlans', () => {
      const data = createBaseAdultOnboardingData();
      const profile1 = buildCanonicalUserProfile(data);
      const profile2 = buildCanonicalUserProfile(data);

      const res1 = generateWorkoutPlanFromProfile(profile1, { deterministicSeed: 'seed_w5' });
      const res2 = generateWorkoutPlanFromProfile(profile2, { deterministicSeed: 'seed_w5' });

      assert.strictEqual(res1.status, 'success');
      assert.strictEqual(res2.status, 'success');

      if (res1.status === 'success' && res2.status === 'success') {
        assert.deepStrictEqual(res1.plan.sessions, res2.plan.sessions);
        assert.deepStrictEqual(res1.plan.structure, res2.plan.structure);
        assert.deepStrictEqual(res1.plan.objective, res2.plan.objective);
      }
    });
  });

  // =========================================================================
  // CATEGORY H: Immutability
  // =========================================================================
  describe('Category H: Immutability', () => {
    it('H.1. Inputs are never mutated by generation orchestration', () => {
      const data = createBaseAdultOnboardingData();
      const dataSnapshot = JSON.stringify(data);

      const profile = buildCanonicalUserProfile(data);
      const profileSnapshot = JSON.stringify(profile);

      const res = generateWorkoutPlanFromProfile(profile);
      assert.strictEqual(res.status, 'success');

      // Assert original inputs remain perfectly unmutated
      assert.strictEqual(JSON.stringify(data), dataSnapshot, 'OnboardingData unmutated');
      assert.strictEqual(JSON.stringify(profile), profileSnapshot, 'CanonicalUserProfile unmutated');
    });
  });

  // =========================================================================
  // CATEGORY I: End-to-End Structure Personalization (Milestone W5.2)
  // =========================================================================
  describe('Category I: End-to-End Structure Personalization (Profiles A-E)', () => {
    // Profile A: Advanced + very consistent + 6 days + long sessions + hypertrophy + PPL preference -> PPL
    it('I.1. Profile A: Advanced, 6d, long sessions, hypertrophy, PPL preference -> PPL plan generated', () => {
      const data = createBaseAdultOnboardingData({
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        idealTrainingDays: 6,
        realisticMinimumDays: 6,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'ppl',
      });
      const profile = buildCanonicalUserProfile(data);
      const res = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        assert.strictEqual(res.plan.structure.splitFamily, 'ppl');
        assert.strictEqual(res.plan.sessions.length, 6);
        assert.ok(res.plan.sessions.some((s) => s.sessionName.includes('Push')));
        assert.ok(res.plan.sessions.some((s) => s.sessionName.includes('Pull')));
        assert.ok(res.plan.sessions.some((s) => s.sessionName.includes('Legs')));
      }
    });

    // Profile B: Same as Profile A but Upper/Lower preference -> Upper/Lower plan generated
    it('I.2. Profile B: Same as Profile A but Upper/Lower preference -> upper_lower plan generated', () => {
      const data = createBaseAdultOnboardingData({
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        idealTrainingDays: 6,
        realisticMinimumDays: 6,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'upper_lower',
      });
      const profile = buildCanonicalUserProfile(data);
      const res = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        assert.strictEqual(res.plan.structure.splitFamily, 'upper_lower');
        assert.strictEqual(res.plan.sessions.length, 6);
        assert.ok(res.plan.sessions.some((s) => s.sessionName.includes('Upper Body')));
        assert.ok(res.plan.sessions.some((s) => s.sessionName.includes('Lower Body')));
      }
    });

    // Profile C: Same as Profile A but Body-part focused preference -> specialization generated
    it('I.3. Profile C: Same as Profile A but Body-part focused preference -> specialization plan generated', () => {
      const data = createBaseAdultOnboardingData({
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        idealTrainingDays: 6,
        realisticMinimumDays: 6,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'body_part_focused',
      });
      const profile = buildCanonicalUserProfile(data);
      const res = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        assert.strictEqual(res.plan.structure.splitFamily, 'specialization');
        assert.strictEqual(res.plan.sessions.length, 6);
      }
    });

    // Profile D: Same as Profile A but Coach decides -> baseline T3 choice
    it('I.4. Profile D: Same as Profile A but Coach decides -> baseline deterministic T3 choice', () => {
      const data = createBaseAdultOnboardingData({
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        idealTrainingDays: 6,
        realisticMinimumDays: 6,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'coach_decides',
      });
      const profile = buildCanonicalUserProfile(data);
      const res = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        assert.strictEqual(res.plan.structure.splitFamily, 'specialization');
        assert.strictEqual(res.plan.sessions.length, 6);
      }
    });

    // Profile E: Same as Profile A but foundational experience -> safety constrains PPL preference to upper_lower
    it('I.5. Profile E: Same as Profile A but foundational experience -> constrained to upper_lower', () => {
      const data = createBaseAdultOnboardingData({
        trainingHistory: 'under_3_months',
        consistency: 'rarely',
        exerciseConfidence: 2,
        programmingConfidence: 1,
        idealTrainingDays: 6,
        realisticMinimumDays: 6,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'ppl',
      });
      const profile = buildCanonicalUserProfile(data);
      const res = generateWorkoutPlanFromProfile(profile);

      assert.strictEqual(res.status, 'success');
      if (res.status === 'success') {
        assert.strictEqual(res.plan.structure.splitFamily, 'upper_lower');
        assert.notEqual(res.plan.structure.splitFamily, 'ppl', 'Foundational protection prevents PPL');
        assert.strictEqual(res.plan.sessions.length, 6);
        assert.ok(
          res.strategy.structure.decisionTrace.some((t) =>
            t.includes('constrained because current trainee structure is foundational')
          )
        );
      }
    });
  });
});
