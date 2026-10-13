/**
 * SegmentedNumberPicker — Horizontal numeric segment selector for frequency questions.
 *
 * Implements mobile-first ergonomics:
 * - 48px touch target height with even distribution
 * - High-contrast unselected and selected (#6C5CE7) states
 * - Fully accessible radio semantics
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface SegmentedNumberPickerProps<T extends number> {
  options: T[];
  value?: T;
  onChange: (value: T) => void;
  unitLabel?: string;
  accessibilityLabel: string;
}

export function SegmentedNumberPicker<T extends number>({
  options,
  value,
  onChange,
  unitLabel = 'days',
  accessibilityLabel,
}: SegmentedNumberPickerProps<T>) {
  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((num) => {
        const isSelected = value === num;
        return (
          <Pressable
            key={num}
            onPress={() => onChange(num)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              pressed && styles.segmentPressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${num} ${unitLabel}, ${isSelected ? 'selected' : 'not selected'}`}
          >
            <Text
              style={[
                styles.numberText,
                isSelected && styles.numberTextSelected,
              ]}
            >
              {num}
            </Text>
            <Text
              style={[
                styles.unitText,
                isSelected && styles.unitTextSelected,
              ]}
            >
              {unitLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#1C1C24',
    borderWidth: 1.5,
    borderColor: '#282834',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  segmentSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  numberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  numberTextSelected: {
    color: '#FFFFFF',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  unitTextSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
});
