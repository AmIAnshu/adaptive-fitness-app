/**
 * InputField — Reusable mobile text input.
 *
 * Implements premium dark surface aesthetics:
 * - Clear label and error states
 * - Accent-highlighted border on focus
 * - Large 54px touch target
 * - Optional inline unit suffix label
 * - Optimized for numeric input modes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

export interface InputFieldProps extends Omit<RNTextInputProps, 'style'> {
  /** Input field label */
  label: string;
  /** Current text value */
  value: string;
  /** Value change callback */
  onChangeText: (text: string) => void;
  /** Validation error message */
  error?: string;
  /** Inline trailing unit label (e.g. "cm", "kg") */
  unitLabel?: string;
  /** Right accessory component (e.g. unit toggle) */
  rightElement?: React.ReactNode;
}

export function InputField({
  label,
  value,
  onChangeText,
  error,
  unitLabel,
  rightElement,
  placeholder,
  keyboardType = 'numeric',
  ...rest
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {rightElement ? <View>{rightElement}</View> : null}
      </View>

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
      >
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={styles.textInput}
          {...rest}
        />
        {unitLabel ? (
          <Text style={styles.unitSuffix}>{unitLabel}</Text>
        ) : null}
      </View>

      {hasError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  label: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(108, 92, 231, 0.05)',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 12,
    minWidth: 0,
  },
  unitSuffix: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flexShrink: 0,
  },
  errorText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
    paddingHorizontal: 2,
  },
});
