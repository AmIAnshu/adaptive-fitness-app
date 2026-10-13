/**
 * Today Dashboard Types (Stage W8.1)
 *
 * Defines strongly-typed contracts for the unified daily dashboard experience.
 *
 * INVARIANTS:
 * 1. Read-only aggregation: derived factually from validated repositories and engines.
 * 2. Unambiguous nutrition distinctions: planned target vs logged intake vs remaining difference.
 * 3. Never equates missing records with zero consumption or completed training.
 * 4. Respects youth, ineligible, and qualitative-only boundaries without fabricating numbers.
 * 5. Deep immutability and deterministic state transitions.
 */

import type { DayOfWeek, CanonicalUserProfile } from '../profile';
import type { WorkoutPlan, WorkoutSession } from '../workout-plan';
import type { WorkoutExecution, WorkoutExecutionStatus } from '../workout-runtime';
import type {
  NutritionPlan,
  NutritionExecution,
  NutritionPlanRevision,
  NutritionAdaptationRecommendation,
  MealExecution,
} from '../nutrition';

export type TodayTrainingStatus =
  | 'no_plan'
  | 'rest_day'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'abandoned';

export interface TodayTrainingSummary {
  status: TodayTrainingStatus;
  isScheduledTrainingDay: boolean;
  dayOfWeek: DayOfWeek;
  activePlan: WorkoutPlan | null;
  currentSession: WorkoutSession | null;
  activeExecution: WorkoutExecution | null;
  latestCompletedExecutionToday: WorkoutExecution | null;
  nextUpcomingSession: WorkoutSession | null;
  totalCycleSessions: number;
}

export type TodayNutritionStatus =
  | 'no_plan'
  | 'youth_protection_pending'
  | 'ineligible'
  | 'qualitative_only'
  | 'ready';

export interface NutrientComparison {
  calories: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

export interface TodayNutritionSummary {
  status: TodayNutritionStatus;
  activePlan: NutritionPlan | null;
  execution: NutritionExecution | null;
  isPartiallyLogged: boolean;
  isFullyResolved: boolean;
  hasAnyIntakeLogged: boolean;
  plannedTargets: NutrientComparison | null;
  loggedIntake: NutrientComparison | null;
  remainingDifference: NutrientComparison | null;
  mealSlots: Array<{
    slotId: string;
    slotName: string;
    scheduledTimeWindow?: string;
    status: 'not_started' | 'completed' | 'partial' | 'skipped';
    targetCalories?: number;
    loggedCalories?: number;
    loggedFoodNames: string[];
    allowedFoodsPreview: string[];
    loggedFoods?: import('../nutrition').LoggedFoodItem[];
    plannedFoods?: Array<{
      foodId: string;
      foodName: string;
      portionUnits: number;
      servingDescription: string;
    }>;
    notes?: string;
    hasCorrections?: boolean;
    correctionCount?: number;
  }>;
  pendingRevision: NutritionPlanRevision | null;
  adaptationRecommendation: NutritionAdaptationRecommendation | null;
}

export type PopulationSafetyState = 'adult' | 'youth' | 'ineligible';

export interface TodayDashboardState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  population: PopulationSafetyState;
  userGoalLabel?: string;
  todayDateString: string;
  training: TodayTrainingSummary;
  nutrition: TodayNutritionSummary;
  adaptationAlerts: Array<{
    id: string;
    type: 'recovery' | 'nutrition_revision' | 'nutrition_pattern' | 'info';
    title: string;
    description: string;
    actionLabel?: string;
    actionType?: 'review_revision' | 'view_plan' | 'none';
  }>;
}
