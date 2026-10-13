/**
 * Screen 7: Exercise Preferences
 *
 * Route: /onboarding/exercise-preferences
 *
 * Purpose:
 * Learn what exercises the user enjoys (favorites, max 8), dislikes (max 5),
 * or wants to avoid (max 5). Includes a friendly beginner escape path:
 * "I don't know enough exercises yet".
 *
 * Key Constraints:
 * - Mutual exclusivity: an exercise can only exist in one category at a time
 * - Searchable catalog with category filtering
 * - Case-insensitive search with empty state ("No exercises found")
 * - Summary display at the bottom of the preference section
 * - Mobile-first design for 390x844 & 375x812
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
  PrimaryButton,
} from '../../src/components';
import {
  useOnboarding,
  ExercisePreferenceCategory,
  ExerciseMuscleCategory,
  SeedExercise,
  EXERCISE_CATEGORY_FILTERS,
  MAX_PREFERENCE_LIMITS,
  SEED_EXERCISES,
} from '../../src/features/onboarding';

export default function ExercisePreferencesScreen() {
  const router = useRouter();
  const { data, updateData } = useOnboarding();

  // Local state initialized from context
  const [favorites, setFavorites] = useState<string[]>(data.favorites || []);
  const [dislikes, setDislikes] = useState<string[]>(data.dislikes || []);
  const [avoid, setAvoid] = useState<string[]>(data.avoid || []);
  const [skippedBecauseUnsure, setSkippedBecauseUnsure] = useState<boolean>(
    Boolean(data.skippedBecauseUnsure)
  );

  // Active preference tab category: 'favorites' | 'dislikes' | 'avoid'
  const [activeTab, setActiveTab] = useState<ExercisePreferenceCategory>('favorites');

  // Search & Muscle Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<ExerciseMuscleCategory>('All');

  // Notice for limit reached
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  // Filtered exercises based on search query & muscle category
  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return SEED_EXERCISES.filter((ex) => {
      // Muscle filter
      if (selectedMuscle !== 'All' && ex.category !== selectedMuscle) {
        return false;
      }
      // Search query filter
      if (query.length > 0) {
        const matchesName = ex.name.toLowerCase().includes(query);
        const matchesCategory = ex.category.toLowerCase().includes(query);
        const matchesSub = ex.subCategory?.toLowerCase().includes(query);
        return matchesName || matchesCategory || matchesSub;
      }
      return true;
    });
  }, [searchQuery, selectedMuscle]);

  // Which category does an exercise currently belong to?
  const getExerciseCategory = (id: string): ExercisePreferenceCategory | null => {
    if (favorites.includes(id)) return 'favorites';
    if (dislikes.includes(id)) return 'dislikes';
    if (avoid.includes(id)) return 'avoid';
    return null;
  };

  // Toggle or move exercise into active category
  const handleToggleExercise = (exerciseId: string) => {
    // If beginner path was active, tapping an exercise deactivates it
    if (skippedBecauseUnsure) {
      setSkippedBecauseUnsure(false);
    }
    setLimitNotice(null);

    const currentCat = getExerciseCategory(exerciseId);

    // If already in the active tab -> remove it (untoggle)
    if (currentCat === activeTab) {
      if (activeTab === 'favorites') {
        setFavorites((prev) => prev.filter((id) => id !== exerciseId));
      } else if (activeTab === 'dislikes') {
        setDislikes((prev) => prev.filter((id) => id !== exerciseId));
      } else if (activeTab === 'avoid') {
        setAvoid((prev) => prev.filter((id) => id !== exerciseId));
      }
      return;
    }

    // Check limit for active category
    const currentList =
      activeTab === 'favorites'
        ? favorites
        : activeTab === 'dislikes'
        ? dislikes
        : avoid;
    const maxLimit = MAX_PREFERENCE_LIMITS[activeTab];

    if (currentList.length >= maxLimit) {
      const tabName =
        activeTab === 'favorites'
          ? 'favorites'
          : activeTab === 'dislikes'
          ? 'dislikes'
          : 'avoid';
      setLimitNotice(`Maximum ${maxLimit} ${tabName} selected`);
      return;
    }

    // Mutual exclusivity: remove from previous category if present
    if (currentCat === 'favorites') {
      setFavorites((prev) => prev.filter((id) => id !== exerciseId));
    } else if (currentCat === 'dislikes') {
      setDislikes((prev) => prev.filter((id) => id !== exerciseId));
    } else if (currentCat === 'avoid') {
      setAvoid((prev) => prev.filter((id) => id !== exerciseId));
    }

    // Add to active category
    if (activeTab === 'favorites') {
      setFavorites((prev) => [...prev, exerciseId]);
    } else if (activeTab === 'dislikes') {
      setDislikes((prev) => [...prev, exerciseId]);
    } else if (activeTab === 'avoid') {
      setAvoid((prev) => [...prev, exerciseId]);
    }
  };

  // Toggle beginner unsure option
  const handleToggleUnsure = () => {
    const nextState = !skippedBecauseUnsure;
    setSkippedBecauseUnsure(nextState);
    setLimitNotice(null);
  };

  // Validation: enabled if unsure is selected OR at least one exercise is selected
  const hasSelections =
    favorites.length > 0 || dislikes.length > 0 || avoid.length > 0;
  const isFormValid = skippedBecauseUnsure || hasSelections;

  // Back navigation: preserve current selections in context and go back
  const handleBack = () => {
    updateData({
      favorites,
      dislikes,
      avoid,
      skippedBecauseUnsure,
    });
    router.back();
  };

  // Continue navigation: persist to onboarding state and route to next step
  const handleContinue = () => {
    if (!isFormValid) return;

    updateData({
      favorites,
      dislikes,
      avoid,
      skippedBecauseUnsure,
    });

    router.push('/onboarding/recovery-lifestyle');
  };

  // Descriptive text for the active category
  const activeTabMeta = {
    favorites: {
      heading: 'Which exercises do you enjoy?',
      supporting: 'Pick up to 8.',
      countLabel: `${favorites.length} / 8`,
    },
    dislikes: {
      heading: "Any exercises you'd rather not do?",
      supporting: 'Optional · Pick up to 5.',
      countLabel: `${dislikes.length} / 5`,
    },
    avoid: {
      heading: 'Anything you never want in your plan?',
      supporting: 'Optional · Pick up to 5.',
      countLabel: `${avoid.length} / 5`,
    },
  }[activeTab];

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
              currentStep={7}
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
              <Text style={styles.title}>Know what you like?</Text>
              <Text style={styles.subtitle}>
                Your preferences help us build workouts you'll actually want to
                follow.
              </Text>
            </View>

            {/* Beginner Unsure Escape Path Card */}
            <Pressable
              onPress={handleToggleUnsure}
              style={[
                styles.unsureCard,
                skippedBecauseUnsure && styles.unsureCardSelected,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skippedBecauseUnsure }}
              accessibilityLabel="I don't know enough exercises yet"
            >
              <View
                style={[
                  styles.unsureRadio,
                  skippedBecauseUnsure && styles.unsureRadioSelected,
                ]}
              >
                {skippedBecauseUnsure ? (
                  <View style={styles.unsureRadioDot} />
                ) : null}
              </View>
              <View style={styles.unsureContent}>
                <Text
                  style={[
                    styles.unsureTitle,
                    skippedBecauseUnsure && styles.unsureTitleSelected,
                  ]}
                >
                  I don't know enough exercises yet
                </Text>
                <Text style={styles.unsureSubtitle}>
                  That's okay — we'll learn what works for you as you train.
                </Text>
              </View>
            </Pressable>

            {/* Preference Category Tabs [ I LIKE ] [ NOT FOR ME ] [ AVOID ] */}
            <View style={styles.segmentedContainer}>
              {/* Tab 1: I LIKE */}
              <Pressable
                onPress={() => {
                  setActiveTab('favorites');
                  setLimitNotice(null);
                }}
                style={[
                  styles.segmentTab,
                  activeTab === 'favorites' && styles.segmentTabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'favorites' }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === 'favorites' && styles.segmentTextActive,
                  ]}
                >
                  I LIKE
                </Text>
                <View
                  style={[
                    styles.countPill,
                    activeTab === 'favorites' && styles.countPillActive,
                    favorites.length > 0 && styles.countPillHighlighted,
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      activeTab === 'favorites' && styles.countPillTextActive,
                    ]}
                  >
                    {favorites.length}/8
                  </Text>
                </View>
              </Pressable>

              {/* Tab 2: NOT FOR ME */}
              <Pressable
                onPress={() => {
                  setActiveTab('dislikes');
                  setLimitNotice(null);
                }}
                style={[
                  styles.segmentTab,
                  activeTab === 'dislikes' && styles.segmentTabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'dislikes' }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === 'dislikes' && styles.segmentTextActive,
                  ]}
                >
                  NOT FOR ME
                </Text>
                <View
                  style={[
                    styles.countPill,
                    activeTab === 'dislikes' && styles.countPillActive,
                    dislikes.length > 0 && styles.countPillHighlighted,
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      activeTab === 'dislikes' && styles.countPillTextActive,
                    ]}
                  >
                    {dislikes.length}/5
                  </Text>
                </View>
              </Pressable>

              {/* Tab 3: AVOID */}
              <Pressable
                onPress={() => {
                  setActiveTab('avoid');
                  setLimitNotice(null);
                }}
                style={[
                  styles.segmentTab,
                  activeTab === 'avoid' && styles.segmentTabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'avoid' }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === 'avoid' && styles.segmentTextActive,
                  ]}
                >
                  AVOID
                </Text>
                <View
                  style={[
                    styles.countPill,
                    activeTab === 'avoid' && styles.countPillActive,
                    avoid.length > 0 && styles.countPillHighlighted,
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      activeTab === 'avoid' && styles.countPillTextActive,
                    ]}
                  >
                    {avoid.length}/5
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Active Category Heading & Subtext */}
            <View style={styles.activeCategoryHeader}>
              <View style={styles.activeCategoryTextWrap}>
                <Text style={styles.activeHeading}>
                  {activeTabMeta.heading}
                </Text>
                <Text style={styles.activeSupporting}>
                  {activeTabMeta.supporting}
                </Text>
              </View>
              <Text style={styles.activeCountBadge}>
                {activeTabMeta.countLabel} selected
              </Text>
            </View>

            {/* Limit Reached Notice Banner */}
            {limitNotice ? (
              <View style={styles.noticeBanner}>
                <Text style={styles.noticeText}>{limitNotice}</Text>
              </View>
            ) : null}

            {/* Search Input Field with Clear Button */}
            <View style={styles.searchContainer}>
              <View style={styles.searchIconWrap}>
                <View style={styles.searchGlassCircle} />
                <View style={styles.searchGlassHandle} />
              </View>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel="Search exercises"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchBtn}
                  hitSlop={10}
                  accessibilityLabel="Clear search"
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Muscle Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFiltersScroll}
              style={styles.categoryFiltersContainer}
            >
              {EXERCISE_CATEGORY_FILTERS.map((cat) => {
                const isSelected = selectedMuscle === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedMuscle(cat)}
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

            {/* Exercise Items Catalog / List */}
            {filteredExercises.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No exercises found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Try a different search term or select another category filter.
                </Text>
              </View>
            ) : (
              <View style={styles.exerciseList}>
                {filteredExercises.map((exercise) => {
                  const cat = getExerciseCategory(exercise.id);
                  const isSelectedInActive = cat === activeTab;
                  const isSelectedInOther = cat !== null && cat !== activeTab;

                  const badgeLabel =
                    cat === 'favorites'
                      ? '★ Liked'
                      : cat === 'dislikes'
                      ? '✕ Not for me'
                      : cat === 'avoid'
                      ? '⊘ Avoid'
                      : null;

                  return (
                    <Pressable
                      key={exercise.id}
                      onPress={() => handleToggleExercise(exercise.id)}
                      style={[
                        styles.exerciseCard,
                        isSelectedInActive && styles.exerciseCardActive,
                        isSelectedInOther && styles.exerciseCardOther,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelectedInActive }}
                      accessibilityLabel={`${exercise.name}, ${exercise.category}, ${
                        badgeLabel || 'not selected'
                      }`}
                    >
                      {/* Check / Status Icon */}
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

                      {/* Exercise Name & Muscle Category */}
                      <View style={styles.exerciseInfo}>
                        <Text
                          style={[
                            styles.exerciseName,
                            isSelectedInActive && styles.exerciseNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {exercise.name}
                        </Text>
                        <Text style={styles.exerciseSubtitle} numberOfLines={1}>
                          {exercise.subCategory
                            ? `${exercise.category} · ${exercise.subCategory}`
                            : exercise.category}
                        </Text>
                      </View>

                      {/* Current Category Tag if selected */}
                      {badgeLabel ? (
                        <View
                          style={[
                            styles.badgePill,
                            cat === 'favorites' && styles.badgeFavorites,
                            cat === 'dislikes' && styles.badgeDislikes,
                            cat === 'avoid' && styles.badgeAvoid,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              cat === 'favorites' && styles.badgeTextFavorites,
                              cat === 'dislikes' && styles.badgeTextDislikes,
                              cat === 'avoid' && styles.badgeTextAvoid,
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

            {/* Bottom Preferences Compact Summary */}
            <View style={styles.summaryBar}>
              {skippedBecauseUnsure ? (
                <Text style={styles.summaryTextUnsure}>
                  Starting approach · We'll learn your favorites as you train
                </Text>
              ) : (
                <Text style={styles.summaryText}>
                  {favorites.length} favorites · {dislikes.length} dislikes ·{' '}
                  {avoid.length} avoid
                </Text>
              )}
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
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
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

  // Beginner Path Unsure Card
  unsureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161C',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#242430',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: spacing.md + 2,
  },
  unsureCardSelected: {
    borderColor: colors.accent,
    backgroundColor: '#1E1B2E',
  },
  unsureRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3D3D4E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  unsureRadioSelected: {
    borderColor: colors.accent,
  },
  unsureRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  unsureContent: {
    flex: 1,
  },
  unsureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  unsureTitleSelected: {
    color: '#FFFFFF',
  },
  unsureSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  // Segmented Preference Category Tabs [ I LIKE ] [ NOT FOR ME ] [ AVOID ]
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

  // Active Category Meta
  activeCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs + 3,
  },
  activeCategoryTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  activeHeading: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activeSupporting: {
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

  // Exercise List & Cards
  exerciseList: {
    gap: 7,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161C',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#242430',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  exerciseCardActive: {
    borderColor: colors.accent,
    backgroundColor: '#1E1B2E',
  },
  exerciseCardOther: {
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
  exerciseInfo: {
    flex: 1,
    paddingRight: 8,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 1,
  },
  exerciseNameActive: {
    color: '#FFFFFF',
  },
  exerciseSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeFavorites: {
    backgroundColor: 'rgba(108, 92, 231, 0.25)',
  },
  badgeDislikes: {
    backgroundColor: 'rgba(243, 156, 18, 0.2)',
  },
  badgeAvoid: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextFavorites: {
    color: '#C4B5FD',
  },
  badgeTextDislikes: {
    color: '#F9CA24',
  },
  badgeTextAvoid: {
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
  summaryTextUnsure: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A29BFE',
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
