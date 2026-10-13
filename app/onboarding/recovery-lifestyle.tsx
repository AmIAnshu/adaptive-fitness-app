/**
 * Screen 8: Recovery & Lifestyle
 *
 * Route: /onboarding/recovery-lifestyle
 *
 * Product Purpose:
 * Collects user-reported lifestyle and recovery signals to help the future
 * adaptive engine gauge training volume capacity. Raw signals are stored
 * without deriving pseudo-scientific medical "recovery scores".
 *
 * Required Questions:
 * 1. Sleep duration (single-select: under_5, 5_to_6, 6_to_7, 7_to_8, 8_plus)
 * 2. Sleep quality (1-5 scale: Poor -> Excellent)
 * 3. Energy level (1-5 scale: Very low -> Very high)
 * 4. Stress level (1-5 scale: 1 = Very low, 5 = Very high; clear direction indicator)
 * 5. Between-workout recovery (single-select: fully_recovered, mostly_recovered, sometimes_fatigued, often_fatigued, not_sure)
 * 6. Daily activity (single-select: mostly_sedentary, light, moderate, very_active)
 *
 * Optional Question:
 * 7. Average daily steps (numeric, optional, non-blocking)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../src/theme';
import {
  OnboardingProgress,
  OptionCard,
  PrimaryButton,
  ConfidenceScale,
  InputField,
} from '../../src/components';
import {
  useOnboarding,
  ConfidenceRating,
  SleepDuration,
  WorkoutRecovery,
  DailyActivity,
  SLEEP_DURATION_OPTIONS,
  WORKOUT_RECOVERY_OPTIONS,
  DAILY_ACTIVITY_OPTIONS,
} from '../../src/features/onboarding';

export default function RecoveryLifestyleScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from context
  const [sleepDuration, setSleepDuration] = useState<SleepDuration | undefined>(
    data.sleepDuration
  );
  const [sleepQuality, setSleepQuality] = useState<ConfidenceRating | undefined>(
    data.sleepQuality
  );
  const [energyLevel, setEnergyLevel] = useState<ConfidenceRating | undefined>(
    data.energyLevel
  );
  const [stressLevel, setStressLevel] = useState<ConfidenceRating | undefined>(
    data.stressLevel
  );
  const [workoutRecovery, setWorkoutRecovery] = useState<
    WorkoutRecovery | undefined
  >(data.workoutRecovery);
  const [dailyActivity, setDailyActivity] = useState<
    DailyActivity | undefined
  >(data.dailyActivity);

  // Optional daily steps input
  const [stepsInput, setStepsInput] = useState<string>(
    data.averageSteps ? String(data.averageSteps) : ''
  );
  const [stepsError, setStepsError] = useState<string | undefined>();

  // Steps validation
  const handleStepsChange = (text: string) => {
    // Allow clean digits only
    const cleaned = text.replace(/[^0-9]/g, '');
    setStepsInput(cleaned);

    if (cleaned.length === 0) {
      setStepsError(undefined);
      return;
    }

    const num = parseInt(cleaned, 10);
    if (isNaN(num) || num < 0 || num > 100000) {
      setStepsError('Please enter a realistic step count (0 to 100,000)');
    } else {
      setStepsError(undefined);
    }
  };

  // Validation: 6 required questions must have valid answers
  const areRequiredAnswered =
    sleepDuration !== undefined &&
    sleepQuality !== undefined &&
    energyLevel !== undefined &&
    stressLevel !== undefined &&
    workoutRecovery !== undefined &&
    dailyActivity !== undefined;

  const isStepsValid = !stepsError;
  const isFormValid = areRequiredAnswered && isStepsValid;

  // Parsed steps number for persistence
  const parsedSteps =
    stepsInput.trim().length > 0 && !stepsError
      ? parseInt(stepsInput.trim(), 10)
      : undefined;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      ...(sleepDuration ? { sleepDuration } : {}),
      ...(sleepQuality ? { sleepQuality } : {}),
      ...(energyLevel ? { energyLevel } : {}),
      ...(stressLevel ? { stressLevel } : {}),
      ...(workoutRecovery ? { workoutRecovery } : {}),
      ...(dailyActivity ? { dailyActivity } : {}),
      averageSteps: parsedSteps,
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state and route to next step
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      sleepDuration,
      sleepQuality,
      energyLevel,
      stressLevel,
      workoutRecovery,
      dailyActivity,
      averageSteps: parsedSteps,
    });

    router.push('/onboarding/nutrition');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mobileContainer}>
          {/* Progress Header with Back Chevron */}
          <View style={styles.progressContainer}>
            <OnboardingProgress
              currentStep={8}
              totalSteps={10}
              onBack={handleBack}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Typography Hierarchy */}
            <View style={styles.header}>
              <Text style={styles.title}>How are you recovering?</Text>
              <Text style={styles.subtitle}>
                Your recovery helps us decide how much training makes sense for
                you.
              </Text>
            </View>

            {/* QUESTION 1: Sleep Duration */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How much do you usually sleep?
              </Text>
              <View style={styles.optionsList}>
                {SLEEP_DURATION_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    selected={sleepDuration === opt.id}
                    onPress={() => setSleepDuration(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* QUESTION 2: Sleep Quality (1–5) */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How would you rate your sleep quality?
              </Text>
              <ConfidenceScale
                value={sleepQuality}
                onChange={setSleepQuality}
                lowAnchor="Poor"
                highAnchor="Excellent"
                accessibilityLabel="Sleep quality rating"
                feedbackFormatter={(val) => {
                  switch (val) {
                    case 1:
                      return 'Level 1 of 5: Poor sleep';
                    case 2:
                      return 'Level 2 of 5: Restless / fair sleep';
                    case 3:
                      return 'Level 3 of 5: Average sleep';
                    case 4:
                      return 'Level 4 of 5: Good, restful sleep';
                    case 5:
                      return 'Level 5 of 5: Excellent, deep sleep';
                  }
                }}
              />
            </View>

            {/* QUESTION 3: Energy (1–5) */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How is your energy on most days?
              </Text>
              <ConfidenceScale
                value={energyLevel}
                onChange={setEnergyLevel}
                lowAnchor="Very low"
                highAnchor="Very high"
                accessibilityLabel="Daily energy rating"
                feedbackFormatter={(val) => {
                  switch (val) {
                    case 1:
                      return 'Level 1 of 5: Very low energy';
                    case 2:
                      return 'Level 2 of 5: Low energy';
                    case 3:
                      return 'Level 3 of 5: Moderate / steady energy';
                    case 4:
                      return 'Level 4 of 5: High energy';
                    case 5:
                      return 'Level 5 of 5: Very high energy';
                  }
                }}
              />
            </View>

            {/* QUESTION 4: Stress (1–5, Higher = More Stress) */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How much stress do you usually deal with?
              </Text>
              <ConfidenceScale
                value={stressLevel}
                onChange={setStressLevel}
                lowAnchor="Very low"
                highAnchor="Very high"
                variant="stress"
                directionNote="Higher number = more stress in your routine"
                accessibilityLabel="Daily stress level rating"
                feedbackFormatter={(val) => {
                  switch (val) {
                    case 1:
                      return 'Level 1 of 5: Very low stress (calm)';
                    case 2:
                      return 'Level 2 of 5: Mild stress (manageable)';
                    case 3:
                      return 'Level 3 of 5: Moderate stress';
                    case 4:
                      return 'Level 4 of 5: Elevated stress';
                    case 5:
                      return 'Level 5 of 5: Very high stress (high demand)';
                  }
                }}
              />
            </View>

            {/* QUESTION 5: Between-Workout Recovery */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How do you usually feel between workouts?
              </Text>
              <View style={styles.optionsList}>
                {WORKOUT_RECOVERY_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    description={opt.description}
                    selected={workoutRecovery === opt.id}
                    onPress={() => setWorkoutRecovery(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* QUESTION 6: Daily Activity */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How active are you outside the gym?
              </Text>
              <View style={styles.optionsList}>
                {DAILY_ACTIVITY_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    description={opt.description}
                    selected={dailyActivity === opt.id}
                    onPress={() => setDailyActivity(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* OPTIONAL QUESTION: Daily Steps */}
            <View style={styles.questionSection}>
              <InputField
                label="Average daily steps"
                value={stepsInput}
                onChangeText={handleStepsChange}
                placeholder="Optional"
                unitLabel="steps"
                error={stepsError}
                keyboardType="numeric"
                rightElement={
                  <Text style={styles.optionalBadge}>Optional</Text>
                }
                accessibilityLabel="Average daily steps (optional)"
              />
              <Text style={styles.stepsHelper}>
                If you track steps with a smartwatch or phone, this helps us
                estimate baseline activity.
              </Text>
            </View>
          </ScrollView>

          {/* Sticky Bottom CTA */}
          <View style={styles.footer}>
            <PrimaryButton
              label="Continue"
              onPress={handleContinue}
              disabled={!isFormValid}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
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
  questionLabel: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm + 2,
    letterSpacing: -0.1,
  },
  optionsList: {
    gap: 8,
  },
  optionalBadge: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: '#1E1E28',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepsHelper: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    lineHeight: 16,
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
