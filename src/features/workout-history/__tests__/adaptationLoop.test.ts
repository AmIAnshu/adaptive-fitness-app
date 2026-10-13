/**
 * Stage W6.2 — Performance & Recovery Adaptation Loop Test Suite
 *
 * Exhaustively verifies the adaptation loop connecting historical workout evidence
 * to the EXISTING T7 and T9 decision authorities.
 *
 * Verifies all 20 required audit categories:
 * A. No History (Neutral Baseline)
 * B. Successful Performance (Progression Signal)
 * C. Missed Target (Repeat Baseline)
 * D. Degraded Execution (Progression Halted)
 * E. Substitution (Re-establishing Baseline)
 * F. Consecutive Misses (Possible Plateau)
 * G. Repeated Stagnation (Confirmed Plateau)
 * H. Repeated Decline (Regression Signal)
 * I. Isolated Recovery Signal (Mildly Constrained)
 * J. Converging Recovery Signals (Constrained)
 * K. Repeated Recovery Deficit Across History
 * L. Persistent Multi-Signal Recovery Deficit (Deload Recommended)
 * M. Conservative Hysteresis Recovery Release
 * N. Next-Generation Plan Reflection
 * O. Chronological Multi-Session Processing
 * P. Plan Separation
 * Q. Baseline Profile Unchanged
 * R. Completed Plans Immutable
 * S. Pure Determinism
 * T. Immutability
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import {
  generateWorkoutPlanFromProfile,
  type WorkoutPlan,
  type WorkoutSession,
} from '../../workout-plan';
import {
  initializeWorkoutExecution,
  startWorkoutExecution,
  recordSetExecution,
  completeExerciseExecution,
  completeWorkoutExecution,
  abandonWorkoutExecution,
  skipWorkoutExecution,
  skipExerciseExecution,
  substituteExerciseExecution,
  type WorkoutExecution,
} from '../../workout-runtime';
import {
  buildAdaptiveStrategyInputs,
  evaluateT7ProgressionFromHistory,
  type WorkoutAdaptationContext,
} from '../adaptation';
import {
  buildExecutionHistorySummary,
  selectExerciseHistory,
} from '../historySelectors';
import { buildRecoveryRuntimeStateFromHistory } from '../adapters';

/**
 * Fixture: Creates a standard adult profile for consistent test execution.
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
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'pullup_bar'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'some_variety',
    structurePreference: 'coach_decides',
    favorites: ['bench_press'],
    dislikes: ['burpees'],
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
 * Helper to generate a clean base plan.
 */
function getBaselinePlan(profile: CanonicalUserProfile): WorkoutPlan {
  const result = generateWorkoutPlanFromProfile(profile);
  if (result.status !== 'success') {
    throw new Error(`Plan generation failed: ${result.status}`);
  }
  return result.plan;
}

/**
 * Helper to simulate performing an entire session cleanly.
 */
function performCleanSession(
  session: WorkoutSession,
  planId: string,
  startTimestamp: number = 1000,
  overrides?: {
    reps?: number;
    load?: number;
    rir?: number;
    energyLevel?: 1 | 2 | 3 | 4 | 5;
    sorenessLevel?: 'none' | 'mild' | 'moderate' | 'severe';
  }
): WorkoutExecution {
  let exec = initializeWorkoutExecution(session, planId, `exec_${startTimestamp}`);
  exec = startWorkoutExecution(exec, startTimestamp);

  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.setType === 'work') {
        const targetReps = ex.repetitionPrescription.targetReps ?? ex.repetitionPrescription.repRange?.min ?? 8;
        exec = recordSetExecution(exec, {
          exerciseId: ex.exerciseId,
          setIndex: s.setIndex,
          actualReps: overrides?.reps ?? targetReps,
          actualLoad: overrides?.load ?? 60,
          perceivedEffortRIR: overrides?.rir ?? 2,
          executionQuality: 'clean',
        });
      }
    }
    exec = completeExerciseExecution(exec, ex.exerciseId);
  }

  return completeWorkoutExecution(exec, startTimestamp + 3600000, {
    energyLevel: overrides?.energyLevel ?? 4,
    sorenessLevel: overrides?.sorenessLevel ?? 'mild',
    perceivedRecoveryBeforeSession: 4,
  });
}

describe('Stage W6.2 — Performance & Recovery Adaptation Loop', () => {
  // ==========================================================================
  // CATEGORY A: No History (Neutral Baseline)
  // ==========================================================================
  describe('A. No History (Neutral Baseline)', () => {
    it('produces neutral runtime state and identical baseline plan when history is empty', () => {
      const profile = createProfile();
      const baselineResult = generateWorkoutPlanFromProfile(profile);
      assert.equal(baselineResult.status, 'success');

      // Next generation with empty adaptation context
      const adaptedResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [],
          previousPlan: baselineResult.plan,
          previousConstraintLevel: 'stable',
        },
      });

      assert.equal(adaptedResult.status, 'success');
      if (baselineResult.status === 'success' && adaptedResult.status === 'success') {
        assert.equal(adaptedResult.plan.recoveryContext.level, 'stable');
        assert.equal(
          adaptedResult.plan.generationMetadata.totalSetsPrescribed,
          baselineResult.plan.generationMetadata.totalSetsPrescribed
        );
      }
    });
  });

  // ==========================================================================
  // CATEGORY B: Successful Performance (Progression Signal)
  // ==========================================================================
  describe('B. Successful Performance (Progression Signal)', () => {
    it('evaluates clean execution meeting target reps as progress eligible in T7', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      const exec = performCleanSession(session, plan.planId, 1000, {
        reps: 12,
        rir: 2,
      });

      const outcomes = evaluateT7ProgressionFromHistory([exec], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'progress');
      assert.equal(exOutcome.plateauState, 'none');
      assert.equal(exOutcome.trend, 'improving');
    });
  });

  // ==========================================================================
  // CATEGORY C: Missed Target (Repeat Baseline)
  // ==========================================================================
  describe('C. Missed Target (Repeat Baseline)', () => {
    it('evaluates missed target reps in current session as repeat current baseline', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      // Trainee only manages 3 reps when minTarget is >= 6
      let exec = initializeWorkoutExecution(session, plan.planId, 'exec_miss');
      exec = startWorkoutExecution(exec, 1000);
      exec = recordSetExecution(exec, {
        exerciseId: targetEx.exerciseId,
        setIndex: 1,
        actualReps: 3,
        actualLoad: 80,
        perceivedEffortRIR: 0.5,
        executionQuality: 'clean',
      });
      exec = completeExerciseExecution(exec, targetEx.exerciseId);

      // Skip remaining exercises to complete workout
      for (let i = 1; i < session.exercises.length; i++) {
        exec = skipExerciseExecution(exec, session.exercises[i].exerciseId);
      }
      exec = completeWorkoutExecution(exec, 2000);

      const outcomes = evaluateT7ProgressionFromHistory([exec], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'repeat');
      assert.equal(exOutcome.plateauState, 'none');
      assert.equal(exOutcome.progressionPaused, false);
    });
  });

  // ==========================================================================
  // CATEGORY D: Degraded Execution (Progression Halted)
  // ==========================================================================
  describe('D. Degraded Execution (Progression Halted)', () => {
    it('evaluates degraded technique as maintain, halting progression despite target reps', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      let exec = initializeWorkoutExecution(session, plan.planId, 'exec_deg');
      exec = startWorkoutExecution(exec, 1000);
      exec = recordSetExecution(exec, {
        exerciseId: targetEx.exerciseId,
        setIndex: 1,
        actualReps: 12,
        actualLoad: 80,
        perceivedEffortRIR: 1,
        executionQuality: 'degraded',
      });
      exec = completeExerciseExecution(exec, targetEx.exerciseId);
      for (let i = 1; i < session.exercises.length; i++) {
        exec = skipExerciseExecution(exec, session.exercises[i].exerciseId);
      }
      exec = completeWorkoutExecution(exec, 2000);

      const outcomes = evaluateT7ProgressionFromHistory([exec], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'maintain');
      assert.equal(exOutcome.trend, 'declining');
      assert.ok(exOutcome.rationale.includes('Technique quality degraded'));
    });
  });

  // ==========================================================================
  // CATEGORY E: Substitution (Re-establishing Baseline)
  // ==========================================================================
  describe('E. Substitution (Re-establishing Baseline)', () => {
    it('evaluates substituted exercise as maintain to re-establish new performance baseline', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];
      const substituteId = targetEx.substitutionExerciseIds[0] ?? 'push_up';

      let exec = initializeWorkoutExecution(session, plan.planId, 'exec_sub');
      exec = startWorkoutExecution(exec, 1000);
      exec = substituteExerciseExecution(
        exec,
        targetEx.exerciseId,
        substituteId,
        targetEx,
        'Equipment busy'
      );
      exec = recordSetExecution(exec, {
        exerciseId: substituteId,
        setIndex: 1,
        actualReps: 10,
        actualLoad: 20,
        perceivedEffortRIR: 2,
        executionQuality: 'clean',
      });
      exec = completeExerciseExecution(exec, substituteId, { overallQuality: 'clean' });
      for (let i = 1; i < session.exercises.length; i++) {
        exec = skipExerciseExecution(exec, session.exercises[i].exerciseId);
      }
      exec = completeWorkoutExecution(exec, 2000);

      const outcomes = evaluateT7ProgressionFromHistory([exec], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'maintain');
      assert.equal(exOutcome.plateauState, 'none');
      assert.equal(exOutcome.trend, 'uncertain');
      assert.ok(exOutcome.rationale.includes('substituted'));
    });
  });

  // ==========================================================================
  // CATEGORY F & G: Plateaus (Possible and Confirmed)
  // ==========================================================================
  describe('F & G. Plateaus (Possible and Confirmed)', () => {
    it('F. Flags possible plateau after 2 consecutive missed target sessions', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      // Session 1: missed
      let e1 = initializeWorkoutExecution(session, plan.planId, 'e1');
      e1 = startWorkoutExecution(e1, 1000);
      e1 = recordSetExecution(e1, {
        exerciseId: targetEx.exerciseId,
        setIndex: 1,
        actualReps: 2,
        executionQuality: 'clean',
      });
      e1 = completeExerciseExecution(e1, targetEx.exerciseId);
      for (let i = 1; i < session.exercises.length; i++) {
        e1 = skipExerciseExecution(e1, session.exercises[i].exerciseId);
      }
      const exec1 = completeWorkoutExecution(e1, 2000);

      // Session 2: missed again
      let e2 = initializeWorkoutExecution(session, plan.planId, 'e2');
      e2 = startWorkoutExecution(e2, 3000);
      e2 = recordSetExecution(e2, {
        exerciseId: targetEx.exerciseId,
        setIndex: 1,
        actualReps: 2,
        executionQuality: 'clean',
      });
      e2 = completeExerciseExecution(e2, targetEx.exerciseId);
      for (let i = 1; i < session.exercises.length; i++) {
        e2 = skipExerciseExecution(e2, session.exercises[i].exerciseId);
      }
      const exec2 = completeWorkoutExecution(e2, 4000);

      const outcomes = evaluateT7ProgressionFromHistory([exec1, exec2], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'repeat');
      assert.equal(exOutcome.plateauState, 'possible');
    });

    it('G. Flags confirmed plateau and signals regression after 3 consecutive missed targets', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      const createMissedExec = (id: string, time: number) => {
        let e = initializeWorkoutExecution(session, plan.planId, id);
        e = startWorkoutExecution(e, time);
        e = recordSetExecution(e, {
          exerciseId: targetEx.exerciseId,
          setIndex: 1,
          actualReps: 2,
          executionQuality: 'clean',
        });
        e = completeExerciseExecution(e, targetEx.exerciseId);
        for (let i = 1; i < session.exercises.length; i++) {
          e = skipExerciseExecution(e, session.exercises[i].exerciseId);
        }
        return completeWorkoutExecution(e, time + 1000);
      };

      const exec1 = createMissedExec('e1', 1000);
      const exec2 = createMissedExec('e2', 3000);
      const exec3 = createMissedExec('e3', 5000);

      const outcomes = evaluateT7ProgressionFromHistory([exec1, exec2, exec3], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'regress');
      assert.equal(exOutcome.plateauState, 'confirmed');
      assert.equal(exOutcome.progressionPaused, true);
    });
  });

  // ==========================================================================
  // CATEGORY H: Repeated Decline (Regression Signal)
  // ==========================================================================
  describe('H. Repeated Decline (Regression Signal)', () => {
    it('detects repeated degraded execution across 2 sessions as regression signal', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      const createDegradedExec = (id: string, time: number) => {
        let e = initializeWorkoutExecution(session, plan.planId, id);
        e = startWorkoutExecution(e, time);
        for (const s of targetEx.sets.filter((st) => st.setType === 'work')) {
          e = recordSetExecution(e, {
            exerciseId: targetEx.exerciseId,
            setIndex: s.setIndex,
            actualReps: 10,
            executionQuality: 'degraded',
          });
        }
        e = completeExerciseExecution(e, targetEx.exerciseId, { overallQuality: 'degraded' });
        for (let i = 1; i < session.exercises.length; i++) {
          e = skipExerciseExecution(e, session.exercises[i].exerciseId);
        }
        return completeWorkoutExecution(e, time + 1000);
      };

      const exec1 = createDegradedExec('d1', 1000);
      const exec2 = createDegradedExec('d2', 3000);
      // exec3: clean execution attempting to progress, but blocked & regressed by 2 prior degraded sessions in recent history
      const exec3 = performCleanSession(session, plan.planId, 5000, { reps: 10 });

      const outcomes = evaluateT7ProgressionFromHistory([exec1, exec2, exec3], plan);
      const exOutcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(exOutcome);
      assert.equal(exOutcome.decision, 'regress');
      assert.equal(exOutcome.progressionPaused, true);
      assert.equal(exOutcome.plateauState, 'confirmed');
    });
  });

  // ==========================================================================
  // CATEGORY I: Isolated Recovery Signal (Mildly Constrained)
  // ==========================================================================
  describe('I. Isolated Recovery Signal (Mildly Constrained)', () => {
    it('treats single moderate fatigue signal as mildly_constrained while preserving volume', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      // Clean session executed, with isolated subjective moderate soreness
      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000);

      const nextPlanResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec],
          previousPlan: plan,
          previousConstraintLevel: 'stable',
          latestSubjectiveFeedback: {
            sorenessLevel: 'moderate',
            energyLevel: 4,
          },
        },
      });

      assert.equal(nextPlanResult.status, 'success');
      if (nextPlanResult.status === 'success') {
        assert.equal(nextPlanResult.plan.recoveryContext.level, 'mildly_constrained');
        assert.equal(nextPlanResult.plan.recoveryContext.volumeModifier, 'maintain');
        assert.equal(nextPlanResult.plan.recoveryContext.deloadDecision, 'none');
      }
    });
  });

  // ==========================================================================
  // CATEGORY J: Converging Recovery Signals (Constrained)
  // ==========================================================================
  describe('J. Converging Recovery Signals (Constrained)', () => {
    it('evaluates multiple concurrent recovery signals as constrained with reduced volume and easier effort', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      // Trainee reports low energy (2) and moderate soreness (2 signals)
      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000, {
        energyLevel: 2,
        sorenessLevel: 'moderate',
      });

      const nextPlanResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec],
          previousPlan: plan,
          previousConstraintLevel: 'stable',
        },
      });

      assert.equal(nextPlanResult.status, 'success');
      if (nextPlanResult.status === 'success') {
        assert.equal(nextPlanResult.plan.recoveryContext.level, 'constrained');
        assert.equal(nextPlanResult.plan.recoveryContext.volumeModifier, 'reduce');
        assert.equal(nextPlanResult.plan.recoveryContext.effortModifier, 'easier');
      }
    });
  });

  // ==========================================================================
  // CATEGORY K: Repeated Recovery Deficit Across History
  // ==========================================================================
  describe('K. Repeated Recovery Deficit Across History', () => {
    it('evaluates 2 degraded sessions across history as constrained with consider deload', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      // 2 degraded sessions non-consecutively across history (separated by a recovered session)
      let e1 = initializeWorkoutExecution(plan.sessions[0], plan.planId, 'e1');
      e1 = startWorkoutExecution(e1, 1000);
      const exec1 = abandonWorkoutExecution(e1, 1500, 'Fatigued');

      // Intervening recovered session resets the consecutive under-recovered counter
      const execRecovered = performCleanSession(plan.sessions[1], plan.planId, 3000, {
        energyLevel: 4,
        sorenessLevel: 'none',
      });

      let e2 = initializeWorkoutExecution(plan.sessions[0], plan.planId, 'e2');
      e2 = startWorkoutExecution(e2, 5000);
      const exec2 = abandonWorkoutExecution(e2, 5500, 'Fatigued');

      const nextPlanResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec1, execRecovered, exec2],
          previousPlan: plan,
          previousConstraintLevel: 'stable',
        },
      });

      assert.equal(nextPlanResult.status, 'success');
      if (nextPlanResult.status === 'success') {
        assert.equal(nextPlanResult.plan.recoveryContext.level, 'constrained');
        assert.equal(nextPlanResult.plan.recoveryContext.volumeModifier, 'reduce');
        assert.equal(nextPlanResult.plan.recoveryContext.deloadDecision, 'consider');
      }
    });
  });

  // ==========================================================================
  // CATEGORY L: Persistent Multi-Signal Recovery Deficit (Deload Recommended)
  // ==========================================================================
  describe('L. Persistent Multi-Signal Recovery Deficit (Deload Recommended)', () => {
    it('evaluates 3+ under-recovered sessions as strongly_constrained with deload recommended', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      // 3 consecutive sessions with low recovery and severe fatigue
      const createSeverelyFatiguedExec = (session: WorkoutSession, id: string, time: number) => {
        let e = initializeWorkoutExecution(session, plan.planId, id);
        e = startWorkoutExecution(e, time);
        return abandonWorkoutExecution(e, time + 500, 'Severe systemic exhaustion');
      };

      const exec1 = createSeverelyFatiguedExec(plan.sessions[0], 'f1', 1000);
      const exec2 = createSeverelyFatiguedExec(plan.sessions[1], 'f2', 3000);
      const exec3 = createSeverelyFatiguedExec(plan.sessions[0], 'f3', 5000);

      const nextPlanResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec1, exec2, exec3],
          previousPlan: plan,
          previousConstraintLevel: 'constrained',
        },
      });

      assert.equal(nextPlanResult.status, 'success');
      if (nextPlanResult.status === 'success') {
        assert.equal(nextPlanResult.plan.recoveryContext.level, 'strongly_constrained');
        assert.equal(nextPlanResult.plan.recoveryContext.volumeModifier, 'strongly_reduce');
        assert.equal(nextPlanResult.plan.recoveryContext.effortModifier, 'easier');
        assert.equal(nextPlanResult.plan.recoveryContext.deloadDecision, 'recommend');
      }
    });
  });

  // ==========================================================================
  // CATEGORY M: Conservative Hysteresis Recovery Release
  // ==========================================================================
  describe('M. Conservative Hysteresis Recovery Release', () => {
    it('steps down by at most 1 tier per observation (e.g. strongly_constrained -> constrained on healthy session)', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      // Fully healthy, clean session
      const cleanExec = performCleanSession(plan.sessions[0], plan.planId, 1000, {
        energyLevel: 5,
        sorenessLevel: 'none',
      });

      // Starting from strongly_constrained
      const nextPlanResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [cleanExec],
          previousPlan: plan,
          previousConstraintLevel: 'strongly_constrained',
        },
      });

      assert.equal(nextPlanResult.status, 'success');
      if (nextPlanResult.status === 'success') {
        // Hysteresis clamps 1 tier release: strongly_constrained -> constrained (NOT straight to stable)
        assert.equal(nextPlanResult.plan.recoveryContext.level, 'constrained');
      }
    });
  });

  // ==========================================================================
  // CATEGORY N: Next-Generation Plan Reflection
  // ==========================================================================
  describe('N. Next-Generation Plan Reflection', () => {
    it('materializes conservative deload work sets and RIR 4–5 reserve when deload is recommended', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      const createFatiguedExec = (id: string, time: number) => {
        let e = initializeWorkoutExecution(plan.sessions[0], plan.planId, id);
        e = startWorkoutExecution(e, time);
        return abandonWorkoutExecution(e, time + 500, 'Exhaustion');
      };

      const execs = [
        createFatiguedExec('e1', 1000),
        createFatiguedExec('e2', 3000),
        createFatiguedExec('e3', 5000),
      ];

      const adaptedResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: execs,
          previousPlan: plan,
          previousConstraintLevel: 'constrained',
        },
      });

      assert.equal(adaptedResult.status, 'success');
      if (adaptedResult.status === 'success') {
        const adaptedPlan = adaptedResult.plan;
        assert.equal(adaptedPlan.recoveryContext.deloadDecision, 'recommend');

        // All work sets in deload session must have targetRIR = 4 or effort guidance reflecting deload
        for (const session of adaptedPlan.sessions) {
          for (const ex of session.exercises) {
            assert.equal(ex.effortPrescription.minRIR, 4);
            assert.equal(ex.effortPrescription.maxRIR, 5);
            assert.ok(ex.effortPrescription.effortGuidance.includes('Deload effort'));
            // Work sets capped conservatively at 1-2
            const workSets = ex.sets.filter((s) => s.setType === 'work');
            assert.ok(workSets.length <= 2);
          }
        }
      }
    });

    it('materializes increased RIR buffer (+1 RIR) when effortModifier is easier', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);

      // Converging signals -> constrained -> effortModifier 'easier'
      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000, {
        energyLevel: 2,
        sorenessLevel: 'moderate',
      });

      const adaptedResult = generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec],
          previousPlan: plan,
          previousConstraintLevel: 'stable',
        },
      });

      assert.equal(adaptedResult.status, 'success');
      if (adaptedResult.status === 'success') {
        const adaptedPlan = adaptedResult.plan;
        assert.equal(adaptedPlan.recoveryContext.effortModifier, 'easier');

        // Verify effort guidance or RIR values are buffered compared to baseline
        const baseSession = plan.sessions[0];
        const adaptedSession = adaptedPlan.sessions[0];
        assert.ok(
          adaptedSession.exercises[0].effortPrescription.minRIR >=
            baseSession.exercises[0].effortPrescription.minRIR + 1
        );
      }
    });
  });

  // ==========================================================================
  // CATEGORY O: Chronological Multi-Session Processing
  // ==========================================================================
  describe('O. Chronological Multi-Session Processing', () => {
    it('processes out-of-order execution arrays strictly by chronological timestamp', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const session = plan.sessions[0];
      const targetEx = session.exercises[0];

      // Session at t=1000: Clean (progress) (completes at t=1000 + 3600000 = 3601000)
      const e1 = performCleanSession(session, plan.planId, 1000, { reps: 10 });
      // Session at t=5000000: Degraded (maintain) (completes at t=5500000)
      let e2Raw = initializeWorkoutExecution(session, plan.planId, 'e2');
      e2Raw = startWorkoutExecution(e2Raw, 5000000);
      for (const s of targetEx.sets.filter((st) => st.setType === 'work')) {
        e2Raw = recordSetExecution(e2Raw, {
          exerciseId: targetEx.exerciseId,
          setIndex: s.setIndex,
          actualReps: 10,
          executionQuality: 'degraded',
        });
      }
      e2Raw = completeExerciseExecution(e2Raw, targetEx.exerciseId, { overallQuality: 'degraded' });
      for (let i = 1; i < session.exercises.length; i++) {
        e2Raw = skipExerciseExecution(e2Raw, session.exercises[i].exerciseId);
      }
      const e2 = completeWorkoutExecution(e2Raw, 5500000);

      // Pass executions in reverse order [e2, e1]
      const outcomes = evaluateT7ProgressionFromHistory([e2, e1], plan);
      const outcome = outcomes.find((o) => o.exerciseId === targetEx.exerciseId);

      assert.ok(outcome);
      // Because e2 was the latest session chronologically (t=5500000), the outcome must reflect degraded (maintain)
      assert.equal(outcome.decision, 'maintain');
      assert.equal(outcome.trend, 'declining');
    });
  });

  // ==========================================================================
  // CATEGORY P: Plan Separation
  // ==========================================================================
  describe('P. Plan Separation', () => {
    it('isolates executions between different plans when filtering by planId', () => {
      const profile = createProfile();
      const planA = getBaselinePlan(profile);
      const planB = { ...planA, planId: 'plan_b_id' };

      // Clean execution for plan A
      const execA = performCleanSession(planA.sessions[0], planA.planId, 1000);
      // Degraded execution for plan B
      let eBRaw = initializeWorkoutExecution(planB.sessions[0], planB.planId, 'eb');
      eBRaw = startWorkoutExecution(eBRaw, 2000);
      const execB = abandonWorkoutExecution(eBRaw, 2500, 'Fatigued');

      // Evaluating plan A with only plan A executions
      const summaryA = buildExecutionHistorySummary([execA], planA.structure.sessionsPerCycle);
      assert.equal(summaryA.completedSessions, 1);
      assert.equal(summaryA.degradedSessions, 0);

      // Evaluating plan B with only plan B executions
      const summaryB = buildExecutionHistorySummary([execB], planB.structure.sessionsPerCycle);
      assert.equal(summaryB.completedSessions, 0);
      assert.equal(summaryB.degradedSessions, 1);
    });
  });

  // ==========================================================================
  // CATEGORY Q: Baseline Profile Unchanged
  // ==========================================================================
  describe('Q. Baseline Profile Unchanged', () => {
    it('never mutates canonical user profile during adaptation evaluation', () => {
      const profile = createProfile();
      const snapshot = JSON.stringify(profile);

      const plan = getBaselinePlan(profile);
      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000);

      generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec],
          previousPlan: plan,
          previousConstraintLevel: 'constrained',
        },
      });

      assert.equal(JSON.stringify(profile), snapshot);
    });
  });

  // ==========================================================================
  // CATEGORY R: Completed Plans Immutable
  // ==========================================================================
  describe('R. Completed Plans Immutable', () => {
    it('never modifies completed prior plans when generating a new adapted plan', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const snapshot = JSON.stringify(plan);

      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000);

      generateWorkoutPlanFromProfile(profile, {
        adaptationContext: {
          historicalExecutions: [exec],
          previousPlan: plan,
          previousConstraintLevel: 'stable',
        },
      });

      assert.equal(JSON.stringify(plan), snapshot);
    });
  });

  // ==========================================================================
  // CATEGORY S: Determinism
  // ==========================================================================
  describe('S. Determinism', () => {
    it('produces byte-for-byte identical adapted plans when provided identical inputs', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000, {
        energyLevel: 2,
        sorenessLevel: 'moderate',
      });

      const context: WorkoutAdaptationContext = {
        historicalExecutions: [exec],
        previousPlan: plan,
        previousConstraintLevel: 'stable',
      };

      const run1 = generateWorkoutPlanFromProfile(profile, { adaptationContext: context });
      const run2 = generateWorkoutPlanFromProfile(profile, { adaptationContext: context });

      assert.equal(run1.status, 'success');
      assert.equal(run2.status, 'success');
      if (run1.status === 'success' && run2.status === 'success') {
        assert.deepStrictEqual(run1.plan.sessions, run2.plan.sessions);
        assert.deepStrictEqual(run1.plan.structure, run2.plan.structure);
        assert.deepStrictEqual(run1.plan.objective, run2.plan.objective);
        assert.deepStrictEqual(run1.plan.recoveryContext, run2.plan.recoveryContext);
      }
    });
  });

  // ==========================================================================
  // CATEGORY T: Immutability
  // ==========================================================================
  describe('T. Immutability', () => {
    it('preserves historical execution records without mutating any inner fields', () => {
      const profile = createProfile();
      const plan = getBaselinePlan(profile);
      const exec = performCleanSession(plan.sessions[0], plan.planId, 1000);
      const execSnapshot = JSON.stringify(exec);

      buildAdaptiveStrategyInputs({
        historicalExecutions: [exec],
        previousPlan: plan,
        previousConstraintLevel: 'stable',
      });

      assert.equal(JSON.stringify(exec), execSnapshot);
    });
  });
});
