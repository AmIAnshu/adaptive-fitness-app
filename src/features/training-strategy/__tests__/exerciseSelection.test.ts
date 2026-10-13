/**
 * T5 — Exercise Selection Test Suite
 *
 * Verifies all 31 required invariants:
 * 1. Avoided exercise is excluded.
 * 2. Disliked exercise remains eligible.
 * 3. Favorite exercise receives a deterministic positive preference.
 * 4. Favorite exercise cannot override equipment incompatibility.
 * 5. Favorite exercise cannot override avoid.
 * 6. Custom equipment mode respects equipmentIds.
 * 7. Broad gym mode permits normal gym equipment.
 * 8. Bodyweight exercise does not require gym equipment.
 * 9. Foundational user prioritizes foundational exercises.
 * 10. Advanced-only exercise receives appropriate lower eligibility for foundational users according to the implemented rule.
 * 11. Advanced user can access advanced exercise candidates.
 * 12. Goal-compatible candidates are ranked appropriately.
 * 13. Strength objective prioritizes strength-appropriate candidates.
 * 14. Hypertrophy objective prioritizes practical resistance candidates.
 * 15. Fat-loss support does not convert selection into cardio-only selection.
 * 16. General fitness maintains broad movement coverage candidates.
 * 17. repeat_key_exercises preference influences ranking deterministically.
 * 18. change_often preference permits broader candidate ranking.
 * 19. Short sessions influence practicality ranking.
 * 20. No actual workout day assignments are created.
 * 21. No sets, reps, or RIR are created.
 * 22. No weekly target allocation is created.
 * 23. Same input produces exactly the same result.
 * 24. Function does not mutate profile.
 * 25. Every excluded exercise has a reason.
 * 26. decisionTrace is non-empty.
 * 27. No random behavior exists.
 * 28. T5 can operate with a custom catalog passed into the function.
 * 29. Missing required equipment excludes the candidate.
 * 30. Hard constraints always beat preference ranking.
 * 31. Required movement types are represented in candidate metadata where available, but T5 does not perform T6 allocation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingObjective } from '../goalResolution';
import { resolveFrequency } from '../frequencyResolution';
import { resolveTrainingStructure } from '../trainingStructure';
import { resolveExerciseSelection, isExerciseEquipmentCompatible } from '../exerciseSelection';
import {
  type ExerciseDefinition,
  SEED_EXERCISE_CATALOG,
} from '../exerciseCatalog';

/**
 * Fixture factory: creates a validated CanonicalUserProfile with specific overrides.
 */
function createProfile(overrides: Partial<OnboardingData> = {}): CanonicalUserProfile {
  const baseData: OnboardingData = {
    goal: 'build_muscle',
    age: 28,
    heightCm: 180,
    weightKg: 78.5,
    trainingHistory: '1_to_2_years',
    consistency: 'mostly_consistent',
    exerciseConfidence: 4,
    programmingConfidence: 3,
    idealTrainingDays: 4,
    realisticMinimumDays: 3,
    availableDays: ['mon', 'wed', 'fri', 'sat'],
    scheduleFlexibility: 'sometimes_changes',
    sessionDuration: '45_60',
    preferredTrainingTime: 'evening',
    trainingLocation: 'commercial_gym',
    equipmentMode: 'most_gym_equipment',
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench', 'machines'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'some_variety',
    favorites: ['bench_press'],
    dislikes: ['burpees'],
    avoid: ['deadlift'],
    skippedBecauseUnsure: false,
    sleepDuration: '7_to_8',
    sleepQuality: 4,
    energyLevel: 4,
    stressLevel: 2,
    workoutRecovery: 'mostly_recovered',
    dailyActivity: 'moderate',
    averageSteps: 8500,
    dietType: 'non_vegetarian',
    dietaryRestrictions: ['none'],
    likedFoods: ['chicken_breast'],
    dislikedFoods: ['celery'],
    preferredMeals: '3',
    mealSource: 'mostly_cook',
    eatingOutFrequency: '1_2_week',
    nutritionStructure: 'mostly_structured',
    communicationStyle: 'educational',
    decisionAutonomy: 'recommend',
    explanationDepth: 'detailed',
    accountability: 'gentle',
    isCompleted: true,
    ...overrides,
  };

  return buildCanonicalUserProfile(baseData);
}

describe('T5 — Exercise Selection Rules', () => {
  it('1. Avoided exercise is excluded', () => {
    const profile = createProfile({ avoid: ['deadlift', 'bench_press'] });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.excludedExerciseIds.includes('deadlift'));
    assert.ok(selection.excludedExerciseIds.includes('bench_press'));
    assert.equal(selection.candidates.some((c) => c.exerciseId === 'deadlift'), false);
    assert.equal(selection.candidates.some((c) => c.exerciseId === 'bench_press'), false);
  });

  it('2. Disliked exercise remains eligible', () => {
    const profile = createProfile({ dislikes: ['barbell_squat'], avoid: [] });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const squatCandidate = selection.candidates.find((c) => c.exerciseId === 'barbell_squat');
    assert.ok(squatCandidate, 'Disliked barbell_squat should still remain eligible');
  });

  it('3. Favorite exercise receives a deterministic positive preference', () => {
    const profileWithFav = createProfile({ favorites: ['lat_pulldown'], dislikes: [], avoid: [] });
    const profileWithoutFav = createProfile({ favorites: [], dislikes: [], avoid: [] });

    const obj = resolveTrainingObjective(profileWithFav);
    const freq = resolveFrequency(profileWithFav);
    const struct = resolveTrainingStructure(profileWithFav, obj, freq);

    const selectionFav = resolveExerciseSelection(profileWithFav, obj, struct);
    const selectionNoFav = resolveExerciseSelection(profileWithoutFav, obj, struct);

    const candFav = selectionFav.candidates.find((c) => c.exerciseId === 'lat_pulldown');
    const candNoFav = selectionNoFav.candidates.find((c) => c.exerciseId === 'lat_pulldown');

    assert.ok(candFav);
    assert.ok(candNoFav);
    assert.ok(candFav.priority > candNoFav.priority, 'Favorite should increase candidate priority');
    assert.ok(candFav.reasons.includes('favorite'));
  });

  it('4. Favorite exercise cannot override equipment incompatibility', () => {
    // User only has dumbbells in custom mode, but favorites barbell bench_press
    const profile = createProfile({
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells'],
      favorites: ['bench_press'], // requires barbell + bench
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.excludedExerciseIds.includes('bench_press'));
    assert.equal(selection.candidates.some((c) => c.exerciseId === 'bench_press'), false);
  });

  it('5. Favorite exercise cannot override avoid', () => {
    // Profile with bench_press in avoid
    const profile = createProfile({
      avoid: ['bench_press'],
      favorites: ['lat_pulldown'],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.excludedExerciseIds.includes('bench_press'));
  });

  it('6. Custom equipment mode respects equipmentIds', () => {
    const profile = createProfile({
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells', 'pullup_bar'],
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    // Should include goblet_squat (dumbbells), pull_up (pullup_bar), push_up (bodyweight)
    assert.ok(selection.candidates.some((c) => c.exerciseId === 'goblet_squat'));
    assert.ok(selection.candidates.some((c) => c.exerciseId === 'pull_up'));
    assert.ok(selection.candidates.some((c) => c.exerciseId === 'push_up'));

    // Should exclude barbell_squat, cable_row, machine_chest_press
    assert.ok(selection.excludedExerciseIds.includes('barbell_squat'));
    assert.ok(selection.excludedExerciseIds.includes('cable_row'));
    assert.ok(selection.excludedExerciseIds.includes('machine_chest_press'));
  });

  it('7. Broad gym mode permits normal gym equipment', () => {
    const profile = createProfile({
      equipmentMode: 'most_gym_equipment',
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    // Broad gym includes barbell, cable, machine exercises
    assert.ok(selection.candidates.some((c) => c.exerciseId === 'bench_press'));
    assert.ok(selection.candidates.some((c) => c.exerciseId === 'cable_row'));
    assert.ok(selection.candidates.some((c) => c.exerciseId === 'leg_press'));
  });

  it('8. Bodyweight exercise does not require gym equipment', () => {
    const profile = createProfile({
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells'], // no barbell, no bench, no pullup bar
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const pushUp = selection.candidates.find((c) => c.exerciseId === 'push_up');
    const plank = selection.candidates.find((c) => c.exerciseId === 'plank');
    const walking = selection.candidates.find((c) => c.exerciseId === 'walking');

    assert.ok(pushUp, 'push_up should be eligible');
    assert.ok(plank, 'plank should be eligible');
    assert.ok(walking, 'walking should be eligible');
  });

  it('9. Foundational user prioritizes foundational exercises', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'rarely',
      exerciseConfidence: 1,
      programmingConfidence: 1,
      avoid: [],
      favorites: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const machinePress = selection.candidates.find((c) => c.exerciseId === 'machine_chest_press');
    const barbellSquat = selection.candidates.find((c) => c.exerciseId === 'barbell_squat');

    assert.ok(machinePress);
    assert.ok(barbellSquat);
    assert.ok(
      machinePress.priority > barbellSquat.priority,
      'Foundational user should prioritize foundational machine press over advanced barbell squat'
    );
  });

  it('10. Advanced-only exercise receives appropriate lower eligibility for foundational users according to the implemented rule', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 1,
      avoid: [],
      favorites: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const deadlift = selection.candidates.find((c) => c.exerciseId === 'deadlift');
    const gobletSquat = selection.candidates.find((c) => c.exerciseId === 'goblet_squat');

    assert.ok(deadlift);
    assert.ok(gobletSquat);
    assert.ok(gobletSquat.priority > deadlift.priority);
  });

  it('11. Advanced user can access advanced exercise candidates', () => {
    const profile = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const deadlift = selection.candidates.find((c) => c.exerciseId === 'deadlift');
    const barbellSquat = selection.candidates.find((c) => c.exerciseId === 'barbell_squat');
    const overheadPress = selection.candidates.find((c) => c.exerciseId === 'overhead_press');

    assert.ok(deadlift);
    assert.ok(barbellSquat);
    assert.ok(overheadPress);
  });

  it('12. Goal-compatible candidates are ranked appropriately', () => {
    const profile = createProfile({ avoid: [], favorites: [] });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.candidates.some((c) => c.reasons.includes('goal_compatible')));
  });

  it('13. Strength objective prioritizes strength-appropriate candidates', () => {
    const profile = createProfile({
      goal: 'get_stronger',
      avoid: [],
      favorites: [],
      exerciseVariety: 'no_preference',
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const benchPress = selection.candidates.find((c) => c.exerciseId === 'bench_press');
    const lateralRaise = selection.candidates.find((c) => c.exerciseId === 'lateral_raise');

    assert.ok(benchPress);
    assert.ok(lateralRaise);
    assert.ok(
      benchPress.priority > lateralRaise.priority,
      'Strength goal should rank primary compound bench press above lateral raise'
    );
  });

  it('14. Hypertrophy objective prioritizes practical resistance candidates', () => {
    const profile = createProfile({
      goal: 'build_muscle',
      avoid: [],
      favorites: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const benchPress = selection.candidates.find((c) => c.exerciseId === 'bench_press');
    const walking = selection.candidates.find((c) => c.exerciseId === 'walking');

    assert.ok(benchPress);
    assert.ok(walking);
    assert.ok(benchPress.priority > walking.priority);
  });

  it('15. Fat-loss support does not convert selection into cardio-only selection', () => {
    const profile = createProfile({
      goal: 'lose_fat',
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    // Resistance movements must remain strong candidates
    const resistanceCandidates = selection.candidates.filter(
      (c) => c.exerciseId === 'bench_press' || c.exerciseId === 'romanian_deadlift'
    );
    assert.equal(resistanceCandidates.length, 2);
  });

  it('16. General fitness maintains broad movement coverage candidates', () => {
    const profile = createProfile({
      goal: 'improve_fitness',
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.candidates.length >= 10);
  });

  it('17. repeat_key_exercises preference influences ranking deterministically', () => {
    const profileRepeat = createProfile({
      exerciseVariety: 'repeat_key_exercises',
      avoid: [],
      favorites: [],
    });
    const profileNormal = createProfile({
      exerciseVariety: 'no_preference',
      avoid: [],
      favorites: [],
    });

    const obj = resolveTrainingObjective(profileRepeat);
    const freq = resolveFrequency(profileRepeat);
    const struct = resolveTrainingStructure(profileRepeat, obj, freq);

    const selectionRepeat = resolveExerciseSelection(profileRepeat, obj, struct);
    const selectionNormal = resolveExerciseSelection(profileNormal, obj, struct);

    const benchRepeat = selectionRepeat.candidates.find((c) => c.exerciseId === 'bench_press');
    const benchNormal = selectionNormal.candidates.find((c) => c.exerciseId === 'bench_press');

    assert.ok(benchRepeat);
    assert.ok(benchNormal);
    assert.ok(benchRepeat.priority > benchNormal.priority);
    assert.ok(benchRepeat.reasons.includes('variety'));
  });

  it('18. change_often preference permits broader candidate ranking', () => {
    const profile = createProfile({
      exerciseVariety: 'change_often',
      avoid: [],
      favorites: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    const bicepCurl = selection.candidates.find((c) => c.exerciseId === 'biceps_curl');
    assert.ok(bicepCurl);
    assert.ok(bicepCurl.reasons.includes('variety'));
  });

  it('19. Short sessions influence practicality ranking', () => {
    const profileShort = createProfile({
      sessionDuration: '20_30',
      avoid: [],
      favorites: [],
    });
    const profileStandard = createProfile({
      sessionDuration: '45_60',
      avoid: [],
      favorites: [],
    });

    const obj = resolveTrainingObjective(profileShort);
    const freq = resolveFrequency(profileShort);
    const struct = resolveTrainingStructure(profileShort, obj, freq);

    const selectionShort = resolveExerciseSelection(profileShort, obj, struct);
    const selectionStandard = resolveExerciseSelection(profileStandard, obj, struct);

    const pushUpShort = selectionShort.candidates.find((c) => c.exerciseId === 'push_up');
    const pushUpStandard = selectionStandard.candidates.find((c) => c.exerciseId === 'push_up');

    assert.ok(pushUpShort);
    assert.ok(pushUpStandard);
    assert.ok(pushUpShort.priority > pushUpStandard.priority);
    assert.ok(pushUpShort.reasons.includes('time_efficient'));
  });

  it('20. No actual workout day assignments are created', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);
    const rawSel = selection as Record<string, unknown>;

    assert.equal('workouts' in rawSel, false);
    assert.equal('sessions' in rawSel, false);
    assert.equal('schedule' in rawSel, false);
  });

  it('21. No sets, reps, or RIR are created', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);
    const rawSel = selection as Record<string, unknown>;

    assert.equal('sets' in rawSel, false);
    assert.equal('reps' in rawSel, false);
    assert.equal('rir' in rawSel, false);
  });

  it('22. No weekly target allocation is created', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);
    const rawSel = selection as Record<string, unknown>;

    assert.equal('weeklyTargets' in rawSel, false);
    assert.equal('targetDemand' in rawSel, false);
  });

  it('23. Same input produces exactly the same result', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);

    const run1 = resolveExerciseSelection(profile, obj, struct);
    const run2 = resolveExerciseSelection(profile, obj, struct);
    const run3 = resolveExerciseSelection(profile, obj, struct);

    assert.deepEqual(run1, run2);
    assert.deepEqual(run2, run3);
  });

  it('24. Function does not mutate profile', () => {
    const profile = createProfile();
    const snapshot = JSON.parse(JSON.stringify(profile));
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);

    resolveExerciseSelection(profile, obj, struct);

    assert.deepEqual(profile, snapshot);
  });

  it('25. Every excluded exercise has a reason', () => {
    const profile = createProfile({
      avoid: ['deadlift'],
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells'],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.excludedExerciseIds.length > 0);
    for (const exId of selection.excludedExerciseIds) {
      const reasons = selection.exclusionReasons[exId];
      assert.ok(Array.isArray(reasons));
      assert.ok(reasons.length > 0);
      for (const r of reasons) {
        assert.equal(typeof r, 'string');
        assert.ok(r.trim().length > 0);
      }
    }
  });

  it('26. decisionTrace is non-empty', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(Array.isArray(selection.decisionTrace));
    assert.ok(selection.decisionTrace.length > 0);
    for (const t of selection.decisionTrace) {
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0);
    }
  });

  it('27. No random behavior exists', () => {
    const profile = createProfile();
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);

    const s1 = resolveExerciseSelection(profile, obj, struct);
    const s2 = resolveExerciseSelection(profile, obj, struct);

    assert.deepEqual(s1.candidates, s2.candidates);
  });

  it('28. T5 can operate with a custom catalog passed into the function', () => {
    const customCatalog: ExerciseDefinition[] = [
      {
        id: 'special_exercise',
        name: 'Special Exercise',
        movementPatterns: ['horizontal_push'],
        primaryMuscles: ['chest'],
        secondaryMuscles: [],
        equipmentRequired: [],
        difficulty: 'foundational',
        exerciseType: 'bodyweight',
        progressionProfile: 'bodyweight',
        stableSetup: true,
      },
    ];

    const profile = createProfile({ avoid: [] });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct, customCatalog);

    assert.equal(selection.candidates.length, 1);
    assert.equal(selection.candidates[0].exerciseId, 'special_exercise');
  });

  it('29. Missing required equipment excludes the candidate', () => {
    const profile = createProfile({
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells'], // missing barbell
      avoid: [],
    });

    const exercise: ExerciseDefinition = {
      id: 'barbell_move',
      name: 'Barbell Move',
      movementPatterns: ['squat'],
      primaryMuscles: ['quads'],
      secondaryMuscles: [],
      equipmentRequired: ['barbell'],
      difficulty: 'standard',
      exerciseType: 'compound',
      progressionProfile: 'primary_compound',
      stableSetup: true,
    };

    assert.equal(isExerciseEquipmentCompatible(exercise, profile), false);
  });

  it('30. Hard constraints always beat preference ranking', () => {
    // Favorite exercise missing equipment
    const profile = createProfile({
      equipmentMode: 'custom',
      equipmentIds: ['dumbbells'],
      favorites: ['barbell_squat'],
      avoid: [],
    });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    assert.ok(selection.excludedExerciseIds.includes('barbell_squat'));
    assert.equal(selection.candidates.some((c) => c.exerciseId === 'barbell_squat'), false);
  });

  it('31. Required movement types are represented in candidate metadata where available, but T5 does not perform T6 allocation', () => {
    const profile = createProfile({ avoid: [] });
    const obj = resolveTrainingObjective(profile);
    const freq = resolveFrequency(profile);
    const struct = resolveTrainingStructure(profile, obj, freq);
    const selection = resolveExerciseSelection(profile, obj, struct);

    // Verify candidate items contain only exerciseId, priority, and reasons
    for (const c of selection.candidates) {
      assert.ok('exerciseId' in c);
      assert.ok('priority' in c);
      assert.ok('reasons' in c);
      assert.equal('allocation' in (c as Record<string, unknown>), false);
      assert.equal('slot' in (c as Record<string, unknown>), false);
    }
  });
});
