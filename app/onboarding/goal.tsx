/**
 * Onboarding — Goal Selection Screen
 *
 * Screen 1 of 10 in the Adaptive Fitness onboarding flow.
 * Mobile-first presentation designed primarily for 390 × 844 viewports,
 * centered and gracefully responsive on larger desktop displays.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../src/theme';
import { OptionCard, PrimaryButton, OnboardingProgress } from '../../src/components';
import { GOAL_OPTIONS, useOnboarding } from '../../src/features/onboarding';

export default function GoalScreen() {
  const router = useRouter();
  const { data, setGoal } = useOnboarding();
  const selectedGoal = data.goal || null;

  const handleContinue = () => {
    if (selectedGoal) {
      router.push('/onboarding/about-you');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Mobile-width wrapper for intentional layout on mobile and centered layout on desktop */}
      <View style={styles.mobileContainer}>
        {/* Subtle Onboarding Progress Indicator */}
        <View style={styles.progressContainer}>
          <OnboardingProgress currentStep={1} totalSteps={10} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Typography Hierarchy */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Let's build a plan{'\n'}around you.
            </Text>
            <Text style={styles.subtitle}>
              Your training, nutrition and progression will adapt as we learn how
              you perform and live.
            </Text>
          </View>

          {/* Focused Question Prompt */}
          <View style={styles.questionSection}>
            <Text style={styles.questionText}>What do you want most right now?</Text>
          </View>

          {/* Goal Cards */}
          <View style={styles.optionsList}>
            {GOAL_OPTIONS.map((option) => (
              <OptionCard
                key={option.id}
                label={option.label}
                description={option.description}
                icon={option.icon}
                selected={selectedGoal === option.id}
                onPress={() => setGoal(option.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA with mobile margins */}
        <View style={styles.footer}>
          <PrimaryButton
            label="Continue"
            onPress={handleContinue}
            disabled={selectedGoal === null}
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
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
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
    marginBottom: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  questionText: {
    ...typography.body,
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  optionsList: {
    gap: 9,
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
