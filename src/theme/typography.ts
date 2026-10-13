/**
 * Adaptive Fitness — Typography Presets
 *
 * System font stack — we rely on SF Pro (iOS) / Roboto (Android)
 * for a clean native feel. Custom fonts can be added later.
 */

import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  /** Large hero / title text */
  title: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.3,
  } as TextStyle,

  /** Section subtitle */
  subtitle: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0,
  } as TextStyle,

  /** Body / option label */
  body: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0,
  } as TextStyle,

  /** Smaller body copy */
  bodySmall: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  } as TextStyle,

  /** Button label */
  button: {
    fontFamily,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0,
  } as TextStyle,
} as const;
