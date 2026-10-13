/**
 * OptionCard — Premium selectable option card for onboarding flows.
 *
 * Designed with mobile-first ergonomics:
 * - Comfortable 64px+ touch target
 * - Cohesive vector-style fitness icon badge
 * - High-contrast label with natural 2-line wrapped description (no truncation)
 * - Distinct, subtle selected state (stronger accent border, subtle tint, filled radio indicator)
 * - Restrained dark theme treatment
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { GoalIcon } from './GoalIcon';

interface OptionCardProps {
  /** Primary label */
  label: string;
  /** Optional supporting one-line or two-line description */
  description?: string;
  /** Identifier of the icon or visual mark */
  icon?: string;
  /** Whether this card is currently selected */
  selected: boolean;
  /** Called when the card is pressed */
  onPress: () => void;
  /** Optional compact sizing for multi-question screens */
  compact?: boolean;
}

export function OptionCard({
  label,
  description,
  icon,
  selected,
  onPress,
  compact = false,
}: OptionCardProps) {
  const iconColor = selected ? colors.accent : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {/* Leading icon badge */}
      {icon ? (
        <View
          style={[
            styles.iconBadge,
            selected && styles.iconBadgeSelected,
          ]}
        >
          <GoalIcon name={icon} color={iconColor} selected={selected} />
        </View>
      ) : null}

      {/* Center text container */}
      <View style={styles.textContainer}>
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>
        {description ? (
          <Text
            style={[
              styles.description,
              selected && styles.descriptionSelected,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      {/* Trailing radio selector disc — filled when selected */}
      <View
        style={[
          styles.radioDisc,
          selected && styles.radioDiscSelected,
        ]}
      >
        {selected ? <View style={styles.radioInnerDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  cardSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.12)',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  cardCompact: {
    minHeight: 52,
    paddingVertical: 10,
    borderRadius: 14,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconBadgeSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.20)',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
  description: {
    ...typography.bodySmall,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: 2,
  },
  descriptionSelected: {
    color: '#B5AEF8',
  },
  radioDisc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#2E2E3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioDiscSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
