/**
 * Deterministic Nutrition Adherence & Adaptation Engine (Stage W7.6)
 *
 * Evaluates historical nutrition execution records against structured non-reductive
 * adherence signals and produces actionable qualitative adaptation recommendations.
 *
 * INVARIANTS:
 * 1. Pure, deterministic, stateless evaluation.
 * 2. Does NOT modify quantitative calorie or macro targets directly.
 * 3. Does NOT reduce adherence to a fake single 0–100 score.
 * 4. Never violates hard dietary restrictions or forces disliked foods.
 * 5. Requires repeated evidence (minimum 3 evaluated days) before recommending structural adaptations.
 */

import type {
  NutritionExecution,
  NutritionAdherenceEvidence,
  DayCompletenessEvidence,
  NutritionAdaptationRecommendation,
  NutritionAdaptationContext,
  AdherenceBandStatus,
  NutritionAdaptationAction,
} from './nutritionExecutionTypes';
import { deepFreeze } from './nutritionTargetEngine';

/**
 * Evaluates historical execution records for structured adherence patterns.
 *
 * COMPLETENESS RULE:
 * A day is sufficiently complete if and only if EVERY planned meal slot has a resolved
 * status ('completed', 'partial', or 'skipped'). If any meal slot remains 'not_started',
 * that meal's intake is unknown, and the day is classified as incomplete.
 * Missing records must NEVER be interpreted as zero food consumption.
 * Incomplete days are strictly excluded from quantitative calorie/macro under/overconsumption
 * calculations to prevent false under-eating or over-eating determinations.
 */
export function evaluateNutritionAdherence(
  executions: NutritionExecution[]
): NutritionAdherenceEvidence {
  const decisionTrace: string[] = [];
  const evaluatedDaysCount = executions.length;

  if (evaluatedDaysCount === 0) {
    return deepFreeze({
      evaluatedDaysCount: 0,
      completeDaysCount: 0,
      incompleteDaysCount: 0,
      dayCompleteness: [],
      overallStatus: 'insufficient_evidence',
      mealCompletionRate: 0,
      repeatedMealSkippingDetected: false,
      repeatedSubstitutions: [],
      evidenceSummary: 'No historical nutrition execution records logged yet.',
      decisionTrace: ['Historical nutrition records count: 0 -> insufficient_evidence'],
    });
  }

  const dayCompleteness: DayCompletenessEvidence[] = [];
  let totalPlannedMeals = 0;
  let totalCompletedMeals = 0;
  let totalPartialMeals = 0;
  let totalSkippedMeals = 0;
  let totalUnloggedMeals = 0;

  let completeDaysCount = 0;
  let incompleteDaysCount = 0;

  let proteinHitDays = 0;
  let energyHitDays = 0;
  let completeQuantitativeDaysCount = 0;
  const completeQuantitativeExecutions: NutritionExecution[] = [];

  const substitutionCounts = new Map<string, number>();

  for (const exec of executions) {
    const plannedSlots = exec.mealExecutions.length || exec.summary.mealsPlanned;
    let completedCount = 0;
    let partialCount = 0;
    let skippedCount = 0;
    let unloggedCount = 0;

    for (const meal of exec.mealExecutions) {
      if (meal.status === 'completed') completedCount++;
      else if (meal.status === 'partial') partialCount++;
      else if (meal.status === 'skipped') skippedCount++;
      else if (meal.status === 'not_started') unloggedCount++;
    }

    totalPlannedMeals += plannedSlots;
    totalCompletedMeals += completedCount;
    totalPartialMeals += partialCount;
    totalSkippedMeals += skippedCount;
    totalUnloggedMeals += unloggedCount;

    // A day is complete IF AND ONLY IF all planned slots are resolved (no not_started)
    const isComplete = plannedSlots > 0 && unloggedCount === 0;
    if (isComplete) {
      completeDaysCount++;
    } else {
      incompleteDaysCount++;
    }

    dayCompleteness.push({
      date: exec.date,
      isComplete,
      totalPlannedSlots: plannedSlots,
      completedSlots: completedCount,
      partialSlots: partialCount,
      skippedSlots: skippedCount,
      unloggedSlots: unloggedCount,
    });

    // Incomplete days MUST NOT count towards calorie/macro quantitative adherence!
    if (isComplete && exec.summary.isQuantitative && exec.summary.plannedCalories && exec.summary.plannedProteinG) {
      completeQuantitativeDaysCount++;
      completeQuantitativeExecutions.push(exec);

      // Protein hit: within 15% of target
      const proRatio = exec.summary.consumedProteinG / exec.summary.plannedProteinG;
      if (proRatio >= 0.85 && proRatio <= 1.25) {
        proteinHitDays++;
      }

      // Energy band hit: within ±15% of target
      const calRatio = exec.summary.consumedCalories / exec.summary.plannedCalories;
      if (calRatio >= 0.85 && calRatio <= 1.15) {
        energyHitDays++;
      }
    }

    // Tally repeated substitutions across logged foods
    for (const meal of exec.mealExecutions) {
      for (const food of meal.loggedFoods) {
        if (food.source === 'catalog_substitution' || food.source === 'additional_food') {
          substitutionCounts.set(food.foodId, (substitutionCounts.get(food.foodId) || 0) + 1);
        }
      }
    }
  }

  const mealCompletionRate = totalPlannedMeals > 0 ? Number((totalCompletedMeals / totalPlannedMeals).toFixed(2)) : 0;
  const proteinTargetHitRate =
    completeQuantitativeDaysCount > 0 ? Number((proteinHitDays / completeQuantitativeDaysCount).toFixed(2)) : undefined;
  const energyBandHitRate =
    completeQuantitativeDaysCount > 0 ? Number((energyHitDays / completeQuantitativeDaysCount).toFixed(2)) : undefined;

  // Repeated meal skipping: skipped >= 25% of planned meals across 6+ total planned meals
  const repeatedMealSkippingDetected = totalPlannedMeals >= 6 && totalSkippedMeals / totalPlannedMeals >= 0.25;

  // Repeated substitutions: items substituted 2+ times
  const repeatedSubstitutions = Array.from(substitutionCounts.entries())
    .filter(([_, count]) => count >= 2)
    .map(([foodId, count]) => ({ foodId, count }))
    .sort((a, b) => b.count - a.count);

  let overallStatus: AdherenceBandStatus = 'broadly_on_track';
  if (evaluatedDaysCount < 3 || completeDaysCount < 3) {
    if (repeatedMealSkippingDetected) {
      overallStatus = 'inconsistent';
    } else {
      overallStatus = 'insufficient_evidence';
    }
  } else if (repeatedMealSkippingDetected || mealCompletionRate < 0.6) {
    overallStatus = 'inconsistent';
  } else if (energyBandHitRate !== undefined && energyBandHitRate < 0.5) {
    const avgDelta =
      completeQuantitativeExecutions.reduce((acc, e) => acc + (e.summary.deltaCalories || 0), 0) /
      completeQuantitativeExecutions.length;
    overallStatus = avgDelta < 0 ? 'repeatedly_below_target' : 'repeatedly_above_target';
  }

  decisionTrace.push(
    `Evaluated ${evaluatedDaysCount} days (${completeDaysCount} complete, ${incompleteDaysCount} incomplete): completion rate ${mealCompletionRate * 100}%, status: ${overallStatus}`
  );
  if (incompleteDaysCount > 0) {
    decisionTrace.push(
      `Incomplete days excluded from energy/macro target calculations: ${incompleteDaysCount} day(s) had unlogged slots`
    );
  }
  if (repeatedMealSkippingDetected) {
    decisionTrace.push(`Repeated meal skipping detected: ${totalSkippedMeals}/${totalPlannedMeals} meals skipped`);
  }
  if (repeatedSubstitutions.length > 0) {
    decisionTrace.push(
      `Repeated substitutions noted: ${repeatedSubstitutions.map((s) => `${s.foodId} (x${s.count})`).join(', ')}`
    );
  }

  return deepFreeze({
    evaluatedDaysCount,
    completeDaysCount,
    incompleteDaysCount,
    dayCompleteness,
    overallStatus,
    mealCompletionRate,
    proteinTargetHitRate,
    energyBandHitRate,
    repeatedMealSkippingDetected,
    repeatedSubstitutions,
    evidenceSummary: `Evaluated ${evaluatedDaysCount} days (${completeDaysCount} complete). Meal completion: ${Math.round(mealCompletionRate * 100)}%. Status: ${overallStatus.replace(/_/g, ' ')}.`,
    decisionTrace,
  });
}

/**
 * Derives qualitative adaptation recommendations from adherence evidence and profile context.
 */
export function deriveNutritionAdaptation(
  context: NutritionAdaptationContext
): NutritionAdaptationRecommendation {
  const { activePlan, strategy, historicalExecutions } = context;
  const evidence = evaluateNutritionAdherence(historicalExecutions);
  const decisionTrace = [...evidence.decisionTrace];

  const actionableInsights: string[] = [];
  const suggestedPreferredFoodIdsToAdd: string[] = [];
  let suggestedStructureSimplification = false;
  let requiresTargetReview = false;
  let primaryAction: NutritionAdaptationAction = 'maintain';

  // 1. Insufficient evidence: less than 3 days, or less than 3 complete days without behavioral pattern
  if (
    evidence.evaluatedDaysCount < 3 ||
    (evidence.completeDaysCount < 3 &&
      !evidence.repeatedMealSkippingDetected &&
      evidence.repeatedSubstitutions.length === 0)
  ) {
    return deepFreeze({
      primaryAction: 'insufficient_evidence',
      summary: 'Continue logging meals across complete days to establish consistent behavioral evidence.',
      actionableInsights: [
        'Log all planned meals across at least 3 complete days to unlock personalized nutrition structure adaptation.',
      ],
      suggestedPreferredFoodIdsToAdd: [],
      suggestedStructureSimplification: false,
      requiresTargetReview: false,
      decisionTrace: [...decisionTrace, 'Insufficient complete historical evidence (<3 days) -> maintain current plan'],
    });
  }

  // 2. Repeated meal skipping -> simplify structure recommendation
  if (evidence.repeatedMealSkippingDetected) {
    primaryAction = 'simplify_structure';
    suggestedStructureSimplification = true;
    actionableInsights.push(
      'Repeated meal skipping detected. Consider consolidating into fewer, more substantial meal windows.'
    );
    decisionTrace.push('Rule triggered: repeated meal skipping -> recommend structure simplification');
  }

  // 3. Learned substitutions
  for (const sub of evidence.repeatedSubstitutions) {
    // Ensure substituted food is not already in liked foods and not in disliked foods
    if (
      !strategy.foodPreferences.likedFoodIds.includes(sub.foodId) &&
      !strategy.foodPreferences.dislikedFoodIds.includes(sub.foodId)
    ) {
      suggestedPreferredFoodIdsToAdd.push(sub.foodId);
      actionableInsights.push(
        `Frequent substitution observed: "${sub.foodId}". Consider adding to preferred catalog recommendations.`
      );
    }
  }

  if (suggestedPreferredFoodIdsToAdd.length > 0 && primaryAction === 'maintain') {
    primaryAction = 'prioritize_learned_substitutions';
    decisionTrace.push(
      `Rule triggered: learned substitutions [${suggestedPreferredFoodIdsToAdd.join(', ')}] prioritized`
    );
  }

  // 4. Repeated target deviations -> review target adherence
  if (evidence.overallStatus === 'repeatedly_below_target' || evidence.overallStatus === 'repeatedly_above_target') {
    requiresTargetReview = true;
    actionableInsights.push(
      `Intake is ${evidence.overallStatus.replace(/_/g, ' ')}. Recommend reviewing energetic targets or portion sizes.`
    );
    if (primaryAction === 'maintain') {
      primaryAction = 'review_energy_target_adherence';
    }
    decisionTrace.push(`Rule triggered: ${evidence.overallStatus} -> flag for target review without mutating targets`);
  }

  // 5. Broadly on track baseline
  if (primaryAction === 'maintain') {
    actionableInsights.push('Adherence is consistent and well-aligned with plan targets. Maintain current structure.');
    decisionTrace.push('Trainee broadly on track -> maintain plan structure');
  }

  return deepFreeze({
    primaryAction,
    summary: `Adaptation recommendation: ${primaryAction.replace(/_/g, ' ')}.`,
    actionableInsights,
    suggestedPreferredFoodIdsToAdd,
    suggestedStructureSimplification,
    requiresTargetReview,
    decisionTrace,
  });
}
