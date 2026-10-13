/**
 * Onboarding — About You Screen
 *
 * Screen 2 of 10 in the Adaptive Fitness onboarding flow.
 * Collects foundational profile data:
 * - Age (whole number integer)
 * - Height (metric cm or imperial ft + in)
 * - Weight (metric kg or imperial lb)
 *
 * All stored values are strictly normalized internally to metric (cm, kg).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../../src/theme';
import {
  OnboardingProgress,
  PrimaryButton,
  InputField,
  UnitToggle,
} from '../../src/components';
import {
  useOnboarding,
  HeightUnit,
  WeightUnit,
  BiologicalSex,
  BIOLOGICAL_SEX_OPTIONS,
  validateAge,
  validateHeightMetric,
  validateHeightImperial,
  validateWeight,
  validateBiologicalSex,
  cmToFtIn,
  ftInToCm,
  lbToKg,
  kgToLb,
} from '../../src/features/onboarding';

export default function AboutYouScreen() {
  const router = useRouter();
  const {
    data,
    updateData,
    heightUnit,
    setHeightUnit,
    weightUnit,
    setWeightUnit,
  } = useOnboarding();

  // Local form state initialized from persistent onboarding data
  const [ageText, setAgeText] = useState(data.age ? String(data.age) : '');

  // Height local state
  const initialFtIn = data.heightCm ? cmToFtIn(data.heightCm) : { feet: 5, inches: 9 };
  const [heightCmText, setHeightCmText] = useState(
    data.heightCm ? String(Math.round(data.heightCm)) : ''
  );
  const [heightFtText, setHeightFtText] = useState(
    data.heightCm ? String(initialFtIn.feet) : ''
  );
  const [heightInText, setHeightInText] = useState(
    data.heightCm ? String(initialFtIn.inches) : ''
  );

  // Weight local state
  const [weightText, setWeightText] = useState(() => {
    if (!data.weightKg) return '';
    return weightUnit === 'kg'
      ? String(Math.round(data.weightKg * 10) / 10)
      : String(kgToLb(data.weightKg));
  });

  // Biological sex local state (optional)
  const [selectedSex, setSelectedSex] = useState<BiologicalSex | undefined>(data.biologicalSex);

  const handleSelectSex = (sex: BiologicalSex) => {
    setSelectedSex((prev) => (prev === sex ? undefined : sex));
  };

  // Track field blur/interaction for error messaging
  const [touched, setTouched] = useState<{
    age?: boolean;
    height?: boolean;
    weight?: boolean;
  }>({});

  // Validations
  const ageValidation = validateAge(ageText);
  const heightValidation =
    heightUnit === 'cm'
      ? validateHeightMetric(heightCmText)
      : validateHeightImperial(heightFtText, heightInText);
  const weightValidation = validateWeight(weightText, weightUnit);
  const sexValidation = validateBiologicalSex(selectedSex);

  const isFormValid =
    ageValidation.isValid &&
    heightValidation.isValid &&
    weightValidation.isValid &&
    sexValidation.isValid;

  // Handle Height Unit Toggle
  const handleHeightUnitChange = (newUnit: HeightUnit) => {
    if (newUnit === heightUnit) return;

    if (newUnit === 'ft_in') {
      const cmVal = parseFloat(heightCmText);
      if (!isNaN(cmVal) && cmVal > 0) {
        const { feet, inches } = cmToFtIn(cmVal);
        setHeightFtText(String(feet));
        setHeightInText(String(inches));
      }
    } else {
      const ft = parseInt(heightFtText, 10);
      const inch = parseInt(heightInText, 10) || 0;
      if (!isNaN(ft) && ft > 0) {
        const cm = ftInToCm(ft, inch);
        setHeightCmText(String(cm));
      }
    }
    setHeightUnit(newUnit);
  };

  // Handle Weight Unit Toggle
  const handleWeightUnitChange = (newUnit: WeightUnit) => {
    if (newUnit === weightUnit) return;

    const currentVal = parseFloat(weightText);
    if (!isNaN(currentVal) && currentVal > 0) {
      if (newUnit === 'lb') {
        setWeightText(String(kgToLb(currentVal)));
      } else {
        setWeightText(String(lbToKg(currentVal)));
      }
    }
    setWeightUnit(newUnit);
  };

  // Back Navigation
  const handleBack = () => {
    // Preserve any valid values into onboarding context
    updateData({
      ...(ageValidation.isValid && ageValidation.value !== undefined
        ? { age: ageValidation.value }
        : {}),
      ...(heightValidation.isValid && heightValidation.value !== undefined
        ? { heightCm: heightValidation.value }
        : {}),
      ...(weightValidation.isValid && weightValidation.value !== undefined
        ? { weightKg: weightValidation.value }
        : {}),
      biologicalSex: selectedSex,
    });
    router.back();
  };

  // Continue Navigation
  const handleContinue = () => {
    if (!isFormValid) {
      setTouched({ age: true, height: true, weight: true });
      return;
    }

    // Persist normalized metric values to global onboarding state
    updateData({
      age: ageValidation.value,
      heightCm: heightValidation.value,
      weightKg: weightValidation.value,
      biologicalSex: selectedSex,
    });

    router.push('/onboarding/training-experience');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <View style={styles.mobileContainer}>
          {/* Progress Header with Back Arrow */}
          <View style={styles.progressContainer}>
            <OnboardingProgress
              currentStep={2}
              totalSteps={10}
              onBack={handleBack}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Header Typography Hierarchy matching Screen 1 */}
            <View style={styles.header}>
              <Text style={styles.title}>Tell us about yourself.</Text>
              <Text style={styles.subtitle}>
                We'll use this information to personalize your training and
                nutrition plan.
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formSection}>
              {/* Age Field */}
              <InputField
                label="Age"
                value={ageText}
                onChangeText={(text) => {
                  setAgeText(text.replace(/[^0-9]/g, ''));
                  if (!touched.age) setTouched((prev) => ({ ...prev, age: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, age: true }))}
                placeholder="28"
                error={touched.age && !ageValidation.isValid ? ageValidation.error : undefined}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="Enter your age"
              />

              {/* Height Field */}
              {heightUnit === 'cm' ? (
                <InputField
                  label="Height"
                  value={heightCmText}
                  onChangeText={(text) => {
                    setHeightCmText(text.replace(/[^0-9]/g, ''));
                    if (!touched.height) setTouched((prev) => ({ ...prev, height: true }));
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, height: true }))}
                  placeholder="175"
                  unitLabel="cm"
                  error={touched.height && !heightValidation.isValid ? heightValidation.error : undefined}
                  keyboardType="number-pad"
                  maxLength={3}
                  rightElement={
                    <UnitToggle<HeightUnit>
                      options={[
                        { value: 'cm', label: 'cm' },
                        { value: 'ft_in', label: 'ft + in' },
                      ]}
                      value={heightUnit}
                      onChange={handleHeightUnitChange}
                    />
                  }
                  accessibilityLabel="Enter your height in centimeters"
                />
              ) : (
                <View style={styles.imperialFieldContainer}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>Height</Text>
                    <UnitToggle<HeightUnit>
                      options={[
                        { value: 'cm', label: 'cm' },
                        { value: 'ft_in', label: 'ft + in' },
                      ]}
                      value={heightUnit}
                      onChange={handleHeightUnitChange}
                    />
                  </View>
                  <View style={styles.imperialInputsRow}>
                    <View style={styles.halfInput}>
                      <InputField
                        label="ft"
                        value={heightFtText}
                        onChangeText={(text) => {
                          setHeightFtText(text.replace(/[^0-9]/g, ''));
                          if (!touched.height) setTouched((prev) => ({ ...prev, height: true }));
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, height: true }))}
                        placeholder="5"
                        unitLabel="ft"
                        keyboardType="number-pad"
                        maxLength={1}
                        accessibilityLabel="Height in feet (ft)"
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <InputField
                        label="in"
                        value={heightInText}
                        onChangeText={(text) => {
                          setHeightInText(text.replace(/[^0-9]/g, ''));
                          if (!touched.height) setTouched((prev) => ({ ...prev, height: true }));
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, height: true }))}
                        placeholder="10"
                        unitLabel="in"
                        keyboardType="number-pad"
                        maxLength={2}
                        accessibilityLabel="Height in inches (in)"
                      />
                    </View>
                  </View>
                  {touched.height && !heightValidation.isValid ? (
                    <Text style={styles.errorText}>{heightValidation.error}</Text>
                  ) : null}
                </View>
              )}

              {/* Weight Field */}
              <InputField
                label="Weight"
                value={weightText}
                onChangeText={(text) => {
                  // Allow numbers and a single decimal point
                  const sanitized = text.replace(/[^0-9.]/g, '');
                  setWeightText(sanitized);
                  if (!touched.weight) setTouched((prev) => ({ ...prev, weight: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, weight: true }))}
                placeholder={weightUnit === 'kg' ? '75' : '165'}
                unitLabel={weightUnit}
                error={touched.weight && !weightValidation.isValid ? weightValidation.error : undefined}
                keyboardType="decimal-pad"
                maxLength={6}
                rightElement={
                  <UnitToggle<WeightUnit>
                    options={[
                      { value: 'kg', label: 'kg' },
                      { value: 'lb', label: 'lb' },
                    ]}
                    value={weightUnit}
                    onChange={handleWeightUnitChange}
                  />
                }
                accessibilityLabel={`Enter your weight in ${weightUnit}`}
              />

              {/* Biological Sex (Optional) Section */}
              <View style={styles.biologicalSexSection}>
                <View style={styles.biologicalSexHeader}>
                  <Text style={styles.biologicalSexLabel}>Biological sex (optional)</Text>
                  <Text style={styles.biologicalSexHelper}>
                    This is optional. It helps improve some nutrition estimates.
                  </Text>
                </View>

                <View style={styles.biologicalSexOptionsRow}>
                  <View style={styles.sexOptionsTwoCol}>
                    <TouchableOpacity
                      style={[
                        styles.sexOptionChip,
                        selectedSex === 'female' && styles.sexOptionChipSelected,
                      ]}
                      onPress={() => handleSelectSex('female')}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Female"
                      accessibilityState={{ selected: selectedSex === 'female' }}
                    >
                      <Text
                        style={[
                          styles.sexOptionText,
                          selectedSex === 'female' && styles.sexOptionTextSelected,
                        ]}
                      >
                        Female
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sexOptionChip,
                        selectedSex === 'male' && styles.sexOptionChipSelected,
                      ]}
                      onPress={() => handleSelectSex('male')}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Male"
                      accessibilityState={{ selected: selectedSex === 'male' }}
                    >
                      <Text
                        style={[
                          styles.sexOptionText,
                          selectedSex === 'male' && styles.sexOptionTextSelected,
                        ]}
                      >
                        Male
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sexOptionChip,
                      selectedSex === 'prefer_not_to_say' && styles.sexOptionChipSelected,
                    ]}
                    onPress={() => handleSelectSex('prefer_not_to_say')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Prefer not to say"
                    accessibilityState={{ selected: selectedSex === 'prefer_not_to_say' }}
                  >
                    <Text
                      style={[
                        styles.sexOptionText,
                        selectedSex === 'prefer_not_to_say' && styles.sexOptionTextSelected,
                      ]}
                    >
                      Prefer not to say
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
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
    paddingBottom: spacing.lg,
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
  formSection: {
    gap: spacing.xs,
  },
  imperialFieldContainer: {
    marginBottom: spacing.md,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  fieldLabel: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  imperialInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  errorText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
  },
  biologicalSexSection: {
    marginTop: spacing.md,
  },
  biologicalSexHeader: {
    marginBottom: 10,
  },
  biologicalSexLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  biologicalSexHelper: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  biologicalSexOptionsRow: {
    gap: 8,
  },
  sexOptionsTwoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  sexOptionChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sexOptionChipSelected: {
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    borderColor: '#6C5CE7',
  },
  sexOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sexOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
