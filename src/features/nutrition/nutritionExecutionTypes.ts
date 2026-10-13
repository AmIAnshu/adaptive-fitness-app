/**
 * Nutrition Execution & Tracking Contracts (Stage W7.6)
 *
 * Defines strongly-typed contracts for runtime meal and intake logging,
 * daily nutrition summaries, adherence evaluation, and adaptation feedback.
 *
 * ARCHITECTURAL BOUNDARY:
 * NutritionPlan (authoritative planned targets)
 *         ↓
 * NutritionExecution (factual runtime logged intake)
 *         ↓
 * NutritionDailySummary (pure comparison of planned vs consumed)
 *         ↓
 * NutritionAdherenceEvaluation (structured non-reductive adherence evidence)
 *         ↓
 * NutritionAdaptationFeedback (pure qualitative adaptation recommendations)
 *
 * DESIGN INVARIANTS:
 * 1. Pure, deterministic, side-effect free, zero randomness, zero external dependencies.
 * 2. Planned vs. Actual Separation: Actual logged intake NEVER overwrites or recalculates
 *    the authoritative planned targets in NutritionPlan or NutritionTargets.
 * 3. Authoritative Food Catalog: All logged foods use catalog nutrient constants.
 *    Calculations are strictly: reference_nutrient × logged_portion_units.
 * 4. Population Boundary: Adult only; youth safely held; ineligible rejected.
 * 5. Pending Status: Qualitative meal logging allowed with zero fabricated calories/macros.
 * 6. Hard Restriction & Dislike Inviolability: Adaptation recommendations never violate
 *    user allergens or force disliked foods.
 * 7. Immutability: Deeply frozen output contracts.
 */

import type { FoodDefinition } from './foodCatalogTypes';
import type { NutritionPlan } from './nutritionPlanTypes';
import type { NutritionStrategy } from './types';

// ============================================================================
// 1. MEAL & FOOD LOGGING CONTRACTS
// ============================================================================

export type LoggedItemSource =
  | 'planned_food'
  | 'catalog_substitution'
  | 'additional_food';

export interface LoggedFoodItem {
  foodId: string;
  foodName: string;
  portionUnits: number; // multiplier of referenceAmount
  servingDescription: string;
  source: LoggedItemSource;
  substitutedFoodId?: string; // if this item replaced a planned food
  notes?: string;

  // Calculated strictly from catalog reference values
  calories: number;
  proteinG: number;
  fatG: number;
  carbohydratesG: number;
}

export type MealExecutionStatus =
  | 'not_started'
  | 'completed'
  | 'partial'
  | 'skipped';

export type MealIntakeCorrectionReason =
  | 'correction'
  | 'reset'
  | 'status_change';

export interface MealIntakeCorrection {
  correctionId: string;
  supersededAt: number; // ISO timestamp ms
  reason: MealIntakeCorrectionReason;
  previousStatus: MealExecutionStatus;
  previousLoggedFoods: LoggedFoodItem[];
  consumedCalories: number;
  consumedProteinG: number;
  consumedFatG: number;
  consumedCarbohydratesG: number;
  notes?: string;
}

export interface MealExecution {
  mealSlotId: string;
  mealName: string;
  slotType: string;
  status: MealExecutionStatus;

  // Actual consumed foods (effective current state)
  loggedFoods: LoggedFoodItem[];

  // Factual consumed totals for this meal (effective current totals)
  consumedCalories: number;
  consumedProteinG: number;
  consumedFatG: number;
  consumedCarbohydratesG: number;

  notes?: string;
  completedAt?: number; // ISO timestamp ms

  // Historical auditable corrections / supersessions (Stage W8.3)
  supersededHistory?: MealIntakeCorrection[];
}

// ============================================================================
// 2. DAILY INTAKE SUMMARY (Planned vs Consumed)
// ============================================================================

export interface NutritionDailySummary {
  date: string; // YYYY-MM-DD
  isQuantitative: boolean;

  // Authoritative planned targets
  plannedCalories?: number;
  plannedProteinG?: number;
  plannedFatG?: number;
  plannedCarbohydratesG?: number;

  // Factual consumed intake
  consumedCalories: number;
  consumedProteinG: number;
  consumedFatG: number;
  consumedCarbohydratesG: number;

  // Deltas (consumed - planned) if quantitative
  deltaCalories?: number;
  deltaProteinG?: number;
  deltaFatG?: number;
  deltaCarbohydratesG?: number;

  // Meal slot metrics
  mealsPlanned: number;
  mealsCompleted: number;
  mealsPartial: number;
  mealsSkipped: number;
}

// ============================================================================
// 3. TOP-LEVEL NUTRITION EXECUTION CONTRACT
// ============================================================================

export type NutritionExecutionStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'abandoned';

export interface NutritionExecution {
  schemaVersion: 1;
  executionId: string;
  planId: string;
  date: string; // YYYY-MM-DD
  status: NutritionExecutionStatus;
  mealExecutions: MealExecution[];
  summary: NutritionDailySummary;
  notes?: string;
  createdAt: number;
  lastUpdated: number;
}

// ============================================================================
// 4. ADHERENCE EVALUATION CONTRACTS
// ============================================================================

export type AdherenceBandStatus =
  | 'insufficient_evidence'
  | 'broadly_on_track'
  | 'inconsistent'
  | 'repeatedly_below_target'
  | 'repeatedly_above_target';

export interface DayCompletenessEvidence {
  date: string;
  isComplete: boolean;
  totalPlannedSlots: number;
  completedSlots: number;
  partialSlots: number;
  skippedSlots: number;
  unloggedSlots: number;
}

export interface NutritionAdherenceEvidence {
  evaluatedDaysCount: number;
  completeDaysCount: number;
  incompleteDaysCount: number;
  dayCompleteness: DayCompletenessEvidence[];
  overallStatus: AdherenceBandStatus;
  mealCompletionRate: number; // 0.0 - 1.0
  proteinTargetHitRate?: number; // 0.0 - 1.0 (if quantitative on complete days)
  energyBandHitRate?: number; // 0.0 - 1.0 (if quantitative on complete days)
  repeatedMealSkippingDetected: boolean;
  repeatedSubstitutions: { foodId: string; count: number }[];
  evidenceSummary: string;
  decisionTrace: string[];
}

// ============================================================================
// 4b. VERSIONED NUTRITION PLAN REVISION CONTRACT (Stage W7.7)
// ============================================================================

export type NutritionPlanRevisionReason =
  | 'simplify_structure'
  | 'custom_adjustment'
  | 'user_request';

export type NutritionPlanRevisionStatus =
  | 'pending_review'
  | 'accepted'
  | 'rejected';

export interface NutritionPlanRevision {
  schemaVersion: 1;
  revisionId: string;
  originalPlanId: string;
  parentPlanId: string;
  revisedPlan: NutritionPlan;
  revisionReason: NutritionPlanRevisionReason;
  appliedRecommendations: NutritionAdaptationRecommendation[];
  status: NutritionPlanRevisionStatus;
  createdAt: number;
  resolvedAt?: number;
}

// ============================================================================
// 5. ADAPTATION RECOMMENDATIONS CONTRACT
// ============================================================================

export type NutritionAdaptationAction =
  | 'maintain'
  | 'simplify_structure'
  | 'increase_structure'
  | 'prioritize_learned_substitutions'
  | 'review_energy_target_adherence'
  | 'insufficient_evidence';

export interface NutritionAdaptationRecommendation {
  primaryAction: NutritionAdaptationAction;
  summary: string;
  actionableInsights: string[];
  suggestedPreferredFoodIdsToAdd: string[];
  suggestedStructureSimplification: boolean;
  requiresTargetReview: boolean;
  decisionTrace: string[];
}

// ============================================================================
// 6. ADAPTATION CONTEXT (Historical Query Input)
// ============================================================================

export interface NutritionAdaptationContext {
  activePlan: NutritionPlan;
  strategy: NutritionStrategy;
  historicalExecutions: NutritionExecution[];
}
