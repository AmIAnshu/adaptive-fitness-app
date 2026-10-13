/**
 * Test-Only E2E Bootstrap Route (Stage QA-1)
 *
 * Route: /e2e-bootstrap?persona=[PERSONA_ID]
 *
 * Allows Playwright and automated regression test harnesses to inject a fully
 * valid deterministic user profile into app state and immediately proceed to
 * real plan generation without clicking through all 10 onboarding screens.
 *
 * SAFETY INVARIANTS:
 * - Disabled in production builds (redirects to /onboarding/goal).
 * - Never skips domain validation or the real T1–T10 strategy engine.
 * - Injects only strictly validated deterministic personas.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Redirect } from 'expo-router';
import { colors } from '../src/theme';
import { useOnboarding } from '../src/features/onboarding';
import { QA_PERSONAS, type QAPersonaId } from '../src/qa/personas';

export default function E2EBootstrapScreen() {
  // Hard security guard: never available in production builds
  if (process.env.NODE_ENV === 'production' && !(typeof __DEV__ !== 'undefined' && __DEV__)) {
    return <Redirect href="/onboarding/goal" />;
  }

  const router = useRouter();
  const params = useLocalSearchParams<{ persona?: string }>();
  const { updateData } = useOnboarding();

  useEffect(() => {
    const personaKey = (params.persona ?? 'PERSONA_A_BASELINE') as QAPersonaId;
    const persona = QA_PERSONAS[personaKey] ?? QA_PERSONAS.PERSONA_A_BASELINE;

    // Inject valid deterministic onboarding data
    updateData(persona);

    // Immediate forward to real plan generation screen
    const timer = setTimeout(() => {
      router.replace('/plan-generation');
    }, 50);

    return () => clearTimeout(timer);
  }, [params.persona, updateData, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Bootstrapping E2E Test Persona...</Text>
        <Text style={styles.subtitle}>
          Injecting {params.persona ?? 'PERSONA_A_BASELINE'} into Adaptive Pipeline
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
