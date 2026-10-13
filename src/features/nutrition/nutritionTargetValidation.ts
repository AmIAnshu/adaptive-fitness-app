/**
 * Quantitative Nutrition Target Validation (Stage W7.2)
 *
 * Validates NutritionTargets contract against domain constraints and invariants.
 */

import type { NutritionTargets } from './quantitativeTypes';

export type NutritionTargetValidationError = {
  field: string;
  code: string;
  message: string;
};

export type NutritionTargetValidationResult = {
  valid: boolean;
  errors: NutritionTargetValidationError[];
};

export function validateNutritionTargets(
  targets: unknown
): NutritionTargetValidationResult {
  const errors: NutritionTargetValidationError[] = [];

  if (!targets || typeof targets !== 'object') {
    return {
      valid: false,
      errors: [
        {
          field: 'targets',
          code: 'TYPE_ERROR',
          message: 'Nutrition targets must be a non-null object',
        },
      ],
    };
  }

  const t = targets as NutritionTargets;

  // 1. Schema Version & Population
  if (t.schemaVersion !== 1) {
    errors.push({
      field: 'schemaVersion',
      code: 'INVALID_VERSION',
      message: `Expected schemaVersion 1, received ${t.schemaVersion}`,
    });
  }

  if (t.population !== 'adult') {
    errors.push({
      field: 'population',
      code: 'INVALID_POPULATION',
      message: `Expected population 'adult', received '${t.population}'`,
    });
  }

  if (t.status !== 'ready') {
    errors.push({
      field: 'status',
      code: 'INVALID_STATUS',
      message: `Expected status 'ready', received '${t.status}'`,
    });
  }

  // 2. Energy Verification
  if (!t.energy || typeof t.energy !== 'object') {
    errors.push({
      field: 'energy',
      code: 'REQUIRED',
      message: 'Energy estimation is required',
    });
  } else {
    const { bmrKcal, activityMultiplier, tdeeKcal, targetRange } = t.energy;

    if (typeof bmrKcal !== 'number' || isNaN(bmrKcal) || bmrKcal <= 0) {
      errors.push({
        field: 'energy.bmrKcal',
        code: 'INVALID_VALUE',
        message: 'BMR must be a positive number',
      });
    }

    if (
      typeof activityMultiplier !== 'number' ||
      isNaN(activityMultiplier) ||
      activityMultiplier < 1.15 ||
      activityMultiplier > 2.0
    ) {
      errors.push({
        field: 'energy.activityMultiplier',
        code: 'INVALID_RANGE',
        message: `Activity multiplier out of valid range: ${activityMultiplier}`,
      });
    }

    if (typeof tdeeKcal !== 'number' || isNaN(tdeeKcal) || tdeeKcal <= 0) {
      errors.push({
        field: 'energy.tdeeKcal',
        code: 'INVALID_VALUE',
        message: 'TDEE must be a positive number',
      });
    }

    if (!targetRange || typeof targetRange !== 'object') {
      errors.push({
        field: 'energy.targetRange',
        code: 'REQUIRED',
        message: 'Target range is required',
      });
    } else {
      const { minKcal, maxKcal, midpointKcal } = targetRange;
      if (typeof minKcal !== 'number' || typeof maxKcal !== 'number' || typeof midpointKcal !== 'number') {
        errors.push({
          field: 'energy.targetRange',
          code: 'INVALID_TYPE',
          message: 'Target range boundaries must be numbers',
        });
      } else {
        if (minKcal >= maxKcal) {
          errors.push({
            field: 'energy.targetRange',
            code: 'INVALID_BOUNDS',
            message: `minKcal (${minKcal}) must be strictly less than maxKcal (${maxKcal})`,
          });
        }
        if (midpointKcal < minKcal || midpointKcal > maxKcal) {
          errors.push({
            field: 'energy.targetRange.midpointKcal',
            code: 'OUT_OF_BOUNDS',
            message: `midpointKcal (${midpointKcal}) must lie between minKcal (${minKcal}) and maxKcal (${maxKcal})`,
          });
        }
      }
    }
  }

  // 3. Macronutrients Verification
  if (!t.macronutrients || typeof t.macronutrients !== 'object') {
    errors.push({
      field: 'macronutrients',
      code: 'REQUIRED',
      message: 'Macronutrients contract is required',
    });
  } else {
    const { protein, fat, carbohydrates, totalCalculatedCalories } = t.macronutrients;

    if (!protein || typeof protein.targetGrams !== 'number' || protein.targetGrams <= 0) {
      errors.push({
        field: 'macronutrients.protein',
        code: 'INVALID_VALUE',
        message: 'Protein target must be a positive number',
      });
    } else if (protein.targetGrams % 5 !== 0) {
      errors.push({
        field: 'macronutrients.protein.targetGrams',
        code: 'UNROUNDED_VALUE',
        message: `Protein target (${protein.targetGrams}g) must be rounded to nearest 5g`,
      });
    }

    if (!fat || typeof fat.targetGrams !== 'number' || fat.targetGrams < 45) {
      errors.push({
        field: 'macronutrients.fat',
        code: 'FLOOR_BREACH',
        message: 'Fat target must meet physiological floor (>= 45g)',
      });
    } else if (fat.targetGrams % 5 !== 0) {
      errors.push({
        field: 'macronutrients.fat.targetGrams',
        code: 'UNROUNDED_VALUE',
        message: `Fat target (${fat.targetGrams}g) must be rounded to nearest 5g`,
      });
    }

    if (!carbohydrates || typeof carbohydrates.targetGrams !== 'number' || carbohydrates.targetGrams <= 0) {
      errors.push({
        field: 'macronutrients.carbohydrates',
        code: 'INVALID_VALUE',
        message: 'Carbohydrates target must be a positive number',
      });
    } else if (carbohydrates.targetGrams % 5 !== 0) {
      errors.push({
        field: 'macronutrients.carbohydrates.targetGrams',
        code: 'UNROUNDED_VALUE',
        message: `Carbohydrates target (${carbohydrates.targetGrams}g) must be rounded to nearest 5g`,
      });
    }

    // Energy balance consistency: totalCalculatedCalories within 5% of targetRange.midpointKcal
    if (t.energy?.targetRange?.midpointKcal) {
      const midpoint = t.energy.targetRange.midpointKcal;
      const deviation = Math.abs(totalCalculatedCalories - midpoint);
      const tolerance = midpoint * 0.05;
      if (deviation > tolerance) {
        errors.push({
          field: 'macronutrients.totalCalculatedCalories',
          code: 'ENERGY_DISCREPANCY',
          message: `Calculated macro calories (${totalCalculatedCalories}) deviates more than 5% from target midpoint (${midpoint})`,
        });
      }
    }
  }

  // 4. Immutability Verification
  if (!Object.isFrozen(t)) {
    errors.push({
      field: 'targets',
      code: 'MUTABLE_TARGETS',
      message: 'Nutrition targets object must be deeply frozen and immutable',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
