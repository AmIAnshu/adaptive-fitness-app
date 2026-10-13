/**
 * Today Dashboard Screen (Milestone W8.1)
 *
 * Route: /today
 *
 * Polished, mobile-first Today Dashboard that unifies training and nutrition into
 * one consistent daily experience.
 *
 * INVARIANTS:
 * - Reads validated state directly from useTodayDashboard hook.
 * - Authoritative targets remain immutable and separate from logged intake.
 * - Missing data is never treated as confirmed zero intake or completed training.
 * - Revision acceptance/rejection strictly requires explicit user confirmation.
 * - Respects youth, ineligible, and qualitative-only boundaries.
 * - Mobile-first layout optimized for 390x844 and 375x812 viewports.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../src/theme';
import { PrimaryButton } from '../src/components';
import { useTodayDashboard } from '../src/features/dashboard';
import type { NutritionPlanRevision } from '../src/features/nutrition';

export default function TodayDashboardScreen() {
  const router = useRouter();
  const {
    state,
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
    refresh,
  } = useTodayDashboard();

  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<NutritionPlanRevision | null>(null);

  // Custom Intake Logging Modal State
  const [activeLoggingSlot, setActiveLoggingSlot] = useState<any | null>(null);
  const [intakeMode, setIntakeMode] = useState<'completed' | 'partial'>('completed');
  const [selectedFoodId, setSelectedFoodId] = useState<string>('chicken_breast');
  const [selectedPortion, setSelectedPortion] = useState<number>(1.0);
  const [mealNotes, setMealNotes] = useState<string>('');

  const openCustomIntakeModal = (slot: any, mode: 'completed' | 'partial' = 'completed') => {
    setActiveLoggingSlot(slot);
    setIntakeMode(mode);
    // Default food selection to first planned food or candidate, or catalog default
    const defaultFood =
      slot.plannedFoods?.[0]?.foodId ??
      (slot.allowedFoodsPreview?.[0] ? 'chicken_breast' : 'chicken_breast');
    setSelectedFoodId(defaultFood);
    setSelectedPortion(mode === 'partial' ? 0.5 : 1.0);
    setMealNotes('');
  };

  const closeCustomIntakeModal = () => {
    setActiveLoggingSlot(null);
  };

  const submitCustomIntake = async () => {
    if (!activeLoggingSlot) return;
    const isPlanned = activeLoggingSlot.plannedFoods?.some((p: any) => p.foodId === selectedFoodId);
    await recordCustomMealIntake(
      activeLoggingSlot.slotId,
      [
        {
          foodId: selectedFoodId,
          portionUnits: selectedPortion,
          source: isPlanned ? 'planned_food' : 'catalog_substitution',
          notes: mealNotes.trim() ? mealNotes.trim() : undefined,
        },
      ],
      intakeMode,
      mealNotes.trim() ? mealNotes.trim() : undefined
    );
    closeCustomIntakeModal();
  };

  // Loading state
  if (state.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.mobileContainer}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading your daily dashboard...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (state.hasError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.mobileContainer}>
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>Dashboard Unavailable</Text>
            <Text style={styles.errorSubtitle}>
              {state.errorMessage ?? 'Unable to load today’s data from local storage.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Population Guards
  const isYouth = state.population === 'youth';
  const isIneligible = state.population === 'ineligible';

  // No active plan state
  const hasNoPlan = trainingSummary.status === 'no_plan' && nutritionSummary.status === 'no_plan';
  if (hasNoPlan) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.mobileContainer}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <Text style={styles.brandTitle}>ADAPTIVE FITNESS</Text>
            <Text style={styles.todayDateText}>{state.todayDateString}</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emptyPlanCard}>
              <View style={styles.emptyIconBadge}>
                <Text style={styles.emptyIconText}>📋</Text>
              </View>
              <Text style={styles.emptyPlanTitle}>No Active Plan Found</Text>
              <Text style={styles.emptyPlanSubtitle}>
                Complete the onboarding assessment to generate your personalized, adaptive training
                and nutrition plan.
              </Text>
              <TouchableOpacity
                style={styles.primaryCtaButton}
                onPress={() => router.push('/onboarding/goal')}
              >
                <Text style={styles.primaryCtaText}>Start Onboarding & Build Plan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryCtaButton}
                onPress={() => router.push('/plan-generation')}
              >
                <Text style={styles.secondaryCtaText}>Go to Plan Generation</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  const openRevisionReview = (rev: NutritionPlanRevision) => {
    setSelectedRevision(rev);
    setIsRevisionModalOpen(true);
  };

  const closeRevisionReview = () => {
    setSelectedRevision(null);
    setIsRevisionModalOpen(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>ADAPTIVE FITNESS</Text>
            <Text style={styles.todayDateText}>
              TODAY · {trainingSummary.dayOfWeek.toUpperCase()} ({state.todayDateString})
            </Text>
          </View>
          <View style={styles.topNavLinks}>
            <TouchableOpacity
              style={styles.topNavLink}
              onPress={() => router.push('/plan-overview')}
            >
              <Text style={styles.topNavLinkText}>Training Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topNavLink}
              onPress={() => router.push('/plan-generation')}
            >
              <Text style={styles.topNavLinkText}>Plan Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Population Guard Banners */}
          {isIneligible && (
            <View style={styles.guardBanner}>
              <Text style={styles.guardTitle}>Profile Ineligible</Text>
              <Text style={styles.guardSubtitle}>
                Adaptive Fitness is configured for adult participants. Quantitative training and
                nutrition planning are deactivated.
              </Text>
            </View>
          )}

          {isYouth && (
            <View style={[styles.guardBanner, styles.youthBanner]}>
              <Text style={[styles.guardTitle, styles.youthTitle]}>Youth Protection Pending</Text>
              <Text style={styles.guardSubtitle}>
                Youth training and non-restrictive nutrition safeguards are active. Quantitative
                caloric restriction is withheld.
              </Text>
            </View>
          )}

          {/* ============================================================ */}
          {/* SECTION A: TODAY'S TRAINING                                 */}
          {/* ============================================================ */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Today's Training</Text>
              {trainingSummary.status === 'completed' && (
                <View style={[styles.statusBadge, styles.completedBadge]}>
                  <Text style={[styles.statusBadgeText, styles.completedBadgeText]}>
                    ✓ COMPLETED TODAY
                  </Text>
                </View>
              )}
              {trainingSummary.status === 'in_progress' && (
                <View style={[styles.statusBadge, styles.inProgressBadge]}>
                  <Text style={[styles.statusBadgeText, styles.inProgressBadgeText]}>
                    ● IN PROGRESS
                  </Text>
                </View>
              )}
              {trainingSummary.status === 'planned' && (
                <View style={[styles.statusBadge, styles.plannedBadge]}>
                  <Text style={[styles.statusBadgeText, styles.plannedBadgeText]}>PLANNED</Text>
                </View>
              )}
              {trainingSummary.status === 'rest_day' && (
                <View style={[styles.statusBadge, styles.restBadge]}>
                  <Text style={[styles.statusBadgeText, styles.restBadgeText]}>REST DAY</Text>
                </View>
              )}
            </View>

            {/* REST DAY CARD */}
            {trainingSummary.status === 'rest_day' && (
              <View style={styles.restDayCard}>
                <View style={styles.restDayHeader}>
                  <Text style={styles.restDayIcon}>🌿</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.restDayTitle}>Scheduled Rest Day: Active Recovery & Adaptation</Text>
                    <Text style={styles.restDaySubtitle}>
                      Focus on sleep, hydration, and nutritional recovery to prepare for your next
                      session.
                    </Text>
                  </View>
                </View>

                {trainingSummary.nextUpcomingSession && (
                  <View style={styles.nextSessionBox}>
                    <Text style={styles.nextSessionLabel}>NEXT SCHEDULED WORKOUT:</Text>
                    <Text style={styles.nextSessionName}>
                      Session {trainingSummary.nextUpcomingSession.sequenceIndex}:{' '}
                      {trainingSummary.nextUpcomingSession.sessionName}
                    </Text>
                    <Text style={styles.nextSessionDuration}>
                      ~{trainingSummary.nextUpcomingSession.targetDurationMinutes} min ·{' '}
                      {trainingSummary.nextUpcomingSession.exercises.length} prescribed movements
                    </Text>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() =>
                        router.push(`/workout/${trainingSummary.nextUpcomingSession!.sessionId}`)
                      }
                    >
                      <Text style={styles.secondaryButtonText}>Preview Session Early</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* WORKOUT DAY CARD (Planned, In Progress, or Completed) */}
            {trainingSummary.status !== 'rest_day' && trainingSummary.currentSession && (
              <View style={styles.workoutCard}>
                <View style={styles.workoutCardHeader}>
                  <View style={styles.sessionBadge}>
                    <Text style={styles.sessionBadgeText}>
                      SESSION {trainingSummary.currentSession.sequenceIndex} OF{' '}
                      {trainingSummary.totalCycleSessions}
                    </Text>
                  </View>
                  <Text style={styles.durationTag}>
                    ~{trainingSummary.currentSession.targetDurationMinutes} min
                  </Text>
                </View>

                <Text style={styles.workoutSessionName}>
                  {trainingSummary.currentSession.sessionName}
                </Text>

                {/* Focus Areas Chips */}
                <View style={styles.chipRow}>
                  {trainingSummary.currentSession.focusAreas.map((f) => (
                    <View key={f} style={styles.focusChip}>
                      <Text style={styles.focusChipText}>{f.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                  {trainingSummary.currentSession.conditioning && (
                    <View style={[styles.focusChip, styles.conditioningChip]}>
                      <Text style={[styles.focusChipText, styles.conditioningChipText]}>
                        + Conditioning
                      </Text>
                    </View>
                  )}
                </View>

                {/* Exercises summary preview */}
                <View style={styles.exercisesPreview}>
                  <Text style={styles.exercisesPreviewLabel}>
                    {trainingSummary.currentSession.exercises.length} Prescribed Movements:
                  </Text>
                  <Text style={styles.exercisesPreviewList}>
                    {trainingSummary.currentSession.exercises
                      .map((e) => e.exerciseName)
                      .slice(0, 3)
                      .join(' · ')}
                    {trainingSummary.currentSession.exercises.length > 3
                      ? ` +${trainingSummary.currentSession.exercises.length - 3} more`
                      : ''}
                  </Text>
                </View>

                {/* Action button */}
                {trainingSummary.status === 'in_progress' ? (
                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={() =>
                      router.push(`/workout/${trainingSummary.currentSession!.sessionId}`)
                    }
                  >
                    <Text style={styles.primaryActionText}>Continue Workout ▶</Text>
                  </TouchableOpacity>
                ) : trainingSummary.status === 'completed' ? (
                  <TouchableOpacity
                    style={[styles.primaryActionButton, styles.completedActionButton]}
                    onPress={() =>
                      router.push(`/workout/${trainingSummary.currentSession!.sessionId}`)
                    }
                  >
                    <Text style={styles.completedActionText}>View Workout Summary</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={() =>
                      router.push(`/workout/${trainingSummary.currentSession!.sessionId}`)
                    }
                  >
                    <Text style={styles.primaryActionText}>Start Workout</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.viewPlanLink}
              onPress={() => router.push('/plan-overview')}
            >
              <Text style={styles.viewPlanLinkText}>View Full Training Plan →</Text>
            </TouchableOpacity>
          </View>

          {/* ============================================================ */}
          {/* SECTION B: TODAY'S NUTRITION                                 */}
          {/* ============================================================ */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Today's Nutrition</Text>
              {nutritionSummary.status === 'ready' && (
                <View style={styles.strategyStatusBadge}>
                  <Text style={styles.strategyStatusText}>Quantitative Targets Active</Text>
                </View>
              )}
            </View>

            {/* QUANTITATIVE TARGETS VS LOGGED INTAKE CARD */}
            {nutritionSummary.status === 'ready' &&
              nutritionSummary.plannedTargets &&
              nutritionSummary.loggedIntake && (
                <View style={styles.nutritionComparisonCard}>
                  <Text style={styles.comparisonHeader}>Daily Energy & Macronutrients</Text>
                  <Text style={styles.comparisonSubheader}>
                    Authoritative target benchmarks compared against recorded intake.
                  </Text>

                  {/* Calories Row */}
                  <View style={styles.macroRow}>
                    <View style={styles.macroCol}>
                      <Text style={styles.macroLabel}>ENERGY</Text>
                      <Text style={styles.macroValue}>
                        {nutritionSummary.loggedIntake.calories} kcal
                      </Text>
                      <Text style={styles.macroSubtext}>
                        Target: {nutritionSummary.plannedTargets.calories} kcal
                      </Text>
                    </View>
                    <View style={styles.macroDivider} />
                    <View style={styles.macroCol}>
                      <Text style={styles.macroLabel}>REMAINING</Text>
                      <Text
                        style={[
                          styles.macroValue,
                          nutritionSummary.remainingDifference!.calories < 0 && { color: '#F2994A' },
                        ]}
                      >
                        {nutritionSummary.remainingDifference!.calories >= 0 ? '' : '+'}
                        {nutritionSummary.remainingDifference!.calories} kcal
                      </Text>
                      <Text style={styles.macroSubtext}>based on logged</Text>
                    </View>
                  </View>

                  {/* Macronutrients Grid */}
                  <View style={styles.macrosGrid}>
                    <View style={styles.macroPill}>
                      <Text style={styles.macroPillLabel}>Protein</Text>
                      <Text style={styles.macroPillValue}>
                        {nutritionSummary.loggedIntake.proteinGrams}g
                      </Text>
                      <Text style={styles.macroPillTarget}>
                        / {nutritionSummary.plannedTargets.proteinGrams}g
                      </Text>
                    </View>
                    <View style={styles.macroPill}>
                      <Text style={styles.macroPillLabel}>Fats</Text>
                      <Text style={styles.macroPillValue}>
                        {nutritionSummary.loggedIntake.fatGrams}g
                      </Text>
                      <Text style={styles.macroPillTarget}>
                        / {nutritionSummary.plannedTargets.fatGrams}g
                      </Text>
                    </View>
                    <View style={styles.macroPill}>
                      <Text style={styles.macroPillLabel}>Carbs</Text>
                      <Text style={styles.macroPillValue}>
                        {nutritionSummary.loggedIntake.carbsGrams}g
                      </Text>
                      <Text style={styles.macroPillTarget}>
                        / {nutritionSummary.plannedTargets.carbsGrams}g
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.disclaimerText}>
                    * Difference based on recorded intake. Missing meal logs do not represent zero
                    food consumption.
                  </Text>
                </View>
              )}

            {/* QUALITATIVE ONLY NOTICE */}
            {nutritionSummary.status === 'qualitative_only' && (
              <View style={styles.qualitativeNoticeCard}>
                <Text style={styles.qualitativeNoticeTitle}>Qualitative Nutrition Framework</Text>
                <Text style={styles.qualitativeNoticeText}>
                  Caloric and macronutrient numbers are withheld because biological sex or full
                  inputs were not specified. Tracking is focused on habit consistency and meal structure.
                </Text>
              </View>
            )}

            {/* MEAL SLOTS LIST */}
            <Text style={styles.subSectionTitle}>Planned Meal Slots</Text>
            {nutritionSummary.mealSlots.map((slot) => {
              const isLogged = slot.status === 'completed';
              const isSkipped = slot.status === 'skipped';
              const isPartial = slot.status === 'partial';

              return (
                <View key={slot.slotId} style={styles.mealSlotCard}>
                  <View style={styles.mealSlotHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotName}>{slot.slotName}</Text>
                      {slot.targetCalories && (
                        <Text style={styles.slotTargetCalories}>
                          Target: ~{slot.targetCalories} kcal
                          {slot.loggedCalories !== undefined && ` · Logged: ${slot.loggedCalories} kcal`}
                        </Text>
                      )}
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.slotStatusPill,
                        isLogged && styles.slotStatusLogged,
                        isSkipped && styles.slotStatusSkipped,
                        isPartial && styles.slotStatusPartial,
                      ]}
                    >
                      <Text
                        style={[
                          styles.slotStatusPillText,
                          isLogged && styles.slotStatusLoggedText,
                          isSkipped && styles.slotStatusSkippedText,
                        ]}
                      >
                        {isLogged ? '✓ Logged' : isSkipped ? '— Skipped' : isPartial ? '● Partial' : 'Not Started'}
                      </Text>
                    </View>
                  </View>

                  {/* Food items info */}
                  {slot.loggedFoodNames.length > 0 ? (
                    <Text style={styles.loggedFoodsSummary}>
                      Logged: {slot.loggedFoodNames.join(', ')}
                    </Text>
                  ) : slot.allowedFoodsPreview.length > 0 ? (
                    <Text style={styles.candidateFoodsPreview}>
                      Candidates: {slot.allowedFoodsPreview.join(', ')}
                    </Text>
                  ) : null}

                  {/* Detailed Meal Status & Explicit Action Buttons */}
                  <View style={styles.slotActionsRow}>
                    {slot.status === 'not_started' && (
                      <>
                        <TouchableOpacity
                          style={[styles.quickLogButton, styles.primaryLogBtn]}
                          onPress={() => logMealAsPlanned(slot.slotId)}
                        >
                          <Text style={[styles.quickLogButtonText, styles.primaryLogBtnText]}>Log Meal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => openCustomIntakeModal(slot, 'completed')}
                        >
                          <Text style={styles.quickLogButtonText}>Record Intake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => openCustomIntakeModal(slot, 'partial')}
                        >
                          <Text style={styles.quickLogButtonText}>Mark Partial</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => markMealSkipped(slot.slotId)}
                        >
                          <Text style={styles.quickLogButtonText}>Mark Skipped</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {slot.status === 'completed' && (
                      <>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => openCustomIntakeModal(slot, 'completed')}
                        >
                          <Text style={styles.quickLogButtonText}>Edit Intake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => markMealSkipped(slot.slotId)}
                        >
                          <Text style={styles.quickLogButtonText}>Mark Skipped</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => resetMealSlot(slot.slotId)}
                        >
                          <Text style={styles.quickLogButtonText}>Reset Slot</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {slot.status === 'partial' && (
                      <>
                        <TouchableOpacity
                          style={[styles.quickLogButton, styles.primaryLogBtn]}
                          onPress={() => logMealAsPlanned(slot.slotId)}
                        >
                          <Text style={[styles.quickLogButtonText, styles.primaryLogBtnText]}>Log as Planned</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => openCustomIntakeModal(slot, 'completed')}
                        >
                          <Text style={styles.quickLogButtonText}>Edit Intake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => resetMealSlot(slot.slotId)}
                        >
                          <Text style={styles.quickLogButtonText}>Reset Slot</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {slot.status === 'skipped' && (
                      <>
                        <TouchableOpacity
                          style={[styles.quickLogButton, styles.primaryLogBtn]}
                          onPress={() => logMealAsPlanned(slot.slotId)}
                        >
                          <Text style={[styles.quickLogButtonText, styles.primaryLogBtnText]}>Log Meal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => openCustomIntakeModal(slot, 'completed')}
                        >
                          <Text style={styles.quickLogButtonText}>Record Intake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickLogButton}
                          onPress={() => resetMealSlot(slot.slotId)}
                        >
                          <Text style={styles.quickLogButtonText}>Reset Slot</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.viewPlanLink}
              onPress={() => router.push('/plan-generation')}
            >
              <Text style={styles.viewPlanLinkText}>Manage Nutrition & Food Catalog →</Text>
            </TouchableOpacity>
          </View>

          {/* ============================================================ */}
          {/* SECTION C: ADAPTIVE COACHING & RECOMMENDATIONS              */}
          {/* ============================================================ */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Adaptive Coaching</Text>

            {/* Pending Revision Alert Card */}
            {pendingRevision && pendingRevision.status === 'pending_review' ? (
              <View style={styles.alertCard}>
                <View style={styles.alertCardTop}>
                  <Text style={styles.alertBadge}>REVISION AWAITING REVIEW</Text>
                </View>
                <Text style={styles.alertTitle}>
                  {pendingRevision.revisionReason === 'simplify_structure'
                    ? 'Simplified Meal Structure Proposed'
                    : 'Learned Food Preferences Available'}
                </Text>
                <Text style={styles.alertDescription}>
                  {pendingRevision.revisionReason === 'simplify_structure'
                    ? 'Based on frequent skipping, your daily meals can be consolidated into fewer slots while strictly preserving 100% of your daily calories and macros.'
                    : 'Based on your recurring substitutions, your meal choices can prioritize your preferred items with full dietary boundary protection.'}
                </Text>

                <TouchableOpacity
                  style={styles.reviewButton}
                  onPress={() => openRevisionReview(pendingRevision)}
                >
                  <Text style={styles.reviewButtonText}>Review Proposed Revision</Text>
                </TouchableOpacity>
              </View>
            ) : adaptationAlerts.length > 0 ? (
              adaptationAlerts.map((alert) => (
                <View key={alert.id} style={styles.alertCard}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertDescription}>{alert.description}</Text>
                  {alert.actionType === 'review_revision' && (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={handleProposeSimplification}
                    >
                      <Text style={styles.reviewButtonText}>
                        {alert.actionLabel ?? 'Review Recommendation'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {alert.actionType === 'view_plan' && (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={() => router.push('/plan-overview')}
                    >
                      <Text style={styles.reviewButtonText}>View Training Plan</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyAdaptationCard}>
                <Text style={styles.emptyAdaptationTitle}>All Systems On Track</Text>
                <Text style={styles.emptyAdaptationText}>
                  Your training and nutrition habits are running smoothly. As you log more days,
                  your coach will suggest optimizations if skipping or fatigue patterns emerge.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ============================================================ */}
        {/* REVISION REVIEW MODAL                                        */}
        {/* ============================================================ */}
        <Modal
          visible={isRevisionModalOpen}
          transparent={true}
          animationType="slide"
          onRequestClose={closeRevisionReview}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Review Proposed Revision</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedRevision?.revisionReason === 'simplify_structure'
                      ? 'Consolidate meal slots to match your natural eating frequency.'
                      : 'Integrate frequently logged food preferences.'}
                  </Text>
                </View>

                {/* Target Preservation Guarantee */}
                <View style={styles.guaranteeCard}>
                  <Text style={styles.guaranteeTitle}>✓ Targets 100% Preserved</Text>
                  <Text style={styles.guaranteeText}>
                    Daily target calories (
                    {selectedRevision?.revisedPlan.nutritionTargets?.energy.targetRange.midpointKcal ??
                      '—'}{' '}
                    kcal) and macronutrients are unchanged. Budgets have been redistributed across the
                    remaining meal slots.
                  </Text>
                </View>

                {/* Slots Preview */}
                <Text style={styles.modalSlotsHeading}>Proposed Meal Slots:</Text>
                {selectedRevision?.revisedPlan.dailyPlan.slots.map((s, idx) => (
                  <View key={s.slotId} style={styles.modalSlotRow}>
                    <Text style={styles.modalSlotName}>
                      {idx + 1}. {s.name}
                    </Text>
                    <Text style={styles.modalSlotCals}>
                      ~{s.targets?.targetEnergyKcal ?? '—'} kcal
                    </Text>
                  </View>
                ))}

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={async () => {
                      if (selectedRevision) {
                        await handleAcceptRevision(selectedRevision);
                        closeRevisionReview();
                      }
                    }}
                  >
                    <Text style={styles.acceptButtonText}>Accept & Activate Revision</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={async () => {
                      if (selectedRevision) {
                        await handleRejectRevision(selectedRevision);
                        closeRevisionReview();
                      }
                    }}
                  >
                    <Text style={styles.rejectButtonText}>Keep Current Plan</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ============================================================ */}
        {/* CUSTOM INTAKE LOGGING MODAL                                  */}
        {/* ============================================================ */}
        <Modal
          visible={!!activeLoggingSlot}
          transparent={true}
          animationType="slide"
          onRequestClose={closeCustomIntakeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {intakeMode === 'partial' ? 'Log Partial Meal' : 'Record Actual Intake'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {activeLoggingSlot?.slotName ?? 'Meal Slot'} · Select food items and portion units consumed.
                  </Text>
                </View>

                {/* Mode Selector */}
                <View style={styles.modalModeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.modalModeBtn,
                      intakeMode === 'completed' && styles.modalModeBtnActive,
                    ]}
                    onPress={() => setIntakeMode('completed')}
                  >
                    <Text
                      style={[
                        styles.modalModeBtnText,
                        intakeMode === 'completed' && styles.modalModeBtnTextActive,
                      ]}
                    >
                      Full Meal (Completed)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalModeBtn,
                      intakeMode === 'partial' && styles.modalModeBtnActive,
                    ]}
                    onPress={() => setIntakeMode('partial')}
                  >
                    <Text
                      style={[
                        styles.modalModeBtnText,
                        intakeMode === 'partial' && styles.modalModeBtnTextActive,
                      ]}
                    >
                      Partial Intake
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Food Selection */}
                <Text style={styles.modalSectionLabel}>Select Food Item:</Text>
                <View style={styles.foodSelectionGrid}>
                  {[
                    { id: 'chicken_breast', name: 'Grilled Chicken Breast' },
                    { id: 'fish', name: 'Salmon / White Fish' },
                    { id: 'eggs', name: 'Whole Eggs' },
                    { id: 'tofu', name: 'Firm Tofu' },
                    { id: 'brown_rice', name: 'Cooked Brown Rice' },
                    { id: 'oats', name: 'Rolled Oats' },
                    { id: 'banana', name: 'Banana' },
                    { id: 'broccoli', name: 'Steamed Broccoli' },
                    { id: 'nuts', name: 'Mixed Nuts' },
                  ].map((food) => {
                    const isSelected = selectedFoodId === food.id;
                    return (
                      <TouchableOpacity
                        key={food.id}
                        style={[styles.foodChip, isSelected && styles.foodChipActive]}
                        onPress={() => setSelectedFoodId(food.id)}
                      >
                        <Text style={[styles.foodChipText, isSelected && styles.foodChipTextActive]}>
                          {food.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Portion Adjuster */}
                <Text style={styles.modalSectionLabel}>Portion Multiplier:</Text>
                <View style={styles.portionRow}>
                  {[0.5, 1.0, 1.5, 2.0, 2.5].map((units) => {
                    const isSelected = selectedPortion === units;
                    return (
                      <TouchableOpacity
                        key={units}
                        style={[styles.portionBtn, isSelected && styles.portionBtnActive]}
                        onPress={() => setSelectedPortion(units)}
                      >
                        <Text
                          style={[
                            styles.portionBtnText,
                            isSelected && styles.portionBtnTextActive,
                          ]}
                        >
                          {units}x
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={submitCustomIntake}
                  >
                    <Text style={styles.acceptButtonText}>Save Intake Record</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={closeCustomIntakeModal}
                  >
                    <Text style={styles.rejectButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EB5757',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  todayDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    marginTop: 2,
  },
  topNavLinks: {
    flexDirection: 'row',
    gap: 8,
  },
  topNavLink: {
    backgroundColor: '#1E1E28',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  topNavLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  guardBanner: {
    backgroundColor: '#281C1C',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#4A2828',
    marginBottom: 16,
  },
  guardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF8888',
    marginBottom: 4,
  },
  guardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  youthBanner: {
    backgroundColor: '#1C2428',
    borderColor: '#243A4A',
  },
  youthTitle: {
    color: '#60A5FA',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  plannedBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  plannedBadgeText: {
    color: '#DDD8FF',
  },
  inProgressBadge: {
    backgroundColor: 'rgba(242, 153, 74, 0.15)',
  },
  inProgressBadgeText: {
    color: '#F2994A',
  },
  completedBadge: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
  },
  completedBadgeText: {
    color: '#27AE60',
  },
  restBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  restBadgeText: {
    color: '#34D399',
  },
  strategyStatusBadge: {
    backgroundColor: '#1C1D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  strategyStatusText: {
    fontSize: 10,
    color: '#93A4C0',
    fontWeight: '600',
  },
  workoutCard: {
    backgroundColor: '#13141C',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242533',
    marginBottom: 8,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionBadge: {
    backgroundColor: '#202232',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9D9EAF',
  },
  durationTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  workoutSessionName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  focusChip: {
    backgroundColor: '#1C1D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  focusChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  conditioningChip: {
    backgroundColor: '#192620',
  },
  conditioningChipText: {
    color: '#34D399',
  },
  exercisesPreview: {
    backgroundColor: '#0E0F14',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  exercisesPreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 3,
  },
  exercisesPreviewList: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  primaryActionButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completedActionButton: {
    backgroundColor: '#202232',
  },
  completedActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  viewPlanLink: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewPlanLinkText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  restDayCard: {
    backgroundColor: '#131917',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1D2E27',
    marginBottom: 8,
  },
  restDayHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  restDayIcon: {
    fontSize: 24,
  },
  restDayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 4,
  },
  restDaySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  nextSessionBox: {
    backgroundColor: '#0E1412',
    padding: 12,
    borderRadius: 10,
  },
  nextSessionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  nextSessionName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nextSessionDuration: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#1A2923',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34D399',
  },
  nutritionComparisonCard: {
    backgroundColor: '#13141C',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#242533',
    marginBottom: 16,
  },
  comparisonHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  comparisonSubheader: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 12,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0E0F14',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  macroCol: {
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  macroSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  macroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: '#0E0F14',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  macroPillLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  macroPillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  macroPillTarget: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  disclaimerText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontStyle: 'italic',
    lineHeight: 14,
  },
  qualitativeNoticeCard: {
    backgroundColor: '#161922',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262D3D',
    marginBottom: 16,
  },
  qualitativeNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#93A4C0',
    marginBottom: 4,
  },
  qualitativeNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  mealSlotCard: {
    backgroundColor: '#13141C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#242533',
    marginBottom: 8,
  },
  mealSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  slotName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  slotTargetCalories: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  slotStatusPill: {
    backgroundColor: '#1E1E28',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotStatusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  slotStatusLogged: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
  },
  slotStatusLoggedText: {
    color: '#27AE60',
  },
  slotStatusSkipped: {
    backgroundColor: 'rgba(235, 87, 87, 0.15)',
  },
  slotStatusSkippedText: {
    color: '#EB5757',
  },
  slotStatusPartial: {
    backgroundColor: 'rgba(242, 153, 74, 0.15)',
  },
  loggedFoodsSummary: {
    fontSize: 12,
    color: '#27AE60',
    marginBottom: 8,
  },
  candidateFoodsPreview: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  slotActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  quickLogButton: {
    backgroundColor: '#202232',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickLogButtonActive: {
    backgroundColor: '#2C2D3C',
  },
  quickLogButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  alertCard: {
    backgroundColor: '#1F1B2C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3D2F5C',
    marginBottom: 8,
  },
  alertCardTop: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  alertBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  reviewButton: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyAdaptationCard: {
    backgroundColor: '#13141C',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#242533',
  },
  emptyAdaptationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyAdaptationText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  emptyPlanCard: {
    backgroundColor: '#13141C',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242533',
    marginTop: 40,
  },
  emptyIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E1E28',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyPlanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyPlanSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryCtaButton: {
    backgroundColor: colors.accent,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryCtaButton: {
    paddingVertical: 8,
  },
  secondaryCtaText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#161622',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  guaranteeCard: {
    backgroundColor: '#16221C',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1D3B2E',
    marginBottom: 14,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 4,
  },
  guaranteeText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  modalSlotsHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalSlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#101117',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  modalSlotName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalSlotCals: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalActions: {
    marginTop: 16,
    gap: 8,
    paddingBottom: 20,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectButton: {
    backgroundColor: '#202232',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  primaryLogBtn: {
    backgroundColor: 'rgba(39, 174, 96, 0.25)',
  },
  primaryLogBtnText: {
    color: '#27AE60',
    fontWeight: '700',
  },
  modalModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#0E0F14',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  modalModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modalModeBtnActive: {
    backgroundColor: '#202232',
  },
  modalModeBtnText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  modalModeBtnTextActive: {
    color: colors.textPrimary,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  foodSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  foodChip: {
    backgroundColor: '#1C1D2B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242533',
  },
  foodChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  foodChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  foodChipTextActive: {
    color: '#DDD8FF',
    fontWeight: '700',
  },
  portionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  portionBtn: {
    flex: 1,
    backgroundColor: '#1C1D2B',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242533',
  },
  portionBtnActive: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  portionBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  portionBtnTextActive: {
    color: '#34D399',
    fontWeight: '700',
  },
});
