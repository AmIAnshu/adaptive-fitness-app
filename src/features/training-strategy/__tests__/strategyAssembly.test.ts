/**
 * Stage T10 — Strategy Assembly Test Suite
 *
 * Verifies pure, deterministic assembly of stages T1–T9 into TrainingStrategy (v1).
 *
 * TEST COVERAGE:
 * A. Basic Adult Assembly
 * B. Field Preservation (T1–T9 outputs preserved without data loss)
 * C. Determinism (identical inputs produce identical results)
 * D. Immutability (input profile and stage outputs are not mutated)
 * E. Recovery Constraints Integration (stable, constrained, strongly_constrained, deload, modifiers)
 * F. Population Boundaries (youth & ineligible never produce adult TrainingStrategy)
 * G. Explainability & Transparent Decision Tracing
 * H. Strategy Validation (validateTrainingStrategy behavior and error reporting)
 * I. Safety & Architectural Boundaries (no workouts, sets, reps, loads, weekdays, calories, readiness scores)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { runStrategyPipeline } from '../strategyPipeline';
import {
  assembleTrainingStrategy,
  validateTrainingStrategy,
} from '../strategyAssembly';
import { resolveTrainingObjective } from '../goalResolution';
import { resolveFrequency } from '../frequencyResolution';
import { resolveTrainingStructure } from '../trainingStructure';
import { resolveTrainingLoad } from '../trainingLoad';
import { resolveExerciseSelection } from '../exerciseSelection';
import { resolveTrainingDemand } from '../trainingDemand';
import { resolveProgressionStrategy } from '../progressionStrategy';
import { resolveConditioningStrategy } from '../conditioningStrategy';
import { resolveRecoveryConstraints } from '../recoveryConstraints';
import type { RecoveryRuntimeState } from '../types';

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

describe('Stage T10 — Strategy Assembly', () => {
  // ==================================================
  // Category A: Basic Adult Assembly
  // ==================================================
  describe('A. Basic Adult Assembly', () => {
    it('A.1. Valid adult profile produces complete TrainingStrategy (v1) via pipeline', () => {
      const profile = createProfile({ age: 26, heightCm: 165, weightKg: 62 });
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      assert.equal(pipelineResult.path, 'adult_strategy');
      if (pipelineResult.status === 'completed') {
        const { strategy } = pipelineResult;
        assert.ok(strategy, 'strategy object must be present on completed adult pipeline result');
        assert.equal(strategy.schemaVersion, 1);
        assert.equal(strategy.population, 'adult');
        assert.ok(strategy.objective);
        assert.ok(strategy.frequency);
        assert.ok(strategy.structure);
        assert.ok(strategy.trainingLoad);
        assert.ok(strategy.exerciseSelection);
        assert.ok(strategy.trainingDemand);
        assert.ok(strategy.progression);
        assert.ok(strategy.conditioning);
        assert.ok(strategy.recoveryConstraints);
        assert.ok(Array.isArray(strategy.decisionTrace));
        assert.ok(strategy.decisionTrace.length > 0);
      }
    });

    it('A.2. Direct invocation of assembleTrainingStrategy produces coherent TrainingStrategy', () => {
      const profile = createProfile();
      const objective = resolveTrainingObjective(profile);
      const frequency = resolveFrequency(profile);
      const structure = resolveTrainingStructure(profile, objective, frequency);
      const trainingLoad = resolveTrainingLoad(profile, objective, frequency, structure);
      const exerciseSelection = resolveExerciseSelection(profile, objective, structure);
      const trainingDemand = resolveTrainingDemand(profile, objective, frequency, structure, trainingLoad, exerciseSelection);
      const progression = resolveProgressionStrategy(profile, objective, structure, trainingLoad, trainingDemand);
      const conditioning = resolveConditioningStrategy(profile, objective, frequency, structure, trainingLoad, trainingDemand, progression);
      const recoveryConstraints = resolveRecoveryConstraints(profile, objective, structure, trainingLoad, trainingDemand, progression, conditioning);

      const strategy = assembleTrainingStrategy({
        objective,
        frequency,
        structure,
        trainingLoad,
        exerciseSelection,
        trainingDemand,
        progression,
        conditioning,
        recoveryConstraints,
        decisionTrace: ['Initial pipeline trace'],
      });

      assert.equal(strategy.schemaVersion, 1);
      assert.equal(strategy.population, 'adult');
      assert.equal(strategy.objective.primary, 'hypertrophy');
      assert.equal(strategy.frequency.targetDays, 4);
      assert.equal(strategy.structure.splitFamily, 'upper_lower');
      assert.equal(strategy.trainingLoad.startingVolume, 'moderate');
      assert.ok(strategy.exerciseSelection.candidates.length > 0);
      assert.equal(strategy.trainingDemand.targetSessions, 4);
      assert.equal(strategy.progression.method, 'double_progression');
      assert.equal(strategy.conditioning.demand, 'minimal');
      assert.equal(strategy.recoveryConstraints.level, 'stable');
      assert.ok(strategy.decisionTrace.some((t) => t.includes('T10 Strategy Assembly')));
    });
  });

  // ==================================================
  // Category B: Field Preservation (T1–T9)
  // ==================================================
  describe('B. Field Preservation (T1–T9)', () => {
    it('B.1. All T1–T9 stage outputs are preserved without loss of detail', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const { strategy } = pipelineResult;

        // T1
        assert.equal(strategy.objective, pipelineResult.objective);
        assert.equal(strategy.objective.primary, 'hypertrophy');
        assert.equal(strategy.objective.source, 'explicit');

        // T2
        assert.equal(strategy.frequency, pipelineResult.frequency);
        assert.equal(strategy.frequency.targetDays, 4);
        assert.equal(strategy.frequency.structureMode, 'hybrid');

        // T3
        assert.equal(strategy.structure, pipelineResult.structure);
        assert.equal(strategy.structure.splitFamily, 'upper_lower');
        assert.equal(strategy.structure.programmingComplexity, 'standard');

        // T4
        assert.equal(strategy.trainingLoad, pipelineResult.trainingLoad);
        assert.equal(strategy.trainingLoad.startingVolume, 'moderate');
        assert.ok(strategy.trainingLoad.effort.minRIR <= strategy.trainingLoad.effort.maxRIR);

        // T5
        assert.equal(strategy.exerciseSelection, pipelineResult.exerciseSelection);
        assert.ok(strategy.exerciseSelection.candidates.length > 0);

        // T6
        assert.equal(strategy.trainingDemand, pipelineResult.trainingDemand);
        assert.equal(strategy.trainingDemand.sessions.length, 4);
        assert.ok(strategy.trainingDemand.sessions[0].allocatedExercises.length > 0);
        assert.ok(strategy.trainingDemand.demandLevels.chest);

        // T7
        assert.equal(strategy.progression, pipelineResult.progression);
        assert.equal(strategy.progression.method, 'double_progression');
        assert.ok(strategy.progression.exerciseProgressionPlans.length > 0);

        // T8
        assert.equal(strategy.conditioning, pipelineResult.conditioning);
        assert.equal(strategy.conditioning.interferenceConsiderations.resistanceProtection, 'high');

        // T9
        assert.equal(strategy.recoveryConstraints, pipelineResult.recoveryConstraints);
        assert.equal(strategy.recoveryConstraints.level, 'stable');
      }
    });

    it('B.2. Top-level stage fields on AdultStrategyPipelineResult remain backward compatible', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        // Direct property access matches strategy sub-properties exactly
        assert.strictEqual(pipelineResult.objective, pipelineResult.strategy.objective);
        assert.strictEqual(pipelineResult.frequency, pipelineResult.strategy.frequency);
        assert.strictEqual(pipelineResult.structure, pipelineResult.strategy.structure);
        assert.strictEqual(pipelineResult.trainingLoad, pipelineResult.strategy.trainingLoad);
        assert.strictEqual(pipelineResult.exerciseSelection, pipelineResult.strategy.exerciseSelection);
        assert.strictEqual(pipelineResult.trainingDemand, pipelineResult.strategy.trainingDemand);
        assert.strictEqual(pipelineResult.progression, pipelineResult.strategy.progression);
        assert.strictEqual(pipelineResult.conditioning, pipelineResult.strategy.conditioning);
        assert.strictEqual(pipelineResult.recoveryConstraints, pipelineResult.strategy.recoveryConstraints);
      }
    });
  });

  // ==================================================
  // Category C: Determinism
  // ==================================================
  describe('C. Determinism', () => {
    it('C.1. Same input profile produces strictly identical assembled TrainingStrategy', () => {
      const profile1 = createProfile();
      const profile2 = createProfile();

      const res1 = runStrategyPipeline(profile1);
      const res2 = runStrategyPipeline(profile2);

      assert.equal(res1.status, 'completed');
      assert.equal(res2.status, 'completed');
      if (res1.status === 'completed' && res2.status === 'completed') {
        assert.deepEqual(res1.strategy, res2.strategy);
      }
    });

    it('C.2. Same direct assembleTrainingStrategy inputs produce strictly identical outputs', () => {
      const profile = createProfile();
      const objective = resolveTrainingObjective(profile);
      const frequency = resolveFrequency(profile);
      const structure = resolveTrainingStructure(profile, objective, frequency);
      const trainingLoad = resolveTrainingLoad(profile, objective, frequency, structure);
      const exerciseSelection = resolveExerciseSelection(profile, objective, structure);
      const trainingDemand = resolveTrainingDemand(profile, objective, frequency, structure, trainingLoad, exerciseSelection);
      const progression = resolveProgressionStrategy(profile, objective, structure, trainingLoad, trainingDemand);
      const conditioning = resolveConditioningStrategy(profile, objective, frequency, structure, trainingLoad, trainingDemand, progression);
      const recoveryConstraints = resolveRecoveryConstraints(profile, objective, structure, trainingLoad, trainingDemand, progression, conditioning);

      const input = {
        objective,
        frequency,
        structure,
        trainingLoad,
        exerciseSelection,
        trainingDemand,
        progression,
        conditioning,
        recoveryConstraints,
        decisionTrace: ['trace1', 'trace2'],
      };

      const strat1 = assembleTrainingStrategy(input);
      const strat2 = assembleTrainingStrategy(input);

      assert.deepEqual(strat1, strat2);
    });
  });

  // ==================================================
  // Category D: Immutability
  // ==================================================
  describe('D. Immutability', () => {
    it('D.1. User profile is not mutated during assembly', () => {
      const profile = createProfile();
      const snapshot = JSON.parse(JSON.stringify(profile));

      runStrategyPipeline(profile);

      assert.deepEqual(profile, snapshot);
    });

    it('D.2. Stage input objects are not mutated by assembleTrainingStrategy', () => {
      const profile = createProfile();
      const objective = resolveTrainingObjective(profile);
      const frequency = resolveFrequency(profile);
      const structure = resolveTrainingStructure(profile, objective, frequency);
      const trainingLoad = resolveTrainingLoad(profile, objective, frequency, structure);
      const exerciseSelection = resolveExerciseSelection(profile, objective, structure);
      const trainingDemand = resolveTrainingDemand(profile, objective, frequency, structure, trainingLoad, exerciseSelection);
      const progression = resolveProgressionStrategy(profile, objective, structure, trainingLoad, trainingDemand);
      const conditioning = resolveConditioningStrategy(profile, objective, frequency, structure, trainingLoad, trainingDemand, progression);
      const recoveryConstraints = resolveRecoveryConstraints(profile, objective, structure, trainingLoad, trainingDemand, progression, conditioning);

      const objSnapshot = JSON.parse(JSON.stringify(objective));
      const freqSnapshot = JSON.parse(JSON.stringify(frequency));
      const structSnapshot = JSON.parse(JSON.stringify(structure));
      const loadSnapshot = JSON.parse(JSON.stringify(trainingLoad));
      const demandSnapshot = JSON.parse(JSON.stringify(trainingDemand));
      const recSnapshot = JSON.parse(JSON.stringify(recoveryConstraints));

      assembleTrainingStrategy({
        objective,
        frequency,
        structure,
        trainingLoad,
        exerciseSelection,
        trainingDemand,
        progression,
        conditioning,
        recoveryConstraints,
      });

      assert.deepEqual(objective, objSnapshot);
      assert.deepEqual(frequency, freqSnapshot);
      assert.deepEqual(structure, structSnapshot);
      assert.deepEqual(trainingLoad, loadSnapshot);
      assert.deepEqual(trainingDemand, demandSnapshot);
      assert.deepEqual(recoveryConstraints, recSnapshot);
    });
  });

  // ==================================================
  // Category E: Recovery Constraints Integration
  // ==================================================
  describe('E. Recovery Constraints Integration', () => {
    it('E.1. Stable recovery constraints assemble cleanly with maintain modifiers', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const { recoveryConstraints } = pipelineResult.strategy;
        assert.equal(recoveryConstraints.level, 'stable');
        assert.equal(recoveryConstraints.volumeModifier, 'maintain');
        assert.equal(recoveryConstraints.effortModifier, 'maintain');
        assert.equal(recoveryConstraints.conditioningModifier, 'maintain');
        assert.equal(recoveryConstraints.frequencyModifier, 'maintain');
        assert.equal(recoveryConstraints.deloadDecision, 'none');
      }
    });

    it('E.2. Constrained runtime recovery state preserves reduce modifiers in strategy', () => {
      const profile = createProfile();
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: '5_to_6',
        stressLevel: 4,
      };

      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const { recoveryConstraints, trainingLoad, conditioning } = pipelineResult.strategy;
        assert.equal(recoveryConstraints.level, 'constrained');
        assert.equal(recoveryConstraints.volumeModifier, 'reduce');
        assert.equal(recoveryConstraints.effortModifier, 'easier');
        assert.equal(recoveryConstraints.conditioningModifier, 'omit');

        // T4 baseline starting volume and T8 baseline conditioning demand remain intact
        assert.equal(trainingLoad.startingVolume, 'moderate');
        assert.equal(conditioning.demand, 'minimal');
      }
    });

    it('E.3. Strongly constrained state with recommended deload preserves exact qualitative modifiers', () => {
      const profile = createProfile();
      const runtimeState: RecoveryRuntimeState = {
        sleepDuration: 'under_5',
        sleepQuality: 1,
        stressLevel: 5,
        energyLevel: 1,
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };

      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const { recoveryConstraints } = pipelineResult.strategy;
        assert.equal(recoveryConstraints.level, 'strongly_constrained');
        assert.equal(recoveryConstraints.volumeModifier, 'strongly_reduce');
        assert.equal(recoveryConstraints.effortModifier, 'easier');
        assert.equal(recoveryConstraints.conditioningModifier, 'omit');
        assert.equal(recoveryConstraints.frequencyModifier, 'reduce');
        assert.equal(recoveryConstraints.deloadDecision, 'recommend');
      }
    });

    it('E.4. Assembly does not invent arbitrary numeric percentage reductions for volume or RIR', () => {
      const profile = createProfile();
      const runtimeState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 3,
      };
      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const rawRec = pipelineResult.strategy.recoveryConstraints as Record<string, unknown>;
        assert.equal('volumeReductionPercent' in rawRec, false);
        assert.equal('rirOffset' in rawRec, false);
        assert.equal('setCountReduction' in rawRec, false);
      }
    });
  });

  // ==================================================
  // Category F: Population Boundaries & Route Protection
  // ==================================================
  describe('F. Population Boundaries & Route Protection', () => {
    it('F.1. Youth profile (age 13-17) strictly stops at youth_strategy_pending and never assembles TrainingStrategy', () => {
      const youthAges = [13, 14, 15, 16, 17];
      for (const age of youthAges) {
        const youthProfile = createProfile({ age, heightCm: 160, weightKg: 52 });
        const result = runStrategyPipeline(youthProfile);

        assert.equal(result.status, 'pending');
        assert.equal(result.path, 'youth_strategy_pending');

        const raw = result as Record<string, unknown>;
        assert.equal('strategy' in raw, false, `Youth age ${age} must not produce a strategy property`);
        assert.equal('objective' in raw, false);
        assert.equal('recoveryConstraints' in raw, false);
        assert.ok(result.decisionTrace.some((t) => t.includes('Adult T10 (Strategy Assembly) SKIPPED')));
      }
    });

    it('F.2. Ineligible profile (age <13 or >100) strictly blocks and never assembles TrainingStrategy', () => {
      const ineligibleAges = [10, 12, 101, 105];
      for (const age of ineligibleAges) {
        const ineligibleProfile = createProfile({ age, heightCm: 150, weightKg: 45 });
        const result = runStrategyPipeline(ineligibleProfile);

        assert.equal(result.status, 'ineligible');
        assert.equal(result.path, 'ineligible');

        const raw = result as Record<string, unknown>;
        assert.equal('strategy' in raw, false, `Ineligible age ${age} must not produce a strategy property`);
        assert.equal('trainingDemand' in raw, false);
      }
    });

    it('F.3. Adult boundary edge cases (ages 18 and 100) assemble valid adult TrainingStrategy', () => {
      const profile18 = createProfile({ age: 18, heightCm: 165, weightKg: 58 });
      const res18 = runStrategyPipeline(profile18);
      assert.equal(res18.status, 'completed');
      if (res18.status === 'completed') {
        assert.equal(res18.strategy.population, 'adult');
      }

      const profile100 = createProfile({ age: 100, heightCm: 170, weightKg: 65 });
      const res100 = runStrategyPipeline(profile100);
      assert.equal(res100.status, 'completed');
      if (res100.status === 'completed') {
        assert.equal(res100.strategy.population, 'adult');
      }
    });
  });

  // ==================================================
  // Category G: Explainability & Decision Traces
  // ==================================================
  describe('G. Explainability & Decision Traces', () => {
    it('G.1. Final TrainingStrategy contains non-empty deterministic decision trace with all stage traces', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const { decisionTrace } = pipelineResult.strategy;
        assert.ok(Array.isArray(decisionTrace));
        assert.ok(decisionTrace.length >= 10);

        // Verify traces from T1 through T10 exist
        assert.ok(decisionTrace.some((t) => t.includes('T1 Primary Objective')));
        assert.ok(decisionTrace.some((t) => t.includes('T2 Target Frequency')));
        assert.ok(decisionTrace.some((t) => t.includes('T3 Structure')));
        assert.ok(decisionTrace.some((t) => t.includes('T4 Starting Load')));
        assert.ok(decisionTrace.some((t) => t.includes('T5 Eligible Candidates')));
        assert.ok(decisionTrace.some((t) => t.includes('T6 Session Demand Allocations')));
        assert.ok(decisionTrace.some((t) => t.includes('T7 Progression Method')));
        assert.ok(decisionTrace.some((t) => t.includes('T8 Conditioning')));
        assert.ok(decisionTrace.some((t) => t.includes('T9 Recovery Constraints')));
        assert.ok(decisionTrace.some((t) => t.includes('T10 Strategy Assembly')));
      }
    });

    it('G.2. Every decision trace item is a non-empty string', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        for (const item of pipelineResult.strategy.decisionTrace) {
          assert.equal(typeof item, 'string');
          assert.ok(item.trim().length > 0);
        }
      }
    });
  });

  // ==================================================
  // Category H: Strategy Validation
  // ==================================================
  describe('H. Strategy Validation (validateTrainingStrategy)', () => {
    it('H.1. Valid assembled strategy passes validation with zero errors', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const validation = validateTrainingStrategy(pipelineResult.strategy);
        assert.equal(validation.valid, true);
        assert.equal(validation.errors.length, 0);
      }
    });

    it('H.2. Validation rejects non-object or null input', () => {
      const vNull = validateTrainingStrategy(null);
      assert.equal(vNull.valid, false);
      assert.ok(vNull.errors.length > 0);

      const vStr = validateTrainingStrategy('not a strategy');
      assert.equal(vStr.valid, false);
    });

    it('H.3. Validation detects invalid schemaVersion or population', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      if (pipelineResult.status === 'completed') {
        const corrupted = {
          ...pipelineResult.strategy,
          schemaVersion: 2,
          population: 'youth',
        };
        const validation = validateTrainingStrategy(corrupted);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some((e) => e.includes('schemaVersion')));
        assert.ok(validation.errors.some((e) => e.includes('population')));
      }
    });

    it('H.4. Validation detects missing required stage components', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      if (pipelineResult.status === 'completed') {
        const corrupted = {
          ...pipelineResult.strategy,
          recoveryConstraints: undefined,
          trainingDemand: undefined,
        };
        const validation = validateTrainingStrategy(corrupted);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some((e) => e.includes('recoveryConstraints')));
        assert.ok(validation.errors.some((e) => e.includes('trainingDemand')));
      }
    });

    it('H.5. Validation detects empty decisionTrace', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      if (pipelineResult.status === 'completed') {
        const corrupted = {
          ...pipelineResult.strategy,
          decisionTrace: [],
        };
        const validation = validateTrainingStrategy(corrupted);
        assert.equal(validation.valid, false);
        assert.ok(validation.errors.some((e) => e.includes('decisionTrace')));
      }
    });

    it('H.6. Validation produces warning when strongly constrained and deload recommended', () => {
      const profile = createProfile();
      const runtimeState: RecoveryRuntimeState = {
        consecutiveUnderRecoveredSessions: 3,
        accumulatedFatigueCycles: 2,
      };
      const pipelineResult = runStrategyPipeline(profile, undefined, runtimeState);

      if (pipelineResult.status === 'completed') {
        const validation = validateTrainingStrategy(pipelineResult.strategy);
        assert.equal(validation.valid, true);
        assert.ok(validation.warnings.some((w) => w.includes('strongly constrained')));
      }
    });

    it('H.7. assembleTrainingStrategy throws when missing mandatory stage components', () => {
      assert.throws(() => {
        assembleTrainingStrategy({} as any);
      }, /objective \(T1\) is required/);
    });
  });

  // ==================================================
  // Category I: Safety & Architectural Boundaries
  // ==================================================
  describe('I. Safety & Architectural Boundaries', () => {
    it('I.1. TrainingStrategy contains NO final workouts, sets, reps, load values, or weekdays', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const raw = pipelineResult.strategy as Record<string, unknown>;
        assert.equal('workouts' in raw, false);
        assert.equal('workoutPlan' in raw, false);
        assert.equal('calendar' in raw, false);
        assert.equal('weekdayAssignments' in raw, false);
        assert.equal('sets' in raw, false);
        assert.equal('reps' in raw, false);
        assert.equal('weightPrescriptions' in raw, false);
      }
    });

    it('I.2. TrainingStrategy contains NO calories, macros, or meal planning', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const raw = pipelineResult.strategy as Record<string, unknown>;
        assert.equal('calories' in raw, false);
        assert.equal('macros' in raw, false);
        assert.equal('proteinGrams' in raw, false);
        assert.equal('mealPlan' in raw, false);
      }
    });

    it('I.3. TrainingStrategy contains NO numeric readiness or recovery score', () => {
      const profile = createProfile();
      const pipelineResult = runStrategyPipeline(profile);

      assert.equal(pipelineResult.status, 'completed');
      if (pipelineResult.status === 'completed') {
        const raw = pipelineResult.strategy as Record<string, unknown>;
        assert.equal('recoveryScore' in raw, false);
        assert.equal('readinessScore' in raw, false);
        assert.equal('dailyReadiness' in raw, false);
      }
    });
  });
});
