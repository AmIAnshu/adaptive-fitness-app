/**
 * EquipmentCard — Compact selectable card/chip for equipment inventory.
 *
 * Implements mobile-first ergonomics:
 * - 48px+ touch target height
 * - High-contrast unselected and selected (#6C5CE7) states
 * - Trailing check indicator
 * - Accessible checkbox semantics for multi-select
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { EquipmentId } from '../features/onboarding';

interface EquipmentCardProps {
  id: EquipmentId;
  label: string;
  selected: boolean;
  onToggle: (id: EquipmentId) => void;
}

export function EquipmentCard({
  id,
  label,
  selected,
  onToggle,
}: EquipmentCardProps) {
  return (
    <Pressable
      onPress={() => onToggle(id)}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>

      {/* Trailing checkmark indicator */}
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? (
          <View style={styles.checkIcon}>
            <View style={styles.checkStemShort} />
            <View style={styles.checkStemLong} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C24',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#282834',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  cardSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.12)',
    borderColor: colors.accent,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  label: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
    paddingRight: 8,
  },
  labelSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#3A3A4A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141418',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkIcon: {
    width: 10,
    height: 6,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  checkStemShort: {},
  checkStemLong: {},
});
