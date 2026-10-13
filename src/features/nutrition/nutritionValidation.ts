/**
 * Nutrition Strategy Validation (Stage W7.1)
 *
 * Implements pure, deterministic validation of NutritionStrategy (v1) objects
 * against domain and structural invariants.
 */

import type {
  NutritionStrategy,
  NutritionObjective,
  DietaryRestriction,
  PlanningStructureLevel,
  FoodPlanningMode,
} from './types';
import { validateNutritionTargets } from './nutritionTargetValidation';

export type NutritionValidationError = {
  field: string;
  code: string;
  message: string;
};

export type NutritionValidationResult = {
  valid: boolean;
  errors: NutritionValidationError[];
};

const VALID_NUTRITION_OBJECTIVES: NutritionObjective[] = [
  'muscle_gain_support',
  'fat_loss_support',
  'body_composition_support',
  'performance_support',
  'general_health_support',
];

const VALID_DIET_TYPES = [
  'vegetarian',
  'eggetarian',
  'non_vegetarian',
  'vegan',
  'no_preference',
  'other',
];

const VALID_RESTRICTIONS: DietaryRestriction[] = [
  'dairy',
  'eggs',
  'gluten',
  'nuts',
  'seafood',
  'other',
  'none',
];

const VALID_STRUCTURE_LEVELS: PlanningStructureLevel[] = [
  'strict_meal_plan',
  'structured_framework',
  'flexible_options',
  'habit_first_baseline',
];

const VALID_PLANNING_MODES: FoodPlanningMode[] = [
  'structured_meal_plan',
  'flexible_meal_framework',
  'food_options_based',
  'coach_selected_structure',
];

/**
 * Validates a NutritionStrategy (v1) object.
 *
 * @param strategy - Candidate NutritionStrategy object
 * @returns NutritionValidationResult with error list
 */
export function validateNutritionStrategy(
  strategy: unknown
): NutritionValidationResult {
  const errors: NutritionValidationError[] = [];

  if (!strategy || typeof strategy !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'strategy',
          code: 'TYPE_ERROR',
          message: 'NutritionStrategy must be a non-null object',
        },
      ],
    };
  }

  const s = strategy as Partial<NutritionStrategy>;

  // 1. Schema version
  if (s.schemaVersion !== 1) {
    errors.push({
      field: 'schemaVersion',
      code: 'INVALID_VERSION',
      message: `Expected schemaVersion 1, received ${s.schemaVersion}`,
    });
  }

  // 2. Population
  if (s.population !== 'adult') {
    errors.push({
      field: 'population',
      code: 'INVALID_POPULATION',
      message: `Expected adult population, received ${s.population}`,
    });
  }

  // 3. Objective
  if (!s.objective || typeof s.objective !== 'object') {
    errors.push({
      field: 'objective',
      code: 'REQUIRED',
      message: 'Nutrition objective is required',
    });
  } else {
    if (!VALID_NUTRITION_OBJECTIVES.includes(s.objective.primary)) {
      errors.push({
        field: 'objective.primary',
        code: 'INVALID_OBJECTIVE',
        message: `Invalid nutrition objective: ${s.objective.primary}`,
      });
    }
    if (!s.objective.decisionTrace || !Array.isArray(s.objective.decisionTrace)) {
      errors.push({
        field: 'objective.decisionTrace',
        code: 'INVALID_TRACE',
        message: 'Objective decisionTrace must be an array of strings',
      });
    }
  }

  // 4. Diet Compatibility
  if (!s.dietCompatibility || typeof s.dietCompatibility !== 'object') {
    errors.push({
      field: 'dietCompatibility',
      code: 'REQUIRED',
      message: 'Diet compatibility profile is required',
    });
  } else {
    if (!VALID_DIET_TYPES.includes(s.dietCompatibility.dietType)) {
      errors.push({
        field: 'dietCompatibility.dietType',
        code: 'INVALID_DIET_TYPE',
        message: `Invalid diet type: ${s.dietCompatibility.dietType}`,
      });
    }

    const restrictions = s.dietCompatibility.restrictions;
    if (!Array.isArray(restrictions) || restrictions.length === 0) {
      errors.push({
        field: 'dietCompatibility.restrictions',
        code: 'REQUIRED',
        message: 'Dietary restrictions must be a non-empty array',
      });
    } else {
      for (const r of restrictions) {
        if (!VALID_RESTRICTIONS.includes(r)) {
          errors.push({
            field: 'dietCompatibility.restrictions',
            code: 'INVALID_RESTRICTION',
            message: `Invalid restriction: ${r}`,
          });
        }
      }
      // 'none' exclusivity
      if (restrictions.includes('none') && restrictions.length > 1) {
        errors.push({
          field: 'dietCompatibility.restrictions',
          code: 'MUTUAL_EXCLUSION_VIOLATION',
          message: "'none' cannot be combined with specific dietary restrictions",
        });
      }
    }
  }

  // 5. Meal Structure
  if (!s.mealStructure || typeof s.mealStructure !== 'object') {
    errors.push({
      field: 'mealStructure',
      code: 'REQUIRED',
      message: 'Meal structure strategy is required',
    });
  } else {
    if (!VALID_STRUCTURE_LEVELS.includes(s.mealStructure.structureLevel)) {
      errors.push({
        field: 'mealStructure.structureLevel',
        code: 'INVALID_STRUCTURE_LEVEL',
        message: `Invalid structure level: ${s.mealStructure.structureLevel}`,
      });
    }
    if (!['low', 'moderate', 'high'].includes(s.mealStructure.flexibilityLevel)) {
      errors.push({
        field: 'mealStructure.flexibilityLevel',
        code: 'INVALID_FLEXIBILITY',
        message: `Invalid flexibility level: ${s.mealStructure.flexibilityLevel}`,
      });
    }
  }

  // 6. Food Preferences
  if (!s.foodPreferences || typeof s.foodPreferences !== 'object') {
    errors.push({
      field: 'foodPreferences',
      code: 'REQUIRED',
      message: 'Food preferences strategy is required',
    });
  } else {
    const liked = s.foodPreferences.likedFoodIds;
    const disliked = s.foodPreferences.dislikedFoodIds;
    if (!Array.isArray(liked) || !Array.isArray(disliked)) {
      errors.push({
        field: 'foodPreferences',
        code: 'INVALID_TYPE',
        message: 'Liked and disliked food lists must be arrays',
      });
    } else {
      const likedSet = new Set(liked);
      for (const d of disliked) {
        if (likedSet.has(d)) {
          errors.push({
            field: 'foodPreferences',
            code: 'PREFERENCE_CONFLICT',
            message: `Food '${d}' cannot be both liked and disliked`,
          });
        }
      }
    }
  }

  // 7. Planning Mode
  if (!s.planningMode || !VALID_PLANNING_MODES.includes(s.planningMode)) {
    errors.push({
      field: 'planningMode',
      code: 'INVALID_PLANNING_MODE',
      message: `Invalid planning mode: ${s.planningMode}`,
    });
  }

  // 8. Quantitative Readiness (Invariant: NO FAKE PRECISION)
  if (!s.quantitativeReadiness || typeof s.quantitativeReadiness !== 'object') {
    errors.push({
      field: 'quantitativeReadiness',
      code: 'REQUIRED',
      message: 'Quantitative readiness contract is required',
    });
  } else {
    if (s.quantitativeReadiness.status === 'pending_required_inputs') {
      if (
        s.quantitativeReadiness.canCalculateCalories !== false ||
        s.quantitativeReadiness.canCalculateMacros !== false ||
        s.quantitativeReadiness.canCalculateTDEE !== false
      ) {
        errors.push({
          field: 'quantitativeReadiness',
          code: 'FABRICATED_PRECISION',
          message: 'Calculations must remain false when required biological inputs are absent',
        });
      }
    } else if (s.quantitativeReadiness.status === 'ready') {
      if (
        s.quantitativeReadiness.canCalculateCalories !== true ||
        s.quantitativeReadiness.canCalculateMacros !== true ||
        s.quantitativeReadiness.canCalculateTDEE !== true
      ) {
        errors.push({
          field: 'quantitativeReadiness',
          code: 'INVALID_READY_STATE',
          message: 'Calculations must be flagged true when readiness status is ready',
        });
      }
      if (s.targets) {
        const targetVal = validateNutritionTargets(s.targets);
        if (!targetVal.valid) {
          for (const err of targetVal.errors) {
            errors.push({
              field: `targets.${err.field}`,
              code: err.code,
              message: err.message,
            });
          }
        }
      }
    } else {
      errors.push({
        field: 'quantitativeReadiness.status',
        code: 'INVALID_STATUS',
        message: `Expected 'ready' or 'pending_required_inputs', received '${(s.quantitativeReadiness as any).status}'`,
      });
    }
  }

  // 9. Coaching Context
  if (!s.coachingContext || typeof s.coachingContext !== 'object') {
    errors.push({
      field: 'coachingContext',
      code: 'REQUIRED',
      message: 'Coaching context is required',
    });
  }

  // 10. Top-Level Decision Trace
  if (!s.decisionTrace || !Array.isArray(s.decisionTrace) || s.decisionTrace.length === 0) {
    errors.push({
      field: 'decisionTrace',
      code: 'EMPTY_TRACE',
      message: 'Strategy must contain a non-empty audit decision trace',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
