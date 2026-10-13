/**
 * PrimaryButton — Mobile call-to-action button.
 *
 * Supports an enabled / disabled state with clear visual feedback:
 * - Disabled: Subdued surface background, muted text, non-interactive
 * - Active: Accent violet background, crisp text, subtle press feedback
 */

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface PrimaryButtonProps {
  /** Button label */
  label: string;
  /** Called when the button is pressed (only when enabled) */
  onPress: () => void;
  /** Whether the button is interactive */
  disabled?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#1E1E26',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  label: {
    ...typography.button,
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentText,
    letterSpacing: 0.2,
  },
  labelDisabled: {
    color: '#555568',
  },
});
