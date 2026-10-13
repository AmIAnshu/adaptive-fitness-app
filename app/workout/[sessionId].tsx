/**
 * Workout Player Route (Stage W4.2)
 *
 * Route: /workout/[sessionId]
 *
 * Mobile-first interactive workout player screen:
 * - Loads prescribed WorkoutSession from plan (or dev fixture)
 * - Wires user actions to W4.1 pure state machine via useWorkoutPlayer
 * - Records actual reps, load, load units (kg/lb/BW), perceived RIR, quality, and notes
 * - Supports warm-up / work / optional set distinctions
 * - Provides explicit Finish Early / Skip / Substitution flows
 * - Includes rest countdown guidance from prescribed restSeconds
 * - Records conditioning execution when prescribed
 * - Attaches subjective session feedback (RPE, energy, soreness)
 * - Disallows faking or silently overwriting prescribed values
 * - Exports truthful factual evidence for downstream T7 progression & T9 recovery
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../src/theme';
import { PrimaryButton } from '../../src/components';
import {
  getDevWorkoutSession,
  useWorkoutPlayer,
  type LoadUnit,
  type ExecutionQuality,
  type WorkoutExecution,
} from '../../src/features/workout-runtime';
import { useWorkoutPlan } from '../../src/features/workout-plan';
import { SEED_EXERCISE_CATALOG } from '../../src/features/training-strategy/exerciseCatalog';
import { defaultWorkoutHistoryRepository } from '../../src/features/workout-history';

export default function WorkoutPlayerScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { getSession, activePlan } = useWorkoutPlan();

  // Load prescribed session: consume REAL generated plan first, falling back to dev fixture only for isolated testing
  const prescribedSession = useMemo(() => {
    const realSession = getSession(sessionId);
    if (realSession) {
      return realSession;
    }
    return getDevWorkoutSession(sessionId);
  }, [sessionId, getSession]);

  const isUsingDevFixture = !activePlan || !getSession(sessionId);
  const planId = isUsingDevFixture ? 'dev_fixture_plan' : 'real_adaptive_plan';

  // Hydrate in-progress execution if one exists
  const [resumedExecution, setResumedExecution] = useState<WorkoutExecution | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    defaultWorkoutHistoryRepository
      .loadActiveExecution(planId, prescribedSession.sessionId)
      .then((existing) => {
        if (!isMounted) return;
        setResumedExecution(existing ?? null);
      })
      .catch((err) => {
        console.warn('[WorkoutPlayerScreen] Failed to load active execution:', err);
        if (isMounted) setResumedExecution(null);
      });
    return () => {
      isMounted = false;
    };
  }, [planId, prescribedSession.sessionId]);

  // Wait for hydration check before rendering player
  if (resumedExecution === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.mobileContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <WorkoutPlayerActive
      key={resumedExecution?.executionId ?? 'new_session'}
      prescribedSession={prescribedSession}
      planId={planId}
      initialExecution={resumedExecution}
      isUsingDevFixture={isUsingDevFixture}
    />
  );
}

function WorkoutPlayerActive({
  prescribedSession,
  planId,
  initialExecution,
  isUsingDevFixture,
}: {
  prescribedSession: any;
  planId: string;
  initialExecution: WorkoutExecution | null;
  isUsingDevFixture: boolean;
}) {
  const router = useRouter();

  const {
    execution,
    activeExerciseIndex,
    setActiveExerciseIndex,
    currentPrescribedExercise,
    currentExerciseExecution,
    totalExercises,
    progressRatio,
    restSecondsRemaining,
    isRestActive,
    setRestSecondsRemaining,
    uiError,
    showFinishEarlyPrompt,
    setShowFinishEarlyPrompt,
    showSubstitutionModal,
    setShowSubstitutionModal,
    showAbandonModal,
    setShowAbandonModal,
    feedbackSnapshot,
    t7Feedback,
    handleStartWorkout,
    handleRecordSet,
    handleSkipRestTimer,
    handleCompleteCurrentExercise,
    handleFinishExerciseEarly,
    handleSkipCurrentExercise,
    handleSubstituteCurrentExercise,
    handleRecordConditioning,
    handleAttachFeedback,
    handleCompleteWorkout,
    handleAbandonWorkout,
  } = useWorkoutPlayer({
    prescribedSession,
    planId,
    initialExecution,
    onExecutionChange: (updated) => {
      if (updated.status === 'in_progress' || updated.status === 'not_started') {
        defaultWorkoutHistoryRepository.saveActiveExecution(updated).catch((err) => {
          console.warn('[WorkoutPlayer] Failed to persist active execution:', err);
        });
      } else if (
        updated.status === 'completed' ||
        updated.status === 'abandoned' ||
        updated.status === 'skipped'
      ) {
        defaultWorkoutHistoryRepository.saveTerminalExecution(updated).catch((err) => {
          console.warn('[WorkoutPlayer] Failed to persist terminal execution:', err);
        });
      }
    },
  });

  // Local set entry form state
  const [activeSetIndex, setActiveSetIndex] = useState<number>(1);
  const [inputReps, setInputReps] = useState<string>('');
  const [inputLoad, setInputLoad] = useState<string>('');
  const [inputUnit, setInputUnit] = useState<LoadUnit>('kg');
  const [inputRIR, setInputRIR] = useState<string>('');
  const [inputQuality, setInputQuality] = useState<ExecutionQuality>('clean');
  const [inputNotes, setInputNotes] = useState<string>('');
  const [setEntryError, setSetEntryError] = useState<string | null>(null);

  // Subjective feedback modal state before completion
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [sessionRPE, setSessionRPE] = useState<number>(7);
  const [sessionEnergy, setSessionEnergy] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [sessionSoreness, setSessionSoreness] = useState<'none' | 'mild' | 'moderate' | 'severe'>('mild');
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Conditioning local inputs
  const [condDuration, setCondDuration] = useState<string>('');
  const [condRIR, setCondRIR] = useState<string>('');

  // Rest timer countdown effect
  useEffect(() => {
    let interval: any = null;
    if (isRestActive && restSecondsRemaining > 0) {
      interval = setInterval(() => {
        setRestSecondsRemaining((prev) => {
          if (prev <= 1) {
            handleSkipRestTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRestActive, restSecondsRemaining, handleSkipRestTimer, setRestSecondsRemaining]);

  // Sync inputs when active exercise or set changes
  useEffect(() => {
    if (currentPrescribedExercise) {
      // Find default target reps from prescribed
      const targetReps =
        currentPrescribedExercise.repetitionPrescription.targetReps ??
        currentPrescribedExercise.repetitionPrescription.repRange?.min ??
        8;
      setInputReps(String(targetReps));

      // Find target RIR
      const targetRIR = currentPrescribedExercise.effortPrescription.targetRIR ?? 2;
      setInputRIR(String(targetRIR));
      setInputQuality('clean');
      setInputNotes('');
      setSetEntryError(null);
    }
  }, [currentPrescribedExercise, activeExerciseIndex]);

  // Handle Set Save
  const onSaveSet = (setIdx: number) => {
    setSetEntryError(null);
    const parsedReps = parseInt(inputReps, 10);
    if (isNaN(parsedReps) || parsedReps < 0) {
      setSetEntryError('Please enter valid actual reps (>= 0).');
      return;
    }

    const parsedLoad = inputLoad.trim() !== '' ? parseFloat(inputLoad) : undefined;
    if (parsedLoad !== undefined && (isNaN(parsedLoad) || parsedLoad < 0)) {
      setSetEntryError('Load must be a positive number.');
      return;
    }

    const parsedRIR = inputRIR.trim() !== '' ? parseFloat(inputRIR) : undefined;
    if (parsedRIR !== undefined && (isNaN(parsedRIR) || parsedRIR < 0 || parsedRIR > 10)) {
      setSetEntryError('Perceived RIR must be between 0 and 10.');
      return;
    }

    handleRecordSet({
      setIndex: setIdx,
      actualReps: parsedReps,
      actualLoad: parsedLoad,
      loadUnit: inputUnit,
      perceivedEffortRIR: parsedRIR,
      executionQuality: inputQuality,
      notes: inputNotes.trim() !== '' ? inputNotes : undefined,
    });

    // Advance to next set if available
    const nextSetIdx = setIdx + 1;
    if (currentPrescribedExercise && nextSetIdx <= currentPrescribedExercise.sets.length) {
      setActiveSetIndex(nextSetIdx);
    }
  };

  // Completed workout view
  if (execution.status === 'completed') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.mobileContainer}>
          <ScrollView contentContainerStyle={styles.summaryContent}>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>✓ WORKOUT COMPLETE</Text>
            </View>

            <Text style={styles.summaryTitle}>{prescribedSession.sessionName}</Text>
            <Text style={styles.summarySubtitle}>
              Execution recorded factually. Structured evidence is ready for downstream T7 & T9.
            </Text>

            <View style={styles.statsCard}>
              <Text style={styles.statsCardHeader}>Session Evidence Summary</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Exercises Prescribed:</Text>
                <Text style={styles.statValue}>{feedbackSnapshot.totalPrescribedExercises}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Exercises Completed:</Text>
                <Text style={styles.statValue}>{feedbackSnapshot.completedExercisesCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Exercises Skipped / Partial:</Text>
                <Text style={styles.statValue}>{feedbackSnapshot.skippedExercisesCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Work Sets Completed:</Text>
                <Text style={styles.statValue}>
                  {feedbackSnapshot.completedWorkSetsCount} / {feedbackSnapshot.totalPrescribedWorkSets}
                </Text>
              </View>
              {feedbackSnapshot.subjectiveFeedback?.sessionRPE && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Session Effort (RPE):</Text>
                  <Text style={styles.statValue}>
                    {feedbackSnapshot.subjectiveFeedback.sessionRPE} / 10
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.t7SnapshotCard}>
              <Text style={styles.statsCardHeader}>T7 Progression Handoff Snapshot</Text>
              {t7Feedback.map((fb, idx) => (
                <View key={idx} style={styles.fbItem}>
                  <Text style={styles.fbExerciseName}>
                    {fb.exerciseId.replace(/_/g, ' ')}
                    {fb.isSubstituted ? ' [Substituted]' : ''}
                  </Text>
                  <Text style={styles.fbDetails}>
                    Completed: {fb.completed ? 'Yes' : 'No'} · Target Reps: {fb.targetRepsAchieved ? '✓' : '✗'} · RIR: {fb.perceivedEffortRIR ?? '—'} · Quality: {fb.executionQuality ?? 'clean'}
                  </Text>
                </View>
              ))}
            </View>

            <PrimaryButton
              label="Go to Today Dashboard"
              onPress={() => router.push('/today')}
            />
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: 'center' }}
              onPress={() => router.push('/plan-generation')}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Return to Plan Overview</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // Abandoned workout view
  if (execution.status === 'abandoned') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.mobileContainer}>
          <ScrollView contentContainerStyle={styles.summaryContent}>
            <View style={[styles.summaryBadge, { backgroundColor: 'rgba(235, 87, 87, 0.15)' }]}>
              <Text style={[styles.summaryBadgeText, { color: '#EB5757' }]}>WORKOUT ABANDONED</Text>
            </View>
            <Text style={styles.summaryTitle}>{prescribedSession.sessionName}</Text>
            <Text style={styles.summarySubtitle}>
              Workout was left early. All sets recorded before exit were preserved truthfully for downstream recovery history.
            </Text>
            <PrimaryButton
              label="Go to Today Dashboard"
              onPress={() => router.push('/today')}
            />
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: 'center' }}
              onPress={() => router.push('/plan-generation')}
            >
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Return to Plan Overview</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              if (execution.status === 'in_progress') {
                setShowAbandonModal(true);
              } else {
                router.back();
              }
            }}
          >
            <Text style={styles.cancelText}>✕ Cancel</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.sessionName} numberOfLines={1}>
              {prescribedSession.sessionName}
            </Text>
            <Text style={styles.progressCounter}>
              {isUsingDevFixture ? '[Dev Fixture] ' : ''}Exercise {activeExerciseIndex + 1} of {totalExercises}
            </Text>
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* PROGRESS BAR */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
        </View>

        {/* REST TIMER TOAST (IF ACTIVE) */}
        {isRestActive && (
          <View style={styles.restToast}>
            <Text style={styles.restToastLabel}>Rest Timer</Text>
            <Text style={styles.restToastTime}>{restSecondsRemaining}s</Text>
            <TouchableOpacity onPress={handleSkipRestTimer} style={styles.skipRestBtn}>
              <Text style={styles.skipRestText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* UI ERROR BANNER */}
        {uiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{uiError}</Text>
          </View>
        )}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* WORKOUT NOT STARTED BANNER */}
          {execution.status === 'not_started' && (
            <View style={styles.startBanner}>
              <Text style={styles.startBannerTitle}>Ready to begin?</Text>
              <Text style={styles.startBannerSubtitle}>
                Press Start to begin tracking your sets and load in real time.
              </Text>
              <PrimaryButton label="Start Workout" onPress={handleStartWorkout} />
            </View>
          )}

          {/* CURRENT EXERCISE CARD */}
          {currentPrescribedExercise && (
            <View style={styles.exerciseCard}>
              <View style={styles.exerciseHeaderRow}>
                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {currentPrescribedExercise.role.toUpperCase()}
                    </Text>
                  </View>
                  {currentExerciseExecution?.status === 'substituted' && (
                    <View style={[styles.roleBadge, { backgroundColor: colors.accentMuted }]}>
                      <Text style={[styles.roleBadgeText, { color: colors.accent }]}>SUBSTITUTED</Text>
                    </View>
                  )}
                  {currentExerciseExecution?.status === 'skipped' && (
                    <View style={[styles.roleBadge, { backgroundColor: 'rgba(235, 87, 87, 0.15)' }]}>
                      <Text style={[styles.roleBadgeText, { color: '#EB5757' }]}>SKIPPED</Text>
                    </View>
                  )}
                </View>

                {currentPrescribedExercise.substitutionExerciseIds.length > 0 &&
                  execution.status === 'in_progress' &&
                  currentExerciseExecution?.status !== 'completed' && (
                    <TouchableOpacity
                      onPress={() => setShowSubstitutionModal(true)}
                      style={styles.swapBtn}
                    >
                      <Text style={styles.swapBtnText}>Swap ↻</Text>
                    </TouchableOpacity>
                  )}
              </View>

              <Text style={styles.exerciseTitle}>
                {currentExerciseExecution?.status === 'substituted' && currentExerciseExecution.substitution
                  ? currentExerciseExecution.substitution.substitutedExerciseId.replace(/_/g, ' ')
                  : currentPrescribedExercise.exerciseName}
              </Text>

              {/* PRESCRIBED GUIDANCE CARD */}
              <View style={styles.prescribedPillsRow}>
                <View style={styles.guidancePill}>
                  <Text style={styles.guidanceLabel}>Prescribed Reps</Text>
                  <Text style={styles.guidanceValue}>
                    {currentPrescribedExercise.repetitionPrescription.label}
                  </Text>
                </View>
                <View style={styles.guidancePill}>
                  <Text style={styles.guidanceLabel}>Target RIR</Text>
                  <Text style={styles.guidanceValue}>
                    {currentPrescribedExercise.effortPrescription.targetRIR} RIR
                  </Text>
                </View>
                <View style={styles.guidancePill}>
                  <Text style={styles.guidanceLabel}>Rest</Text>
                  <Text style={styles.guidanceValue}>
                    {currentPrescribedExercise.restSeconds}s
                  </Text>
                </View>
              </View>

              {/* SET LIST TABLE */}
              <View style={styles.setTable}>
                <View style={styles.setTableHeader}>
                  <Text style={[styles.colHeader, { flex: 0.8 }]}>SET</Text>
                  <Text style={[styles.colHeader, { flex: 1.2 }]}>TYPE</Text>
                  <Text style={[styles.colHeader, { flex: 1.5 }]}>PRESCRIBED</Text>
                  <Text style={[styles.colHeader, { flex: 1.5 }]}>ACTUAL</Text>
                  <Text style={[styles.colHeader, { flex: 0.8 }]}>STATUS</Text>
                </View>

                {currentPrescribedExercise.sets.map((prescribedSet) => {
                  const setExec = currentExerciseExecution?.setExecutions.find(
                    (s) => s.setIndex === prescribedSet.setIndex
                  );
                  const isCompleted = setExec?.completed ?? false;
                  const isSelected = activeSetIndex === prescribedSet.setIndex;

                  return (
                    <TouchableOpacity
                      key={prescribedSet.setIndex}
                      style={[
                        styles.setRow,
                        isSelected && styles.setRowSelected,
                        isCompleted && styles.setRowCompleted,
                      ]}
                      onPress={() => setActiveSetIndex(prescribedSet.setIndex)}
                    >
                      <Text style={[styles.setCellText, { flex: 0.8 }]}>
                        {prescribedSet.setIndex}
                      </Text>
                      <Text style={[styles.setCellText, { flex: 1.2 }]}>
                        {prescribedSet.setType}
                      </Text>
                      <Text style={[styles.setCellText, { flex: 1.5, color: colors.textSecondary }]}>
                        {prescribedSet.targetReps ?? '8-12'} reps
                      </Text>
                      <Text style={[styles.setCellText, { flex: 1.5 }]}>
                        {isCompleted
                          ? `${setExec?.actualReps}r @ ${setExec?.actualLoad ?? 'BW'}${setExec?.loadUnit}`
                          : '—'}
                      </Text>
                      <Text style={[styles.setCellText, { flex: 0.8, color: isCompleted ? '#27AE60' : colors.textTertiary }]}>
                        {isCompleted ? '✓' : '○'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* SET INPUT FORM (WHEN WORKOUT IS IN PROGRESS) */}
              {execution.status === 'in_progress' && (
                <View style={styles.entryBox}>
                  <Text style={styles.entryTitle}>Record Set {activeSetIndex}</Text>

                  {setEntryError && (
                    <Text style={styles.entryInlineError}>{setEntryError}</Text>
                  )}

                  <View style={styles.inputsRow}>
                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Actual Reps *</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={inputReps}
                        onChangeText={setInputReps}
                        placeholder="e.g. 10"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>Load ({inputUnit})</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={inputLoad}
                        onChangeText={setInputLoad}
                        placeholder="e.g. 60"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>

                    <View style={styles.inputCol}>
                      <Text style={styles.inputLabel}>RIR (0-10)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={inputRIR}
                        onChangeText={setInputRIR}
                        placeholder="e.g. 2"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  </View>

                  <View style={styles.unitToggleRow}>
                    <Text style={styles.unitLabel}>Unit:</Text>
                    {(['kg', 'lb', 'bodyweight'] as LoadUnit[]).map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, inputUnit === u && styles.unitChipSelected]}
                        onPress={() => setInputUnit(u)}
                      >
                        <Text style={[styles.unitChipText, inputUnit === u && styles.unitChipTextSelected]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.recordSetBtn}
                    onPress={() => onSaveSet(activeSetIndex)}
                  >
                    <Text style={styles.recordSetBtnText}>Log Set {activeSetIndex} ✓</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* EXERCISE ACTION CONTROLS */}
              {execution.status === 'in_progress' && (
                <View style={styles.exerciseActionsRow}>
                  <TouchableOpacity
                    style={styles.actionOutlineBtn}
                    onPress={() => setShowFinishEarlyPrompt(true)}
                  >
                    <Text style={styles.actionOutlineBtnText}>Finish Early</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionOutlineBtn}
                    onPress={() => handleSkipCurrentExercise()}
                  >
                    <Text style={styles.actionOutlineBtnText}>Skip Exercise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionPrimaryBtn}
                    onPress={() => handleCompleteCurrentExercise()}
                  >
                    <Text style={styles.actionPrimaryBtnText}>Complete Exercise ✓</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* EXERCISE PAGINATION NAVIGATOR */}
          <View style={styles.paginationRow}>
            <TouchableOpacity
              disabled={activeExerciseIndex === 0}
              onPress={() => setActiveExerciseIndex((prev) => Math.max(0, prev - 1))}
              style={[styles.navArrowBtn, activeExerciseIndex === 0 && styles.navArrowBtnDisabled]}
            >
              <Text style={styles.navArrowText}>‹ Previous</Text>
            </TouchableOpacity>

            <Text style={styles.pageIndicator}>
              {activeExerciseIndex + 1} / {totalExercises}
            </Text>

            <TouchableOpacity
              disabled={activeExerciseIndex === totalExercises - 1}
              onPress={() => setActiveExerciseIndex((prev) => Math.min(totalExercises - 1, prev + 1))}
              style={[
                styles.navArrowBtn,
                activeExerciseIndex === totalExercises - 1 && styles.navArrowBtnDisabled,
              ]}
            >
              <Text style={styles.navArrowText}>Next ›</Text>
            </TouchableOpacity>
          </View>

          {/* CONDITIONING SECTION (IF PRESCRIBED) */}
          {prescribedSession.conditioning && (
            <View style={styles.conditioningCard}>
              <View style={styles.condHeader}>
                <Text style={styles.condTitle}>Conditioning (Post-Resistance)</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {prescribedSession.conditioning.modalityFamily}
                  </Text>
                </View>
              </View>

              <Text style={styles.condGuidance}>
                Target Duration: {prescribedSession.conditioning.durationMinutesGuidance?.target ?? 15}m · {prescribedSession.conditioning.intensityGuidance}
              </Text>

              {execution.status === 'in_progress' && (
                <View style={styles.condInputRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, marginRight: 8 }]}
                    keyboardType="numeric"
                    placeholder="Actual Minutes"
                    placeholderTextColor={colors.textTertiary}
                    value={condDuration}
                    onChangeText={setCondDuration}
                  />
                  <TouchableOpacity
                    style={[styles.actionPrimaryBtn, { flex: 1 }]}
                    onPress={() => {
                      const mins = parseInt(condDuration, 10);
                      handleRecordConditioning({
                        status: 'completed',
                        actualDurationMinutes: isNaN(mins) ? undefined : mins,
                      });
                    }}
                  >
                    <Text style={styles.actionPrimaryBtnText}>Mark Done ✓</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* COMPLETE WORKOUT CTA */}
          {execution.status === 'in_progress' && (
            <View style={styles.finishWorkoutContainer}>
              <PrimaryButton
                label="Finish Workout"
                onPress={() => setShowFeedbackModal(true)}
              />
            </View>
          )}
        </ScrollView>

        {/* MODAL: SUBSTITUTION */}
        <Modal visible={showSubstitutionModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Substitute Exercise</Text>
              <Text style={styles.modalSubtitle}>
                Select an approved compatible substitute:
              </Text>

              {currentPrescribedExercise?.substitutionExerciseIds.map((subId) => (
                <TouchableOpacity
                  key={subId}
                  style={styles.subItem}
                  onPress={() => handleSubstituteCurrentExercise(subId, 'User swapped')}
                >
                  <Text style={styles.subItemText}>{subId.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowSubstitutionModal(false)}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: FINISH EARLY */}
        <Modal visible={showFinishEarlyPrompt} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Finish Exercise Early?</Text>
              <Text style={styles.modalSubtitle}>
                This will record completed sets and mark the exercise completed partially without faking missing sets.
              </Text>
              <PrimaryButton
                label="Yes, Finish Early"
                onPress={() => handleFinishExerciseEarly('Completed partial sets')}
              />
              <TouchableOpacity
                style={[styles.modalCloseBtn, { marginTop: 12 }]}
                onPress={() => setShowFinishEarlyPrompt(false)}
              >
                <Text style={styles.modalCloseText}>Continue Exercise</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: ABANDON CONFIRMATION */}
        <Modal visible={showAbandonModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Leave Workout?</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to exit? Your recorded sets will be saved as an abandoned session for recovery tracking.
              </Text>
              <PrimaryButton
                label="Abandon Workout"
                onPress={() => handleAbandonWorkout('User cancelled')}
              />
              <TouchableOpacity
                style={[styles.modalCloseBtn, { marginTop: 12 }]}
                onPress={() => setShowAbandonModal(false)}
              >
                <Text style={styles.modalCloseText}>Keep Working Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: SESSION FEEDBACK & FINAL COMPLETION */}
        <Modal visible={showFeedbackModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Session Check-in</Text>
              <Text style={styles.modalSubtitle}>
                Provide factual subjective feedback for future recovery adaptation:
              </Text>

              <Text style={styles.feedbackLabel}>Session RPE (1 = easy, 10 = max): {sessionRPE}</Text>
              <View style={styles.rpeRow}>
                {[5, 6, 7, 8, 9, 10].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.rpeChip, sessionRPE === num && styles.rpeChipSelected]}
                    onPress={() => setSessionRPE(num)}
                  >
                    <Text style={[styles.rpeChipText, sessionRPE === num && styles.rpeChipTextSelected]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.feedbackLabel}>Energy Level: {sessionEnergy} / 5</Text>
              <View style={styles.rpeRow}>
                {([1, 2, 3, 4, 5] as const).map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.rpeChip, sessionEnergy === num && styles.rpeChipSelected]}
                    onPress={() => setSessionEnergy(num)}
                  >
                    <Text style={[styles.rpeChipText, sessionEnergy === num && styles.rpeChipTextSelected]}>
                      {num}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.feedbackLabel}>Soreness:</Text>
              <View style={styles.rpeRow}>
                {(['none', 'mild', 'moderate', 'severe'] as const).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.rpeChip, sessionSoreness === lvl && styles.rpeChipSelected]}
                    onPress={() => setSessionSoreness(lvl)}
                  >
                    <Text style={[styles.rpeChipText, sessionSoreness === lvl && styles.rpeChipTextSelected]}>
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <PrimaryButton
                label="Submit & Complete Workout"
                onPress={() => {
                  setShowFeedbackModal(false);
                  handleCompleteWorkout({
                    sessionRPE,
                    energyLevel: sessionEnergy,
                    sorenessLevel: sessionSoreness,
                    notes: sessionNotes.trim() !== '' ? sessionNotes : undefined,
                  });
                }}
              />

              <TouchableOpacity
                style={[styles.modalCloseBtn, { marginTop: 12 }]}
                onPress={() => setShowFeedbackModal(false)}
              >
                <Text style={styles.modalCloseText}>Back</Text>
              </TouchableOpacity>
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
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    padding: spacing.xs,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  sessionName: {
    color: colors.textPrimary,
    fontSize: typography.subtitle.fontSize,
    fontWeight: typography.subtitle.fontWeight,
  },
  progressCounter: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 2,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: colors.surfaceSubtle,
    width: '100%',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: colors.accent,
  },
  restToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.accentBorder,
  },
  restToastLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  restToastTime: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  skipRestBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.surfaceSubtle,
  },
  skipRestText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(235, 87, 87, 0.15)',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#EB5757',
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  startBanner: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  startBannerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  startBannerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  swapBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  swapBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  prescribedPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  guidancePill: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
  },
  guidanceLabel: {
    color: colors.textTertiary,
    fontSize: 10,
    marginBottom: 2,
  },
  guidanceValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  setTable: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  setTableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colHeader: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setRowSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.08)',
  },
  setRowCompleted: {
    opacity: 0.85,
  },
  setCellText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  entryBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  entryTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  entryInlineError: {
    color: '#EB5757',
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  unitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  unitLabel: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  unitChipSelected: {
    backgroundColor: colors.accent,
  },
  unitChipText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  unitChipTextSelected: {
    color: colors.accentText,
    fontWeight: '700',
  },
  recordSetBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordSetBtnText: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.lg,
  },
  actionOutlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionOutlineBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  actionPrimaryBtn: {
    flex: 1.5,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionPrimaryBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  navArrowBtn: {
    padding: spacing.sm,
  },
  navArrowBtnDisabled: {
    opacity: 0.3,
  },
  navArrowText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  pageIndicator: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  conditioningCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  condHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  condTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  condGuidance: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  condInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  finishWorkoutContainer: {
    marginTop: 32,
  },
  // SUMMARY VIEW STYLES
  summaryContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  summaryBadge: {
    backgroundColor: 'rgba(39, 174, 96, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  summaryBadgeText: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  summarySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statsCardHeader: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  t7SnapshotCard: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  fbItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 6,
  },
  fbExerciseName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  fbDetails: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  subItem: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: 8,
  },
  subItemText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseBtn: {
    alignItems: 'center',
    padding: spacing.sm,
    marginTop: 4,
  },
  modalCloseText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  feedbackLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  rpeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  rpeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
  },
  rpeChipSelected: {
    backgroundColor: colors.accent,
  },
  rpeChipText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  rpeChipTextSelected: {
    color: colors.accentText,
    fontWeight: '700',
  },
});
