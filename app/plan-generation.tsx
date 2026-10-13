/**
 * Real Adaptive Plan Generation Screen (Stage W5.1)
 *
 * Route: /plan-generation
 *
 * Replaces the development placeholder with the real, deterministic
 * Adaptive Fitness training pipeline:
 *
 * OnboardingData → CanonicalUserProfile → Population Guard →
 * T1–T10 Strategy Pipeline → W2 Session Skeleton → W3 Exact Prescription →
 * Real prescribed WorkoutPlan (v1) → Workout Player (W4.2)
 *
 * INVARIANTS:
 * - Deterministic, pure generation; zero fake artificial thinking delays.
 * - Population boundary protection: youth held at youth_strategy_pending, ineligible blocked.
 * - Stores generated plan in app-level memory state (WorkoutPlanState).
 * - Multi-session support: lists all generated sessions with sequence order and direct launch CTAs.
 */

import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../src/theme';
import { PrimaryButton } from '../src/components';
import { useOnboarding } from '../src/features/onboarding';
import {
  buildCanonicalUserProfile,
  validateCanonicalUserProfile,
} from '../src/features/profile';
import {
  generateWorkoutPlanFromProfile,
  useWorkoutPlan,
} from '../src/features/workout-plan';
import {
  defaultWorkoutHistoryRepository,
  type WorkoutAdaptationContext,
} from '../src/features/workout-history';
import {
  runNutritionStrategyPipeline,
  generateNutritionPlan,
  initializeNutritionExecution,
  logMealExecution,
  calculateLoggedFoodNutrients,
  defaultNutritionHistoryRepository,
  type NutritionExecution,
  type NutritionPlanRevision,
  type NutritionAdaptationRecommendation,
  deriveNutritionAdaptation,
  proposeStructureSimplificationRevision,
  acceptPlanRevision,
  rejectPlanRevision,
} from '../src/features/nutrition';

export default function PlanGenerationScreen() {
  const router = useRouter();
  const { data } = useOnboarding();
  const { setPlanAndResult, activePlan } = useWorkoutPlan();
  const [adaptationContext, setAdaptationContext] = React.useState<WorkoutAdaptationContext | undefined>(undefined);

  // Load persistent execution history to provide real adaptation inputs if history exists
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      defaultWorkoutHistoryRepository.getExecutions(),
      defaultWorkoutHistoryRepository.loadActivePlan(),
    ])
      .then(([executions, prevPlan]) => {
        if (!isMounted) return;
        if (executions.length > 0) {
          const completed = executions.filter((e) => e.status === 'completed');
          const latestCompleted = completed[completed.length - 1];
          setAdaptationContext({
            historicalExecutions: executions,
            previousPlan: prevPlan ?? undefined,
            previousConstraintLevel: prevPlan?.recoveryContext?.level,
            latestSubjectiveFeedback: latestCompleted?.sessionFeedback,
          });
        }
      })
      .catch((err) => {
        console.warn('[PlanGenerationScreen] Failed to load adaptation context:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Normalize raw onboarding answers into canonical user profile
  const profile = useMemo(() => buildCanonicalUserProfile(data), [data]);

  // 2. Validate normalized profile against domain invariants
  const profileValidation = useMemo(
    () => validateCanonicalUserProfile(profile),
    [profile]
  );

  // 3. Run real workout plan generation orchestration pipeline
  const generationResult = useMemo(() => {
    if (!profileValidation.valid) {
      return null;
    }
    return generateWorkoutPlanFromProfile(profile, { adaptationContext });
  }, [profile, profileValidation.valid, adaptationContext]);

  // 3b. Run real nutrition strategy pipeline
  const nutritionResult = useMemo(() => {
    if (!profileValidation.valid) {
      return null;
    }
    return runNutritionStrategyPipeline(profile);
  }, [profile, profileValidation.valid]);

  // 3c. Run real nutrition plan generator (Stage W7.4)
  const nutritionPlanResult = useMemo(() => {
    if (!profileValidation.valid || !nutritionResult || nutritionResult.status !== 'completed') {
      return null;
    }
    return generateNutritionPlan(profile, nutritionResult.strategy);
  }, [profile, profileValidation.valid, nutritionResult]);

  // 3d. Nutrition Execution Tracking & Adaptation (Stage W7.6 & W7.7)
  const todayDateString = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [nutritionExecution, setNutritionExecution] = React.useState<NutritionExecution | null>(null);
  const [historicalNutritionExecutions, setHistoricalNutritionExecutions] = React.useState<NutritionExecution[]>([]);
  const [activePlanRevision, setActivePlanRevision] = React.useState<NutritionPlanRevision | null>(null);
  const [previewRevision, setPreviewRevision] = React.useState<NutritionPlanRevision | null>(null);

  // Load historical nutrition executions & active plan revision
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      defaultNutritionHistoryRepository.getExecutions(),
      defaultNutritionHistoryRepository.getActivePlanRevision(),
    ])
      .then(([execs, activeRev]) => {
        if (!isMounted) return;
        setHistoricalNutritionExecutions(execs);
        setActivePlanRevision(activeRev);
      })
      .catch((err) => {
        console.warn('[PlanGenerationScreen] Failed to load nutrition history/revision:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Determine active plan (revised plan if accepted, otherwise baseline generated plan)
  const activeNutritionPlan = useMemo(() => {
    if (activePlanRevision && activePlanRevision.status === 'accepted') {
      return activePlanRevision.revisedPlan;
    }
    if (nutritionPlanResult && (nutritionPlanResult.status === 'success' || nutritionPlanResult.status === 'pending')) {
      return nutritionPlanResult.plan;
    }
    return null;
  }, [activePlanRevision, nutritionPlanResult]);

  // Compute nutrition adaptation recommendation from active nutrition plan and history
  const adaptationRecommendation = useMemo(() => {
    if (!activeNutritionPlan || !nutritionResult || nutritionResult.status !== 'completed') {
      return null;
    }
    return deriveNutritionAdaptation({
      activePlan: activeNutritionPlan,
      strategy: nutritionResult.strategy,
      historicalExecutions: historicalNutritionExecutions,
    });
  }, [activeNutritionPlan, nutritionResult, historicalNutritionExecutions]);

  // Load existing nutrition execution for today or initialize new one from active plan
  useEffect(() => {
    let isMounted = true;
    if (!activeNutritionPlan) {
      return;
    }

    defaultNutritionHistoryRepository
      .getExecutionByDate(todayDateString)
      .then((existing) => {
        if (!isMounted) return;
        if (existing) {
          setNutritionExecution(existing);
        } else {
          const fresh = initializeNutritionExecution(activeNutritionPlan, todayDateString);
          setNutritionExecution(fresh);
          defaultNutritionHistoryRepository.saveExecution(fresh).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[PlanGenerationScreen] Failed to load nutrition execution:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeNutritionPlan, todayDateString]);

  // Handler to toggle meal completion / mark eaten
  const handleLogMeal = React.useCallback(
    async (slotId: string, currentStatus: string) => {
      if (!activeNutritionPlan || !nutritionExecution) {
        return;
      }
      const plan = activeNutritionPlan;
      const slot = plan.dailyPlan.slots.find((s) => s.slotId === slotId);
      if (!slot) return;

      // Toggle status: if completed -> skipped; if skipped -> completed
      const nextStatus: 'completed' | 'skipped' = currentStatus === 'completed' ? 'skipped' : 'completed';

      const loggedFoods =
        nextStatus === 'completed' && slot.composition && slot.composition.selectedFoods.length > 0
          ? slot.composition.selectedFoods.map((item) =>
              calculateLoggedFoodNutrients(item.food, item.portionUnits, 'planned_food')
            )
          : [];

      try {
        const updated = logMealExecution(
          nutritionExecution,
          plan,
          slotId,
          loggedFoods,
          nextStatus
        );
        setNutritionExecution(updated);
        await defaultNutritionHistoryRepository.saveExecution(updated);
        const updatedExecs = await defaultNutritionHistoryRepository.getExecutions();
        setHistoricalNutritionExecutions(updatedExecs);
      } catch (err) {
        console.warn('[PlanGenerationScreen] Failed to log meal execution:', err);
      }
    },
    [activeNutritionPlan, nutritionExecution]
  );

  // Proposed revision actions
  const handlePreviewSimplification = React.useCallback(() => {
    if (!activeNutritionPlan || !nutritionResult || nutritionResult.status !== 'completed' || !adaptationRecommendation) {
      return;
    }
    const revision = proposeStructureSimplificationRevision(
      activeNutritionPlan,
      nutritionResult.strategy,
      adaptationRecommendation
    );
    setPreviewRevision(revision);
  }, [activeNutritionPlan, nutritionResult, adaptationRecommendation]);

  const handleAcceptRevision = React.useCallback(async () => {
    if (!previewRevision) return;
    try {
      const accepted = acceptPlanRevision(previewRevision);
      await defaultNutritionHistoryRepository.saveRevision(accepted);
      setActivePlanRevision(accepted);
      setPreviewRevision(null);

      // Re-initialize today's execution with new slots
      const freshExec = initializeNutritionExecution(accepted.revisedPlan, todayDateString);
      setNutritionExecution(freshExec);
      await defaultNutritionHistoryRepository.saveExecution(freshExec);
      const allExecs = await defaultNutritionHistoryRepository.getExecutions();
      setHistoricalNutritionExecutions(allExecs);
    } catch (err) {
      console.warn('[PlanGenerationScreen] Failed to accept plan revision:', err);
    }
  }, [previewRevision, todayDateString]);

  const handleRejectRevision = React.useCallback(async () => {
    if (!previewRevision) return;
    try {
      const rejected = rejectPlanRevision(previewRevision);
      await defaultNutritionHistoryRepository.saveRevision(rejected);
      setPreviewRevision(null);
    } catch (err) {
      console.warn('[PlanGenerationScreen] Failed to reject plan revision:', err);
    }
  }, [previewRevision]);

  // Expose to window in development for E2E QA assertion
  useEffect(() => {
    if (typeof window !== 'undefined' && __DEV__) {
      (window as any).__LAST_NUTRITION_STRATEGY__ =
        nutritionResult?.status === 'completed' ? nutritionResult.strategy : null;
      (window as any).__LAST_NUTRITION_TARGETS__ =
        nutritionResult?.status === 'completed' && nutritionResult.strategy.targets
          ? nutritionResult.strategy.targets
          : null;
      (window as any).__LAST_NUTRITION_PLAN__ = activeNutritionPlan;
      (window as any).__LAST_NUTRITION_EXECUTION__ = nutritionExecution;
      (window as any).__LAST_NUTRITION_ADAPTATION__ = adaptationRecommendation;
      (window as any).__LAST_PLAN_REVISION__ = activePlanRevision || previewRevision;
    }
  }, [nutritionResult, activeNutritionPlan, nutritionExecution, adaptationRecommendation, activePlanRevision, previewRevision]);

  // 4. Synchronize generated plan to app-level in-memory state and local persistence
  const lastSynchronizedPlanTimestampRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (generationResult && generationResult.status === 'success') {
      const generatedAt = generationResult.plan.generationMetadata.generatedAtTimestamp;
      if (lastSynchronizedPlanTimestampRef.current !== generatedAt) {
        lastSynchronizedPlanTimestampRef.current = generatedAt;
        setPlanAndResult(generationResult.plan, generationResult);
      }
    }
  }, [generationResult, setPlanAndResult]);

  const plan = generationResult?.status === 'success' ? generationResult.plan : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Status Section */}
          <View style={styles.headerSection}>
            <View style={styles.badgeWrapper}>
              <Text style={styles.badgeDot}>●</Text>
              <Text style={styles.badgeLabel}>
                {generationResult?.status === 'success'
                  ? 'Plan Generated'
                  : generationResult?.status === 'youth_strategy_pending'
                  ? 'Youth Pathway'
                  : generationResult?.status === 'ineligible'
                  ? 'Ineligible'
                  : 'Profile Incomplete'}
              </Text>
            </View>

            <Text style={styles.title}>
              {generationResult?.status === 'success'
                ? 'Your adaptive plan is ready'
                : generationResult?.status === 'youth_strategy_pending'
                ? 'Youth training pathway'
                : generationResult?.status === 'ineligible'
                ? 'Trainee ineligible'
                : 'Complete your profile'}
            </Text>

            <Text style={styles.subtitle}>
              {generationResult?.status === 'success'
                ? 'Built deterministically from your biometrics, equipment, recovery, and volume capacity.'
                : generationResult?.status === 'youth_strategy_pending'
                ? 'Trainee is within youth boundaries (ages 13–17). Adult resistance strategy is safely held.'
                : generationResult?.status === 'ineligible'
                ? 'Trainee age falls outside supported adaptive training guidelines.'
                : 'Please return to onboarding to finish required biometrics, goals, and schedule fields.'}
            </Text>
          </View>

          {/* SUCCESS BRANCH: Real Generated Plan Card */}
          {plan && generationResult?.status === 'success' && (
            <>
              <View style={styles.planCard}>
                <View style={styles.planCardHeaderRow}>
                  <View style={styles.objectiveTag}>
                    <Text style={styles.objectiveTagText}>
                      {plan.objective.primary.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.feasibilityBadge}>
                    <Text style={styles.feasibilityTag}>
                      {plan.generationMetadata.durationFeasibility ?? 'balanced'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.planTitle}>
                  {plan.structure.sessionsPerCycle}-Day {plan.structure.splitFamily.replace(/_/g, ' ')} Split
                </Text>

                <Text style={styles.planSubtitle}>
                  Target: {plan.structure.targetDaysPerWeek} days/week · Total {plan.generationMetadata.totalExercisesPrescribed} exercises · {plan.generationMetadata.totalSetsPrescribed} work sets
                </Text>

                {/* Metrics Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Split Family</Text>
                    <Text style={styles.metricValue}>
                      {plan.structure.splitFamily.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Sessions / Cycle</Text>
                    <Text style={styles.metricValue}>
                      {plan.structure.sessionsPerCycle}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Target Days</Text>
                    <Text style={styles.metricValue}>
                      {plan.structure.targetDaysPerWeek} days/wk
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Recovery Level</Text>
                    <Text style={styles.metricValue}>
                      {plan.recoveryContext.level}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Nutrition Strategy Summary Card */}
              {nutritionResult?.status === 'completed' && (
                <View style={styles.nutritionStrategyCard}>
                  <View style={styles.nutritionHeaderRow}>
                    <Text style={styles.nutritionHeaderTitle}>Nutrition Strategy</Text>
                    <View style={styles.nutritionBadge}>
                      <Text style={styles.nutritionBadgeText}>v1 Validated</Text>
                    </View>
                  </View>
                  <Text style={styles.nutritionSummaryBody}>
                    {nutritionResult.strategy.objective.focusSummary}
                  </Text>
                  <View style={styles.nutritionPillsRow}>
                    <View style={styles.nutritionPill}>
                      <Text style={styles.nutritionPillText}>
                        Diet: {nutritionResult.strategy.dietCompatibility.dietType}
                      </Text>
                    </View>
                    <View style={styles.nutritionPill}>
                      <Text style={styles.nutritionPillText}>
                        Mode: {nutritionResult.strategy.planningMode.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View style={styles.nutritionPill}>
                      <Text style={styles.nutritionPillText}>
                        Meals: {nutritionResult.strategy.mealStructure.preferredMealCount}/day
                      </Text>
                    </View>
                  </View>

                  {/* Quantitative Targets (Stage W7.2 & W7.3) */}
                  {nutritionResult.strategy.targets ? (
                    <View style={styles.quantitativeTargetsContainer}>
                      <View style={styles.calorieBandHeader}>
                        <Text style={styles.calorieBandLabel}>Daily Energy</Text>
                        <Text style={styles.calorieBandValue}>
                          {nutritionResult.strategy.targets.energy.targetRange.minKcal.toLocaleString()}–{' '}
                          {nutritionResult.strategy.targets.energy.targetRange.maxKcal.toLocaleString()} kcal
                        </Text>
                      </View>

                      <View style={styles.macroGrid}>
                        <View style={styles.macroBox}>
                          <Text style={styles.macroLabel}>Protein</Text>
                          <Text style={styles.macroValue}>
                            {nutritionResult.strategy.targets.macronutrients.protein.targetGrams} g
                          </Text>
                          <Text style={styles.macroSub}>
                            {nutritionResult.strategy.targets.macronutrients.protein.gramsPerKg} g/kg
                          </Text>
                        </View>
                        <View style={styles.macroBox}>
                          <Text style={styles.macroLabel}>Fat</Text>
                          <Text style={styles.macroValue}>
                            {nutritionResult.strategy.targets.macronutrients.fat.targetGrams} g
                          </Text>
                          <Text style={styles.macroSub}>
                            {nutritionResult.strategy.targets.macronutrients.fat.gramsPerKg} g/kg
                          </Text>
                        </View>
                        <View style={styles.macroBox}>
                          <Text style={styles.macroLabel}>Carbohydrates</Text>
                          <Text style={styles.macroValue}>
                            {nutritionResult.strategy.targets.macronutrients.carbohydrates.targetGrams} g
                          </Text>
                          <Text style={styles.macroSub}>
                            {nutritionResult.strategy.targets.macronutrients.carbohydrates.gramsPerKg} g/kg
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.quantitativePendingContainer}>
                      <Text style={styles.pendingTargetsTitle}>Nutrition targets are not ready yet.</Text>
                      <Text style={styles.pendingTargetsBody}>
                        Add the optional information used for energy estimation to unlock estimated calorie and macro targets.
                      </Text>
                      <TouchableOpacity
                        style={styles.pendingEditLink}
                        onPress={() => router.push('/onboarding/about-you')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pendingEditLinkText}>Add details in About You →</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Meal Framework & Slots (Stage W7.4 & W7.7) */}
                  {nutritionPlanResult &&
                    (nutritionPlanResult.status === 'success' || nutritionPlanResult.status === 'pending') &&
                    activeNutritionPlan && (
                      <View style={styles.mealFrameworkContainer}>
                        <View style={styles.mealFrameworkHeaderRow}>
                          <Text style={styles.mealFrameworkHeading}>Meal Framework</Text>
                          <Text style={styles.mealFrameworkSub}>
                            {activeNutritionPlan.dailyPlan.totalMeals} Meals ·{' '}
                            {activeNutritionPlan.dailyPlan.preparationOrientation.replace(/_/g, ' ')}
                          </Text>
                        </View>

                        {/* Active Plan Revision Badge if accepted */}
                        {activePlanRevision && activePlanRevision.status === 'accepted' && (
                          <View style={styles.activeRevisionBanner}>
                            <Text style={styles.activeRevisionBannerText}>
                              ✓ Active Revised Structure: {activePlanRevision.revisedPlan.dailyPlan.totalMeals} Consolidated Meals
                            </Text>
                          </View>
                        )}

                        {activeNutritionPlan.dailyPlan.slots.map((slot) => {
                          const mealExec = nutritionExecution?.mealExecutions.find((m) => m.mealSlotId === slot.slotId);
                          const currentMealStatus = mealExec?.status || 'not_started';

                          return (
                            <View key={slot.slotId} style={styles.mealSlotCard}>
                              <View style={styles.mealSlotHeader}>
                                <Text style={styles.mealSlotName}>{slot.name}</Text>
                                <View style={styles.mealHeaderRight}>
                                  {slot.suggestedTiming && (
                                    <Text style={styles.mealSlotTiming}>{slot.suggestedTiming}</Text>
                                  )}
                                  <TouchableOpacity
                                    style={[
                                      styles.mealStatusBadge,
                                      currentMealStatus === 'completed' && styles.mealStatusBadgeCompleted,
                                      currentMealStatus === 'skipped' && styles.mealStatusBadgeSkipped,
                                    ]}
                                    onPress={() => handleLogMeal(slot.slotId, currentMealStatus)}
                                    activeOpacity={0.7}
                                  >
                                    <Text
                                      style={[
                                        styles.mealStatusBadgeText,
                                        currentMealStatus === 'completed' && styles.mealStatusBadgeTextCompleted,
                                        currentMealStatus === 'skipped' && styles.mealStatusBadgeTextSkipped,
                                      ]}
                                    >
                                      {currentMealStatus === 'completed'
                                        ? '✓ Eaten'
                                        : currentMealStatus === 'skipped'
                                        ? '✕ Skipped'
                                        : 'Log Meal'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              <Text style={styles.mealSlotGuidance}>{slot.guidance}</Text>

                              {/* Quantitative meal targets if available */}
                              {slot.targets && (
                                <View style={styles.mealSlotTargetsRow}>
                                  <Text style={styles.mealSlotTargetTag}>
                                    Target: {slot.targets.targetEnergyKcal} kcal
                                  </Text>
                                  <Text style={styles.mealSlotTargetSub}>
                                    {slot.targets.targetProteinG}g P · {slot.targets.targetFatG}g F · {slot.targets.targetCarbohydratesG}g C
                                  </Text>
                                </View>
                              )}

                              {/* Composed Meal Example (Stage W7.5) */}
                              {slot.composition && slot.composition.selectedFoods.length > 0 && (
                                <View style={styles.compositionContainer}>
                                  <Text style={styles.compositionHeading}>Suggested Foods:</Text>
                                  {slot.composition.selectedFoods.map((item) => (
                                    <View key={item.food.id} style={styles.compositionFoodRow}>
                                      <Text style={styles.compositionFoodName}>• {item.food.name}</Text>
                                      <Text style={styles.compositionFoodPortion}>
                                        {item.servingDescription}
                                        {slot.composition?.isQuantitative
                                          ? ` (~${item.calculatedCalories} kcal)`
                                          : ''}
                                      </Text>
                                    </View>
                                  ))}

                                  {slot.composition.isQuantitative && (
                                    <View style={styles.compositionTotalsRow}>
                                      <Text style={styles.compositionTotalsText}>
                                        Estimated: {slot.composition.totalEstimatedCalories} kcal · {slot.composition.totalEstimatedProteinG}g P · {slot.composition.totalEstimatedFatG}g F · {slot.composition.totalEstimatedCarbohydratesG}g C
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* Daily Nutrition Intake Summary (Stage W7.6) */}
                        {nutritionExecution && (
                          <View style={styles.dailySummaryCard}>
                            <View style={styles.dailySummaryHeaderRow}>
                              <Text style={styles.dailySummaryHeading}>Today's Nutrition Summary</Text>
                              <Text style={styles.dailySummaryDateText}>{nutritionExecution.date}</Text>
                            </View>

                            <View style={styles.summaryStatsGrid}>
                              <View style={styles.summaryStatBox}>
                                <Text style={styles.summaryStatLabel}>Consumed Calories</Text>
                                <Text style={styles.summaryStatValue}>
                                  {nutritionExecution.summary.consumedCalories}{' '}
                                  {nutritionExecution.summary.isQuantitative
                                    ? `/ ${nutritionExecution.summary.plannedCalories} kcal`
                                    : 'kcal'}
                                </Text>
                              </View>
                              <View style={styles.summaryStatBox}>
                                <Text style={styles.summaryStatLabel}>Consumed Protein</Text>
                                <Text style={styles.summaryStatValue}>
                                  {nutritionExecution.summary.consumedProteinG}{' '}
                                  {nutritionExecution.summary.isQuantitative
                                    ? `/ ${nutritionExecution.summary.plannedProteinG} g`
                                    : 'g'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.summaryStatsGrid}>
                              <View style={styles.summaryStatBox}>
                                <Text style={styles.summaryStatLabel}>Consumed Fat</Text>
                                <Text style={styles.summaryStatValue}>
                                  {nutritionExecution.summary.consumedFatG}{' '}
                                  {nutritionExecution.summary.isQuantitative
                                    ? `/ ${nutritionExecution.summary.plannedFatG} g`
                                    : 'g'}
                                </Text>
                              </View>
                              <View style={styles.summaryStatBox}>
                                <Text style={styles.summaryStatLabel}>Consumed Carbs</Text>
                                <Text style={styles.summaryStatValue}>
                                  {nutritionExecution.summary.consumedCarbohydratesG}{' '}
                                  {nutritionExecution.summary.isQuantitative
                                    ? `/ ${nutritionExecution.summary.plannedCarbohydratesG} g`
                                    : 'g'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.summaryMealProgressRow}>
                              <Text style={styles.summaryMealProgressText}>
                                Meals: {nutritionExecution.summary.mealsCompleted} /{' '}
                                {nutritionExecution.summary.mealsPlanned} completed
                                {nutritionExecution.summary.mealsSkipped > 0
                                  ? ` · ${nutritionExecution.summary.mealsSkipped} skipped`
                                  : ''}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Nutrition Adaptation Feedback Card (Stage W7.7) */}
                        {adaptationRecommendation && (
                          <View style={styles.adaptationFeedbackCard}>
                            <View style={styles.adaptationHeaderRow}>
                              <Text style={styles.adaptationCardHeading}>
                                {adaptationRecommendation.primaryAction === 'simplify_structure'
                                  ? 'Simplify Meal Structure'
                                  : adaptationRecommendation.primaryAction === 'prioritize_learned_substitutions'
                                  ? 'Learned Food Preferences'
                                  : adaptationRecommendation.primaryAction === 'review_energy_target_adherence'
                                  ? 'Energy Intake Review'
                                  : adaptationRecommendation.primaryAction === 'maintain'
                                  ? 'Nutrition Plan On Track'
                                  : 'Building Tracking Evidence'}
                              </Text>
                              <View
                                style={[
                                  styles.adaptationBadge,
                                  adaptationRecommendation.primaryAction === 'simplify_structure' && styles.adaptationBadgeWarning,
                                  adaptationRecommendation.primaryAction === 'maintain' && styles.adaptationBadgeSuccess,
                                ]}
                              >
                                <Text style={styles.adaptationBadgeText}>
                                  {adaptationRecommendation.primaryAction === 'simplify_structure'
                                    ? 'RECOMMENDED'
                                    : adaptationRecommendation.primaryAction === 'maintain'
                                    ? 'ON TRACK'
                                    : adaptationRecommendation.primaryAction === 'review_energy_target_adherence'
                                    ? 'REVIEW'
                                    : 'ADAPTIVE'}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.adaptationSummaryText}>{adaptationRecommendation.summary}</Text>

                            {adaptationRecommendation.actionableInsights.length > 0 && (
                              <View style={styles.adaptationInsightsList}>
                                {adaptationRecommendation.actionableInsights.map((insight, idx) => (
                                  <Text key={idx} style={styles.adaptationInsightBullet}>
                                    • {insight}
                                  </Text>
                                ))}
                              </View>
                            )}

                            {/* Structure Simplification Action Button */}
                            {adaptationRecommendation.suggestedStructureSimplification &&
                              !previewRevision &&
                              (!activePlanRevision || activePlanRevision.revisedPlan.dailyPlan.totalMeals > 2) && (
                                <TouchableOpacity
                                  style={styles.adaptationActionBtn}
                                  onPress={handlePreviewSimplification}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.adaptationActionBtnText}>
                                    Review Simpler {Math.max(2, activeNutritionPlan.dailyPlan.totalMeals - 1)}-Meal Structure →
                                  </Text>
                                </TouchableOpacity>
                              )}
                          </View>
                        )}

                        {/* Versioned Plan Revision Preview & Confirmation (Stage W7.7) */}
                        {previewRevision && (
                          <View style={styles.revisionPreviewCard}>
                            <View style={styles.revisionPreviewHeader}>
                              <Text style={styles.revisionPreviewTitle}>
                                Proposed Plan Revision ({previewRevision.revisedPlan.dailyPlan.totalMeals} Meals)
                              </Text>
                              <View style={styles.revisionPendingBadge}>
                                <Text style={styles.revisionPendingBadgeText}>PENDING REVIEW</Text>
                              </View>
                            </View>

                            <Text style={styles.revisionPreviewBody}>
                              Consolidating daily structure from {activeNutritionPlan.dailyPlan.totalMeals} to{' '}
                              {previewRevision.revisedPlan.dailyPlan.totalMeals} meal windows to reduce missed meals.
                            </Text>

                            <View style={styles.revisionSlotsContainer}>
                              <Text style={styles.revisionSlotsHeading}>Proposed Meal Slots:</Text>
                              {previewRevision.revisedPlan.dailyPlan.slots.map((s) => (
                                <View key={s.slotId} style={styles.revisionSlotRow}>
                                  <Text style={styles.revisionSlotName}>• {s.name}</Text>
                                  <Text style={styles.revisionSlotTargets}>
                                    {s.targets
                                      ? `${s.targets.targetEnergyKcal} kcal (${s.targets.targetProteinG}g P · ${s.targets.targetFatG}g F · ${s.targets.targetCarbohydratesG}g C)`
                                      : s.guidance}
                                  </Text>
                                </View>
                              ))}
                            </View>

                            <Text style={styles.revisionGuaranteeText}>
                              ✓ Daily energy target ({previewRevision.revisedPlan.nutritionTargets?.energy.targetRange.midpointKcal || '—'} kcal) and macro targets remain 100% unchanged.
                            </Text>

                            <View style={styles.revisionActionsRow}>
                              <TouchableOpacity
                                style={styles.acceptRevisionBtn}
                                onPress={handleAcceptRevision}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.acceptRevisionBtnText}>Accept & Activate</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.rejectRevisionBtn}
                                onPress={handleRejectRevision}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.rejectRevisionBtnText}>Keep Current Plan</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                </View>
              )}

              {/* Multi-Session Sequence Cards */}
              <Text style={styles.sectionHeading}>
                Prescribed Sessions ({plan.sessions.length})
              </Text>

              {plan.sessions.map((session) => (
                <View key={session.sessionId} style={styles.sessionRowCard}>
                  <View style={styles.sessionCardHeader}>
                    <View style={styles.sequenceChip}>
                      <Text style={styles.sequenceChipText}>SESSION {session.sequenceIndex}</Text>
                    </View>
                    <Text style={styles.sessionDurationText}>~{session.targetDurationMinutes} min</Text>
                  </View>

                  <Text style={styles.sessionCardName}>{session.sessionName}</Text>

                  {/* Focus chips */}
                  <View style={styles.chipsRow}>
                    {session.focusAreas.map((focus) => (
                      <View key={focus} style={styles.chip}>
                        <Text style={styles.chipText}>{focus.replace(/_/g, ' ')}</Text>
                      </View>
                    ))}
                    {session.conditioning && (
                      <View style={[styles.chip, styles.chipCond]}>
                        <Text style={[styles.chipText, styles.chipCondText]}>+ Conditioning</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.sessionSummaryText}>
                    {session.exercises.length} movements ({session.exercises.map((e) => e.exerciseName).slice(0, 2).join(', ')}...)
                  </Text>

                  <TouchableOpacity
                    style={styles.sessionLaunchBtn}
                    onPress={() => router.push(`/workout/${session.sessionId}`)}
                  >
                    <Text style={styles.sessionLaunchBtnText}>Start Workout</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* YOUTH BRANCH */}
          {generationResult?.status === 'youth_strategy_pending' && (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Youth Protection Active</Text>
              <Text style={styles.noticeBody}>
                {generationResult.message}
              </Text>
              <Text style={styles.noticeMeta}>
                Trainee age: {profile.anthropometrics.age} · Adult resistance algorithms barred.
              </Text>
            </View>
          )}

          {/* INELIGIBLE BRANCH */}
          {generationResult?.status === 'ineligible' && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Ineligible for Program</Text>
              <Text style={styles.errorCardBody}>
                {generationResult.reason}
              </Text>
            </View>
          )}

          {/* INCOMPLETE PROFILE BRANCH */}
          {!profileValidation.valid && (
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Profile Incomplete</Text>
              <Text style={styles.errorCardBody}>
                The canonical user profile requires all mandatory fields before generation:
              </Text>
              {profileValidation.errors.slice(0, 4).map((err, idx) => (
                <Text key={idx} style={styles.errorBulletText}>
                  • {err.field}: {err.message}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          {plan && (
            <>
              <TouchableOpacity
                style={styles.todayDashboardButton}
                onPress={() => router.push('/today')}
              >
                <Text style={styles.todayDashboardButtonText}>Open Today Dashboard →</Text>
              </TouchableOpacity>
              <PrimaryButton
                label="View Plan Overview"
                onPress={() => router.push('/plan-overview')}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/onboarding/ai-coach')}
          >
            <Text style={styles.backButtonText}>Edit Onboarding Answers</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerSection: {
    marginBottom: spacing.lg,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  badgeDot: {
    fontSize: 10,
    color: '#10B981',
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  planCard: {
    backgroundColor: '#151722',
    borderRadius: 16,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: '#262A3E',
    marginBottom: spacing.lg,
  },
  planCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  objectiveTag: {
    backgroundColor: '#262438',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  objectiveTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DDD8FF',
  },
  feasibilityBadge: {
    backgroundColor: '#1E2538',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  feasibilityTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A99AD',
    textTransform: 'uppercase',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  planSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: spacing.sm,
  },
  metricBox: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#1A1E2C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm + 2,
    letterSpacing: 0.2,
  },
  sessionRowCard: {
    backgroundColor: '#14151E',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#242533',
    marginBottom: spacing.md,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sequenceChip: {
    backgroundColor: '#1E202E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sequenceChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA0B8',
  },
  sessionDurationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  sessionCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#1C1D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  chipCond: {
    backgroundColor: '#15241C',
  },
  chipCondText: {
    color: '#34D399',
  },
  sessionSummaryText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: spacing.sm + 2,
  },
  sessionLaunchBtn: {
    backgroundColor: '#232536',
    borderWidth: 1,
    borderColor: '#373A52',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLaunchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F0F0FF',
  },
  noticeCard: {
    backgroundColor: '#1A1D28',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#2E354A',
    marginBottom: spacing.md,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0F0FF',
    marginBottom: 6,
  },
  noticeBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  noticeMeta: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  errorCard: {
    backgroundColor: '#1E1414',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#4A2626',
    marginBottom: spacing.md,
  },
  errorCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 6,
  },
  errorCardBody: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 18,
    marginBottom: 6,
  },
  errorBulletText: {
    fontSize: 12,
    color: '#FCA5A5',
    marginBottom: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
    gap: 8,
  },
  todayDashboardButton: {
    backgroundColor: '#262438',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  todayDashboardButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DDD8FF',
  },
  backButton: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  nutritionStrategyCard: {
    backgroundColor: '#161922',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  nutritionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  nutritionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#38BDF8',
  },
  nutritionBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nutritionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  nutritionSummaryBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  nutritionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nutritionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  nutritionPillText: {
    fontSize: 11,
    color: '#E0E7FF',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  quantitativeTargetsContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.15)',
  },
  calorieBandHeader: {
    marginBottom: 8,
  },
  calorieBandLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calorieBandValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  calorieBandSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  macroBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginTop: 2,
  },
  macroSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  metabolicNote: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
  },
  quantitativePendingContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  pendingTargetsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E0E7FF',
    marginBottom: 4,
  },
  pendingTargetsBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  pendingEditLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  pendingEditLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38BDF8',
  },
  mealFrameworkContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  mealFrameworkHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealFrameworkHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealFrameworkSub: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'capitalize',
  },
  mealSlotCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealSlotName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  mealSlotTiming: {
    fontSize: 11,
    color: '#64748B',
  },
  mealSlotGuidance: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginBottom: 6,
  },
  mealSlotTargetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  mealSlotTargetTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  mealSlotTargetSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  compositionContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  compositionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  compositionFoodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  compositionFoodName: {
    fontSize: 12,
    color: '#F8FAFC',
    fontWeight: '500',
  },
  compositionFoodPortion: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  compositionTotalsRow: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.15)',
  },
  compositionTotalsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#38BDF8',
  },
  mealHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealStatusBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  mealStatusBadgeCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  mealStatusBadgeSkipped: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  mealStatusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
  mealStatusBadgeTextCompleted: {
    color: '#10B981',
  },
  mealStatusBadgeTextSkipped: {
    color: '#EF4444',
  },
  dailySummaryCard: {
    marginTop: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  dailySummaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dailySummaryHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailySummaryDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  summaryStatsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  summaryStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryStatLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  summaryMealProgressRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryMealProgressText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  activeRevisionBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  activeRevisionBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  adaptationFeedbackCard: {
    marginTop: 14,
    backgroundColor: '#161922',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  adaptationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adaptationCardHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  adaptationBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  adaptationBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  adaptationBadgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  adaptationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  adaptationSummaryText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
    marginBottom: 8,
  },
  adaptationInsightsList: {
    gap: 4,
    marginBottom: 10,
  },
  adaptationInsightBullet: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  adaptationActionBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  adaptationActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24',
  },
  revisionPreviewCard: {
    marginTop: 14,
    backgroundColor: '#151D28',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  revisionPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  revisionPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  revisionPendingBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  revisionPendingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#38BDF8',
  },
  revisionPreviewBody: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
    marginBottom: 10,
  },
  revisionSlotsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  revisionSlotsHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  revisionSlotRow: {
    flexDirection: 'column',
    gap: 2,
  },
  revisionSlotName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  revisionSlotTargets: {
    fontSize: 11,
    color: '#94A3B8',
    paddingLeft: 10,
  },
  revisionGuaranteeText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 16,
  },
  revisionActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptRevisionBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptRevisionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  rejectRevisionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectRevisionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
