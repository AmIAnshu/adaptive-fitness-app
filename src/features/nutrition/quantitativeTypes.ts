/**
 * Quantitative Nutrition Contracts (Stage W7.2)
 *
 * Defines the strongly-typed contracts and interfaces for quantitative nutrition
 * calculations (energy estimation, expenditure, goal-based deficits/surpluses,
 * and macronutrient partitioning).
 *
 * ARCHITECTURAL ROLE:
 * CanonicalUserProfile + NutritionStrategy
 *         ↓
 * Quantitative Nutrition Engine (calculateNutritionTargets)
 *         ↓
 * NutritionTargets (v1)
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, immutable, zero randomness, zero external dependencies.
 * 2. NO FABRICATED SEX: Biological sex is never inferred or guessed.
 *    If absent or 'prefer_not_to_say', readiness stays 'pending_required_inputs'.
 * 3. NO FABRICATED PRECISION: Targets are represented as conservative rounded
 *    ranges (e.g. 2400 – 2600 kcal) rather than arbitrary point values like 2473 kcal.
 * 4. MACRO FLOOR SAFETY:
 *    - Protein g/kg based on objective and diet.
 *    - Fat floor (>= 0.8 g/kg and >= 45g) for essential hormonal function.
 *    - Carbs fill remaining energy balance.
 * 5. POPULATION BOUNDARY:
 *    - Adult (18-100): eligible for quantitative targets when sex is provided.
 *    - Youth (13-17): held pending youth developmental guidelines.
 *    - Ineligible: blocked at boundary.
 */

import type { BiologicalSex } from '../profile';
import type { NutritionObjective, DietaryRestriction } from './types';

export type CalculationMethod =
  | 'mifflin_st_jeor'
  | 'conservative_bodyweight_band';

export type QuantitativeReadiness =
  | {
      status: 'ready';
      canCalculateCalories: true;
      canCalculateMacros: true;
      canCalculateTDEE: true;
      method: CalculationMethod;
      decisionTrace: string[];
    }
  | {
      status: 'pending_required_inputs';
      canCalculateCalories: false;
      canCalculateMacros: false;
      canCalculateTDEE: false;
      reason: string;
      missingInputs: string[];
      decisionTrace: string[];
    }
  | {
      status: 'ineligible';
      canCalculateCalories: false;
      canCalculateMacros: false;
      canCalculateTDEE: false;
      reason: string;
      decisionTrace: string[];
    };

export interface EnergyTargetRange {
  minKcal: number;
  maxKcal: number;
  midpointKcal: number;
}

export interface EnergyEstimate {
  bmrKcal: number;
  activityMultiplier: number;
  tdeeKcal: number;
  goalAdjustmentKcal: number;
  targetRange: EnergyTargetRange;
  calculationTrace: string[];
}

export interface MacroItem {
  targetGrams: number;
  gramsPerKg: number;
  calories: number;
  percentageOfEnergy: number;
}

export interface MacronutrientTargets {
  protein: MacroItem;
  fat: MacroItem;
  carbohydrates: MacroItem;
  totalCalculatedCalories: number;
  roundingExplanation: string;
}

export interface NutritionTargets {
  schemaVersion: 1;
  population: 'adult';
  status: 'ready';
  energy: EnergyEstimate;
  macronutrients: MacronutrientTargets;
  hardConstraintsApplied: string[];
  warnings: string[];
  decisionTrace: string[];
}

export type ReadyNutritionTargetsResult = {
  status: 'ready';
  population: 'adult';
  targets: NutritionTargets;
  readiness: Extract<QuantitativeReadiness, { status: 'ready' }>;
  decisionTrace: string[];
};

export type PendingNutritionTargetsResult = {
  status: 'pending_required_inputs';
  population: 'adult' | 'youth';
  reason: string;
  missingInputs: string[];
  readiness: Extract<QuantitativeReadiness, { status: 'pending_required_inputs' }>;
  decisionTrace: string[];
};

export type IneligibleNutritionTargetsResult = {
  status: 'ineligible';
  reason: string;
  readiness: Extract<QuantitativeReadiness, { status: 'ineligible' }>;
  decisionTrace: string[];
};

export type NutritionTargetsResult =
  | ReadyNutritionTargetsResult
  | PendingNutritionTargetsResult
  | IneligibleNutritionTargetsResult;
