/**
 * Food Catalog & Meal Composition Types (Stage W7.5)
 *
 * Defines strongly-typed contracts for the authoritative food catalog
 * and deterministic meal composition engine.
 *
 * ARCHITECTURAL ROLE:
 * Food Catalog (authoritative nutrient data)
 *         +
 * NutritionStrategy (v1) [diet & restriction rules]
 *         +
 * NutritionPlan (v1) [authoritative meal slots & targets]
 *         ↓
 * Meal Composition Engine (composeMealCandidate)
 *         ↓
 * MealCompositionCandidate [deterministic, bounded portion fit]
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, zero randomness, zero external dependencies.
 * 2. Explicit Catalog Nutrient Data: Nutrient values are authoritative constants,
 *    never generated algorithmically or guessed from food names.
 * 3. Daily Target Preservation: W7.4 daily NutritionTargets remain authoritative.
 *    The meal composition engine only fits foods near meal targets, it never
 *    recalculates or mutates daily targets.
 * 4. Hard Restriction Dominance: Dietary restrictions and vegan/vegetarian rules
 *    strictly bar non-compliant foods. Disliked foods are strictly barred.
 *    Liked foods receive deterministic score preference.
 * 5. Practical Portions: Portions are discrete, realistic, bounded, and non-negative.
 * 6. Immutability: All catalog records and output candidates are deeply frozen.
 */

import type { DietType } from '../profile';
import type { DietaryRestriction } from './types';

// ============================================================================
// 1. FOOD DEFINITION CONTRACT
// ============================================================================

export type FoodCategory =
  | 'grains_starches'
  | 'lean_proteins'
  | 'dairy_alternatives'
  | 'fruits'
  | 'vegetables'
  | 'healthy_fats'
  | 'convenience_outside';

export type FoodMealRole =
  | 'protein_anchor'
  | 'carbohydrate_fuel'
  | 'essential_fat'
  | 'vegetable_fiber'
  | 'supportive_snack'
  | 'quick_convenience';

export type ReferenceUnit = 'g' | 'ml' | 'piece' | 'tbsp';

export interface FoodDefinition {
  id: string; // Stable ID matching onboarding SEED_FOODS where applicable
  name: string;
  category: FoodCategory;
  foodGroups: string[]; // e.g. ['poultry', 'meat'], ['dairy'], ['tree_nuts']

  // Diet Compatibility
  compatibleDietTypes: DietType[];
  excludedByRestrictions: DietaryRestriction[]; // e.g. ['dairy'], ['nuts']

  // Authoritative Nutrient Profile per reference amount
  referenceAmount: number; // e.g. 100
  referenceUnit: ReferenceUnit; // e.g. 'g'
  caloriesPerReference: number; // kcal
  proteinPerReference: number; // grams
  fatPerReference: number; // grams
  carbohydratesPerReference: number; // grams

  // Composition metadata
  mealRoles: FoodMealRole[];
  minPortionUnits: number; // e.g. 0.5 (half reference portion)
  maxPortionUnits: number; // e.g. 3.0 (three reference portions)
  defaultPortionUnits: number; // e.g. 1.0
  portionStepUnits: number; // e.g. 0.5

  // Lifestyle fit
  isOutsideFriendly: boolean;
  tags: string[];
}

// ============================================================================
// 2. FOOD PORTION & SELECTION CONTRACTS
// ============================================================================

export interface FoodPortionSelection {
  food: FoodDefinition;
  portionUnits: number; // Multiplier of referenceAmount
  servingDescription: string; // e.g. "150 g", "2 pieces", "1 tbsp"
  calculatedCalories: number;
  calculatedProteinG: number;
  calculatedFatG: number;
  calculatedCarbohydratesG: number;
}

// ============================================================================
// 3. MEAL COMPOSITION CANDIDATE
// ============================================================================

export type CompositionFitLevel =
  | 'tight_fit' // Within ±10% of target calories
  | 'moderate_fit' // Within ±20% of target calories
  | 'qualitative_guideline'; // Used when quantitative targets are pending

export interface MealCompositionCandidate {
  slotId: string;
  slotName: string;
  slotType: string;
  isQuantitative: boolean;

  // Selected foods & portions
  selectedFoods: FoodPortionSelection[];

  // Aggregated meal totals
  totalEstimatedCalories: number;
  totalEstimatedProteinG: number;
  totalEstimatedFatG: number;
  totalEstimatedCarbohydratesG: number;

  // Fit & reasoning metadata
  fitLevel: CompositionFitLevel;
  calorieDeltaFromTarget?: number; // positive = surplus, negative = deficit
  compatibilityReasons: string[];
  decisionTrace: string[];
}
