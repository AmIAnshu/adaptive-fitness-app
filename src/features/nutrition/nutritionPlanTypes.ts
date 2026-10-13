/**
 * Nutrition Plan Contracts (Stage W7.4)
 *
 * Defines the strongly-typed contracts and interfaces for the deterministic
 * Nutrition Plan Generator v1.
 *
 * ARCHITECTURAL ROLE:
 * CanonicalUserProfile + NutritionStrategy (v1) + NutritionTargets (v1)
 *         ↓
 * Nutrition Plan Generator (generateNutritionPlan)
 *         ↓
 * NutritionPlan (v1) [Immutable, Validated, Pure]
 *         ↓
 * Future Food & Meal Recommendation Catalog (FoodRecommendationCandidate)
 *         ↓
 * Future AI Coach communication layer
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, side-effect free, zero randomness, zero external dependencies.
 * 2. Deeply frozen and immutable output.
 * 3. Authoritative Daily Target Preservation:
 *    - Does NOT recalculate daily calories or macros from foods.
 *    - Sum of allocated meal targets must exactly match or tightly align with the authoritative daily targets.
 * 4. Population Boundary:
 *    - Adult (18-100): Validated adult NutritionPlan (v1).
 *    - Youth (13-17): Safely held at pending_youth_guidelines; zero fabricated adult plans.
 *    - Ineligible (<13 or >100): Rejected at boundary.
 * 5. Pending Status:
 *    - When NutritionTargets is pending_required_inputs (e.g. unstated biological sex),
 *      generates a qualitative meal framework with zero fabricated calories or macros.
 * 6. Hard Dietary Boundaries:
 *    - Diet types (vegan, vegetarian, eggetarian, non-vegetarian) and restrictions
 *      (dairy, eggs, gluten, nuts, seafood) are strictly preserved from NutritionStrategy.
 *    - Disliked foods are strictly excluded from recommendation candidates.
 * 7. Meal Preparation / Source Context:
 *    - mostly_cook, family_prepares, mixed, mostly_outside are explicitly represented
 *      as planning metadata (e.g. home_focused, mixed_source, outside_friendly).
 * 8. Auditable Decision Trace:
 *    - Preserves transparent, step-by-step reasoning for all allocation and framework choices.
 */

import type {
  NutritionStrategy,
  NutritionObjective,
  DietaryRestriction,
  FoodPlanningMode,
} from './types';
import type {
  NutritionTargets,
  QuantitativeReadiness,
} from './quantitativeTypes';
import type { DietType } from '../profile';

// ============================================================================
// 1. MEAL SLOT & TARGET CONTRACTS
// ============================================================================

export type MealSlotId = string;

export type MealSlotType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'meal_1'
  | 'meal_2'
  | 'meal_3'
  | 'meal_4'
  | 'meal_5';

export interface MealQuantitativeTargets {
  targetEnergyKcal: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbohydratesG: number;
  allocationPercentage: number; // e.g. 0.35 = 35%
}

export type MealSourceContext =
  | 'home_prepared'
  | 'flexible_source'
  | 'outside_convenience'
  | 'shared_family';

export interface FoodRecommendationCandidate {
  foodId: string;
  category: 'protein' | 'carbohydrate' | 'fat' | 'vegetable_fiber' | 'beverage';
  isLikedByUser: boolean;
  notes?: string;
}

export interface MealSlot {
  slotId: MealSlotId;
  slotIndex: number; // 1-indexed
  name: string; // e.g. "Meal 1", "Breakfast"
  slotType: MealSlotType;
  suggestedTiming?: string; // e.g. "Morning", "Midday", "Evening"
  sourceContext: MealSourceContext;
  guidance: string;

  // Present if targets are 'ready', omitted if 'pending_required_inputs'
  targets?: MealQuantitativeTargets;

  // Future pluggable candidates compliant with user's diet & restrictions
  compatibleFoodCategories: string[];
  recommendedLikedFoods: string[];

  // Deterministic meal composition candidate (Stage W7.5)
  composition?: import('./foodCatalogTypes').MealCompositionCandidate;
}

// ============================================================================
// 2. DAILY PLAN CONTRACT
// ============================================================================

export type PreparationOrientation =
  | 'home_focused'
  | 'mixed_source'
  | 'outside_friendly';

export interface DailyPlanFramework {
  totalMeals: number;
  preparationOrientation: PreparationOrientation;
  frameworkSummary: string;
  adherenceGuidelines: string[];
  slots: MealSlot[];
}

// ============================================================================
// 3. MEAL STRUCTURE METADATA
// ============================================================================

export type MealStructureType =
  | 'structured_meal_slots'
  | 'flexible_interchangeable_slots'
  | 'food_options_framework'
  | 'coach_selected_hybrid';

export interface MealStructureDefinition {
  structureType: MealStructureType;
  planningMode: FoodPlanningMode;
  flexibilityLevel: 'low' | 'moderate' | 'high';
  isInterchangeable: boolean;
  structureExplanation: string;
}

// ============================================================================
// 4. RESTRICTIONS & PREFERENCES METADATA
// ============================================================================

export interface NutritionPlanBoundaries {
  dietType: DietType;
  hardRestrictions: DietaryRestriction[];
  hardExcludedFoodGroups: string[];
  strictlyExcludedDislikedFoodIds: string[];
  prioritizedLikedFoodIds: string[];
}

// ============================================================================
// 5. TOP-LEVEL NUTRITION PLAN (v1)
// ============================================================================

export interface NutritionPlan {
  schemaVersion: 1;
  population: 'adult';
  readinessStatus: 'ready' | 'pending_required_inputs';

  // Upstream authoritative contracts preserved
  nutritionStrategy: NutritionStrategy;
  nutritionTargets?: NutritionTargets;

  // Framework & Slot structure
  mealStructure: MealStructureDefinition;
  boundaries: NutritionPlanBoundaries;
  dailyPlan: DailyPlanFramework;

  // Trace
  decisionTrace: string[];
}

// ============================================================================
// 6. GENERATION PIPELINE RESULT TYPES (DISCRIMINATED UNION)
// ============================================================================

export type ReadyAdultNutritionPlanResult = {
  status: 'success';
  readinessStatus: 'ready';
  population: 'adult';
  plan: NutritionPlan;
  decisionTrace: string[];
};

export type PendingAdultNutritionPlanResult = {
  status: 'pending';
  readinessStatus: 'pending_required_inputs';
  population: 'adult';
  reason: string;
  missingInputs: string[];
  plan: NutritionPlan; // Has qualitative slots without fabricated calories/macros
  decisionTrace: string[];
};

export type YouthNutritionPlanResult = {
  status: 'youth_protection_pending';
  population: 'youth';
  reason: string;
  decisionTrace: string[];
};

export type IneligibleNutritionPlanResult = {
  status: 'ineligible';
  reason: string;
  decisionTrace: string[];
};

export type NutritionPlanGenerationResult =
  | ReadyAdultNutritionPlanResult
  | PendingAdultNutritionPlanResult
  | YouthNutritionPlanResult
  | IneligibleNutritionPlanResult;
