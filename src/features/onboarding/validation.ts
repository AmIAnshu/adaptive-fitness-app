/**
 * Onboarding Validation & Unit Conversion Utilities
 *
 * All internal values are strictly normalized to metric (cm, kg).
 * Helper functions convert display values to/from imperial units.
 */

import { HeightUnit, WeightUnit, BiologicalSex } from './onboardingState';

export const VALIDATION_LIMITS = {
  age: { min: 13, max: 100 },
  heightCm: { min: 90, max: 250 },
  heightFt: { min: 3, max: 8 },
  heightIn: { min: 0, max: 11 },
  weightKg: { min: 30, max: 300 },
  weightLb: { min: 66, max: 660 },
};

// Unit conversions
export function ftInToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * 2.54);
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 12) {
    return { feet: feet + 1, inches: 0 };
  }
  return { feet, inches };
}

export function lbToKg(lb: number): number {
  return Math.round((lb / 2.20462) * 10) / 10;
}

export function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462);
}

// Field Validators
export interface ValidationResult<T> {
  isValid: boolean;
  value?: T;
  error?: string;
}

export function validateAge(input: string): ValidationResult<number> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Age is required' };
  }

  // Must be an integer
  if (!/^\d+$/.test(trimmed)) {
    return { isValid: false, error: 'Please enter a whole number' };
  }

  const age = parseInt(trimmed, 10);
  if (age < VALIDATION_LIMITS.age.min || age > VALIDATION_LIMITS.age.max) {
    return {
      isValid: false,
      error: `Age must be between ${VALIDATION_LIMITS.age.min} and ${VALIDATION_LIMITS.age.max}`,
    };
  }

  return { isValid: true, value: age };
}

export function validateHeightMetric(cmStr: string): ValidationResult<number> {
  const trimmed = cmStr.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Height is required' };
  }

  const cm = parseFloat(trimmed);
  if (isNaN(cm) || cm < VALIDATION_LIMITS.heightCm.min || cm > VALIDATION_LIMITS.heightCm.max) {
    return {
      isValid: false,
      error: `Height must be between ${VALIDATION_LIMITS.heightCm.min} and ${VALIDATION_LIMITS.heightCm.max} cm`,
    };
  }

  return { isValid: true, value: Math.round(cm) };
}

export function validateHeightImperial(
  ftStr: string,
  inStr: string
): ValidationResult<number> {
  const trimmedFt = ftStr.trim();
  const trimmedIn = inStr.trim();

  if (!trimmedFt) {
    return { isValid: false, error: 'Feet is required' };
  }

  const feet = parseInt(trimmedFt, 10);
  const inches = trimmedIn ? parseInt(trimmedIn, 10) : 0;

  if (isNaN(feet) || feet < VALIDATION_LIMITS.heightFt.min || feet > VALIDATION_LIMITS.heightFt.max) {
    return {
      isValid: false,
      error: `Feet must be between ${VALIDATION_LIMITS.heightFt.min} and ${VALIDATION_LIMITS.heightFt.max}`,
    };
  }

  if (isNaN(inches) || inches < VALIDATION_LIMITS.heightIn.min || inches > VALIDATION_LIMITS.heightIn.max) {
    return {
      isValid: false,
      error: `Inches must be between ${VALIDATION_LIMITS.heightIn.min} and ${VALIDATION_LIMITS.heightIn.max}`,
    };
  }

  const cm = ftInToCm(feet, inches);
  if (cm < VALIDATION_LIMITS.heightCm.min || cm > VALIDATION_LIMITS.heightCm.max) {
    return { isValid: false, error: 'Height is out of realistic range' };
  }

  return { isValid: true, value: cm };
}

export function validateWeight(
  input: string,
  unit: WeightUnit
): ValidationResult<number> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Weight is required' };
  }

  const val = parseFloat(trimmed);
  if (isNaN(val)) {
    return { isValid: false, error: 'Please enter a valid weight' };
  }

  if (unit === 'kg') {
    if (val < VALIDATION_LIMITS.weightKg.min || val > VALIDATION_LIMITS.weightKg.max) {
      return {
        isValid: false,
        error: `Weight must be between ${VALIDATION_LIMITS.weightKg.min} and ${VALIDATION_LIMITS.weightKg.max} kg`,
      };
    }
    return { isValid: true, value: Math.round(val * 10) / 10 };
  } else {
    if (val < VALIDATION_LIMITS.weightLb.min || val > VALIDATION_LIMITS.weightLb.max) {
      return {
        isValid: false,
        error: `Weight must be between ${VALIDATION_LIMITS.weightLb.min} and ${VALIDATION_LIMITS.weightLb.max} lb`,
      };
    }
    return { isValid: true, value: lbToKg(val) };
  }
}

export function validateBiologicalSex(
  input?: unknown
): ValidationResult<BiologicalSex | undefined> {
  if (input === undefined || input === null || input === '') {
    return { isValid: true, value: undefined };
  }
  if (input === 'female' || input === 'male' || input === 'prefer_not_to_say') {
    return { isValid: true, value: input as BiologicalSex };
  }
  return { isValid: false, error: 'Invalid biological sex selection' };
}
