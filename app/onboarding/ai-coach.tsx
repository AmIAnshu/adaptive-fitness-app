/**
 * Screen 10: Your AI Coach
 *
 * Route: /onboarding/ai-coach
 *
 * Product Purpose:
 * Final onboarding screen. Collects coaching preferences:
 * - Communication style (direct, educational, motivational, data_driven, minimal, adaptive)
 * - Decision autonomy (coach_leads, recommend, user_controls)
 * - Explanation depth (action_only, brief, detailed, contextual)
 * - Accountability level (high, gentle, important_only, self_managed)
 *
 * Final Confirmation & CTA:
 * - "Your plan will adapt." confirmation card
 * - "Build My Plan" primary CTA -> routes to /plan-generation
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
  CommunicationStyle,
  DecisionAutonomy,
  ExplanationDepth,
  Accountability,
  COMMUNICATION_STYLE_OPTIONS,
  DECISION_AUTONOMY_OPTIONS,
  EXPLANATION_DEPTH_OPTIONS,
  ACCOUNTABILITY_OPTIONS,
} from '../../src/features/onboarding';

export default function AiCoachScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from context
  const [communicationStyle, setCommunicationStyle] = useState<
    CommunicationStyle | undefined
  >(data.communicationStyle);
  const [decisionAutonomy, setDecisionAutonomy] = useState<
    DecisionAutonomy | undefined
  >(data.decisionAutonomy);
  const [explanationDepth, setExplanationDepth] = useState<
    ExplanationDepth | undefined
  >(data.explanationDepth);
  const [accountability, setAccountability] = useState<
    Accountability | undefined
  >(data.accountability);

  // Validation: all 4 questions required
  const isFormValid =
    communicationStyle !== undefined &&
    decisionAutonomy !== undefined &&
    explanationDepth !== undefined &&
    accountability !== undefined;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      ...(communicationStyle ? { communicationStyle } : {}),
      ...(decisionAutonomy ? { decisionAutonomy } : {}),
      ...(explanationDepth ? { explanationDepth } : {}),
      ...(accountability ? { accountability } : {}),
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state, mark complete, and route to plan generation
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      communicationStyle,
      decisionAutonomy,
      explanationDepth,
      accountability,
      isCompleted: true,
    });

    router.push('/plan-generation');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Progress Header with Back Chevron */}
        <View style={styles.progressContainer}>
          <OnboardingProgress
            currentStep={10}
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
            <Text style={styles.title}>How should your coach work with you?</Text>
            <Text style={styles.subtitle}>
              Your coach will adapt to your preferences as your training evolves.
            </Text>
          </View>

          {/* QUESTION 1: Communication Style */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How would you like your coach to communicate?
            </Text>
            <View style={styles.optionsList}>
              {COMMUNICATION_STYLE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={communicationStyle === opt.id}
                  onPress={() => setCommunicationStyle(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 2: Decision Autonomy */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How much should your coach decide for you?
            </Text>
            <View style={styles.optionsList}>
              {DECISION_AUTONOMY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={decisionAutonomy === opt.id}
                  onPress={() => setDecisionAutonomy(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 3: Explanation Depth */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How much do you want the coach to explain?
            </Text>
            <View style={styles.optionsList}>
              {EXPLANATION_DEPTH_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={explanationDepth === opt.id}
                  onPress={() => setExplanationDepth(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 4: Accountability */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              How much accountability do you want?
            </Text>
            <View style={styles.optionsList}>
              {ACCOUNTABILITY_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  label={opt.label}
                  description={opt.description}
                  selected={accountability === opt.id}
                  onPress={() => setAccountability(opt.id)}
                  compact
                />
              ))}
            </View>
          </View>

          {/* FINAL PLAN CONFIRMATION CARD */}
          <View style={styles.planCard}>
            <View style={styles.planCardAccentGlow} />
            <Text style={styles.planCardTitle}>Your plan will adapt.</Text>
            <Text style={styles.planCardBody}>
              We'll use your answers, workout performance, recovery, schedule
              and preferences to build your starting plan. As we learn what works
              for you, your plan can change.
            </Text>
          </View>
        </ScrollView>

        {/* Final Onboarding Primary CTA */}
        <View style={styles.footer}>
          <PrimaryButton
            label="Build My Plan"
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

  // Final Plan Confirmation Card
  planCard: {
    backgroundColor: '#16161E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 92, 231, 0.4)',
    padding: spacing.md + 4,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardAccentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
  },
  planCardTitle: {
    ...typography.title,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  planCardBody: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Sticky Bottom Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
  },
});
