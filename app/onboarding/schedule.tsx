/**
 * Onboarding — Your Schedule Screen
 *
 * Screen 4 of 10 in the Adaptive Fitness onboarding flow.
 * Collects real-world training availability to power the adaptive split & scheduling engine:
 * 1. Ideal training days per week (2–6)
 * 2. Realistic minimum days on a busy week (1 to ideal)
 * 3. Available days of the week (Mon–Sun multi-select)
 * 4. Schedule predictability/flexibility (fixed, sometimes, often)
 * 5. Workout session duration (20–30m, 30–45m, 45–60m, 60–75m, 75+m)
 * 6. Preferred time of day (morning, afternoon, evening, no preference)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../src/theme';
import {
  OnboardingProgress,
  PrimaryButton,
  OptionCard,
  DayChip,
  SegmentedNumberPicker,
} from '../../src/components';
import {
  useOnboarding,
  DAYS_OF_WEEK,
  SCHEDULE_FLEXIBILITY_OPTIONS,
  SESSION_DURATION_OPTIONS,
  PREFERRED_TRAINING_TIME_OPTIONS,
  DayOfWeek,
  IdealTrainingDays,
  RealisticMinimumDays,
  ScheduleFlexibility,
  SessionDuration,
  PreferredTrainingTime,
} from '../../src/features/onboarding';

const IDEAL_DAYS_OPTIONS: IdealTrainingDays[] = [2, 3, 4, 5, 6];

export default function ScheduleScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from persistent onboarding context
  const [idealTrainingDays, setIdealTrainingDays] = useState<IdealTrainingDays | undefined>(
    data.idealTrainingDays
  );
  const [realisticMinimumDays, setRealisticMinimumDays] = useState<RealisticMinimumDays | undefined>(
    data.realisticMinimumDays
  );
  const [availableDays, setAvailableDays] = useState<DayOfWeek[]>(
    data.availableDays || []
  );
  const [scheduleFlexibility, setScheduleFlexibility] = useState<ScheduleFlexibility | undefined>(
    data.scheduleFlexibility
  );
  const [sessionDuration, setSessionDuration] = useState<SessionDuration | undefined>(
    data.sessionDuration
  );
  const [preferredTrainingTime, setPreferredTrainingTime] = useState<PreferredTrainingTime | undefined>(
    data.preferredTrainingTime
  );

  // Dynamic minimum days options based on selected ideal days
  const minimumDaysOptions: RealisticMinimumDays[] = idealTrainingDays
    ? (Array.from({ length: idealTrainingDays }, (_, i) => (i + 1) as RealisticMinimumDays))
    : [1, 2, 3, 4];

  // Handle Ideal Days selection with automatic downward clamping of minimum days
  const handleIdealDaysChange = (newIdeal: IdealTrainingDays) => {
    setIdealTrainingDays(newIdeal);
    if (realisticMinimumDays && realisticMinimumDays > newIdeal) {
      setRealisticMinimumDays(newIdeal as RealisticMinimumDays);
    }
  };

  // Toggle day selection (multi-select)
  const handleToggleDay = (dayId: DayOfWeek) => {
    setAvailableDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  // Validation
  const isFormValid =
    idealTrainingDays !== undefined &&
    realisticMinimumDays !== undefined &&
    realisticMinimumDays <= idealTrainingDays &&
    availableDays.length >= 1 &&
    scheduleFlexibility !== undefined &&
    sessionDuration !== undefined &&
    preferredTrainingTime !== undefined;

  // Back Navigation
  const handleBack = () => {
    updateData({
      ...(idealTrainingDays ? { idealTrainingDays } : {}),
      ...(realisticMinimumDays ? { realisticMinimumDays } : {}),
      availableDays,
      ...(scheduleFlexibility ? { scheduleFlexibility } : {}),
      ...(sessionDuration ? { sessionDuration } : {}),
      ...(preferredTrainingTime ? { preferredTrainingTime } : {}),
    });
    router.back();
  };

  // Continue Navigation
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      idealTrainingDays,
      realisticMinimumDays,
      availableDays,
      scheduleFlexibility,
      sessionDuration,
      preferredTrainingTime,
    });

    router.push('/onboarding/environment');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Progress Header with Back Arrow */}
        <View style={styles.progressContainer}>
          <OnboardingProgress
            currentStep={4}
            totalSteps={10}
            onBack={handleBack}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Typography Hierarchy */}
          <View style={styles.header}>
            <Text style={styles.title}>Let's plan around your life.</Text>
            <Text style={styles.subtitle}>
              We'll build a routine that fits your schedule — not the other way
              around.
            </Text>
          </View>

          {/* QUESTION 1: Ideal Training Days */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How many days would you like to train each week?
            </Text>
            <SegmentedNumberPicker<IdealTrainingDays>
              options={IDEAL_DAYS_OPTIONS}
              value={idealTrainingDays}
              onChange={handleIdealDaysChange}
              unitLabel="days"
              accessibilityLabel="Ideal weekly training days"
            />
          </View>

          {/* QUESTION 2: Realistic Minimum Days */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              On a busy week, what's the minimum you can realistically train?
            </Text>
            <SegmentedNumberPicker<RealisticMinimumDays>
              options={minimumDaysOptions}
              value={realisticMinimumDays}
              onChange={setRealisticMinimumDays}
              unitLabel="days"
              accessibilityLabel="Realistic minimum weekly training days"
            />
          </View>

          {/* QUESTION 3: Available Days of Week */}
          <View style={styles.questionSection}>
            <View style={styles.questionHeaderRow}>
              <Text style={styles.questionLabelNoMargin}>
                Which days can you usually train?
              </Text>
              <Text style={styles.helperText}>Select all that apply</Text>
            </View>
            <View style={styles.daysRow}>
              {DAYS_OF_WEEK.map((day) => (
                <DayChip
                  key={day.id}
                  id={day.id}
                  label={day.label}
                  shortLabel={day.shortLabel}
                  selected={availableDays.includes(day.id)}
                  onToggle={handleToggleDay}
                />
              ))}
            </View>
            {availableDays.length === 0 ? (
              <Text style={styles.requiredNotice}>
                Please select at least 1 day
              </Text>
            ) : (
              <Text style={styles.selectionSummary}>
                {availableDays.length} day{availableDays.length > 1 ? 's' : ''} selected
              </Text>
            )}
          </View>

          {/* QUESTION 4: Schedule Flexibility */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How predictable is your weekly schedule?
            </Text>
            <View style={styles.optionsList}>
              {SCHEDULE_FLEXIBILITY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={scheduleFlexibility === opt.id}
                  onPress={() => setScheduleFlexibility(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 5: Session Duration */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How much time do you usually have for a workout?
            </Text>
            <View style={styles.optionsList}>
              {SESSION_DURATION_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={sessionDuration === opt.id}
                  onPress={() => setSessionDuration(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 6: Preferred Training Time */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              When do you usually prefer to train?
            </Text>
            <View style={styles.optionsList}>
              {PREFERRED_TRAINING_TIME_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={preferredTrainingTime === opt.id}
                  onPress={() => setPreferredTrainingTime(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA with mobile margins */}
        <View style={styles.footer}>
          <PrimaryButton
            label="Continue"
            onPress={handleContinue}
            disabled={!isFormValid}
          />
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  questionSection: {
    marginBottom: spacing.lg + 4,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm + 2,
  },
  questionLabel: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm + 2,
    letterSpacing: -0.1,
  },
  questionLabelNoMargin: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  helperText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  requiredNotice: {
    ...typography.bodySmall,
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
  },
  selectionSummary: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  optionsList: {
    gap: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
  },
});
