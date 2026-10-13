/**
 * Workout Plan Overview Screen (Stage W5.1)
 *
 * Route: /plan-overview
 *
 * Displays the complete multi-session overview of the real generated WorkoutPlan.
 *
 * INVARIANTS:
 * - Reads the real generated plan from useWorkoutPlan() (with fallback to dev fixture).
 * - Sequence-based ordering (Session 1, Session 2, Session 3...); zero calendar weekday assignments.
 * - Displays session name, sequence index, duration guidance, focus areas, and exercise count.
 * - Provides direct "Start Workout" action linking to /workout/[sessionId].
 * - Zero nutrition, zero fake progression/recovery recommendations.
 */

import React, { useState, useEffect } from 'react';
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
import { useWorkoutPlan } from '../src/features/workout-plan';
import { getDevWorkoutSession } from '../src/features/workout-runtime';
import { defaultWorkoutHistoryRepository } from '../src/features/workout-history';
import type { WorkoutExecution } from '../src/features/workout-runtime';

export default function PlanOverviewScreen() {
  const router = useRouter();
  const { activePlan, getAllSessions } = useWorkoutPlan();
  const [executions, setExecutions] = useState<WorkoutExecution[]>([]);

  useEffect(() => {
    let isMounted = true;
    defaultWorkoutHistoryRepository.getExecutions().then((list) => {
      if (isMounted) setExecutions(list);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const sessions = getAllSessions();
  const hasRealPlan = Boolean(activePlan && sessions.length > 0);

  // If no plan is active, provide dev fallback option
  if (!hasRealPlan) {
    const devSession = getDevWorkoutSession();
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.mobileContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Workout Plan</Text>
              <Text style={styles.subtitle}>No active plan found. You can generate one through onboarding or run the development session.</Text>
            </View>

            <View style={styles.sessionCard}>
              <View style={styles.sessionCardHeader}>
                <View style={styles.sequenceBadge}>
                  <Text style={styles.sequenceText}>DEV FIXTURE</Text>
                </View>
                <Text style={styles.durationTag}>~{devSession.targetDurationMinutes} min</Text>
              </View>
              <Text style={styles.sessionName}>{devSession.sessionName}</Text>
              <Text style={styles.exerciseCountText}>{devSession.exercises.length} prescribed exercises</Text>

              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push(`/workout/${devSession.sessionId}`)}
              >
                <Text style={styles.startButtonText}>Start Dev Workout</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push('/plan-generation')}
            >
              <Text style={styles.backButtonText}>Return to Plan Generation</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  const plan = activePlan!;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.navBackButton}
            onPress={() => router.push('/plan-generation')}
          >
            <Text style={styles.navBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Your Training Plan</Text>
          <TouchableOpacity
            style={styles.navTodayButton}
            onPress={() => router.push('/today')}
          >
            <Text style={styles.navTodayText}>Today →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan Meta Card */}
          <View style={styles.planMetaCard}>
            <View style={styles.metaTopRow}>
              <View style={styles.goalBadge}>
                <Text style={styles.goalBadgeText}>
                  {plan.objective.primary.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
              <View style={styles.splitBadge}>
                <Text style={styles.splitBadgeText}>
                  {plan.structure.splitFamily.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.planSummaryTitle}>
              {plan.structure.sessionsPerCycle}-Session Adaptive Cycle
            </Text>
            <Text style={styles.planSummarySubtitle}>
              Target: {plan.structure.targetDaysPerWeek} days/week · Feasibility: {plan.generationMetadata.durationFeasibility ?? 'balanced'}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statNum}>{plan.generationMetadata.totalExercisesPrescribed}</Text>
                <Text style={styles.statLabel}>Exercises</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statNum}>{plan.generationMetadata.totalSetsPrescribed}</Text>
                <Text style={styles.statLabel}>Total Sets</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statNum}>{sessions.length}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
            </View>
          </View>

          {/* Session List */}
          <Text style={styles.sectionTitle}>Cycle Sessions ({sessions.length})</Text>

          {sessions.map((session, index) => {
            const hasConditioning = Boolean(session.conditioning);
            const latestExec = executions.find((e) => e.sessionId === session.sessionId);
            const isCompleted = latestExec?.status === 'completed';
            const isInProgress = latestExec?.status === 'in_progress';
            const isAbandoned = latestExec?.status === 'abandoned';

            return (
              <View key={session.sessionId} style={styles.sessionCard}>
                <View style={styles.sessionCardHeader}>
                  <View style={styles.sequenceBadge}>
                    <Text style={styles.sequenceText}>SESSION {session.sequenceIndex}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isCompleted && (
                      <View style={[styles.sequenceBadge, { backgroundColor: 'rgba(39, 174, 96, 0.15)' }]}>
                        <Text style={[styles.sequenceText, { color: '#27AE60' }]}>✓ COMPLETED</Text>
                      </View>
                    )}
                    {isInProgress && (
                      <View style={[styles.sequenceBadge, { backgroundColor: 'rgba(242, 153, 74, 0.15)' }]}>
                        <Text style={[styles.sequenceText, { color: '#F2994A' }]}>● IN PROGRESS</Text>
                      </View>
                    )}
                    {isAbandoned && (
                      <View style={[styles.sequenceBadge, { backgroundColor: 'rgba(235, 87, 87, 0.15)' }]}>
                        <Text style={[styles.sequenceText, { color: '#EB5757' }]}>ABANDONED</Text>
                      </View>
                    )}
                    <Text style={styles.durationTag}>~{session.targetDurationMinutes} min</Text>
                  </View>
                </View>

                <Text style={styles.sessionName}>{session.sessionName}</Text>

                {/* Focus Target Chips */}
                <View style={styles.focusChipsRow}>
                  {session.focusAreas.map((focus) => (
                    <View key={focus} style={styles.focusChip}>
                      <Text style={styles.focusChipText}>{focus.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                  {hasConditioning && (
                    <View style={[styles.focusChip, styles.condChip]}>
                      <Text style={[styles.focusChipText, styles.condChipText]}>+ Conditioning</Text>
                    </View>
                  )}
                </View>

                {/* Exercises preview */}
                <View style={styles.exercisePreviewBox}>
                  <Text style={styles.exercisePreviewTitle}>
                    {session.exercises.length} Prescribed Movements:
                  </Text>
                  <Text style={styles.exerciseListSummary}>
                    {session.exercises.map((e) => e.exerciseName).slice(0, 3).join(' · ')}
                    {session.exercises.length > 3 ? ` +${session.exercises.length - 3} more` : ''}
                  </Text>
                </View>

                {/* Start / Resume Session Action */}
                <TouchableOpacity
                  style={[styles.startButton, isCompleted && { backgroundColor: '#2C2D3C' }]}
                  onPress={() => router.push(`/workout/${session.sessionId}`)}
                >
                  <Text style={styles.startButtonText}>
                    {isInProgress
                      ? `Resume Session ${session.sequenceIndex} ▶`
                      : isCompleted
                      ? `View / Repeat Session ${session.sequenceIndex}`
                      : `Start Session ${session.sequenceIndex}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
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
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  navBackButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E1E28',
    borderRadius: 8,
  },
  navBackText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  navTodayButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#262438',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  navTodayText: {
    fontSize: 13,
    color: '#DDD8FF',
    fontWeight: '700',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  planMetaCard: {
    backgroundColor: '#161622',
    borderRadius: 16,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: '#282838',
    marginBottom: spacing.lg,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  goalBadge: {
    backgroundColor: '#262438',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DDD8FF',
  },
  splitBadge: {
    backgroundColor: '#1F2430',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#303B52',
  },
  splitBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93A4C0',
    textTransform: 'capitalize',
  },
  planSummaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  planSummarySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: spacing.sm + 2,
  },
  statCol: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm + 2,
    letterSpacing: 0.2,
  },
  sessionCard: {
    backgroundColor: '#13141C',
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
    marginBottom: spacing.xs + 2,
  },
  sequenceBadge: {
    backgroundColor: '#202232',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sequenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9D9EAF',
    letterSpacing: 0.5,
  },
  durationTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  focusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm + 2,
  },
  focusChip: {
    backgroundColor: '#1C1D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  focusChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  condChip: {
    backgroundColor: '#192620',
    borderColor: '#1F3F30',
  },
  condChipText: {
    color: '#34D399',
  },
  exercisePreviewBox: {
    backgroundColor: '#101117',
    borderRadius: 8,
    padding: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  exercisePreviewTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 3,
  },
  exerciseListSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  exerciseCountText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  backButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
