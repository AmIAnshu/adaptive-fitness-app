/**
 * Root layout — sets up the navigation stack with a dark theme
 * and hides the default header across all screens.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';
import { OnboardingProvider } from '../src/features/onboarding';
import { WorkoutPlanProvider } from '../src/features/workout-plan';

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <WorkoutPlanProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        />
      </WorkoutPlanProvider>
    </OnboardingProvider>
  );
}
