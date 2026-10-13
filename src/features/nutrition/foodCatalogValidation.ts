/**
 * Food Catalog Validation (Stage W7.5)
 *
 * Enforces data quality, structural invariants, and nutritional integrity
 * on the food catalog.
 */

import type { FoodDefinition } from './foodCatalogTypes';

export type FoodCatalogValidationError = {
  foodId?: string;
  field: string;
  code: string;
  message: string;
};

export type FoodCatalogValidationResult = {
  valid: boolean;
  errors: FoodCatalogValidationError[];
};

export function validateFoodCatalog(catalog: readonly FoodDefinition[]): FoodCatalogValidationResult {
  const errors: FoodCatalogValidationError[] = [];

  if (!Array.isArray(catalog) || catalog.length === 0) {
    return {
      valid: false,
      errors: [
        {
          field: 'catalog',
          code: 'EMPTY_CATALOG',
          message: 'Food catalog must be a non-empty array',
        },
      ],
    };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < catalog.length; i++) {
    const food = catalog[i];
    const foodId = food?.id || `index_${i}`;

    // 1. Identification
    if (!food.id || typeof food.id !== 'string') {
      errors.push({
        foodId,
        field: 'id',
        code: 'INVALID_ID',
        message: 'Food id must be a non-empty string',
      });
    } else if (seenIds.has(food.id)) {
      errors.push({
        foodId,
        field: 'id',
        code: 'DUPLICATE_ID',
        message: `Duplicate food id detected: ${food.id}`,
      });
    } else {
      seenIds.add(food.id);
    }

    if (!food.name || typeof food.name !== 'string') {
      errors.push({
        foodId,
        field: 'name',
        code: 'INVALID_NAME',
        message: 'Food name must be a non-empty string',
      });
    }

    // 2. Reference values
    if (typeof food.referenceAmount !== 'number' || isNaN(food.referenceAmount) || food.referenceAmount <= 0) {
      errors.push({
        foodId,
        field: 'referenceAmount',
        code: 'INVALID_REFERENCE_AMOUNT',
        message: 'referenceAmount must be a positive number',
      });
    }

    if (!['g', 'ml', 'piece', 'tbsp'].includes(food.referenceUnit)) {
      errors.push({
        foodId,
        field: 'referenceUnit',
        code: 'INVALID_REFERENCE_UNIT',
        message: `Invalid referenceUnit: ${food.referenceUnit}`,
      });
    }

    // 3. Nutritional values (rejection of NaN, Infinity, negative values)
    const checkNutrient = (field: 'caloriesPerReference' | 'proteinPerReference' | 'fatPerReference' | 'carbohydratesPerReference') => {
      const val = food[field];
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val) || val < 0) {
        errors.push({
          foodId,
          field,
          code: 'INVALID_NUTRIENT_VALUE',
          message: `${field} must be a non-negative finite number, received ${val}`,
        });
      }
    };

    checkNutrient('caloriesPerReference');
    checkNutrient('proteinPerReference');
    checkNutrient('fatPerReference');
    checkNutrient('carbohydratesPerReference');

    // 4. Portion bounds
    if (typeof food.minPortionUnits !== 'number' || food.minPortionUnits <= 0) {
      errors.push({
        foodId,
        field: 'minPortionUnits',
        code: 'INVALID_PORTION_BOUNDS',
        message: 'minPortionUnits must be greater than zero',
      });
    }
    if (typeof food.maxPortionUnits !== 'number' || food.maxPortionUnits < food.minPortionUnits) {
      errors.push({
        foodId,
        field: 'maxPortionUnits',
        code: 'INVALID_PORTION_BOUNDS',
        message: 'maxPortionUnits must be greater than or equal to minPortionUnits',
      });
    }
    if (typeof food.defaultPortionUnits !== 'number' || food.defaultPortionUnits < food.minPortionUnits || food.defaultPortionUnits > food.maxPortionUnits) {
      errors.push({
        foodId,
        field: 'defaultPortionUnits',
        code: 'INVALID_PORTION_BOUNDS',
        message: 'defaultPortionUnits must fall between minPortionUnits and maxPortionUnits',
      });
    }

    // 5. Diet compatibility & restrictions
    if (!Array.isArray(food.compatibleDietTypes) || food.compatibleDietTypes.length === 0) {
      errors.push({
        foodId,
        field: 'compatibleDietTypes',
        code: 'REQUIRED',
        message: 'compatibleDietTypes must be a non-empty array',
      });
    }

    if (!Array.isArray(food.excludedByRestrictions)) {
      errors.push({
        foodId,
        field: 'excludedByRestrictions',
        code: 'REQUIRED',
        message: 'excludedByRestrictions must be an array',
      });
    }

    // 6. Meal Roles
    if (!Array.isArray(food.mealRoles) || food.mealRoles.length === 0) {
      errors.push({
        foodId,
        field: 'mealRoles',
        code: 'REQUIRED',
        message: 'mealRoles must be a non-empty array',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
