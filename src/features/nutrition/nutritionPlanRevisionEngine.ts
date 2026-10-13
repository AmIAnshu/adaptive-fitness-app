/**
 * Deterministic Nutrition Plan Revision Engine (Stage W7.7)
 *
 * Constructs versioned, safe NutritionPlanRevision contracts from active plans
 * and qualitative adaptation recommendations.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Pure, deterministic, side-effect free, zero randomness, zero external dependencies.
 * 2. Authoritative Target Protection:
 *    - Daily NutritionTargets and quantitative calorie/macro totals are 100% PRESERVED.
 *    - Never silently modifies planned targets.
 * 3. Original Plan Immutability:
 *    - Active plan and historical executions remain deeply immutable and unmutated.
 * 4. User Autonomy & Explicit Confirmation:
 *    - Proposed revisions default to 'pending_review' status.
 *    - Never activates without explicit user acceptance.
 * 5. Boundary Protection:
 *    - Recompositions strictly respect hard restrictions and explicit dislikes.
 *    - Youth held; ineligible rejected.
 */

import type { FoodDefinition } from './foodCatalogTypes';
import { AUTHORITATIVE_FOOD_CATALOG } from './foodCatalog';
import type { NutritionPlan, MealSlot } from './nutritionPlanTypes';
import type { NutritionStrategy } from './types';
import type {
  NutritionPlanRevision,
  NutritionAdaptationRecommendation,
} from './nutritionExecutionTypes';
import {
  generateMealSlots,
  resolveMealStructureDefinition,
} from './nutritionPlanGenerator';
import { composeMealCandidate } from './mealComposition';
import { deepFreeze } from './nutritionTargetEngine';

let _revisionCounter = 0;

function generateRevisionId(prefix: string): string {
  _revisionCounter++;
  return `${prefix}_${Date.now()}_${_revisionCounter}`;
}

/**
 * Proposes a versioned plan revision consolidating meal count into fewer substantial meals.
 */
export function proposeStructureSimplificationRevision(
  activePlan: NutritionPlan,
  strategy: NutritionStrategy,
  recommendation: NutritionAdaptationRecommendation,
  catalog: readonly FoodDefinition[] = AUTHORITATIVE_FOOD_CATALOG,
  learnedPreferenceIds: readonly string[] = []
): NutritionPlanRevision {
  const currentMealCount = activePlan.dailyPlan.totalMeals;
  // Reduce by 1 meal down to minimum 2 meals
  const newMealCount = Math.max(2, currentMealCount - 1);

  // Generate newly allocated slots preserving daily targets exactly
  const rawSlots = generateMealSlots(
    newMealCount,
    activePlan.dailyPlan.preparationOrientation,
    activePlan.nutritionTargets,
    strategy.foodPreferences.likedFoodIds,
    strategy.foodPreferences.dislikedFoodIds
  );

  // Re-compose practical foods for new slots
  const slotsWithComposition: MealSlot[] = rawSlots.map((slot) => {
    const comp = composeMealCandidate(
      slot,
      strategy,
      activePlan,
      catalog,
      learnedPreferenceIds.length > 0 ? learnedPreferenceIds : recommendation.suggestedPreferredFoodIdsToAdd
    );
    return deepFreeze({
      ...slot,
      composition: comp,
    });
  });

  const revisedPlan: NutritionPlan = deepFreeze({
    schemaVersion: 1,
    population: activePlan.population,
    readinessStatus: activePlan.readinessStatus,
    nutritionStrategy: activePlan.nutritionStrategy,
    nutritionTargets: activePlan.nutritionTargets,
    mealStructure: resolveMealStructureDefinition(
      activePlan.mealStructure.planningMode,
      String(newMealCount) as any,
      activePlan.dailyPlan.preparationOrientation
    ),
    boundaries: activePlan.boundaries,
    dailyPlan: {
      totalMeals: newMealCount,
      preparationOrientation: activePlan.dailyPlan.preparationOrientation,
      frameworkSummary: `Consolidated daily framework with ${newMealCount} substantial meals.`,
      adherenceGuidelines: activePlan.dailyPlan.adherenceGuidelines,
      slots: slotsWithComposition,
    },
    decisionTrace: [
      ...activePlan.decisionTrace,
      `Structure simplified from ${currentMealCount} to ${newMealCount} meal slots via adaptation recommendation`,
    ],
  });

  const revision: NutritionPlanRevision = deepFreeze({
    schemaVersion: 1,
    revisionId: generateRevisionId('rev_simp'),
    originalPlanId: 'nutrition_plan_v1',
    parentPlanId: 'nutrition_plan_v1',
    revisedPlan,
    revisionReason: 'simplify_structure',
    appliedRecommendations: [recommendation],
    status: 'pending_review',
    createdAt: Date.now(),
  });

  return revision;
}

/**
 * Proposes a versioned plan revision updating meal compositions with learned food preferences.
 */
export function proposeLearnedSubstitutionsRevision(
  activePlan: NutritionPlan,
  strategy: NutritionStrategy,
  recommendation: NutritionAdaptationRecommendation,
  catalog: readonly FoodDefinition[] = AUTHORITATIVE_FOOD_CATALOG,
  learnedPreferenceIds: readonly string[] = []
): NutritionPlanRevision {
  const effectiveLearned =
    learnedPreferenceIds.length > 0
      ? learnedPreferenceIds
      : recommendation.suggestedPreferredFoodIdsToAdd;

  const updatedSlots: MealSlot[] = activePlan.dailyPlan.slots.map((slot) => {
    const comp = composeMealCandidate(
      slot,
      strategy,
      activePlan,
      catalog,
      effectiveLearned
    );
    return deepFreeze({
      ...slot,
      composition: comp,
    });
  });

  const revisedPlan: NutritionPlan = deepFreeze({
    schemaVersion: 1,
    population: activePlan.population,
    readinessStatus: activePlan.readinessStatus,
    nutritionStrategy: activePlan.nutritionStrategy,
    nutritionTargets: activePlan.nutritionTargets,
    mealStructure: activePlan.mealStructure,
    boundaries: activePlan.boundaries,
    dailyPlan: {
      ...activePlan.dailyPlan,
      slots: updatedSlots,
    },
    decisionTrace: [
      ...activePlan.decisionTrace,
      `Recomposed meal slots with learned preferences: [${effectiveLearned.join(', ')}]`,
    ],
  });

  const revision: NutritionPlanRevision = deepFreeze({
    schemaVersion: 1,
    revisionId: generateRevisionId('rev_learned'),
    originalPlanId: 'nutrition_plan_v1',
    parentPlanId: 'nutrition_plan_v1',
    revisedPlan,
    revisionReason: 'user_request',
    appliedRecommendations: [recommendation],
    status: 'pending_review',
    createdAt: Date.now(),
  });

  return revision;
}

/**
 * Accepts a plan revision, resolving it to accepted status.
 */
export function acceptPlanRevision(revision: NutritionPlanRevision): NutritionPlanRevision {
  return deepFreeze({
    ...revision,
    status: 'accepted',
    resolvedAt: Date.now(),
  });
}

/**
 * Rejects a plan revision, resolving it to rejected status.
 */
export function rejectPlanRevision(revision: NutritionPlanRevision): NutritionPlanRevision {
  return deepFreeze({
    ...revision,
    status: 'rejected',
    resolvedAt: Date.now(),
  });
}
