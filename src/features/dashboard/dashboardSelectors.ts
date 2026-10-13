/**
 * Today Dashboard Pure Selectors (Stage W8.1)
 *
 * Deterministic selector functions aggregating training, nutrition, and adaptation states.
 *
 * INVARIANTS:
 * - 100% pure functions, side-effect free.
 * - Missing records never imply zero consumption or completed workouts.
 * - Authoritative targets remain immutable and separate from logged intake.
 * - Population guards strictly block fabricated quantitative numbers.
 */

import type { DayOfWeek, CanonicalUserProfile } from '../profile';
import type { WorkoutPlan, WorkoutSession } from '../workout-plan';
import type { WorkoutExecution } from '../workout-runtime';
import type {
  NutritionPlan,
  NutritionExecution,
  NutritionPlanRevision,
  NutritionAdaptationRecommendation,
  NutritionStrategy,
} from '../nutrition';
import type {
  TodayTrainingSummary,
  TodayTrainingStatus,
  TodayNutritionSummary,
  TodayNutritionStatus,
  NutrientComparison,
  TodayDashboardState,
} from './types';

export const DAY_OF_WEEK_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

/**
 * Determines DayOfWeek from a Date instance.
 */
export function getDayOfWeekFromDate(date: Date = new Date()): DayOfWeek {
  const dayIndex = date.getDay();
  return DAY_OF_WEEK_MAP[dayIndex] ?? 'mon';
}

/**
 * Checks if today is an available training day according to profile availability.
 * If availableDays is empty or undefined, defaults to true (training permitted).
 */
export function isTodayAvailableTrainingDay(
  availableDays?: DayOfWeek[],
  date: Date = new Date()
): boolean {
  if (!availableDays || availableDays.length === 0) {
    return true;
  }
  const currentDay = getDayOfWeekFromDate(date);
  return availableDays.includes(currentDay);
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDateToDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Purely resolves Today's training state from plan, executions, and profile schedule.
 */
export function resolveTodayTrainingSummary(params: {
  plan: WorkoutPlan | null;
  executions: readonly WorkoutExecution[];
  profile?: CanonicalUserProfile | null;
  todayDate?: Date;
}): TodayTrainingSummary {
  const { plan, executions, profile, todayDate = new Date() } = params;
  const currentDayOfWeek = getDayOfWeekFromDate(todayDate);
  const todayDateString = formatDateToDateString(todayDate);

  if (!plan || !plan.sessions || plan.sessions.length === 0) {
    return {
      status: 'no_plan',
      isScheduledTrainingDay: false,
      dayOfWeek: currentDayOfWeek,
      activePlan: null,
      currentSession: null,
      activeExecution: null,
      latestCompletedExecutionToday: null,
      nextUpcomingSession: null,
      totalCycleSessions: 0,
    };
  }

  const sessions = plan.sessions;
  const isScheduledDay = isTodayAvailableTrainingDay(
    profile?.schedule?.availableDays,
    todayDate
  );

  // Check for executions completed or started today
  const todaysExecutions = executions.filter((e) => {
    const timestamp = e.completedAtTimestamp ?? e.startedAtTimestamp;
    if (!timestamp) return false;
    const execDateString = new Date(timestamp).toISOString().split('T')[0];
    return execDateString === todayDateString;
  });

  const activeExec = executions.find((e) => e.status === 'in_progress') ?? null;
  const completedTodayExec =
    todaysExecutions.find((e) => e.status === 'completed') ?? null;

  // Determine next upcoming session in the cycle based on completed history
  const completedHistory = executions.filter((e) => e.status === 'completed');
  let nextSessionIndex = 0;
  if (completedHistory.length > 0) {
    const lastCompleted = completedHistory[completedHistory.length - 1];
    const lastSessionIndex = sessions.findIndex(
      (s) => s.sessionId === lastCompleted.sessionId
    );
    if (lastSessionIndex >= 0) {
      nextSessionIndex = (lastSessionIndex + 1) % sessions.length;
    }
  }
  const nextUpcomingSession = sessions[nextSessionIndex] ?? sessions[0];

  // Determine status and current session
  let status: TodayTrainingStatus = 'planned';
  let currentSession: WorkoutSession | null = nextUpcomingSession;

  if (activeExec) {
    status = 'in_progress';
    currentSession =
      sessions.find((s) => s.sessionId === activeExec.sessionId) ??
      nextUpcomingSession;
  } else if (completedTodayExec) {
    status = 'completed';
    currentSession =
      sessions.find((s) => s.sessionId === completedTodayExec.sessionId) ??
      nextUpcomingSession;
  } else if (!isScheduledDay) {
    status = 'rest_day';
    currentSession = null;
  } else {
    status = 'planned';
    currentSession = nextUpcomingSession;
  }

  return {
    status,
    isScheduledTrainingDay: isScheduledDay,
    dayOfWeek: currentDayOfWeek,
    activePlan: plan,
    currentSession,
    activeExecution: activeExec,
    latestCompletedExecutionToday: completedTodayExec,
    nextUpcomingSession,
    totalCycleSessions: sessions.length,
  };
}

/**
 * Purely resolves Today's nutrition state from plan, execution, strategy, and profile.
 */
export function resolveTodayNutritionSummary(params: {
  plan: NutritionPlan | null;
  execution: NutritionExecution | null;
  strategy?: NutritionStrategy | null;
  profile?: CanonicalUserProfile | null;
  pendingRevision?: NutritionPlanRevision | null;
  adaptationRecommendation?: NutritionAdaptationRecommendation | null;
}): TodayNutritionSummary {
  const {
    plan,
    execution,
    strategy,
    profile,
    pendingRevision = null,
    adaptationRecommendation = null,
  } = params;

  // 1. Determine population status
  let status: TodayNutritionStatus = 'ready';
  if (!plan) {
    status = 'no_plan';
  } else if (profile && profile.anthropometrics.age < 13) {
    status = 'ineligible';
  } else if (profile && profile.anthropometrics.age < 18) {
    status = 'youth_protection_pending';
  } else if (
    strategy?.quantitativeReadiness.status === 'pending_required_inputs' ||
    !strategy?.quantitativeReadiness.canCalculateCalories
  ) {
    status = 'qualitative_only';
  }

  if (status === 'no_plan' || !plan) {
    return {
      status,
      activePlan: null,
      execution: null,
      isPartiallyLogged: false,
      isFullyResolved: false,
      hasAnyIntakeLogged: false,
      plannedTargets: null,
      loggedIntake: null,
      remainingDifference: null,
      mealSlots: [],
      pendingRevision,
      adaptationRecommendation,
    };
  }

  // 2. Map meal slots
  const mealExecs = execution?.mealExecutions ?? [];
  let resolvedSlotsCount = 0;
  let hasAnyIntake = false;

  const mealSlots = plan.dailyPlan.slots.map((slot) => {
    const mealExec = mealExecs.find((me) => me.mealSlotId === slot.slotId);
    const slotStatus = mealExec?.status ?? 'not_started';

    if (slotStatus === 'completed' || slotStatus === 'partial' || slotStatus === 'skipped') {
      resolvedSlotsCount += 1;
    }

    const loggedFoods = mealExec?.loggedFoods ?? [];
    if (loggedFoods.length > 0 || slotStatus === 'completed' || slotStatus === 'partial') {
      hasAnyIntake = true;
    }

    const loggedFoodNames = loggedFoods.map((f) => f.foodName);
    const allowedFoodsPreview =
      slot.composition?.selectedFoods?.slice(0, 3).map((f) => f.food.name) ??
      slot.recommendedLikedFoods ??
      [];

    const plannedFoods =
      slot.composition?.selectedFoods?.map((f) => ({
        foodId: f.food.id,
        foodName: f.food.name,
        portionUnits: f.portionUnits,
        servingDescription: f.servingDescription,
      })) ?? [];

    return {
      slotId: slot.slotId,
      slotName: slot.name,
      scheduledTimeWindow: slot.suggestedTiming,
      status: slotStatus,
      targetCalories: slot.targets?.targetEnergyKcal,
      loggedCalories: mealExec?.consumedCalories,
      loggedFoodNames,
      allowedFoodsPreview,
      loggedFoods,
      plannedFoods,
      notes: mealExec?.notes,
      hasCorrections: (mealExec?.supersededHistory?.length ?? 0) > 0,
      correctionCount: mealExec?.supersededHistory?.length ?? 0,
    };
  });

  const totalSlots = mealSlots.length;
  const isFullyResolved = totalSlots > 0 && resolvedSlotsCount === totalSlots;
  const isPartiallyLogged = resolvedSlotsCount > 0 && !isFullyResolved;

  // 3. Quantitative targets vs logged intake
  let plannedTargets: NutrientComparison | null = null;
  let loggedIntake: NutrientComparison | null = null;
  let remainingDifference: NutrientComparison | null = null;

  if (status === 'ready' && plan.nutritionTargets) {
    const energy = plan.nutritionTargets.energy.targetRange.midpointKcal;
    const macros = plan.nutritionTargets.macronutrients;

    plannedTargets = {
      calories: energy,
      proteinGrams: macros.protein.targetGrams,
      fatGrams: macros.fat.targetGrams,
      carbsGrams: macros.carbohydrates.targetGrams,
    };

    const daily = execution?.summary ?? {
      consumedCalories: 0,
      consumedProteinG: 0,
      consumedFatG: 0,
      consumedCarbohydratesG: 0,
    };

    loggedIntake = {
      calories: daily.consumedCalories,
      proteinGrams: daily.consumedProteinG,
      fatGrams: daily.consumedFatG,
      carbsGrams: daily.consumedCarbohydratesG,
    };

    remainingDifference = {
      calories: plannedTargets.calories - loggedIntake.calories,
      proteinGrams: plannedTargets.proteinGrams - loggedIntake.proteinGrams,
      fatGrams: plannedTargets.fatGrams - loggedIntake.fatGrams,
      carbsGrams: plannedTargets.carbsGrams - loggedIntake.carbsGrams,
    };
  }

  return {
    status,
    activePlan: plan,
    execution,
    isPartiallyLogged,
    isFullyResolved,
    hasAnyIntakeLogged: hasAnyIntake,
    plannedTargets,
    loggedIntake,
    remainingDifference,
    mealSlots,
    pendingRevision,
    adaptationRecommendation,
  };
}

/**
 * Purely aggregates adaptation alerts for the daily dashboard.
 */
export function resolveDashboardAdaptationAlerts(params: {
  training: TodayTrainingSummary;
  nutrition: TodayNutritionSummary;
}): TodayDashboardState['adaptationAlerts'] {
  const { training, nutrition } = params;
  const alerts: TodayDashboardState['adaptationAlerts'] = [];

  // Recovery constraints alert from WorkoutPlan
  const recoveryContext = training.activePlan?.recoveryContext;
  if (
    recoveryContext &&
    (recoveryContext.level === 'constrained' ||
      recoveryContext.level === 'strongly_constrained' ||
      recoveryContext.deloadDecision === 'recommend')
  ) {
    alerts.push({
      id: 'alert_recovery_constraint',
      type: 'recovery',
      title: 'Active Recovery Constraints',
      description: `Training load is adapted: ${recoveryContext.activeConstraintsSummary.join(', ') || recoveryContext.level.replace(/_/g, ' ')}.`,
      actionLabel: 'View Training Plan',
      actionType: 'view_plan',
    });
  }

  // Nutrition revision pending review
  if (nutrition.pendingRevision && nutrition.pendingRevision.status === 'pending_review') {
    alerts.push({
      id: 'alert_nutrition_revision_pending',
      type: 'nutrition_revision',
      title: 'Nutrition Plan Revision Awaiting Review',
      description:
        nutrition.pendingRevision.revisionReason === 'simplify_structure'
          ? 'Based on repeated meal skipping, a simplified meal structure is proposed. Daily calorie and macro targets are 100% preserved.'
          : 'Based on your frequent substitutions, updated meal choices are proposed with full dietary protection.',
      actionLabel: 'Review Proposed Revision',
      actionType: 'review_revision',
    });
  } else if (
    nutrition.adaptationRecommendation &&
    nutrition.adaptationRecommendation.primaryAction === 'simplify_structure'
  ) {
    alerts.push({
      id: 'alert_nutrition_pattern_skipping',
      type: 'nutrition_pattern',
      title: 'Meal Structure Optimization Available',
      description: nutrition.adaptationRecommendation.summary,
      actionLabel: 'Review Recommendation',
      actionType: 'review_revision',
    });
  }

  return alerts;
}
