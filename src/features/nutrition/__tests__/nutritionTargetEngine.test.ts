/**
 * Quantitative Nutrition Target Engine Unit Tests (Stage W7.2)
 *
 * Exhaustive domain testing for BMR, TDEE, goal-adjusted energy ranges,
 * macronutrient partitioning, dietary constraints, and population boundaries.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateQuantitativeReadiness,
  calculateBasalMetabolicRate,
  calculateActivityMultiplier,
  calculateGoalAdjustment,
  calculateEnergyTargetRange,
  calculateMacronutrientTargets,
  calculateNutritionTargets,
} from '../nutritionTargetEngine';
import { validateNutritionTargets } from '../nutritionTargetValidation';
import { runNutritionStrategyPipeline } from '../nutritionStrategy';
import { buildCanonicalUserProfile } from '../../profile';
import { QA_PERSONAS } from '../../../qa/personas';
import type { CanonicalUserProfile } from '../../profile';

describe('Quantitative Nutrition Target Engine (Stage W7.2)', () => {
  const getProfile = (overrides: Partial<any> = {}): CanonicalUserProfile => {
    return buildCanonicalUserProfile({
      ...QA_PERSONAS.PERSONA_A_BASELINE,
      ...overrides,
    });
  };

  // 1. Biological Sex Input Readiness
  describe('Biological Sex & Readiness Evaluation', () => {
    it('returns ready when biological sex is male', () => {
      const profile = getProfile({ biologicalSex: 'male' });
      const readiness = evaluateQuantitativeReadiness(profile);
      assert.equal(readiness.status, 'ready');
      assert.equal(readiness.canCalculateCalories, true);
      assert.equal(readiness.canCalculateMacros, true);
      assert.equal(readiness.canCalculateTDEE, true);
      assert.equal(readiness.method, 'mifflin_st_jeor');
    });

    it('returns ready when biological sex is female', () => {
      const profile = getProfile({ biologicalSex: 'female' });
      const readiness = evaluateQuantitativeReadiness(profile);
      assert.equal(readiness.status, 'ready');
      assert.equal(readiness.canCalculateCalories, true);
    });

    it('returns pending_required_inputs when biological sex is absent', () => {
      const profile = getProfile(); // no biologicalSex
      const readiness = evaluateQuantitativeReadiness(profile);
      assert.equal(readiness.status, 'pending_required_inputs');
      assert.equal(readiness.canCalculateCalories, false);
      assert.equal(readiness.canCalculateMacros, false);
      assert.equal(readiness.canCalculateTDEE, false);
      assert.ok(readiness.missingInputs.includes('biological_sex'));
    });

    it('returns pending_required_inputs when biological sex is prefer_not_to_say', () => {
      const profile = getProfile({ biologicalSex: 'prefer_not_to_say' });
      const readiness = evaluateQuantitativeReadiness(profile);
      assert.equal(readiness.status, 'pending_required_inputs');
      assert.equal(readiness.canCalculateCalories, false);
      assert.ok(readiness.missingInputs.includes('biological_sex'));
    });

    it('holds youth trainees at pending_required_inputs regardless of sex', () => {
      const profile = getProfile({ age: 15, biologicalSex: 'male' });
      const readiness = evaluateQuantitativeReadiness(profile);
      assert.equal(readiness.status, 'pending_required_inputs');
      assert.equal(readiness.canCalculateCalories, false);
    });

    it('blocks ineligible trainees at boundary', () => {
      const profile = getProfile({ age: 11, biologicalSex: 'male' });
      const readiness = evaluateQuantitativeReadiness(profile);
      assert.equal(readiness.status, 'ineligible');
      assert.equal(readiness.canCalculateCalories, false);
    });
  });

  // 2. Basal Metabolic Rate (Mifflin-St Jeor)
  describe('Basal Metabolic Rate Calculation', () => {
    it('computes exact BMR for 28yo male, 180cm, 80kg', () => {
      // 10*80 + 6.25*180 - 5*28 + 5 = 800 + 1125 - 140 + 5 = 1790
      const { bmrKcal } = calculateBasalMetabolicRate(80, 180, 28, 'male');
      assert.equal(bmrKcal, 1790);
    });

    it('computes exact BMR for 28yo female, 165cm, 60kg', () => {
      // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 -> 1330
      const { bmrKcal } = calculateBasalMetabolicRate(60, 165, 28, 'female');
      assert.equal(bmrKcal, 1330);
    });
  });

  // 3. Activity Multiplier & TDEE
  describe('Activity Multipliers', () => {
    it('applies baseline moderate activity multiplier with training schedule adjustment', () => {
      const profile = getProfile({ dailyActivity: 'moderate', idealTrainingDays: 3 });
      const { multiplier } = calculateActivityMultiplier(profile);
      assert.equal(multiplier, 1.55);
    });

    it('applies higher multiplier for 5 training days', () => {
      const profile = getProfile({ dailyActivity: 'moderate', idealTrainingDays: 5 });
      const { multiplier } = calculateActivityMultiplier(profile);
      // 1.55 + (5 - 3) * 0.025 = 1.60
      assert.equal(multiplier, 1.6);
    });

    it('applies reduction for <= 2 training days', () => {
      const profile = getProfile({ dailyActivity: 'mostly_sedentary', idealTrainingDays: 2 });
      const { multiplier } = calculateActivityMultiplier(profile);
      // 1.20 - 0.025 = 1.175
      assert.equal(multiplier, 1.175);
    });
  });

  // 4. Goal Energy Adjustment
  describe('Goal Energy Adjustments', () => {
    it('applies surplus for muscle_gain_support', () => {
      const { adjustmentKcal } = calculateGoalAdjustment(2500, 'muscle_gain_support');
      assert.ok(adjustmentKcal >= 200 && adjustmentKcal <= 350);
      assert.equal(adjustmentKcal % 25, 0);
    });

    it('applies deficit for fat_loss_support', () => {
      const { adjustmentKcal } = calculateGoalAdjustment(2500, 'fat_loss_support');
      assert.ok(adjustmentKcal <= -300 && adjustmentKcal >= -500);
      assert.equal(Math.abs(adjustmentKcal) % 25, 0);
    });

    it('applies 0 adjustment for general_health_support', () => {
      const { adjustmentKcal } = calculateGoalAdjustment(2500, 'general_health_support');
      assert.equal(adjustmentKcal, 0);
    });
  });

  // 5. Energy Target Range
  describe('Energy Target Range & Safety Floors', () => {
    it('creates bounded target range without false precision', () => {
      const { targetRange, midpointKcal } = calculateEnergyTargetRange(2500, 250, 'male');
      assert.equal(midpointKcal, 2750);
      assert.equal(targetRange.minKcal, 2650);
      assert.equal(targetRange.maxKcal, 2850);
      assert.equal(targetRange.midpointKcal, 2750);
    });

    it('enforces male safety floor of 1500 kcal', () => {
      const { midpointKcal, targetRange } = calculateEnergyTargetRange(1600, -500, 'male');
      assert.ok(midpointKcal >= 1500);
      assert.ok(targetRange.midpointKcal >= 1500);
    });

    it('enforces female safety floor of 1200 kcal', () => {
      const { midpointKcal, targetRange } = calculateEnergyTargetRange(1300, -400, 'female');
      assert.ok(midpointKcal >= 1200);
      assert.ok(targetRange.midpointKcal >= 1200);
    });
  });

  // 6. Macronutrient Partitioning
  describe('Macronutrient Partitioning & Hard Constraints', () => {
    it('computes rounded macros with fat floor >= 45g', () => {
      const { macros } = calculateMacronutrientTargets(
        80,
        2750,
        'muscle_gain_support',
        'non_vegetarian',
        ['none']
      );

      assert.equal(macros.protein.targetGrams % 5, 0);
      assert.equal(macros.fat.targetGrams % 5, 0);
      assert.equal(macros.carbohydrates.targetGrams % 5, 0);
      assert.ok(macros.fat.targetGrams >= 45);
      assert.ok(macros.protein.targetGrams >= 160);

      // Energy balance verification
      const diff = Math.abs(macros.totalCalculatedCalories - 2750);
      assert.ok(diff <= 2750 * 0.05, `Macro calories (${macros.totalCalculatedCalories}) must be within 5% of target (2750)`);
    });

    it('applies vegan bioavailability compensation', () => {
      const nonVeg = calculateMacronutrientTargets(
        70,
        2400,
        'muscle_gain_support',
        'non_vegetarian',
        ['none']
      );
      const vegan = calculateMacronutrientTargets(
        70,
        2400,
        'muscle_gain_support',
        'vegan',
        ['nuts']
      );

      assert.ok(vegan.macros.protein.targetGrams >= nonVeg.macros.protein.targetGrams);
      assert.ok(vegan.hardConstraints.some((c) => c.includes('Vegan protein bioavailability')));
      assert.ok(vegan.hardConstraints.some((c) => c.includes('Nut-free')));
    });
  });

  // 7. Full Orchestration & Validation
  describe('Full Pipeline Orchestration & Validation', () => {
    it('produces valid deeply frozen NutritionTargets for ready male profile', () => {
      const profile = getProfile({ biologicalSex: 'male' });
      const strategyResult = runNutritionStrategyPipeline(profile);
      assert.equal(strategyResult.status, 'completed');
      if (strategyResult.status === 'completed') {
        assert.equal(strategyResult.strategy.quantitativeReadiness.status, 'ready');
        assert.ok(strategyResult.strategy.targets);

        const targets = strategyResult.strategy.targets!;
        assert.equal(targets.schemaVersion, 1);
        assert.equal(targets.population, 'adult');
        assert.equal(targets.status, 'ready');

        // Validation pass
        const validation = validateNutritionTargets(targets);
        assert.equal(validation.valid, true, `Validation errors: ${JSON.stringify(validation.errors)}`);
        assert.equal(validation.errors.length, 0);

        // Immutability pass
        assert.ok(Object.isFrozen(targets));
        assert.ok(Object.isFrozen(targets.energy));
        assert.ok(Object.isFrozen(targets.macronutrients));
      }
    });

    it('leaves targets pending when biological sex is unstated', () => {
      const profile = getProfile(); // unstated sex
      const strategyResult = runNutritionStrategyPipeline(profile);
      assert.equal(strategyResult.status, 'completed');
      if (strategyResult.status === 'completed') {
        assert.equal(strategyResult.strategy.quantitativeReadiness.status, 'pending_required_inputs');
        assert.equal(strategyResult.strategy.targets, undefined);
        assert.equal(strategyResult.strategy.quantitativeReadiness.canCalculateCalories, false);
      }
    });

    it('rejects tampered targets in validateNutritionTargets', () => {
      const profile = getProfile({ biologicalSex: 'male' });
      const res = calculateNutritionTargets(profile, {
        schemaVersion: 1,
        population: 'adult',
        objective: { primary: 'muscle_gain_support' } as any,
        dietCompatibility: { dietType: 'non_vegetarian' } as any,
        mealStructure: {} as any,
        foodPreferences: {} as any,
        planningMode: 'flexible_meal_framework',
        quantitativeReadiness: { status: 'ready' } as any,
        coachingContext: {} as any,
        decisionTrace: [],
      });

      assert.equal(res.status, 'ready');
      if (res.status === 'ready') {
        const val = validateNutritionTargets(res.targets);
        assert.equal(val.valid, true);

        // Tamper with unrounded protein
        const tampered = {
          ...res.targets,
          macronutrients: {
            ...res.targets.macronutrients,
            protein: {
              ...res.targets.macronutrients.protein,
              targetGrams: 163, // Unrounded
            },
          },
        };
        Object.freeze(tampered);
        const tamperedVal = validateNutritionTargets(tampered);
        assert.equal(tamperedVal.valid, false);
        assert.ok(tamperedVal.errors.some((e) => e.code === 'UNROUNDED_VALUE'));
      }
    });
  });
});
