/**
 * App entry point — immediately redirects to the onboarding goal screen.
 *
 * In the future this can check auth state / onboarding completion
 * and route accordingly.
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/onboarding/goal" />;
}
