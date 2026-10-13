/**
 * useTodayDashboard Hook (Stage W8.1)
 *
 * Primary React hook powering the unified Today Dashboard screen.
 *
 * INVARIANTS:
 * - Aggregates validated data directly from underlying repositories and engines.
 * - Idempotent, safe mutations serialized through repository mutexes.
 * - Never alters authoritative daily targets.
 * - Population boundary protection maintained at all times.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOnboarding } from '../onboarding';
import { buildCanonicalUserProfile, validateCanonicalUserProfile } from '../profile';
import { useWorkoutPlan, generateWorkoutPlanFromProfile } from '../workout-plan';
import { defaultWorkoutHistoryRepository } from '../workout-history';
import type { WorkoutExecution } from '../workout-runtime';
import {
  runNutritionStrategyPipeline,
  generateNutritionPlan,
  initializeNutritionExecution,
  logMealExecution,
  resetMealExecutionSlot,
  calculateLoggedFoodNutrients,
  getFoodById,
  computeDailySummary,
  deepFreeze,
  defaultNutritionHistoryRepository,
  type NutritionExecution,
  type NutritionPlanRevision,
  type NutritionAdaptationRecommendation,
  deriveNutritionAdaptation,
  acceptPlanRevision,
  rejectPlanRevision,
  proposeStructureSimplificationRevision,
} from '../nutrition';
import type {
  TodayDashboardState,
  TodayTrainingSummary,
  TodayNutritionSummary,
  PopulationSafetyState,
} from './types';
import {
  resolveTodayTrainingSummary,
  resolveTodayNutritionSummary,
  resolveDashboardAdaptationAlerts,
  formatDateToDateString,
} from './dashboardSelectors';

export function useTodayDashboard() {
  const { data: onboardingData } = useOnboarding();
  const { activePlan: contextWorkoutPlan } = useWorkoutPlan();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const [workoutExecutions, setWorkoutExecutions] = useState<WorkoutExecution[]>([]);
  const [persistedWorkoutPlan, setPersistedWorkoutPlan] = useState<any>(null);

  const [historicalNutritionExecutions, setHistoricalNutritionExecutions] = useState<NutritionExecution[]>([]);
  const [todayNutritionExecution, setTodayNutritionExecution] = useState<NutritionExecution | null>(null);
  const [activePlanRevision, setActivePlanRevision] = useState<NutritionPlanRevision | null>(null);
  const [pendingRevision, setPendingRevision] = useState<NutritionPlanRevision | null>(null);

  const todayDateString = useMemo(() => formatDateToDateString(new Date()), []);

  // 1. Build & validate CanonicalUserProfile
  const profile = useMemo(() => buildCanonicalUserProfile(onboardingData), [onboardingData]);
  const profileValidation = useMemo(() => validateCanonicalUserProfile(profile), [profile]);

  // Determine population safety state
  const populationSafety: PopulationSafetyState = useMemo(() => {
    if (!profileValidation.valid) {
      if (profile.anthropometrics.age < 13) return 'ineligible';
      if (profile.anthropometrics.age < 18) return 'youth';
      return 'ineligible';
    }
    return 'adult';
  }, [profile, profileValidation.valid]);

  // 2. Training Plan: use context plan, or generate deterministically from profile if valid, or fall back to persisted
  const workoutPlan = useMemo(() => {
    if (contextWorkoutPlan) return contextWorkoutPlan;
    if (persistedWorkoutPlan) return persistedWorkoutPlan;
    if (profileValidation.valid && populationSafety === 'adult') {
      const generated = generateWorkoutPlanFromProfile(profile);
      if (generated && generated.status === 'success') {
        return generated.plan;
      }
    }
    return null;
  }, [contextWorkoutPlan, persistedWorkoutPlan, profileValidation.valid, populationSafety, profile]);

  // 3. Nutrition Strategy Pipeline
  const nutritionStrategyResult = useMemo(() => {
    if (!profileValidation.valid) return null;
    return runNutritionStrategyPipeline(profile);
  }, [profile, profileValidation.valid]);

  // 4. Baseline Nutrition Plan Generator
  const baselineNutritionPlan = useMemo(() => {
    if (
      !profileValidation.valid ||
      !nutritionStrategyResult ||
      nutritionStrategyResult.status !== 'completed'
    ) {
      return null;
    }
    const res = generateNutritionPlan(profile, nutritionStrategyResult.strategy);
    if (res && (res.status === 'success' || res.status === 'pending')) {
      return res.plan;
    }
    return null;
  }, [profile, profileValidation.valid, nutritionStrategyResult]);

  // 5. Active Nutrition Plan (accepted revision wins over baseline)
  const activeNutritionPlan = useMemo(() => {
    if (activePlanRevision && activePlanRevision.status === 'accepted') {
      return activePlanRevision.revisedPlan;
    }
    return baselineNutritionPlan;
  }, [activePlanRevision, baselineNutritionPlan]);

  // 6. Nutrition Adaptation Recommendation
  const adaptationRecommendation = useMemo(() => {
    if (
      !activeNutritionPlan ||
      !nutritionStrategyResult ||
      nutritionStrategyResult.status !== 'completed'
    ) {
      return null;
    }
    return deriveNutritionAdaptation({
      activePlan: activeNutritionPlan,
      strategy: nutritionStrategyResult.strategy,
      historicalExecutions: historicalNutritionExecutions,
    });
  }, [activeNutritionPlan, nutritionStrategyResult, historicalNutritionExecutions]);

  // 7. Load persistent repositories
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        wExecutions,
        wPlan,
        nExecutions,
        nActiveRevision,
        nAllRevisions,
        nTodayExec,
      ] = await Promise.all([
        defaultWorkoutHistoryRepository.getExecutions(),
        defaultWorkoutHistoryRepository.loadActivePlan(),
        defaultNutritionHistoryRepository.getExecutions(),
        defaultNutritionHistoryRepository.getActivePlanRevision(),
        defaultNutritionHistoryRepository.getRevisions(),
        defaultNutritionHistoryRepository.getExecutionByDate(todayDateString),
      ]);

      setWorkoutExecutions(wExecutions);
      setPersistedWorkoutPlan(wPlan);
      setHistoricalNutritionExecutions(nExecutions);
      setActivePlanRevision(nActiveRevision);

      // Find any revision awaiting review
      const pending = nAllRevisions.find((r) => r.status === 'pending_review') ?? null;
      setPendingRevision(pending);

      // Today's execution
      if (nTodayExec) {
        setTodayNutritionExecution(nTodayExec);
      } else if (activeNutritionPlan) {
        const fresh = initializeNutritionExecution(activeNutritionPlan, todayDateString);
        setTodayNutritionExecution(fresh);
        await defaultNutritionHistoryRepository.saveExecution(fresh).catch(() => {});
      }

      setHasError(false);
      setErrorMessage(undefined);
    } catch (err: any) {
      console.warn('[useTodayDashboard] Failed to hydrate dashboard state:', err);
      setHasError(true);
      setErrorMessage(err?.message ?? 'Failed to load daily dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [todayDateString, activeNutritionPlan]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If active plan was ready and today's execution was null, initialize it
  useEffect(() => {
    if (activeNutritionPlan && !todayNutritionExecution && !isLoading) {
      defaultNutritionHistoryRepository
        .getExecutionByDate(todayDateString)
        .then((existing) => {
          if (existing) {
            setTodayNutritionExecution(existing);
          } else {
            const fresh = initializeNutritionExecution(activeNutritionPlan, todayDateString);
            setTodayNutritionExecution(fresh);
            defaultNutritionHistoryRepository.saveExecution(fresh).catch(() => {});
          }
        });
    }
  }, [activeNutritionPlan, todayNutritionExecution, isLoading, todayDateString]);

  // 8. Derived Summaries
  const trainingSummary: TodayTrainingSummary = useMemo(() => {
    return resolveTodayTrainingSummary({
      plan: workoutPlan,
      executions: workoutExecutions,
      profile,
      todayDate: new Date(),
    });
  }, [workoutPlan, workoutExecutions, profile]);

  const nutritionSummary: TodayNutritionSummary = useMemo(() => {
    return resolveTodayNutritionSummary({
      plan: activeNutritionPlan,
      execution: todayNutritionExecution,
      strategy:
        nutritionStrategyResult?.status === 'completed'
          ? nutritionStrategyResult.strategy
          : null,
      profile,
      pendingRevision,
      adaptationRecommendation,
    });
  }, [
    activeNutritionPlan,
    todayNutritionExecution,
    nutritionStrategyResult,
    profile,
    pendingRevision,
    adaptationRecommendation,
  ]);

  const adaptationAlerts = useMemo(() => {
    return resolveDashboardAdaptationAlerts({
      training: trainingSummary,
      nutrition: nutritionSummary,
    });
  }, [trainingSummary, nutritionSummary]);

  // 9. Actions
  const logMealAsPlanned = useCallback(
    async (slotId: string) => {
      if (!activeNutritionPlan || !todayNutritionExecution) return;

      const slot = activeNutritionPlan.dailyPlan.slots.find((s) => s.slotId === slotId);
      if (!slot) return;

      // Extract planned food items from composition
      const plannedFoods =
        slot.composition && slot.composition.selectedFoods.length > 0
          ? slot.composition.selectedFoods.map((item) =>
              calculateLoggedFoodNutrients(item.food, item.portionUnits, 'planned_food')
            )
          : [];

      try {
        const updated = logMealExecution(
          todayNutritionExecution,
          activeNutritionPlan,
          slotId,
          plannedFoods,
          'completed'
        );

        setTodayNutritionExecution(updated);
        await defaultNutritionHistoryRepository.saveExecution(updated);

        const allExecs = await defaultNutritionHistoryRepository.getExecutions().catch(() => []);
        setHistoricalNutritionExecutions(allExecs);
      } catch (err: any) {
        console.warn('[useTodayDashboard] Failed to log meal as planned:', err);
        setHasError(true);
        setErrorMessage(err?.message ?? 'Failed to record planned meal intake.');
      }
    },
    [activeNutritionPlan, todayNutritionExecution]
  );

  const markMealSkipped = useCallback(
    async (slotId: string, notes?: string) => {
      if (!activeNutritionPlan || !todayNutritionExecution) return;

      try {
        const updated = logMealExecution(
          todayNutritionExecution,
          activeNutritionPlan,
          slotId,
          [],
          'skipped',
          notes
        );

        setTodayNutritionExecution(updated);
        await defaultNutritionHistoryRepository.saveExecution(updated);

        const allExecs = await defaultNutritionHistoryRepository.getExecutions().catch(() => []);
        setHistoricalNutritionExecutions(allExecs);
      } catch (err: any) {
        console.warn('[useTodayDashboard] Failed to mark meal skipped:', err);
        setHasError(true);
        setErrorMessage(err?.message ?? 'Failed to mark meal skipped.');
      }
    },
    [activeNutritionPlan, todayNutritionExecution]
  );

  const recordCustomMealIntake = useCallback(
    async (
      slotId: string,
      items: Array<{
        foodId: string;
        portionUnits: number;
        source?: 'planned_food' | 'catalog_substitution' | 'additional_food';
        substitutedFoodId?: string;
        notes?: string;
      }>,
      status: 'completed' | 'partial' = 'completed',
      mealNotes?: string
    ) => {
      if (!activeNutritionPlan || !todayNutritionExecution) return;

      try {
        const loggedFoods = items.map((item) => {
          const foodDef = getFoodById(item.foodId);
          if (!foodDef) {
            throw new Error(`Food "${item.foodId}" not found in authoritative food catalog.`);
          }
          return calculateLoggedFoodNutrients(
            foodDef,
            item.portionUnits,
            item.source ?? 'planned_food',
            item.substitutedFoodId,
            item.notes
          );
        });

        const updated = logMealExecution(
          todayNutritionExecution,
          activeNutritionPlan,
          slotId,
          loggedFoods,
          status,
          mealNotes
        );

        setTodayNutritionExecution(updated);
        await defaultNutritionHistoryRepository.saveExecution(updated);

        const allExecs = await defaultNutritionHistoryRepository.getExecutions().catch(() => []);
        setHistoricalNutritionExecutions(allExecs);
      } catch (err: any) {
        console.warn('[useTodayDashboard] Failed to record custom meal intake:', err);
        setHasError(true);
        setErrorMessage(err?.message ?? 'Failed to record custom meal intake.');
      }
    },
    [activeNutritionPlan, todayNutritionExecution]
  );

  const resetMealSlot = useCallback(
    async (slotId: string) => {
      if (!activeNutritionPlan || !todayNutritionExecution) return;

      try {
        const updated = resetMealExecutionSlot(
          todayNutritionExecution,
          activeNutritionPlan,
          slotId,
          'reset'
        );

        // If updated is same reference (was already not_started), no-op
        if (updated === todayNutritionExecution) {
          return;
        }

        setTodayNutritionExecution(updated);
        await defaultNutritionHistoryRepository.saveExecution(updated);

        const allExecs = await defaultNutritionHistoryRepository.getExecutions().catch(() => []);
        setHistoricalNutritionExecutions(allExecs);
      } catch (err: any) {
        console.warn('[useTodayDashboard] Failed to reset meal slot:', err);
        setHasError(true);
        setErrorMessage(err?.message ?? 'Failed to reset meal slot.');
      }
    },
    [activeNutritionPlan, todayNutritionExecution]
  );

  // Backward compatibility alias for toggleMealStatus
  const toggleMealStatus = useCallback(
    async (slotId: string, currentStatus: string) => {
      if (currentStatus === 'completed') {
        await markMealSkipped(slotId);
      } else if (currentStatus === 'skipped') {
        await resetMealSlot(slotId);
      } else {
        await logMealAsPlanned(slotId);
      }
    },
    [logMealAsPlanned, markMealSkipped, resetMealSlot]
  );

  const handleAcceptRevision = useCallback(
    async (revisionToAccept: NutritionPlanRevision) => {
      const accepted = acceptPlanRevision(revisionToAccept);
      await defaultNutritionHistoryRepository.saveRevision(accepted);
      await defaultNutritionHistoryRepository.setActivePlanId('active_revised_plan');
      setActivePlanRevision(accepted);
      setPendingRevision(null);
      await loadData();
    },
    [loadData]
  );

  const handleRejectRevision = useCallback(
    async (revisionToReject: NutritionPlanRevision) => {
      const rejected = rejectPlanRevision(revisionToReject);
      await defaultNutritionHistoryRepository.saveRevision(rejected);
      setPendingRevision(null);
      await loadData();
    },
    [loadData]
  );

  const handleProposeSimplification = useCallback(async () => {
    if (
      !activeNutritionPlan ||
      !nutritionStrategyResult ||
      nutritionStrategyResult.status !== 'completed' ||
      !adaptationRecommendation
    ) {
      return;
    }
    const proposed = proposeStructureSimplificationRevision(
      activeNutritionPlan,
      nutritionStrategyResult.strategy,
      adaptationRecommendation
    );
    await defaultNutritionHistoryRepository.saveRevision(proposed);
    setPendingRevision(proposed);
  }, [activeNutritionPlan, nutritionStrategyResult, adaptationRecommendation]);

  const dashboardState: TodayDashboardState = useMemo(() => {
    return {
      isLoading,
      hasError,
      errorMessage,
      population: populationSafety,
      userGoalLabel: profile.goal.primary?.replace(/_/g, ' '),
      todayDateString,
      training: trainingSummary,
      nutrition: nutritionSummary,
      adaptationAlerts,
    };
  }, [
    isLoading,
    hasError,
    errorMessage,
    populationSafety,
    profile.goal.primary,
    todayDateString,
    trainingSummary,
    nutritionSummary,
    adaptationAlerts,
  ]);

  // Window bridge for tests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__TODAY_DASHBOARD_STATE__ = dashboardState;
    }
  }, [dashboardState]);

  return {
    state: dashboardState,
    trainingSummary,
    nutritionSummary,
    adaptationAlerts,
    pendingRevision,
    activeNutritionPlan,
    toggleMealStatus,
    logMealAsPlanned,
    markMealSkipped,
    recordCustomMealIntake,
    resetMealSlot,
    handleAcceptRevision,
    handleRejectRevision,
    handleProposeSimplification,
    refresh: loadData,
  };
}
