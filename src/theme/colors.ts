/**
 * Adaptive Fitness — Color Palette
 *
 * Dark theme with a single restrained accent color.
 * All colors are defined here so the palette can be swapped in one place.
 */

export const colors = {
  /** Pure background — almost-black */
  background: '#0A0A0C',

  /** Slightly elevated surface (cards, inputs) */
  surface: '#141418',

  /** Subtle border / divider */
  border: '#23232B',

  /** Primary text — near-white */
  textPrimary: '#F0F0F5',

  /** Secondary text — muted */
  textSecondary: '#8A8A9A',

  /** Tertiary text — very subdued */
  textTertiary: '#5A5A6A',

  /** Accent — restrained blue-violet */
  accent: '#6C5CE7',

  /** Accent text — used on accent backgrounds */
  accentText: '#FFFFFF',

  /** Accent muted — for subtle highlight fills */
  accentMuted: 'rgba(108, 92, 231, 0.12)',

  /** Accent border — border for selected states */
  accentBorder: 'rgba(108, 92, 231, 0.5)',

  /** Subtle elevated surface for badges and icon containers */
  surfaceSubtle: '#1C1C24',

  /** Background track for progress bars */
  progressTrack: '#1C1C24',

  /** Selected card background tint */
  cardSelectedBg: 'rgba(108, 92, 231, 0.08)',

  /** Disabled state */
  disabled: '#2A2A34',
  disabledText: '#4A4A58',
} as const;

export type ColorKey = keyof typeof colors;
