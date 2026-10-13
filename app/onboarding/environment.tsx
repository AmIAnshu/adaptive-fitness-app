/**
 * Onboarding — Training Environment Screen
 *
 * Screen 5 of 10 in the Adaptive Fitness onboarding flow.
 * Collects the user's primary training venue and equipment availability,
 * serving as a HARD CONSTRAINT for exercise selection in the workout engine.
 *
 * Questions:
 * 1. Primary training venue (Commercial gym, Small gym, Home gym, Mostly at home, Multiple places)
 * 2. Equipment access mode:
 *    - "Most gym equipment" (broad access path)
 *    - "Customize equipment" (reveals multi-select checklist of 12 items)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../src/theme';
import {
  OnboardingProgress,
  PrimaryButton,
  OptionCard,
  EquipmentCard,
  AddCustomEquipmentModal,
  CustomEquipmentCard,
} from '../../src/components';
import {
  useOnboarding,
  TRAINING_LOCATION_OPTIONS,
  EQUIPMENT_OPTIONS,
  TrainingLocationId,
  EquipmentAccessMode,
  EquipmentId,
  CustomEquipment,
} from '../../src/features/onboarding';

export default function EnvironmentScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from persistent onboarding context
  const [trainingLocation, setTrainingLocation] = useState<TrainingLocationId | undefined>(
    data.trainingLocation
  );
  const [equipmentMode, setEquipmentMode] = useState<EquipmentAccessMode | undefined>(
    data.equipmentMode
  );
  // Preserves custom equipment selections even when switching to broad access
  const [equipmentIds, setEquipmentIds] = useState<string[]>(
    data.equipmentIds || []
  );
  // User-created custom equipment items
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>(
    data.customEquipments || []
  );
  // Modal visibility
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Dynamic context hints based on chosen location
  const isHomeLocation =
    trainingLocation === 'home_gym' || trainingLocation === 'mostly_home';

  // Toggle individual equipment item (works for standard and custom IDs)
  const handleToggleEquipment = (id: string) => {
    setEquipmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add custom equipment from modal
  const handleAddCustomEquipment = (newEquipment: CustomEquipment) => {
    const updatedCustom = [...customEquipments, newEquipment];
    const updatedIds = [...equipmentIds, newEquipment.id];
    setCustomEquipments(updatedCustom);
    setEquipmentIds(updatedIds);
    updateData({
      customEquipments: updatedCustom,
      equipmentIds: updatedIds,
    });
  };

  // Delete custom equipment
  const handleDeleteCustomEquipment = (id: string) => {
    const updatedCustom = customEquipments.filter((item) => item.id !== id);
    const updatedIds = equipmentIds.filter((item) => item !== id);
    setCustomEquipments(updatedCustom);
    setEquipmentIds(updatedIds);
    updateData({
      customEquipments: updatedCustom,
      equipmentIds: updatedIds,
    });
  };

  // Validation
  const isCustomModeValid =
    equipmentMode === 'custom' ? equipmentIds.length >= 1 : true;
  const isFormValid =
    trainingLocation !== undefined &&
    equipmentMode !== undefined &&
    isCustomModeValid;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      ...(trainingLocation ? { trainingLocation } : {}),
      ...(equipmentMode ? { equipmentMode } : {}),
      equipmentIds,
      customEquipments,
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state and route to next step
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      trainingLocation,
      equipmentMode,
      equipmentIds,
      customEquipments,
    });

    router.push('/onboarding/training-style');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.mobileContainer}>
        {/* Progress Header with Back Arrow */}
        <View style={styles.progressContainer}>
          <OnboardingProgress
            currentStep={5}
            totalSteps={10}
            onBack={handleBack}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Typography Hierarchy */}
          <View style={styles.header}>
            <Text style={styles.title}>Where do you train?</Text>
            <Text style={styles.subtitle}>
              Your equipment helps us choose exercises that actually work for
              you.
            </Text>
          </View>

          {/* QUESTION 1: Training Location */}
          <View style={styles.questionSection}>
            <Text style={styles.questionLabel}>
              Where do you train most often?
            </Text>
            <View style={styles.optionsList}>
              {TRAINING_LOCATION_OPTIONS.map((loc) => (
                <OptionCard
                  key={loc.id}
                  label={loc.label}
                  description={loc.description}
                  selected={trainingLocation === loc.id}
                  onPress={() => {
                    setTrainingLocation(loc.id);
                    // If user selects home and hasn't chosen equipment mode yet, default to custom
                    if (
                      (loc.id === 'home_gym' || loc.id === 'mostly_home') &&
                      equipmentMode === undefined
                    ) {
                      setEquipmentMode('custom');
                    } else if (
                      loc.id === 'commercial_gym' &&
                      equipmentMode === undefined
                    ) {
                      setEquipmentMode('most_gym_equipment');
                    }
                  }}
                  compact
                />
              ))}
            </View>
          </View>

          {/* QUESTION 2: Equipment Access Mode */}
          <View style={styles.questionSection}>
            <View style={styles.questionHeaderRow}>
              <Text style={styles.questionLabelNoMargin}>
                What equipment do you have access to?
              </Text>
              {isHomeLocation ? (
                <Text style={styles.contextBadge}>Recommended for home</Text>
              ) : null}
            </View>

            <View style={styles.optionsList}>
              {/* Quick Option: Most gym equipment */}
              <OptionCard
                label="Most gym equipment"
                description="Broad access to free weights, cables, racks, and machines"
                selected={equipmentMode === 'most_gym_equipment'}
                onPress={() => setEquipmentMode('most_gym_equipment')}
                compact
              />

              {/* Secondary Option: Customize equipment */}
              <OptionCard
                label="Customize equipment"
                description={
                  isHomeLocation
                    ? 'Select your home setup (dumbbells, pull-up bar, bands, etc.)'
                    : 'Select the specific equipment you have on hand'
                }
                selected={equipmentMode === 'custom'}
                onPress={() => setEquipmentMode('custom')}
                compact
              />
            </View>

            {/* Revealed Custom Equipment Checklist */}
            {equipmentMode === 'custom' ? (
              <View style={styles.customSection}>
                <View style={styles.customHeaderRow}>
                  <Text style={styles.customSectionTitle}>
                    Select your equipment
                  </Text>
                  <Text style={styles.customCount}>
                    {equipmentIds.length} selected
                  </Text>
                </View>

                <View style={styles.equipmentGrid}>
                  {EQUIPMENT_OPTIONS.map((item) => (
                    <View key={item.id} style={styles.gridItem}>
                      <EquipmentCard
                        id={item.id}
                        label={item.label}
                        selected={equipmentIds.includes(item.id)}
                        onToggle={handleToggleEquipment}
                      />
                    </View>
                  ))}
                </View>

                {/* User-created Custom Equipment Items */}
                {customEquipments.length > 0 ? (
                  <View style={styles.customItemsList}>
                    <Text style={styles.subSectionTitle}>Custom equipment</Text>
                    {customEquipments.map((custom) => (
                      <CustomEquipmentCard
                        key={custom.id}
                        item={custom}
                        selected={equipmentIds.includes(custom.id)}
                        onToggle={handleToggleEquipment}
                        onDelete={handleDeleteCustomEquipment}
                      />
                    ))}
                  </View>
                ) : null}

                {/* Action: Add custom equipment button (replaces "Other") */}
                <Pressable
                  onPress={() => setIsModalVisible(true)}
                  style={styles.addCustomButton}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom equipment"
                >
                  <View style={styles.addCustomPlusCircle}>
                    <Text style={styles.addCustomPlus}>+</Text>
                  </View>
                  <Text style={styles.addCustomText}>Add custom equipment</Text>
                </Pressable>

                {equipmentIds.length === 0 ? (
                  <Text style={styles.requiredNotice}>
                    Please select at least 1 equipment item
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Bottom CTA with mobile margins */}
        <View style={styles.footer}>
          <PrimaryButton
            label="Continue"
            onPress={handleContinue}
            disabled={!isFormValid}
          />
        </View>

        {/* Add Custom Equipment Bottom Sheet Modal */}
        <AddCustomEquipmentModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onAdd={handleAddCustomEquipment}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  questionSection: {
    marginBottom: spacing.lg + 4,
  },
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm + 2,
  },
  questionLabel: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm + 2,
    letterSpacing: -0.1,
  },
  questionLabelNoMargin: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.1,
    flex: 1,
    marginRight: 8,
  },
  contextBadge: {
    ...typography.bodySmall,
    fontSize: 11,
    fontWeight: '600',
    color: '#B5AEF8',
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  optionsList: {
    gap: 8,
  },
  customSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  customHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  customSectionTitle: {
    ...typography.bodySmall,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  customCount: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48.8%',
  },
  requiredNotice: {
    ...typography.bodySmall,
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 8,
  },
  customItemsList: {
    marginTop: spacing.md,
    gap: 8,
  },
  subSectionTitle: {
    ...typography.bodySmall,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#3D357A',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(108, 92, 231, 0.08)',
    marginTop: spacing.sm + 2,
    paddingHorizontal: 16,
  },
  addCustomPlusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addCustomPlus: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  addCustomText: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#B5AEF8',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
  },
});
