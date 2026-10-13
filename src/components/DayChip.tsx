/**
 * DayChip — Reusable selectable chip for days of the week.
 *
 * Implements mobile-first ergonomics:
 * - 44px+ touch target height
 * - High-contrast unselected and selected (#6C5CE7) states
 * - Fully accessible checkbox semantics for multi-select
 */

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { DayOfWeek } from '../features/onboarding';

interface DayChipProps {
  id: DayOfWeek;
  label: string;
  shortLabel: string;
  selected: boolean;
  onToggle: (id: DayOfWeek) => void;
}

export function DayChip({
  id,
  label,
  shortLabel,
  selected,
  onToggle,
}: DayChipProps) {
  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {shortLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    minWidth: 42,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1C1C24',
    borderWidth: 1.5,
    borderColor: '#282834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  textSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
