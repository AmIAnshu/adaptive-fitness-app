/**
 * Screen 6: Training Style
 *
 * Route: /onboarding/training-style
 *
 * Collects user training preferences:
 * - Preferred style (hypertrophy, strength, high intensity, balanced, general fitness, not sure)
 * - Preferred effort (moderate, hard, very hard, not sure)
 * - Volume preference (fewer high effort, more volume, balanced, not sure)
 * - Exercise variety (repeat key exercises, some variety, change often, no preference)
 *
 * Note: These are user preferences and will later feed the training engine alongside
 * goal, experience, recovery, and constraints.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../src/theme';
import {
  OnboardingProgress,
  OptionCard,
  PrimaryButton,
} from '../../src/components';
import {
  useOnboarding,
  PreferredStyle,
  PreferredEffort,
  VolumePreference,
  ExerciseVariety,
  StructurePreference,
  PREFERRED_STYLE_OPTIONS,
  PREFERRED_EFFORT_OPTIONS,
  VOLUME_PREFERENCE_OPTIONS,
  EXERCISE_VARIETY_OPTIONS,
  STRUCTURE_PREFERENCE_OPTIONS,
} from '../../src/features/onboarding';

export default function TrainingStyleScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from context
  const [preferredStyle, setPreferredStyle] = useState<PreferredStyle | undefined>(
    data.preferredStyle
  );
  const [preferredEffort, setPreferredEffort] = useState<PreferredEffort | undefined>(
    data.preferredEffort
  );
  const [volumePreference, setVolumePreference] = useState<VolumePreference | undefined>(
    data.volumePreference
  );
  const [exerciseVariety, setExerciseVariety] = useState<ExerciseVariety | undefined>(
    data.exerciseVariety
  );
  const [structurePreference, setStructurePreference] = useState<StructurePreference | undefined>(
    data.structurePreference
  );

  // Validation: all 5 questions required
  const isFormValid =
    preferredStyle !== undefined &&
    preferredEffort !== undefined &&
    volumePreference !== undefined &&
    exerciseVariety !== undefined &&
    structurePreference !== undefined;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      ...(preferredStyle ? { preferredStyle } : {}),
      ...(preferredEffort ? { preferredEffort } : {}),
      ...(volumePreference ? { volumePreference } : {}),
      ...(exerciseVariety ? { exerciseVariety } : {}),
      ...(structurePreference ? { structurePreference } : {}),
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state and route to next step
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      preferredStyle,
      preferredEffort,
      volumePreference,
      exerciseVariety,
      structurePreference,
    });

    router.push('/onboarding/exercise-preferences');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Progress Header with Back Chevron */}
        <View style={styles.progressContainer}>
          <OnboardingProgress
            currentStep={6}
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
            <Text style={styles.title}>How do you like to train?</Text>
            <Text style={styles.subtitle}>
              Your preferences help us build a plan you'll actually enjoy
              following.
            </Text>
          </View>

          {/* QUESTION 1: Training Style */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              What type of training sounds most like you?
            </Text>
            <View style={styles.optionsList}>
              {PREFERRED_STYLE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={preferredStyle === opt.id}
                  onPress={() => setPreferredStyle(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 2: Effort / Hardness */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How hard do you like to train?
            </Text>
            <View style={styles.optionsList}>
              {PREFERRED_EFFORT_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={preferredEffort === opt.id}
                  onPress={() => setPreferredEffort(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 3: Volume / Structure */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              Which sounds better to you?
            </Text>
            <View style={styles.optionsList}>
              {VOLUME_PREFERENCE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={volumePreference === opt.id}
                  onPress={() => setVolumePreference(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 4: Exercise Variety */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How much variety do you like?
            </Text>
            <View style={styles.optionsList}>
              {EXERCISE_VARIETY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  selected={exerciseVariety === opt.id}
                  onPress={() => setExerciseVariety(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 5: Workout Structure Preference */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How would you prefer to structure your workouts?
            </Text>
            <View style={styles.optionsList}>
              {STRUCTURE_PREFERENCE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={structurePreference === opt.id}
                  onPress={() => setStructurePreference(opt.id)}
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
