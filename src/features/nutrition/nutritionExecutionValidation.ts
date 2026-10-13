/**
 * Nutrition Execution & Adaptation Validation (Stage W7.6)
 *
 * Enforces structural invariants and data integrity on NutritionExecution
 * and NutritionAdaptationRecommendation contracts.
 */

import type {
  NutritionExecution,
  NutritionAdaptationRecommendation,
  NutritionPlanRevision,
} from './nutritionExecutionTypes';
import { getFoodById } from './foodCatalog';

export type NutritionExecutionValidationError = {
  field: string;
  code: string;
  message: string;
};

export type NutritionExecutionValidationResult = {
  valid: boolean;
  errors: NutritionExecutionValidationError[];
};

/**
 * Validates a NutritionExecution object.
 */
export function validateNutritionExecution(
  execution: unknown
): NutritionExecutionValidationResult {
  const errors: NutritionExecutionValidationError[] = [];

  if (!execution || typeof execution !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'execution',
          code: 'TYPE_ERROR',
          message: 'NutritionExecution must be a non-null object',
        },
      ],
    };
  }

  const e = execution as Partial<NutritionExecution>;

  // 1. Schema version
  if (e.schemaVersion !== 1) {
    errors.push({
      field: 'schemaVersion',
      code: 'INVALID_VERSION',
      message: `Expected schemaVersion 1, received ${e.schemaVersion}`,
    });
  }

  // 2. ID and status
  if (!e.executionId || typeof e.executionId !== 'string') {
    errors.push({
      field: 'executionId',
      code: 'REQUIRED',
      message: 'executionId is required',
    });
  }

  const VALID_STATUSES = ['not_started', 'in_progress', 'completed', 'partial', 'abandoned'];
  if (!e.status || !VALID_STATUSES.includes(e.status)) {
    errors.push({
      field: 'status',
      code: 'INVALID_STATUS',
      message: `Invalid execution status: ${e.status}`,
    });
  }

  // 3. Meal executions
  if (!Array.isArray(e.mealExecutions) || e.mealExecutions.length === 0) {
    errors.push({
      field: 'mealExecutions',
      code: 'REQUIRED',
      message: 'mealExecutions must be a non-empty array',
    });
  } else {
    for (let i = 0; i < e.mealExecutions.length; i++) {
      const meal = e.mealExecutions[i];
      if (!meal.mealSlotId) {
        errors.push({
          field: `mealExecutions[${i}].mealSlotId`,
          code: 'REQUIRED',
          message: 'mealSlotId is required',
        });
      }

      const VALID_MEAL_STATUSES = ['not_started', 'completed', 'partial', 'skipped'];
      if (!meal.status || !VALID_MEAL_STATUSES.includes(meal.status)) {
        errors.push({
          field: `mealExecutions[${i}].status`,
          code: 'INVALID_STATUS',
          message: `Invalid meal status: ${meal.status}`,
        });
      }

      if (meal.consumedCalories < 0 || isNaN(meal.consumedCalories) || !isFinite(meal.consumedCalories)) {
        errors.push({
          field: `mealExecutions[${i}].consumedCalories`,
          code: 'INVALID_VALUE',
          message: 'consumedCalories must be a non-negative finite number',
        });
      }

      // Check logged foods
      if (Array.isArray(meal.loggedFoods)) {
        for (let fIdx = 0; fIdx < meal.loggedFoods.length; fIdx++) {
          const item = meal.loggedFoods[fIdx];
          if (!item.foodId || !getFoodById(item.foodId)) {
            errors.push({
              field: `mealExecutions[${i}].loggedFoods[${fIdx}].foodId`,
              code: 'INVALID_FOOD_ID',
              message: `Unknown or invalid foodId: ${item.foodId}`,
            });
          }
          if (typeof item.portionUnits !== 'number' || item.portionUnits <= 0 || !isFinite(item.portionUnits)) {
            errors.push({
              field: `mealExecutions[${i}].loggedFoods[${fIdx}].portionUnits`,
              code: 'INVALID_PORTION',
              message: 'portionUnits must be a positive finite number',
            });
          }
        }
      }

      // Check supersededHistory (Stage W8.3)
      if (meal.supersededHistory !== undefined) {
        if (!Array.isArray(meal.supersededHistory)) {
          errors.push({
            field: `mealExecutions[${i}].supersededHistory`,
            code: 'TYPE_ERROR',
            message: 'supersededHistory must be an array when present',
          });
        } else {
          for (let cIdx = 0; cIdx < meal.supersededHistory.length; cIdx++) {
            const corr = meal.supersededHistory[cIdx];
            if (!corr || typeof corr !== 'object') {
              errors.push({
                field: `mealExecutions[${i}].supersededHistory[${cIdx}]`,
                code: 'TYPE_ERROR',
                message: 'Correction item must be a non-null object',
              });
              continue;
            }
            if (!corr.correctionId || typeof corr.correctionId !== 'string') {
              errors.push({
                field: `mealExecutions[${i}].supersededHistory[${cIdx}].correctionId`,
                code: 'REQUIRED',
                message: 'correctionId is required',
              });
            }
            if (typeof corr.supersededAt !== 'number' || !isFinite(corr.supersededAt) || corr.supersededAt <= 0) {
              errors.push({
                field: `mealExecutions[${i}].supersededHistory[${cIdx}].supersededAt`,
                code: 'INVALID_TIMESTAMP',
                message: 'supersededAt must be a positive finite timestamp',
              });
            }
            const VALID_CORRECTION_REASONS = ['correction', 'reset', 'status_change'];
            if (!corr.reason || !VALID_CORRECTION_REASONS.includes(corr.reason)) {
              errors.push({
                field: `mealExecutions[${i}].supersededHistory[${cIdx}].reason`,
                code: 'INVALID_REASON',
                message: `Invalid correction reason: ${corr.reason}`,
              });
            }
            if (!corr.previousStatus || !VALID_MEAL_STATUSES.includes(corr.previousStatus)) {
              errors.push({
                field: `mealExecutions[${i}].supersededHistory[${cIdx}].previousStatus`,
                code: 'INVALID_STATUS',
                message: `Invalid previousStatus: ${corr.previousStatus}`,
              });
            }
            if (typeof corr.consumedCalories !== 'number' || corr.consumedCalories < 0 || !isFinite(corr.consumedCalories)) {
              errors.push({
                field: `mealExecutions[${i}].supersededHistory[${cIdx}].consumedCalories`,
                code: 'INVALID_VALUE',
                message: 'consumedCalories must be a non-negative finite number',
              });
            }
            if (Array.isArray(corr.previousLoggedFoods)) {
              for (let pfIdx = 0; pfIdx < corr.previousLoggedFoods.length; pfIdx++) {
                const item = corr.previousLoggedFoods[pfIdx];
                if (!item.foodId || !getFoodById(item.foodId)) {
                  errors.push({
                    field: `mealExecutions[${i}].supersededHistory[${cIdx}].previousLoggedFoods[${pfIdx}].foodId`,
                    code: 'INVALID_FOOD_ID',
                    message: `Unknown or invalid foodId: ${item.foodId}`,
                  });
                }
                if (typeof item.portionUnits !== 'number' || item.portionUnits <= 0 || !isFinite(item.portionUnits)) {
                  errors.push({
                    field: `mealExecutions[${i}].supersededHistory[${cIdx}].previousLoggedFoods[${pfIdx}].portionUnits`,
                    code: 'INVALID_PORTION',
                    message: 'portionUnits must be a positive finite number',
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // 4. Daily summary
  if (!e.summary || typeof e.summary !== 'object') {
    errors.push({
      field: 'summary',
      code: 'REQUIRED',
      message: 'summary is required',
    });
  } else {
    if (e.summary.consumedCalories < 0 || !isFinite(e.summary.consumedCalories)) {
      errors.push({
        field: 'summary.consumedCalories',
        code: 'INVALID_VALUE',
        message: 'consumedCalories must be a non-negative finite number',
      });
    }
  }

  // 5. Immutability
  if (!Object.isFrozen(e)) {
    errors.push({
      field: 'execution',
      code: 'MUTABLE_EXECUTION',
      message: 'NutritionExecution must be deeply frozen and immutable',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a NutritionAdaptationRecommendation object.
 */
export function validateNutritionAdaptation(
  adaptation: unknown
): NutritionExecutionValidationResult {
  const errors: NutritionExecutionValidationError[] = [];

  if (!adaptation || typeof adaptation !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'adaptation',
          code: 'TYPE_ERROR',
          message: 'NutritionAdaptationRecommendation must be a non-null object',
        },
      ],
    };
  }

  const a = adaptation as Partial<NutritionAdaptationRecommendation>;

  const VALID_ACTIONS = [
    'maintain',
    'simplify_structure',
    'increase_structure',
    'prioritize_learned_substitutions',
    'review_energy_target_adherence',
    'insufficient_evidence',
  ];

  if (!a.primaryAction || !VALID_ACTIONS.includes(a.primaryAction)) {
    errors.push({
      field: 'primaryAction',
      code: 'INVALID_ACTION',
      message: `Invalid adaptation primaryAction: ${a.primaryAction}`,
    });
  }

  if (!a.summary || typeof a.summary !== 'string') {
    errors.push({
      field: 'summary',
      code: 'REQUIRED',
      message: 'summary is required',
    });
  }

  if (!Array.isArray(a.actionableInsights)) {
    errors.push({
      field: 'actionableInsights',
      code: 'REQUIRED',
      message: 'actionableInsights must be an array',
    });
  }

  if (!Array.isArray(a.decisionTrace) || a.decisionTrace.length === 0) {
    errors.push({
      field: 'decisionTrace',
      code: 'EMPTY_TRACE',
      message: 'decisionTrace must be a non-empty array',
    });
  }

  if (!Object.isFrozen(a)) {
    errors.push({
      field: 'adaptation',
      code: 'MUTABLE_ADAPTATION',
      message: 'NutritionAdaptationRecommendation must be deeply frozen',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a NutritionPlanRevision object.
 */
export function validateNutritionPlanRevision(
  revision: unknown
): NutritionExecutionValidationResult {
  const errors: NutritionExecutionValidationError[] = [];

  if (!revision || typeof revision !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'revision',
          code: 'TYPE_ERROR',
          message: 'NutritionPlanRevision must be a non-null object',
        },
      ],
    };
  }

  const r = revision as Partial<NutritionPlanRevision>;

  if (r.schemaVersion !== 1) {
    errors.push({
      field: 'schemaVersion',
      code: 'INVALID_VERSION',
      message: `Expected schemaVersion 1, received ${r.schemaVersion}`,
    });
  }

  if (!r.revisionId || typeof r.revisionId !== 'string') {
    errors.push({
      field: 'revisionId',
      code: 'REQUIRED',
      message: 'revisionId is required',
    });
  }

  if (!r.originalPlanId || typeof r.originalPlanId !== 'string') {
    errors.push({
      field: 'originalPlanId',
      code: 'REQUIRED',
      message: 'originalPlanId is required',
    });
  }

  if (!r.parentPlanId || typeof r.parentPlanId !== 'string') {
    errors.push({
      field: 'parentPlanId',
      code: 'REQUIRED',
      message: 'parentPlanId is required',
    });
  }

  const VALID_REASONS = ['simplify_structure', 'custom_adjustment', 'user_request'];
  if (!r.revisionReason || !VALID_REASONS.includes(r.revisionReason)) {
    errors.push({
      field: 'revisionReason',
      code: 'INVALID_REASON',
      message: `Invalid revisionReason: ${r.revisionReason}`,
    });
  }

  const VALID_STATUSES = ['pending_review', 'accepted', 'rejected'];
  if (!r.status || !VALID_STATUSES.includes(r.status)) {
    errors.push({
      field: 'status',
      code: 'INVALID_STATUS',
      message: `Invalid revision status: ${r.status}`,
    });
  }

  if (!r.revisedPlan || typeof r.revisedPlan !== 'object' || !r.revisedPlan.dailyPlan) {
    errors.push({
      field: 'revisedPlan',
      code: 'REQUIRED',
      message: 'revisedPlan must be a valid NutritionPlan object',
    });
  }

  if (!Array.isArray(r.appliedRecommendations)) {
    errors.push({
      field: 'appliedRecommendations',
      code: 'REQUIRED',
      message: 'appliedRecommendations must be an array',
    });
  }

  if (!Object.isFrozen(r)) {
    errors.push({
      field: 'revision',
      code: 'MUTABLE_REVISION',
      message: 'NutritionPlanRevision must be deeply frozen',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
