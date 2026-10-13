/**
 * CustomEquipmentCard — Card for user-created custom equipment items.
 *
 * Implements:
 * - Clear equipment title and metadata subtitle (type · loading · muscle)
 * - Trailing selection checkbox
 * - Dedicated delete button with confirmation hit-slop
 * - Full-width layout for comfortable display of custom names
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { CustomEquipment, MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../features/onboarding';

interface CustomEquipmentCardProps {
  item: CustomEquipment;
  selected: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CustomEquipmentCard({
  item,
  selected,
  onToggle,
  onDelete,
}: CustomEquipmentCardProps) {
  const typeLabel =
    EQUIPMENT_TYPES.find((t) => t.id === item.equipmentType)?.label ||
    item.equipmentType;
  const muscleLabel =
    MUSCLE_GROUPS.find((m) => m.id === item.primaryMuscleId)?.label ||
    item.primaryMuscleId;

  const subtitle = `${typeLabel} · ${muscleLabel}`;

  return (
    <View
      style={[
        styles.card,
        selected && styles.cardSelected,
      ]}
    >
      {/* Tap area for selecting/unselecting */}
      <Pressable
        onPress={() => onToggle(item.id)}
        style={styles.touchArea}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${item.name}, ${subtitle}, ${selected ? 'selected' : 'not selected'}`}
      >
        {/* Trailing check indicator */}
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? (
            <View style={styles.checkIcon}>
              <View style={styles.checkStemShort} />
              <View style={styles.checkStemLong} />
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <Text
            style={[styles.name, selected && styles.nameSelected]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>

      {/* Delete button */}
      <Pressable
        onPress={() => onDelete(item.id)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.name}`}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteIcon}>✕</Text>
      </Pressable>
    </View>
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    width: '100%',
  },
  cardSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.12)',
    borderColor: colors.accent,
  },
  touchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
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
    marginRight: 10,
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
  info: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nameSelected: {
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    fontSize: 11,
    lineHeight: 15,
    color: '#8A8A9A',
    marginTop: 1,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  deleteIcon: {
    fontSize: 12,
    color: '#8A8A9A',
    fontWeight: '600',
  },
});
