/**
 * AddCustomEquipmentModal — Clean bottom sheet modal for custom equipment creation.
 *
 * Fields:
 * 1. Equipment name (required text input)
 * 2. Equipment type (required single-select)
 * 3. Loading type (required single-select)
 * 4. Primary muscle group (required single-select)
 * 5. Secondary muscle groups (optional multi-select)
 * 6. Movement pattern (optional single-select, stores "unknown" if not sure or skipped)
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, typography } from '../theme';
import { InputField } from './InputField';
import { PrimaryButton } from './PrimaryButton';
import {
  CustomEquipment,
  EQUIPMENT_TYPES,
  LOADING_TYPES,
  MUSCLE_GROUPS,
  MOVEMENT_PATTERNS,
  CustomOptionItem,
} from '../features/onboarding';

interface AddCustomEquipmentModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (equipment: CustomEquipment) => void;
}

export function AddCustomEquipmentModal({
  visible,
  onClose,
  onAdd,
}: AddCustomEquipmentModalProps) {
  const [name, setName] = useState('');
  const [equipmentType, setEquipmentType] = useState<string | undefined>();
  const [loadingType, setLoadingType] = useState<string | undefined>();
  const [primaryMuscleId, setPrimaryMuscleId] = useState<string | undefined>();
  const [secondaryMuscleIds, setSecondaryMuscleIds] = useState<string[]>([]);
  const [movementPattern, setMovementPattern] = useState<string | undefined>();

  // Reset local state
  const resetForm = () => {
    setName('');
    setEquipmentType(undefined);
    setLoadingType(undefined);
    setPrimaryMuscleId(undefined);
    setSecondaryMuscleIds([]);
    setMovementPattern(undefined);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Toggle secondary muscle
  const handleToggleSecondaryMuscle = (id: string) => {
    // If selected as primary, don't allow as secondary
    if (id === primaryMuscleId) return;

    setSecondaryMuscleIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  // Validation: 4 required fields (movement pattern is optional)
  const isValid =
    name.trim().length > 0 &&
    Boolean(equipmentType) &&
    Boolean(loadingType) &&
    Boolean(primaryMuscleId);

  const handleSubmit = () => {
    if (!isValid) return;

    const newEquipment: CustomEquipment = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      equipmentType: equipmentType!,
      loadingType: loadingType!,
      primaryMuscleId: primaryMuscleId!,
      secondaryMuscleIds,
      movementPattern: movementPattern || 'unknown',
    };

    onAdd(newEquipment);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropDismiss} onPress={handleClose} />

        <View style={styles.sheetContainer}>
          {/* Header drag notch & title bar */}
          <View style={styles.sheetHeader}>
            <View style={styles.notch} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Add custom equipment</Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
                style={styles.closeButton}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Form Scroll Content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Equipment Name */}
            <View style={styles.fieldSection}>
              <InputField
                label="Equipment name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Lateral Raise Machine"
                maxLength={45}
                accessibilityLabel="Equipment name"
              />
            </View>

            {/* 2. Equipment Type (Single select) */}
            <View style={styles.fieldSection}>
              <Text style={styles.sectionLabel}>Equipment type</Text>
              <View style={styles.chipsWrap}>
                {EQUIPMENT_TYPES.map((type) => {
                  const isSelected = equipmentType === type.id;
                  return (
                    <Pressable
                      key={type.id}
                      onPress={() => setEquipmentType(type.id)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. Loading Type (Single select) */}
            <View style={styles.fieldSection}>
              <Text style={styles.sectionLabel}>Loading type</Text>
              <View style={styles.chipsWrap}>
                {LOADING_TYPES.map((lt) => {
                  const isSelected = loadingType === lt.id;
                  return (
                    <Pressable
                      key={lt.id}
                      onPress={() => setLoadingType(lt.id)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {lt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 4. Primary Muscle Group (Single select) */}
            <View style={styles.fieldSection}>
              <Text style={styles.sectionLabel}>Primary muscle group</Text>
              <View style={styles.chipsWrap}>
                {MUSCLE_GROUPS.map((mg) => {
                  const isSelected = primaryMuscleId === mg.id;
                  return (
                    <Pressable
                      key={mg.id}
                      onPress={() => {
                        setPrimaryMuscleId(mg.id);
                        // Remove from secondary if was selected there
                        setSecondaryMuscleIds((prev) =>
                          prev.filter((id) => id !== mg.id)
                        );
                      }}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {mg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 5. Secondary Muscle Groups (Optional multi-select) */}
            <View style={styles.fieldSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Secondary muscle groups</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <View style={styles.chipsWrap}>
                {MUSCLE_GROUPS.filter((mg) => mg.id !== primaryMuscleId).map((mg) => {
                  const isSelected = secondaryMuscleIds.includes(mg.id);
                  return (
                    <Pressable
                      key={mg.id}
                      onPress={() => handleToggleSecondaryMuscle(mg.id)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {mg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 6. Movement Pattern (Optional single select) */}
            <View style={styles.fieldSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>How does this equipment mainly move?</Text>
                <Text style={styles.optionalBadge}>Optional</Text>
              </View>
              <Text style={styles.helperText}>
                Not sure? That's okay — we'll figure it out.
              </Text>
              <View style={styles.chipsWrap}>
                {MOVEMENT_PATTERNS.map((mp) => {
                  const isSelected = movementPattern === mp.id;
                  return (
                    <Pressable
                      key={mp.id}
                      onPress={() => setMovementPattern(isSelected ? undefined : mp.id)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {mp.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Submit CTA */}
          <View style={styles.sheetFooter}>
            <PrimaryButton
              label="Add equipment"
              onPress={handleSubmit}
              disabled={!isValid}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#141418',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#23232B',
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  notch: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2E2E3A',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.title,
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C1C24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  fieldSection: {
    marginBottom: spacing.md + 2,
  },
  sectionLabel: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  optionalBadge: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  helperText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 3,
    lineHeight: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1C1C24',
    borderWidth: 1.5,
    borderColor: '#282834',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#141418',
  },
});
