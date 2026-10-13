/**
 * Onboarding — Training Experience Screen
 *
 * Screen 3 of 10 in the Adaptive Fitness onboarding flow.
 * Collects foundational experience signals rather than arbitrary self-labels
 * (e.g. Beginner/Intermediate/Advanced) to infer training maturity.
 *
 * Four questions:
 * 1. Training duration consistency (single-select)
 * 2. Recent training consistency (single-select)
 * 3. Exercise execution confidence (1-5 scale)
 * 4. Workout programming / gym decision confidence (1-5 dynamic scale)
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
  ConfidenceScale,
} from '../../src/components';
import {
  useOnboarding,
  TRAINING_HISTORY_OPTIONS,
  CONSISTENCY_OPTIONS,
  TrainingHistoryId,
  ConsistencyId,
  ConfidenceRating,
} from '../../src/features/onboarding';

export default function TrainingExperienceScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from persistent onboarding context
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistoryId | undefined>(
    data.trainingHistory
  );
  const [consistency, setConsistency] = useState<ConsistencyId | undefined>(
    data.consistency
  );
  const [exerciseConfidence, setExerciseConfidence] = useState<ConfidenceRating | undefined>(
    data.exerciseConfidence
  );
  const [programmingConfidence, setProgrammingConfidence] = useState<ConfidenceRating | undefined>(
    data.programmingConfidence
  );

  // Dynamic Question 4 wording based on Question 1 selection
  const isNovice = trainingHistory === 'never' || trainingHistory === 'under_3_months';

  const question4Title = isNovice
    ? 'How comfortable are you deciding what to do in the gym?'
    : 'How comfortable are you creating your own workout plan?';

  const question4LowAnchor = isNovice
    ? 'I need the app to guide me'
    : "I don't know where to start";

  const question4HighAnchor = isNovice
    ? 'I feel confident choosing my own training'
    : 'I can program my own training';

  // Validation: all 4 questions must be answered
  const isFormValid =
    trainingHistory !== undefined &&
    consistency !== undefined &&
    exerciseConfidence !== undefined &&
    programmingConfidence !== undefined;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      ...(trainingHistory ? { trainingHistory } : {}),
      ...(consistency ? { consistency } : {}),
      ...(exerciseConfidence ? { exerciseConfidence } : {}),
      ...(programmingConfidence ? { programmingConfidence } : {}),
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state and route to next step
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      trainingHistory,
      consistency,
      exerciseConfidence,
      programmingConfidence,
    });

    router.push('/onboarding/schedule');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Progress Header with Back Arrow */}
        <View style={styles.progressContainer}>
          <OnboardingProgress
            currentStep={3}
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
            <Text style={styles.title}>Tell us about your training.</Text>
            <Text style={styles.subtitle}>
              We'll use your experience and confidence to decide how much
              guidance and structure you need.
            </Text>
          </View>

          {/* QUESTION 1: Training History */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How long have you been training consistently?
            </Text>
            <View style={styles.optionsList}>
              {TRAINING_HISTORY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={trainingHistory === opt.id}
                  onPress={() => setTrainingHistory(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 2: Consistency */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How consistent have you been?
            </Text>
            <View style={styles.optionsList}>
              {CONSISTENCY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={consistency === opt.id}
                  onPress={() => setConsistency(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 3: Exercise Execution Confidence (1–5) */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How comfortable are you performing exercises you already know?
            </Text>
            <ConfidenceScale
              value={exerciseConfidence}
              onChange={setExerciseConfidence}
              lowAnchor="I need a lot of guidance"
              highAnchor="I'm very confident"
              accessibilityLabel="Exercise execution confidence"
            />
          </View>

          {/* QUESTION 4: Programming / Gym Decision Confidence (1–5 Dynamic) */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>{question4Title}</Text>
            <ConfidenceScale
              value={programmingConfidence}
              onChange={setProgrammingConfidence}
              lowAnchor={question4LowAnchor}
              highAnchor={question4HighAnchor}
              accessibilityLabel={question4Title}
            />
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
  },
});
