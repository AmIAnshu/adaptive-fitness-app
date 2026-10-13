/**
 * Screen 9: Nutrition & Eating Habits
 *
 * Route: /onboarding/nutrition
 *
 * Product Purpose:
 * Captures user dietary patterns, restrictions, food preferences, meal frequency,
 * preparation habits, and desired plan structure so the future nutrition engine
 * can construct realistic and sustainable plans.
 *
 * Required Questions:
 * 1. Diet type (single-select: vegetarian, eggetarian, non_vegetarian, vegan, no_preference, other)
 * 2. Dietary restrictions (multi-select: dairy, eggs, gluten, nuts, seafood, other, none; "none" mutually exclusive)
 * 3. Meals per day (single-select: 2, 3, 4, 5_plus, flexible)
 * 4. Meal source (single-select: mostly_cook, family_prepares, mixed, mostly_outside)
 * 5. Eating out frequency (single-select: rarely, 1_2_week, 3_5_week, almost_daily; highlighted if mealSource is mostly_outside)
 * 6. Nutrition structure (single-select: very_structured, mostly_structured, flexible, coach_decides)
 *
 * Optional Questions:
 * - Liked foods (searchable multi-select, max 10)
 * - Disliked foods (searchable multi-select, max 10; mutually exclusive with liked foods)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../src/theme';
import {
  OnboardingProgress,
  OptionCard,
  PrimaryButton,
} from '../../src/components';
import {
  useOnboarding,
  DietType,
  PreferredMeals,
  MealSource,
  EatingOutFrequency,
  NutritionStructure,
  FoodCategory,
  DIET_TYPE_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  PREFERRED_MEALS_OPTIONS,
  MEAL_SOURCE_OPTIONS,
  EATING_OUT_FREQUENCY_OPTIONS,
  NUTRITION_STRUCTURE_OPTIONS,
  FOOD_CATEGORY_FILTERS,
  MAX_FOOD_PREFERENCE_LIMIT,
  SEED_FOODS,
} from '../../src/features/onboarding';

export default function NutritionScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from context
  const [dietType, setDietType] = useState<DietType | undefined>(data.dietType);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
    data.dietaryRestrictions || []
  );
  const [likedFoods, setLikedFoods] = useState<string[]>(data.likedFoods || []);
  const [dislikedFoods, setDislikedFoods] = useState<string[]>(
    data.dislikedFoods || []
  );
  const [preferredMeals, setPreferredMeals] = useState<
    PreferredMeals | undefined
  >(data.preferredMeals);
  const [mealSource, setMealSource] = useState<MealSource | undefined>(
    data.mealSource
  );
  const [eatingOutFrequency, setEatingOutFrequency] = useState<
    EatingOutFrequency | undefined
  >(data.eatingOutFrequency);
  const [nutritionStructure, setNutritionStructure] = useState<
    NutritionStructure | undefined
  >(data.nutritionStructure);

  // Active food picker tab: 'liked' | 'disliked'
  const [activeFoodTab, setActiveFoodTab] = useState<'liked' | 'disliked'>('liked');

  // Search & Category filter for Food Picker
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [selectedFoodCategory, setSelectedFoodCategory] = useState<FoodCategory>('All');
  const [foodLimitNotice, setFoodLimitNotice] = useState<string | null>(null);

  // Filtered seed foods based on query and category
  const filteredFoods = useMemo(() => {
    const query = foodSearchQuery.trim().toLowerCase();
    return SEED_FOODS.filter((food) => {
      if (selectedFoodCategory !== 'All' && food.category !== selectedFoodCategory) {
        return false;
      }
      if (query.length > 0) {
        const matchesName = food.name.toLowerCase().includes(query);
        const matchesCat = food.category.toLowerCase().includes(query);
        return matchesName || matchesCat;
      }
      return true;
    });
  }, [foodSearchQuery, selectedFoodCategory]);

  // Dietary restrictions toggle logic (with "none" exclusivity)
  const handleToggleRestriction = (id: string) => {
    setDietaryRestrictions((prev) => {
      if (id === 'none') {
        // Toggling "none": if already selected, clear it; otherwise set to ONLY ['none']
        return prev.includes('none') ? [] : ['none'];
      }

      // Toggling any other restriction: remove "none" if present
      const withoutNone = prev.filter((r) => r !== 'none');
      if (withoutNone.includes(id)) {
        return withoutNone.filter((r) => r !== id);
      } else {
        return [...withoutNone, id];
      }
    });
  };

  // Food selection toggle logic (with mutual exclusivity between liked & disliked)
  const handleToggleFood = (foodId: string) => {
    setFoodLimitNotice(null);

    const isLiked = likedFoods.includes(foodId);
    const isDisliked = dislikedFoods.includes(foodId);

    if (activeFoodTab === 'liked') {
      if (isLiked) {
        // Untoggle
        setLikedFoods((prev) => prev.filter((id) => id !== foodId));
      } else {
        // Adding to liked: check limit
        if (likedFoods.length >= MAX_FOOD_PREFERENCE_LIMIT) {
          setFoodLimitNotice(`Maximum ${MAX_FOOD_PREFERENCE_LIMIT} liked foods allowed`);
          return;
        }
        // Remove from disliked if present (mutual exclusivity)
        if (isDisliked) {
          setDislikedFoods((prev) => prev.filter((id) => id !== foodId));
        }
        setLikedFoods((prev) => [...prev, foodId]);
      }
    } else {
      // activeFoodTab === 'disliked'
      if (isDisliked) {
        // Untoggle
        setDislikedFoods((prev) => prev.filter((id) => id !== foodId));
      } else {
        // Adding to disliked: check limit
        if (dislikedFoods.length >= MAX_FOOD_PREFERENCE_LIMIT) {
          setFoodLimitNotice(`Maximum ${MAX_FOOD_PREFERENCE_LIMIT} disliked foods allowed`);
          return;
        }
        // Remove from liked if present (mutual exclusivity)
        if (isLiked) {
          setLikedFoods((prev) => prev.filter((id) => id !== foodId));
        }
        setDislikedFoods((prev) => [...prev, foodId]);
      }
    }
  };

  // Validation: 6 required questions answered
  const isFormValid =
    dietType !== undefined &&
    dietaryRestrictions.length > 0 &&
    preferredMeals !== undefined &&
    mealSource !== undefined &&
    eatingOutFrequency !== undefined &&
    nutritionStructure !== undefined;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      ...(dietType ? { dietType } : {}),
      dietaryRestrictions,
      likedFoods,
      dislikedFoods,
      ...(preferredMeals ? { preferredMeals } : {}),
      ...(mealSource ? { mealSource } : {}),
      ...(eatingOutFrequency ? { eatingOutFrequency } : {}),
      ...(nutritionStructure ? { nutritionStructure } : {}),
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state and route to next step
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      dietType,
      dietaryRestrictions,
      likedFoods,
      dislikedFoods,
      preferredMeals,
      mealSource,
      eatingOutFrequency,
      nutritionStructure,
    });

    router.push('/onboarding/ai-coach');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mobileContainer}>
          {/* Progress Header with Back Chevron */}
          <View style={styles.progressContainer}>
            <OnboardingProgress
              currentStep={9}
              totalSteps={10}
              onBack={handleBack}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Typography Hierarchy */}
            <View style={styles.header}>
              <Text style={styles.title}>Let's make nutrition fit your life.</Text>
              <Text style={styles.subtitle}>
                Your plan should work with the way you actually eat.
              </Text>
            </View>

            {/* QUESTION 1: Diet Type */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How would you describe your diet?
              </Text>
              <View style={styles.optionsList}>
                {DIET_TYPE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    selected={dietType === opt.id}
                    onPress={() => setDietType(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* QUESTION 2: Dietary Restrictions (Multi-select) */}
            <View style={styles.questionSection}>
              <View style={styles.questionLabelRow}>
                <Text style={styles.questionLabel}>
                  Anything you need to avoid?
                </Text>
                <Text style={styles.questionSupporting}>
                  Select anything that applies
                </Text>
              </View>
              <View style={styles.optionsList}>
                {DIETARY_RESTRICTION_OPTIONS.map((opt) => {
                  const isSelected = dietaryRestrictions.includes(opt.id);
                  return (
                    <OptionCard
                      key={opt.id}
                      label={opt.label}
                      selected={isSelected}
                      onPress={() => handleToggleRestriction(opt.id)}
                      compact
                    />
                  );
                })}
              </View>
            </View>

            {/* QUESTIONS 3 & 4: Food Preferences (Searchable Pickers) */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                Food preferences
              </Text>
              <Text style={styles.sectionSubtitle}>
                Tell us what you'd like to see in your plan, and what you'd rather skip.
              </Text>

              {/* Segmented Switcher [ FOODS I LIKE ] [ FOODS I DISLIKE ] */}
              <View style={styles.segmentedContainer}>
                {/* Tab 1: FOODS I LIKE */}
                <Pressable
                  onPress={() => {
                    setActiveFoodTab('liked');
                    setFoodLimitNotice(null);
                  }}
                  style={[
                    styles.segmentTab,
                    activeFoodTab === 'liked' && styles.segmentTabActive,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFoodTab === 'liked' }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      activeFoodTab === 'liked' && styles.segmentTextActive,
                    ]}
                  >
                    FOODS I LIKE
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFoodTab === 'liked' && styles.countPillActive,
                      likedFoods.length > 0 && styles.countPillHighlighted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFoodTab === 'liked' && styles.countPillTextActive,
                      ]}
                    >
                      {likedFoods.length}/{MAX_FOOD_PREFERENCE_LIMIT}
                    </Text>
                  </View>
                </Pressable>

                {/* Tab 2: FOODS I DISLIKE */}
                <Pressable
                  onPress={() => {
                    setActiveFoodTab('disliked');
                    setFoodLimitNotice(null);
                  }}
                  style={[
                    styles.segmentTab,
                    activeFoodTab === 'disliked' && styles.segmentTabActive,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFoodTab === 'disliked' }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      activeFoodTab === 'disliked' && styles.segmentTextActive,
                    ]}
                  >
                    FOODS I DISLIKE
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFoodTab === 'disliked' && styles.countPillActive,
                      dislikedFoods.length > 0 && styles.countPillHighlighted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFoodTab === 'disliked' && styles.countPillTextActive,
                      ]}
                    >
                      {dislikedFoods.length}/{MAX_FOOD_PREFERENCE_LIMIT}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Active Tab Header Context */}
              <View style={styles.activeFoodHeader}>
                <View style={styles.activeFoodTextWrap}>
                  <Text style={styles.activeFoodTitle}>
                    {activeFoodTab === 'liked'
                      ? 'What foods do you enjoy eating?'
                      : "Anything you don't enjoy eating?"}
                  </Text>
                  <Text style={styles.activeFoodSubtitle}>
                    {activeFoodTab === 'liked'
                      ? "Optional — pick up to 10 foods you'd like in your plan"
                      : 'Optional — pick up to 10 foods you want to skip'}
                  </Text>
                </View>
                <Text style={styles.activeCountBadge}>
                  {activeFoodTab === 'liked'
                    ? `${likedFoods.length}/10 selected`
                    : `${dislikedFoods.length}/10 selected`}
                </Text>
              </View>

              {/* Limit Notice Banner */}
              {foodLimitNotice ? (
                <View style={styles.noticeBanner}>
                  <Text style={styles.noticeText}>{foodLimitNotice}</Text>
                </View>
              ) : null}

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <View style={styles.searchIconWrap}>
                  <View style={styles.searchGlassCircle} />
                  <View style={styles.searchGlassHandle} />
                </View>
                <TextInput
                  style={styles.searchInput}
                  value={foodSearchQuery}
                  onChangeText={setFoodSearchQuery}
                  placeholder="Search foods..."
                  placeholderTextColor={colors.textSecondary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Search foods"
                />
                {foodSearchQuery.length > 0 ? (
                  <Pressable
                    onPress={() => setFoodSearchQuery('')}
                    style={styles.clearSearchBtn}
                    hitSlop={10}
                    accessibilityLabel="Clear search"
                  >
                    <Text style={styles.clearSearchText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Category Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryFiltersScroll}
                style={styles.categoryFiltersContainer}
              >
                {FOOD_CATEGORY_FILTERS.map((cat) => {
                  const isSelected = selectedFoodCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedFoodCategory(cat)}
                      style={[
                        styles.categoryFilterChip,
                        isSelected && styles.categoryFilterChipSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.categoryFilterChipText,
                          isSelected && styles.categoryFilterChipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Foods List */}
              {filteredFoods.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No foods found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Try a different search or select another category filter.
                  </Text>
                </View>
              ) : (
                <View style={styles.foodList}>
                  {filteredFoods.map((food) => {
                    const isLiked = likedFoods.includes(food.id);
                    const isDisliked = dislikedFoods.includes(food.id);
                    const isSelectedInActive =
                      activeFoodTab === 'liked' ? isLiked : isDisliked;
                    const isSelectedInOther =
                      activeFoodTab === 'liked' ? isDisliked : isLiked;

                    const badgeLabel = isLiked
                      ? '★ Liked'
                      : isDisliked
                      ? '✕ Dislike'
                      : null;

                    return (
                      <Pressable
                        key={food.id}
                        onPress={() => handleToggleFood(food.id)}
                        style={[
                          styles.foodCard,
                          isSelectedInActive && styles.foodCardActive,
                          isSelectedInOther && styles.foodCardOther,
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelectedInActive }}
                        accessibilityLabel={`${food.name}, ${food.category}, ${
                          badgeLabel || 'not selected'
                        }`}
                      >
                        {/* Checkbox indicator */}
                        <View
                          style={[
                            styles.checkbox,
                            isSelectedInActive && styles.checkboxActive,
                            isSelectedInOther && styles.checkboxOther,
                          ]}
                        >
                          {isSelectedInActive ? (
                            <View style={styles.checkMark}>
                              <View style={styles.checkStemShort} />
                              <View style={styles.checkStemLong} />
                            </View>
                          ) : isSelectedInOther ? (
                            <View style={styles.otherDot} />
                          ) : null}
                        </View>

                        {/* Food Name & Category */}
                        <View style={styles.foodInfo}>
                          <Text
                            style={[
                              styles.foodName,
                              isSelectedInActive && styles.foodNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {food.name}
                          </Text>
                          <Text style={styles.foodCategory} numberOfLines={1}>
                            {food.category}
                          </Text>
                        </View>

                        {/* Status Badge */}
                        {badgeLabel ? (
                          <View
                            style={[
                              styles.badgePill,
                              isLiked && styles.badgeLiked,
                              isDisliked && styles.badgeDisliked,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                isLiked && styles.badgeTextLiked,
                                isDisliked && styles.badgeTextDisliked,
                              ]}
                            >
                              {badgeLabel}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Bottom Foods Compact Summary */}
              <View style={styles.summaryBar}>
                <Text style={styles.summaryText}>
                  {likedFoods.length} liked · {dislikedFoods.length} disliked
                </Text>
              </View>
            </View>

            {/* QUESTION 5: Meals Per Day */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How many meals do you usually prefer?
              </Text>
              <View style={styles.optionsList}>
                {PREFERRED_MEALS_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    selected={preferredMeals === opt.id}
                    onPress={() => setPreferredMeals(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* QUESTION 6: Meal Preparation */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How do you usually get your meals?
              </Text>
              <View style={styles.optionsList}>
                {MEAL_SOURCE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    description={opt.description}
                    selected={mealSource === opt.id}
                    onPress={() => setMealSource(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* QUESTION 7: Eating Out (Highlighted if mealSource === 'mostly_outside') */}
            <View
              style={[
                styles.questionSection,
                mealSource === 'mostly_outside' && styles.questionSectionHighlight,
              ]}
            >
              <View style={styles.eatingOutHeaderRow}>
                <Text style={styles.questionLabel}>
                  How often do you eat outside?
                </Text>
                {mealSource === 'mostly_outside' ? (
                  <View style={styles.highlightBadge}>
                    <Text style={styles.highlightBadgeText}>
                      Key Signal
                    </Text>
                  </View>
                ) : null}
              </View>
              {mealSource === 'mostly_outside' ? (
                <Text style={styles.highlightHelper}>
                  Since you get meals mostly outside, understanding this frequency helps us calibrate realistic flexibility.
                </Text>
              ) : null}
              <View style={styles.optionsList}>
                {EATING_OUT_FREQUENCY_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    selected={eatingOutFrequency === opt.id}
                    onPress={() => setEatingOutFrequency(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>

            {/* QUESTION 8: Nutrition Structure */}
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>
                How do you want your nutrition plan to feel?
              </Text>
              <View style={styles.optionsList}>
                {NUTRITION_STRUCTURE_OPTIONS.map((opt) => (
                  <OptionCard
                    key={opt.id}
                    label={opt.label}
                    description={opt.description}
                    selected={nutritionStructure === opt.id}
                    onPress={() => setNutritionStructure(opt.id)}
                    compact
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom CTA */}
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
  keyboardContainer: {
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
  questionSectionHighlight: {
    backgroundColor: 'rgba(108, 92, 231, 0.06)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(108, 92, 231, 0.35)',
    padding: spacing.md,
  },
  eatingOutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  highlightBadge: {
    backgroundColor: 'rgba(108, 92, 231, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  highlightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DDD8FF',
  },
  highlightHelper: {
    ...typography.bodySmall,
    fontSize: 12,
    color: '#C4B5FD',
    marginBottom: spacing.sm,
    lineHeight: 16,
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
  questionLabelRow: {
    marginBottom: spacing.sm,
  },
  questionSupporting: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -4,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -4,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  optionsList: {
    gap: 8,
  },

  // Segmented Switcher [ FOODS I LIKE ] [ FOODS I DISLIKE ]
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#23232E',
    marginBottom: spacing.sm + 2,
    gap: 3,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    gap: 5,
  },
  segmentTabActive: {
    backgroundColor: '#262438',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  countPill: {
    backgroundColor: '#1C1C24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countPillActive: {
    backgroundColor: '#353152',
  },
  countPillHighlighted: {
    backgroundColor: 'rgba(108, 92, 231, 0.35)',
  },
  countPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  countPillTextActive: {
    color: '#DDD8FF',
  },

  // Active Food Header
  activeFoodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs + 3,
  },
  activeFoodTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  activeFoodTitle: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activeFoodSubtitle: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
  },
  activeCountBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    paddingTop: 1,
  },

  // Notice Banner
  noticeBanner: {
    backgroundColor: '#2D1B22',
    borderWidth: 1,
    borderColor: '#E84118',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: spacing.xs + 2,
  },
  noticeText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
  },

  // Search Input Container
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161C',
    borderWidth: 1.5,
    borderColor: '#282834',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: spacing.xs + 2,
  },
  searchIconWrap: {
    width: 16,
    height: 16,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGlassCircle: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    marginBottom: -1,
    marginLeft: -1,
  },
  searchGlassHandle: {
    width: 4,
    height: 1.5,
    backgroundColor: colors.textSecondary,
    transform: [{ rotate: '45deg' }],
    marginLeft: 5,
    marginTop: -1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // Category Filter Chips
  categoryFiltersContainer: {
    marginBottom: spacing.sm + 2,
  },
  categoryFiltersScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  categoryFilterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: '#1A1A22',
    borderWidth: 1,
    borderColor: '#2A2A36',
  },
  categoryFilterChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryFilterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryFilterChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    ...typography.bodySmall,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Food List
  foodList: {
    gap: 7,
  },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161C',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#242430',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  foodCardActive: {
    borderColor: colors.accent,
    backgroundColor: '#1E1B2E',
  },
  foodCardOther: {
    borderColor: '#2F2F3D',
    backgroundColor: '#141419',
    opacity: 0.85,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#3D3D4E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxOther: {
    borderColor: '#5A5A6E',
    backgroundColor: '#252530',
  },
  checkMark: {
    width: 10,
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkStemShort: {
    position: 'absolute',
    left: 1,
    top: 3,
    width: 3,
    height: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  checkStemLong: {
    position: 'absolute',
    left: 3,
    top: 1,
    width: 6,
    height: 2,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  otherDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
  },
  foodInfo: {
    flex: 1,
    paddingRight: 8,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 1,
  },
  foodNameActive: {
    color: '#FFFFFF',
  },
  foodCategory: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeLiked: {
    backgroundColor: 'rgba(108, 92, 231, 0.25)',
  },
  badgeDisliked: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextLiked: {
    color: '#C4B5FD',
  },
  badgeTextDisliked: {
    color: '#FF6B6B',
  },

  // Summary Bar
  summaryBar: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    backgroundColor: '#121217',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F1F28',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Sticky Bottom Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: colors.background,
  },
});
