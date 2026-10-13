/**
 * ConfidenceScale — 1 to 5 rating control for onboarding questionnaires.
 *
 * Implements mobile-first ergonomics:
 * - 5 comfortable, evenly spaced touch targets (min 48px height)
 * - Clear selected state with primary accent fill and high contrast
 * - Contextual anchor descriptions (1: minimum, 5: maximum)
 * - Dynamic feedback showing active selection meaning
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { ConfidenceRating } from '../features/onboarding';

interface ConfidenceScaleProps {
  /** Currently selected rating value (1-5) */
  value?: ConfidenceRating;
  /** Callback triggered when a rating is selected */
  onChange: (value: ConfidenceRating) => void;
  /** Label for rating 1 (lowest anchor) */
  lowAnchor: string;
  /** Label for rating 5 (highest anchor) */
  highAnchor: string;
  /** Optional custom accessible label prefix */
  accessibilityLabel?: string;
  /** Optional custom feedback formatter */
  feedbackFormatter?: (value: ConfidenceRating) => string;
  /** Optional direction/context indicator note */
  directionNote?: string;
  /** Visual variant: 'default' | 'stress' */
  variant?: 'default' | 'stress';
}

const RATINGS: ConfidenceRating[] = [1, 2, 3, 4, 5];

export function ConfidenceScale({
  value,
  onChange,
  lowAnchor,
  highAnchor,
  accessibilityLabel = 'Confidence rating',
  feedbackFormatter,
  directionNote,
  variant = 'default',
}: ConfidenceScaleProps) {
  const isStress = variant === 'stress';

  const defaultFeedback = value
    ? `Level ${value} of 5: ${
        value === 1
          ? lowAnchor
          : value === 5
          ? highAnchor
          : value <= 2
          ? `Closer to "${lowAnchor}"`
          : `Closer to "${highAnchor}"`
      }`
    : '';

  const feedbackMessage = value
    ? feedbackFormatter
      ? feedbackFormatter(value)
      : defaultFeedback
    : '';

  return (
    <View style={styles.container}>
      {/* Direction / Context Note if provided */}
      {directionNote ? (
        <View style={styles.directionNoteRow}>
          <Text style={[styles.directionNoteText, isStress && styles.directionNoteStress]}>
            {directionNote}
          </Text>
        </View>
      ) : null}

      {/* 1–5 Segmented Buttons Row */}
      <View
        style={styles.buttonsRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
      >
        {RATINGS.map((rating) => {
          const isSelected = value === rating;
          return (
            <Pressable
              key={rating}
              onPress={() => onChange(rating)}
              style={({ pressed }) => [
                styles.button,
                isSelected && (isStress ? styles.buttonStressSelected : styles.buttonSelected),
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${accessibilityLabel}: ${rating} of 5`}
            >
              <Text
                style={[
                  styles.buttonText,
                  isSelected && styles.buttonTextSelected,
                ]}
              >
                {rating}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Anchor Descriptions */}
      <View style={styles.anchorsRow}>
        <View style={styles.anchorContainerLeft}>
          <Text style={[styles.anchorNumber, isStress && styles.anchorStressNumberLow]}>1</Text>
          <Text style={styles.anchorText}>{lowAnchor}</Text>
        </View>
        <View style={styles.anchorContainerRight}>
          <Text style={[styles.anchorNumber, styles.anchorNumberRight, isStress && styles.anchorStressNumberHigh]}>5</Text>
          <Text style={[styles.anchorText, styles.anchorTextRight]}>
            {highAnchor}
          </Text>
        </View>
      </View>

      {/* Selected Indicator Chip */}
      {value ? (
        <View style={styles.selectedFeedbackContainer}>
          <View style={[styles.feedbackDot, isStress && styles.feedbackDotStress]} />
          <Text style={[styles.feedbackText, isStress && styles.feedbackTextStress]}>
            {feedbackMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm + 2,
  },
  directionNoteRow: {
    marginBottom: spacing.xs + 3,
  },
  directionNoteText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  directionNoteStress: {
    color: '#F39C12',
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1C1C24',
    borderWidth: 1.5,
    borderColor: '#282834',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonStressSelected: {
    backgroundColor: '#D35400',
    borderColor: '#F39C12',
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  anchorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 2,
  },
  anchorContainerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  anchorContainerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  anchorNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  anchorNumberRight: {
    textAlign: 'right',
  },
  anchorStressNumberLow: {
    color: '#2ECC71',
  },
  anchorStressNumberHigh: {
    color: '#E74C3C',
  },
  anchorText: {
    ...typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  anchorTextRight: {
    textAlign: 'right',
  },
  selectedFeedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  feedbackDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 6,
  },
  feedbackDotStress: {
    backgroundColor: '#E67E22',
  },
  feedbackText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: '#B5AEF8',
    fontWeight: '500',
  },
  feedbackTextStress: {
    color: '#FAD7A0',
  },
});
