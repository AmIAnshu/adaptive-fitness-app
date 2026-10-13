/**
 * Nutrition Strategy Contracts (Stage W7.1)
 *
 * Defines the strongly-typed contracts and interfaces for the deterministic
 * Nutrition Strategy Engine.
 *
 * ARCHITECTURAL ROLE:
 * CanonicalUserProfile
 *         ↓
 * Nutrition Strategy Engine (runNutritionStrategyPipeline)
 *         ↓
 * NutritionStrategy (v1)
 *         ↓
 * Future Nutrition Plan Generator
 *         ↓
 * Future Food/Meal Recommendation Layer
 *         ↓
 * Future AI Coach communication layer
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, side-effect free, zero external dependencies.
 * 2. Immutability: Deeply frozen / non-mutating.
 * 3. Separation of Concerns: Training and nutrition remain completely separate domains.
 *    No nutrition decisions inside the workout engine.
 * 4. Population Boundary:
 *    - Adult (18-100): Validated adult NutritionStrategy (v1).
 *    - Youth (13-17): Stops safely at youth_nutrition_strategy_pending.
 *    - Ineligible (<13 or >100): Blocked at boundary.
 * 5. NO FAKE CALORIES / MACROS:
 *    - Quantitative energy targeting (calories, deficits, surpluses, TDEE, BMR, macro splits)
 *      is explicitly flagged as 'pending_required_inputs' (or 'insufficient_inputs').
 *    - No fabricated precision.
 * 6. NO INVENTED BIOLOGICAL SEX:
 *    - Current profile does NOT provide biological sex.
 *    - Sex is NEVER inferred from name, goal, or fabricated physiological assumptions.
 * 7. Hard Constraints:
 *    - Dietary restrictions (dairy, eggs, gluten, nuts, seafood, etc.) are strict exclusions.
 *    - 'none' is mutually exclusive with any specific restriction.
 *    - Disliked foods are strictly excluded from future recommendations.
 * 8. Auditable Decision Trace:
 *    - Preserves transparent step-by-step reasoning.
 */

import type {
  CanonicalUserProfile,
  DietType,
  PreferredMeals,
  MealSource,
  EatingOutFrequency,
  NutritionStructure,
  CommunicationStyle,
  DecisionAutonomy,
  ExplanationDepth,
  AccountabilityLevel,
} from '../profile';

// ============================================================================
// 1. NUTRITION OBJECTIVE CONTRACTS
// ============================================================================

export type NutritionObjective =
  | 'muscle_gain_support'
  | 'fat_loss_support'
  | 'body_composition_support'
  | 'performance_support'
  | 'general_health_support';

export type NutritionObjectiveSource =
  | 'derived_from_training_goal'
  | 'derived_from_training_style'
  | 'safe_default';

export type ResolvedNutritionObjective = {
  primary: NutritionObjective;
  source: NutritionObjectiveSource;
  focusSummary: string;
  decisionTrace: string[];
};

// ============================================================================
// 2. DIET & RESTRICTIONS CONTRACTS
// ============================================================================

export type DietaryRestriction =
  | 'dairy'
  | 'eggs'
  | 'gluten'
  | 'nuts'
  | 'seafood'
  | 'other'
  | 'none';

export type DietCompatibilityProfile = {
  dietType: DietType;
  restrictions: DietaryRestriction[];
  hardExcludedFoodGroups: string[];
  decisionTrace: string[];
};

// ============================================================================
// 3. MEAL STRUCTURE & LIFESTYLE FIT CONTRACTS
// ============================================================================

export type MealPatternSchedule =
  | 'two_meals'
  | 'three_meals'
  | 'four_meals'
  | 'five_plus_meals'
  | 'flexible_meals';

export type PlanningStructureLevel =
  | 'strict_meal_plan'
  | 'structured_framework'
  | 'flexible_options'
  | 'habit_first_baseline';

export type PreparationBurdenLevel =
  | 'low_burden'
  | 'moderate_shared_burden'
  | 'mixed_burden'
  | 'high_prep_burden';

export type OutsideFoodStrategy =
  | 'rare_dine_out'
  | 'occasional_social_fit'
  | 'regular_dining_integration'
  | 'convenience_first_ordering';

export type MealStructureStrategy = {
  preferredMealCount: PreferredMeals;
  mealPattern: MealPatternSchedule;
  structureLevel: PlanningStructureLevel;
  flexibilityLevel: 'low' | 'moderate' | 'high';
  preparationBurden: PreparationBurdenLevel;
  outsideFoodStrategy: OutsideFoodStrategy;
  decisionTrace: string[];
};

// ============================================================================
// 4. FOOD PREFERENCE CONTRACTS
// ============================================================================

export type FoodPreferenceStrategy = {
  likedFoodIds: string[];
  dislikedFoodIds: string[];
  preferencePriorityMode: 'boost_liked_exclude_disliked' | 'standard';
  decisionTrace: string[];
};

// ============================================================================
// 5. PLANNING BEHAVIOR & COACHING CONTEXT
// ============================================================================

export type FoodPlanningMode =
  | 'structured_meal_plan'
  | 'flexible_meal_framework'
  | 'food_options_based'
  | 'coach_selected_structure';

export type NutritionCoachingContext = {
  communicationStyle: CommunicationStyle;
  decisionAutonomy: DecisionAutonomy;
  explanationDepth: ExplanationDepth;
  accountability: AccountabilityLevel;
};

// ============================================================================
// 6. QUANTITATIVE READINESS CONTRACT
// ============================================================================

export type QuantitativeTargetingReadiness =
  | {
      status: 'pending_required_inputs';
      reason: string;
      missingInputs: string[];
      canCalculateCalories: false;
      canCalculateMacros: false;
      canCalculateTDEE: false;
    }
  | {
      status: 'ready';
      canCalculateCalories: true;
      canCalculateMacros: true;
      canCalculateTDEE: true;
      method: string;
    };

// ============================================================================
// 7. TOP-LEVEL NUTRITION STRATEGY (v1)
// ============================================================================

export type NutritionStrategy = {
  schemaVersion: 1;
  population: 'adult';

  objective: ResolvedNutritionObjective;
  dietCompatibility: DietCompatibilityProfile;
  mealStructure: MealStructureStrategy;
  foodPreferences: FoodPreferenceStrategy;
  planningMode: FoodPlanningMode;
  quantitativeReadiness: QuantitativeTargetingReadiness;
  targets?: import('./quantitativeTypes').NutritionTargets;
  coachingContext: NutritionCoachingContext;

  decisionTrace: string[];
};

// ============================================================================
// 8. PIPELINE RESULT TYPES (DISCRIMINATED UNION)
// ============================================================================

export type AdultNutritionStrategyResult = {
  status: 'completed';
  population: 'adult';
  strategy: NutritionStrategy;
  decisionTrace: string[];
};

export type YouthNutritionStrategyResult = {
  status: 'pending';
  population: 'youth';
  path: 'youth_nutrition_strategy_pending';
  message: string;
  decisionTrace: string[];
};

export type IneligibleNutritionStrategyResult = {
  status: 'ineligible';
  path: 'ineligible';
  reason: string;
  decisionTrace: string[];
};

export type NutritionStrategyPipelineResult =
  | AdultNutritionStrategyResult
  | YouthNutritionStrategyResult
  | IneligibleNutritionStrategyResult;

export * from './quantitativeTypes';
