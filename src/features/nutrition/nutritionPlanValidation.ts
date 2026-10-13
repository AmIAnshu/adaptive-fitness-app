/**
 * Nutrition Plan Validation (Stage W7.4)
 *
 * Implements pure, deterministic validation of NutritionPlan (v1) objects
 * against domain and structural invariants.
 */

import type { NutritionPlan } from './nutritionPlanTypes';
import { validateNutritionStrategy } from './nutritionValidation';
import { validateNutritionTargets } from './nutritionTargetValidation';

export type NutritionPlanValidationError = {
  field: string;
  code: string;
  message: string;
};

export type NutritionPlanValidationResult = {
  valid: boolean;
  errors: NutritionPlanValidationError[];
};

export function validateNutritionPlan(plan: unknown): NutritionPlanValidationResult {
  const errors: NutritionPlanValidationError[] = [];

  if (!plan || typeof plan !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'plan',
          code: 'TYPE_ERROR',
          message: 'NutritionPlan must be a non-null object',
        },
      ],
    };
  }

  const p = plan as Partial<NutritionPlan>;

  // 1. Schema version
  if (p.schemaVersion !== 1) {
    errors.push({
      field: 'schemaVersion',
      code: 'INVALID_VERSION',
      message: `Expected schemaVersion 1, received ${p.schemaVersion}`,
    });
  }

  // 2. Population
  if (p.population !== 'adult') {
    errors.push({
      field: 'population',
      code: 'INVALID_POPULATION',
      message: `Expected adult population, received ${p.population}`,
    });
  }

  // 3. Readiness Status
  if (p.readinessStatus !== 'ready' && p.readinessStatus !== 'pending_required_inputs') {
    errors.push({
      field: 'readinessStatus',
      code: 'INVALID_READINESS',
      message: `Expected 'ready' or 'pending_required_inputs', received '${p.readinessStatus}'`,
    });
  }

  // 4. Immutability
  if (!Object.isFrozen(p)) {
    errors.push({
      field: 'plan',
      code: 'MUTABLE_PLAN',
      message: 'NutritionPlan object must be deeply frozen and immutable',
    });
  }

  // 5. Upstream NutritionStrategy Validation
  if (!p.nutritionStrategy || typeof p.nutritionStrategy !== 'object') {
    errors.push({
      field: 'nutritionStrategy',
      code: 'REQUIRED',
      message: 'Embedded NutritionStrategy is required',
    });
  } else {
    const stratVal = validateNutritionStrategy(p.nutritionStrategy);
    if (!stratVal.valid) {
      for (const err of stratVal.errors) {
        errors.push({
          field: `nutritionStrategy.${err.field}`,
          code: err.code,
          message: err.message,
        });
      }
    }
  }

  // 6. Upstream NutritionTargets Validation (if ready)
  if (p.readinessStatus === 'ready') {
    if (!p.nutritionTargets || typeof p.nutritionTargets !== 'object') {
      errors.push({
        field: 'nutritionTargets',
        code: 'REQUIRED',
        message: 'nutritionTargets is required when readinessStatus is ready',
      });
    } else {
      const targetVal = validateNutritionTargets(p.nutritionTargets);
      if (!targetVal.valid) {
        for (const err of targetVal.errors) {
          errors.push({
            field: `nutritionTargets.${err.field}`,
            code: err.code,
            message: err.message,
          });
        }
      }
    }
  } else if (p.readinessStatus === 'pending_required_inputs') {
    if (p.nutritionTargets !== undefined) {
      errors.push({
        field: 'nutritionTargets',
        code: 'FABRICATED_TARGETS',
        message: 'nutritionTargets must be undefined when readinessStatus is pending_required_inputs',
      });
    }
  }

  // 7. Meal Structure
  if (!p.mealStructure || typeof p.mealStructure !== 'object') {
    errors.push({
      field: 'mealStructure',
      code: 'REQUIRED',
      message: 'Meal structure definition is required',
    });
  }

  // 8. Daily Plan & Slots
  if (!p.dailyPlan || typeof p.dailyPlan !== 'object') {
    errors.push({
      field: 'dailyPlan',
      code: 'REQUIRED',
      message: 'dailyPlan is required',
    });
  } else {
    const { totalMeals, slots } = p.dailyPlan;
    if (typeof totalMeals !== 'number' || totalMeals < 1 || totalMeals > 10) {
      errors.push({
        field: 'dailyPlan.totalMeals',
        code: 'INVALID_MEAL_COUNT',
        message: `totalMeals must be between 1 and 10, received ${totalMeals}`,
      });
    }

    if (!Array.isArray(slots) || slots.length === 0) {
      errors.push({
        field: 'dailyPlan.slots',
        code: 'REQUIRED',
        message: 'Slots must be a non-empty array',
      });
    } else {
      if (slots.length !== totalMeals) {
        errors.push({
          field: 'dailyPlan.slots',
          code: 'SLOT_COUNT_MISMATCH',
          message: `Slot array length (${slots.length}) does not match totalMeals (${totalMeals})`,
        });
      }

      // Check unique slot IDs
      const seenIds = new Set<string>();
      let sumMealCalories = 0;
      let sumMealProtein = 0;
      let sumMealFat = 0;
      let sumMealCarbs = 0;

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot.slotId) {
          errors.push({
            field: `dailyPlan.slots[${i}].slotId`,
            code: 'REQUIRED',
            message: 'slotId is required',
          });
        } else if (seenIds.has(slot.slotId)) {
          errors.push({
            field: `dailyPlan.slots[${i}].slotId`,
            code: 'DUPLICATE_ID',
            message: `Duplicate slotId: ${slot.slotId}`,
          });
        } else {
          seenIds.add(slot.slotId);
        }

        // Quantitative check on slots
        if (p.readinessStatus === 'ready') {
          if (!slot.targets || typeof slot.targets !== 'object') {
            errors.push({
              field: `dailyPlan.slots[${i}].targets`,
              code: 'REQUIRED',
              message: `Meal slot targets required when readinessStatus is ready`,
            });
          } else {
            const { targetEnergyKcal, targetProteinG, targetFatG, targetCarbohydratesG } =
              slot.targets;
            if (typeof targetEnergyKcal !== 'number' || targetEnergyKcal < 0) {
              errors.push({
                field: `dailyPlan.slots[${i}].targets.targetEnergyKcal`,
                code: 'INVALID_VALUE',
                message: 'targetEnergyKcal must be a non-negative number',
              });
            }
            if (typeof targetProteinG !== 'number' || targetProteinG < 0) {
              errors.push({
                field: `dailyPlan.slots[${i}].targets.targetProteinG`,
                code: 'INVALID_VALUE',
                message: 'targetProteinG must be a non-negative number',
              });
            }
            if (typeof targetFatG !== 'number' || targetFatG < 0) {
              errors.push({
                field: `dailyPlan.slots[${i}].targets.targetFatG`,
                code: 'INVALID_VALUE',
                message: 'targetFatG must be a non-negative number',
              });
            }
            if (typeof targetCarbohydratesG !== 'number' || targetCarbohydratesG < 0) {
              errors.push({
                field: `dailyPlan.slots[${i}].targets.targetCarbohydratesG`,
                code: 'INVALID_VALUE',
                message: 'targetCarbohydratesG must be a non-negative number',
              });
            }

            sumMealCalories += targetEnergyKcal;
            sumMealProtein += targetProteinG;
            sumMealFat += targetFatG;
            sumMealCarbs += targetCarbohydratesG;
          }
        } else {
          // Pending status: slot targets must NOT be present (no fabricated calories/macros)
          if (slot.targets !== undefined) {
            errors.push({
              field: `dailyPlan.slots[${i}].targets`,
              code: 'FABRICATED_SLOT_TARGETS',
              message:
                'Slot targets must be undefined when readinessStatus is pending_required_inputs',
            });
          }
        }

        // Validate meal composition if present (Stage W7.5)
        if (slot.composition) {
          if (typeof slot.composition !== 'object') {
            errors.push({
              field: `dailyPlan.slots[${i}].composition`,
              code: 'INVALID_TYPE',
              message: 'Slot composition must be an object',
            });
          } else {
            const { selectedFoods, totalEstimatedCalories } = slot.composition;
            if (!Array.isArray(selectedFoods)) {
              errors.push({
                field: `dailyPlan.slots[${i}].composition.selectedFoods`,
                code: 'REQUIRED',
                message: 'Composition selectedFoods must be an array',
              });
            } else {
              for (let fIdx = 0; fIdx < selectedFoods.length; fIdx++) {
                const item = selectedFoods[fIdx];
                if (typeof item.portionUnits !== 'number' || item.portionUnits <= 0 || !isFinite(item.portionUnits)) {
                  errors.push({
                    field: `dailyPlan.slots[${i}].composition.selectedFoods[${fIdx}].portionUnits`,
                    code: 'INVALID_PORTION',
                    message: 'Portion units must be a positive finite number',
                  });
                }
              }
            }

            if (p.readinessStatus === 'pending_required_inputs' && totalEstimatedCalories !== 0) {
              errors.push({
                field: `dailyPlan.slots[${i}].composition.totalEstimatedCalories`,
                code: 'FABRICATED_PENDING_CALORIES',
                message: 'Composition calories must be 0 when readiness status is pending_required_inputs',
              });
            }
          }
        }
      }

      // Check sum of meal targets preservation against authoritative daily targets
      if (p.readinessStatus === 'ready' && p.nutritionTargets) {
        const expectedMidpoint = p.nutritionTargets.energy.targetRange.midpointKcal;
        const expectedProtein = p.nutritionTargets.macronutrients.protein.targetGrams;
        const expectedFat = p.nutritionTargets.macronutrients.fat.targetGrams;
        const expectedCarbs = p.nutritionTargets.macronutrients.carbohydrates.targetGrams;

        if (sumMealCalories !== expectedMidpoint) {
          errors.push({
            field: 'dailyPlan.slots',
            code: 'CALORIE_SUM_MISMATCH',
            message: `Sum of slot calories (${sumMealCalories}) does not match authoritative daily midpoint (${expectedMidpoint})`,
          });
        }

        if (sumMealProtein !== expectedProtein) {
          errors.push({
            field: 'dailyPlan.slots',
            code: 'PROTEIN_SUM_MISMATCH',
            message: `Sum of slot protein (${sumMealProtein}g) does not match authoritative daily protein (${expectedProtein}g)`,
          });
        }

        if (sumMealFat !== expectedFat) {
          errors.push({
            field: 'dailyPlan.slots',
            code: 'FAT_SUM_MISMATCH',
            message: `Sum of slot fat (${sumMealFat}g) does not match authoritative daily fat (${expectedFat}g)`,
          });
        }

        if (sumMealCarbs !== expectedCarbs) {
          errors.push({
            field: 'dailyPlan.slots',
            code: 'CARBS_SUM_MISMATCH',
            message: `Sum of slot carbs (${sumMealCarbs}g) does not match authoritative daily carbs (${expectedCarbs}g)`,
          });
        }
      }
    }
  }

  // 9. Boundaries
  if (!p.boundaries || typeof p.boundaries !== 'object') {
    errors.push({
      field: 'boundaries',
      code: 'REQUIRED',
      message: 'Plan boundaries are required',
    });
  }

  // 10. Top-Level Decision Trace
  if (!p.decisionTrace || !Array.isArray(p.decisionTrace) || p.decisionTrace.length === 0) {
    errors.push({
      field: 'decisionTrace',
      code: 'EMPTY_TRACE',
      message: 'Plan must contain a non-empty audit decision trace',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
