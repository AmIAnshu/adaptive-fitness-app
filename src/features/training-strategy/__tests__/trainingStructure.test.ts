/**
 * T3 — Training Structure Test Suite
 *
 * Verifies all 24 required invariants:
 * 1. 2-day foundational user -> full_body.
 * 2. 2-day advanced user -> full_body.
 * 3. 3-day foundational user -> full_body.
 * 4. 3-day standard user -> full_body.
 * 5. 3-day advanced user -> full_body or hybrid according to the implemented deterministic rule.
 * 6. 4-day standard user -> upper_lower.
 * 7. 4-day foundational user uses only an allowed simple structure.
 * 8. 5-day standard user uses upper_lower or hybrid.
 * 9. 5-day advanced user can resolve to hybrid or specialization.
 * 10. 6-day foundational user does NOT automatically become PPL.
 * 11. 6-day standard user may resolve to upper_lower or ppl.
 * 12. 6-day advanced user may resolve to ppl, upper_lower, or specialization.
 * 13. Advanced requires substantial experience plus strong consistency and confidence signals.
 * 14. Beginner/low-confidence user does not become advanced because of high frequency.
 * 15. sessionsPerCycle equals frequency.targetDays.
 * 16. Same profile + objective + frequency produces exactly the same result.
 * 17. Function does not mutate the profile.
 * 18. Every result has a non-empty deterministic decisionTrace.
 * 19. T3 does not create exercise IDs.
 * 20. T3 does not create workout assignments.
 * 21. T3 does not create sets, reps, or RIR values.
 * 22. Flexible sequence remains represented only through structure/trace; no weekday assignments are created.
 * 23. Short session duration favors simpler structure according to the implemented rule.
 * 24. Longer session duration does not by itself make a user advanced.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalUserProfile, DayOfWeek } from '../../profile';
import { buildCanonicalUserProfile } from '../../profile';
import type { OnboardingData } from '../../onboarding/onboardingState';
import { resolveTrainingObjective } from '../goalResolution';
import { resolveFrequency } from '../frequencyResolution';
import { resolveTrainingStructure } from '../trainingStructure';

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
    equipmentIds: ['barbell', 'dumbbells', 'cable_machine', 'bench'],
    customEquipments: [],
    preferredStyle: 'hypertrophy',
    preferredEffort: 'hard',
    volumePreference: 'balanced',
    exerciseVariety: 'repeat_key_exercises',
    favorites: ['bench_press'],
    dislikes: ['burpees'],
    avoid: ['behind_neck_press'],
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

describe('T3 — Training Structure', () => {
  it('1. 2-day foundational user -> full_body', () => {
    const profile = createProfile({
      idealTrainingDays: 2,
      realisticMinimumDays: 2,
      availableDays: ['tue', 'fri'],
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 1,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'foundational');
    assert.equal(structure.splitFamily, 'full_body');
    assert.equal(structure.sessionsPerCycle, 2);
  });

  it('2. 2-day advanced user -> full_body', () => {
    const profile = createProfile({
      idealTrainingDays: 2,
      realisticMinimumDays: 2,
      availableDays: ['mon', 'thu'],
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'advanced');
    assert.equal(structure.splitFamily, 'full_body');
    assert.equal(structure.sessionsPerCycle, 2);
  });

  it('3. 3-day foundational user -> full_body', () => {
    const profile = createProfile({
      idealTrainingDays: 3,
      realisticMinimumDays: 2,
      availableDays: ['mon', 'wed', 'fri'],
      trainingHistory: 'never',
      consistency: 'rarely',
      exerciseConfidence: 1,
      programmingConfidence: 1,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'foundational');
    assert.equal(structure.splitFamily, 'full_body');
    assert.equal(structure.sessionsPerCycle, 3);
  });

  it('4. 3-day standard user -> full_body', () => {
    const profile = createProfile({
      idealTrainingDays: 3,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'wed', 'fri'],
      trainingHistory: '6_to_12_months',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'standard');
    assert.equal(structure.splitFamily, 'full_body');
    assert.equal(structure.sessionsPerCycle, 3);
  });

  it('5. 3-day advanced user -> full_body or hybrid according to the implemented deterministic rule', () => {
    // 3-day advanced with moderate duration -> full_body
    const profileStandardDuration = createProfile({
      idealTrainingDays: 3,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'wed', 'fri'],
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '45_60',
    });
    const obj1 = resolveTrainingObjective(profileStandardDuration);
    const freq1 = resolveFrequency(profileStandardDuration);
    const struct1 = resolveTrainingStructure(profileStandardDuration, obj1, freq1);
    assert.equal(struct1.splitFamily, 'full_body');

    // 3-day advanced with long duration and hypertrophy -> hybrid
    const profileLongDuration = createProfile({
      idealTrainingDays: 3,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'wed', 'fri'],
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
      sessionDuration: '60_75',
      goal: 'build_muscle',
    });
    const obj2 = resolveTrainingObjective(profileLongDuration);
    const freq2 = resolveFrequency(profileLongDuration);
    const struct2 = resolveTrainingStructure(profileLongDuration, obj2, freq2);
    assert.equal(struct2.splitFamily, 'hybrid');
  });

  it('6. 4-day standard user -> upper_lower', () => {
    const profile = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'tue', 'thu', 'fri'],
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'standard');
    assert.equal(structure.splitFamily, 'upper_lower');
    assert.equal(structure.sessionsPerCycle, 4);
  });

  it('7. 4-day foundational user uses only an allowed simple structure', () => {
    const profile = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'tue', 'thu', 'fri'],
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 1,
      sessionDuration: '45_60',
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'foundational');
    assert.ok(
      structure.splitFamily === 'upper_lower' || structure.splitFamily === 'full_body',
      `Expected upper_lower or full_body, got ${structure.splitFamily}`
    );
  });

  it('8. 5-day standard user uses upper_lower or hybrid', () => {
    const profile = createProfile({
      idealTrainingDays: 5,
      realisticMinimumDays: 4,
      availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
      trainingHistory: '6_to_12_months',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'standard');
    assert.ok(
      structure.splitFamily === 'upper_lower' || structure.splitFamily === 'hybrid',
      `Expected upper_lower or hybrid, got ${structure.splitFamily}`
    );
  });

  it('9. 5-day advanced user can resolve to hybrid or specialization', () => {
    // Advanced 5-day with hypertrophy + 60+ min
    const profile = createProfile({
      idealTrainingDays: 5,
      realisticMinimumDays: 4,
      availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 4,
      sessionDuration: '60_75',
      goal: 'build_muscle',
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'advanced');
    assert.ok(
      structure.splitFamily === 'hybrid' || structure.splitFamily === 'specialization',
      `Expected hybrid or specialization, got ${structure.splitFamily}`
    );
  });

  it('10. 6-day foundational user does NOT automatically become PPL', () => {
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      trainingHistory: 'never',
      consistency: 'rarely',
      exerciseConfidence: 1,
      programmingConfidence: 1,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'foundational');
    assert.notEqual(structure.splitFamily, 'ppl', 'Foundational user must not receive PPL split');
    assert.ok(structure.splitFamily === 'upper_lower' || structure.splitFamily === 'full_body');
  });

  it('11. 6-day standard user may resolve to upper_lower or ppl', () => {
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      trainingHistory: '1_to_2_years',
      consistency: 'mostly_consistent',
      exerciseConfidence: 3,
      programmingConfidence: 3,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'standard');
    assert.ok(
      structure.splitFamily === 'upper_lower' || structure.splitFamily === 'ppl',
      `Expected upper_lower or ppl, got ${structure.splitFamily}`
    );
  });

  it('12. 6-day advanced user may resolve to ppl, upper_lower, or specialization', () => {
    const profile = createProfile({
      idealTrainingDays: 6,
      realisticMinimumDays: 5,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 5,
    });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);
    const structure = resolveTrainingStructure(profile, objective, frequency);

    assert.equal(structure.programmingComplexity, 'advanced');
    assert.ok(
      ['ppl', 'upper_lower', 'specialization'].includes(structure.splitFamily),
      `Expected ppl, upper_lower, or specialization, got ${structure.splitFamily}`
    );
  });

  it('13. Advanced requires substantial experience plus strong consistency and confidence signals', () => {
    // Missing only consistency
    const p1 = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'mostly_consistent', // not very_consistent
      exerciseConfidence: 5,
      programmingConfidence: 5,
    });
    assert.equal(
      resolveTrainingStructure(p1, resolveTrainingObjective(p1), resolveFrequency(p1)).programmingComplexity,
      'standard'
    );

    // Missing only programming confidence
    const p2 = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 5,
      programmingConfidence: 3, // < 4
    });
    assert.equal(
      resolveTrainingStructure(p2, resolveTrainingObjective(p2), resolveFrequency(p2)).programmingComplexity,
      'standard'
    );

    // Has all 4 criteria
    const p3 = createProfile({
      trainingHistory: '2_plus_years',
      consistency: 'very_consistent',
      exerciseConfidence: 4,
      programmingConfidence: 4,
    });
    assert.equal(
      resolveTrainingStructure(p3, resolveTrainingObjective(p3), resolveFrequency(p3)).programmingComplexity,
      'advanced'
    );
  });

  it('14. Beginner/low-confidence user does not become advanced because of high frequency', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'rarely',
      exerciseConfidence: 2,
      programmingConfidence: 1,
      idealTrainingDays: 6,
      realisticMinimumDays: 6,
      availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    });
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );

    assert.equal(structure.programmingComplexity, 'foundational');
  });

  it('15. sessionsPerCycle equals frequency.targetDays', () => {
    const testFrequencies = [2, 3, 4, 5, 6];

    const daySequence: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    for (const days of testFrequencies) {
      const allDays: DayOfWeek[] = daySequence.slice(0, days);
      const profile = createProfile({
        idealTrainingDays: days as 2 | 3 | 4 | 5 | 6,
        realisticMinimumDays: Math.min(days, 3) as 1 | 2 | 3,
        availableDays: allDays,
      });
      const frequency = resolveFrequency(profile);
      const structure = resolveTrainingStructure(profile, resolveTrainingObjective(profile), frequency);

      assert.equal(structure.sessionsPerCycle, frequency.targetDays);
    }
  });

  it('16. Same profile + objective + frequency produces exactly the same result (determinism)', () => {
    const profile = createProfile({ idealTrainingDays: 4 });
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);

    const run1 = resolveTrainingStructure(profile, objective, frequency);
    const run2 = resolveTrainingStructure(profile, objective, frequency);
    const run3 = resolveTrainingStructure(profile, objective, frequency);

    assert.deepEqual(run1, run2);
    assert.deepEqual(run2, run3);
  });

  it('17. Function does not mutate the profile', () => {
    const profile = createProfile({ idealTrainingDays: 4 });
    const snapshot = JSON.parse(JSON.stringify(profile));
    const objective = resolveTrainingObjective(profile);
    const frequency = resolveFrequency(profile);

    resolveTrainingStructure(profile, objective, frequency);

    assert.deepEqual(profile, snapshot);
  });

  it('18. Every result has a non-empty deterministic decisionTrace', () => {
    const profile = createProfile();
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );

    assert.ok(Array.isArray(structure.decisionTrace));
    assert.ok(structure.decisionTrace.length >= 4);
    for (const t of structure.decisionTrace) {
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0);
    }
  });

  it('19. T3 does not create exercise IDs', () => {
    const profile = createProfile();
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );
    const structObj = structure as Record<string, unknown>;

    assert.equal('exerciseIds' in structObj, false);
    assert.equal('exercises' in structObj, false);
  });

  it('20. T3 does not create workout assignments', () => {
    const profile = createProfile();
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );
    const structObj = structure as Record<string, unknown>;

    assert.equal('workouts' in structObj, false);
    assert.equal('sessions' in structObj, false);
    assert.equal('schedule' in structObj, false);
  });

  it('21. T3 does not create sets, reps, or RIR values', () => {
    const profile = createProfile();
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );
    const structObj = structure as Record<string, unknown>;

    assert.equal('sets' in structObj, false);
    assert.equal('reps' in structObj, false);
    assert.equal('rir' in structObj, false);
    assert.equal('volume' in structObj, false);
  });

  it('22. Flexible sequence remains represented only through structure/trace; no weekday assignments are created', () => {
    const profile = createProfile({ scheduleFlexibility: 'often_changes' });
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );

    assert.ok(structure.decisionTrace.some((t) => t.includes('flexible_sequence')));
    assert.ok(structure.decisionTrace.some((t) => t.includes('independent of fixed weekdays')));
    const structObj = structure as Record<string, unknown>;
    assert.equal('weekdayAssignments' in structObj, false);
  });

  it('23. Short session duration favors simpler structure according to the implemented rule', () => {
    // 4-day foundational user with short session (20_30) -> full_body
    const profileShort = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'tue', 'thu', 'fri'],
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 2,
      sessionDuration: '20_30',
    });
    const structShort = resolveTrainingStructure(
      profileShort,
      resolveTrainingObjective(profileShort),
      resolveFrequency(profileShort)
    );
    assert.equal(structShort.splitFamily, 'full_body');

    // 4-day foundational user with standard session (45_60) -> upper_lower
    const profileStandard = createProfile({
      idealTrainingDays: 4,
      realisticMinimumDays: 3,
      availableDays: ['mon', 'tue', 'thu', 'fri'],
      trainingHistory: 'under_3_months',
      consistency: 'sometimes',
      exerciseConfidence: 2,
      programmingConfidence: 2,
      sessionDuration: '45_60',
    });
    const structStandard = resolveTrainingStructure(
      profileStandard,
      resolveTrainingObjective(profileStandard),
      resolveFrequency(profileStandard)
    );
    assert.equal(structStandard.splitFamily, 'upper_lower');
  });

  it('24. Longer session duration does not by itself make a user advanced', () => {
    const profile = createProfile({
      trainingHistory: 'under_3_months',
      consistency: 'rarely',
      exerciseConfidence: 2,
      programmingConfidence: 1,
      sessionDuration: '75_plus',
    });
    const structure = resolveTrainingStructure(
      profile,
      resolveTrainingObjective(profile),
      resolveFrequency(profile)
    );

    assert.equal(structure.programmingComplexity, 'foundational');
  });

  // =========================================================================
  // MILESTONE W5.2 — STRUCTURE PREFERENCE & REFINEMENT
  // =========================================================================

  describe('W5.2 Structure Preference & Precedence Suite', () => {
    // -----------------------------------------------------------------------
    // A. Backward Compatibility
    // -----------------------------------------------------------------------
    it('A.1. Profile without structurePreference defaults cleanly to coach_decides behavior', () => {
      const profile = createProfile({
        idealTrainingDays: 4,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
        trainingHistory: '1_to_2_years',
        consistency: 'mostly_consistent',
        exerciseConfidence: 3,
        programmingConfidence: 3,
      });
      // Delete structurePreference to simulate legacy/missing field
      delete (profile.trainingPreferences as Record<string, unknown>).structurePreference;

      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );

      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.length > 0);
    });

    // -----------------------------------------------------------------------
    // B. Full Body Preference
    // -----------------------------------------------------------------------
    it('B.1. Full body preference: 1 day -> full_body mandatory', () => {
      const profile = createProfile({
        idealTrainingDays: 1,
        realisticMinimumDays: 1,
        availableDays: ['sat'],
        structurePreference: 'full_body',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('honored')));
    });

    it('B.2. Full body preference: 2 days -> full_body mandatory', () => {
      const profile = createProfile({
        idealTrainingDays: 2,
        realisticMinimumDays: 2,
        availableDays: ['tue', 'fri'],
        structurePreference: 'full_body',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('honored')));
    });

    it('B.3. Full body preference: 3 days -> strongly favored and honored', () => {
      const profile = createProfile({
        idealTrainingDays: 3,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'wed', 'fri'],
        structurePreference: 'full_body',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('strongly favored and honored')));
    });

    it('B.4. Full body preference: 4 days -> honored as viable distributed stimulus', () => {
      const profile = createProfile({
        idealTrainingDays: 4,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
        structurePreference: 'full_body',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('honored for 4-day schedule')));
    });

    // -----------------------------------------------------------------------
    // C. Upper / Lower Preference
    // -----------------------------------------------------------------------
    it('C.1. Upper/lower preference: 3 days -> constrained to full_body for feasibility', () => {
      const profile = createProfile({
        idealTrainingDays: 3,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'wed', 'fri'],
        structurePreference: 'upper_lower',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('constrained to full_body')));
    });

    it('C.2. Upper/lower preference: 4 days -> preferred structure', () => {
      const profile = createProfile({
        idealTrainingDays: 4,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
        structurePreference: 'upper_lower',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.some((t) => t.includes('strongly favored and honored')));
    });

    it('C.3. Upper/lower preference: 5 days -> honored', () => {
      const profile = createProfile({
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
        structurePreference: 'upper_lower',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.some((t) => t.includes('honored for 5-day schedule')));
    });

    it('C.4. Upper/lower preference: 6 days -> honored over PPL', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        structurePreference: 'upper_lower',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.some((t) => t.includes('honored for 6-day schedule')));
    });

    // -----------------------------------------------------------------------
    // D. PPL Preference
    // -----------------------------------------------------------------------
    it('D.1. Beginner + 6 days + PPL preference -> constrained to upper_lower (foundational protection)', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: 'under_3_months',
        consistency: 'rarely',
        exerciseConfidence: 2,
        programmingConfidence: 1,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.programmingComplexity, 'foundational');
      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.some((t) => t.includes('constrained because current trainee structure is foundational')));
    });

    it('D.2. Standard + 6 days + PPL preference -> PPL selected', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: '1_to_2_years',
        consistency: 'mostly_consistent',
        exerciseConfidence: 3,
        programmingConfidence: 3,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.programmingComplexity, 'standard');
      assert.equal(structure.splitFamily, 'ppl');
      assert.ok(structure.decisionTrace.some((t) => t.includes('Structure preference: ppl; compatible with 6-day availability and standard experience.')));
    });

    it('D.3. Advanced + 6 days + PPL preference -> PPL selected', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.programmingComplexity, 'advanced');
      assert.equal(structure.splitFamily, 'ppl');
      assert.ok(structure.decisionTrace.some((t) => t.includes('Structure preference: ppl; compatible with 6-day availability and advanced experience.')));
    });

    it('D.4. Advanced + 5 days + PPL preference -> adapted to hybrid split', () => {
      const profile = createProfile({
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'hybrid');
      assert.ok(structure.decisionTrace.some((t) => t.includes('adapted to hybrid split')));
    });

    it('D.5. Advanced + 4 days + PPL preference -> constrained to upper_lower', () => {
      const profile = createProfile({
        idealTrainingDays: 4,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.some((t) => t.includes('constrained to upper_lower')));
    });

    it('D.6. 3 days + PPL preference -> constrained to full_body for feasibility', () => {
      const profile = createProfile({
        idealTrainingDays: 3,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'wed', 'fri'],
        trainingHistory: '1_to_2_years',
        consistency: 'mostly_consistent',
        exerciseConfidence: 4,
        programmingConfidence: 4,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('constrained to full_body')));
    });

    it('D.7. 6 days + short sessions (20_30) + general fitness + PPL preference -> constrained to upper_lower', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: '1_to_2_years',
        consistency: 'mostly_consistent',
        exerciseConfidence: 3,
        programmingConfidence: 3,
        sessionDuration: '20_30',
        goal: 'improve_fitness',
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'upper_lower');
      assert.ok(structure.decisionTrace.some((t) => t.includes('constrained to upper_lower')));
    });

    // -----------------------------------------------------------------------
    // E. Body-Part Focused Preference
    // -----------------------------------------------------------------------
    it('E.1. Body-part focused + 2 days -> constrained to full_body', () => {
      const profile = createProfile({
        idealTrainingDays: 2,
        realisticMinimumDays: 2,
        availableDays: ['mon', 'thu'],
        structurePreference: 'body_part_focused',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'full_body');
      assert.ok(structure.decisionTrace.some((t) => t.includes('constrained because 2-day schedule requires full_body')));
    });

    it('E.2. Body-part focused + 5 days standard -> hybrid selected', () => {
      const profile = createProfile({
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
        trainingHistory: '1_to_2_years',
        consistency: 'mostly_consistent',
        exerciseConfidence: 3,
        programmingConfidence: 3,
        structurePreference: 'body_part_focused',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'hybrid');
      assert.ok(structure.decisionTrace.some((t) => t.includes('selected hybrid within feasible 5-day frequency')));
    });

    it('E.3. Body-part focused + 5 days advanced with long sessions & hypertrophy -> specialization selected', () => {
      const profile = createProfile({
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'body_part_focused',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'specialization');
      assert.ok(structure.decisionTrace.some((t) => t.includes('selected specialization within feasible 5-day frequency and long sessions')));
    });

    it('E.4. Body-part focused + 6 days advanced -> specialization selected', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        sessionDuration: '60_75',
        goal: 'build_muscle',
        structurePreference: 'body_part_focused',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'specialization');
      assert.ok(structure.decisionTrace.some((t) => t.includes('selected specialization within feasible 6-day frequency')));
    });

    // -----------------------------------------------------------------------
    // F. Coach Decides
    // -----------------------------------------------------------------------
    it('F.1. Coach decides preserves baseline T3 selection without bias', () => {
      // 4 days standard -> upper_lower
      const p4 = createProfile({ idealTrainingDays: 4, structurePreference: 'coach_decides' });
      assert.equal(
        resolveTrainingStructure(p4, resolveTrainingObjective(p4), resolveFrequency(p4)).splitFamily,
        'upper_lower'
      );

      // 3 days standard -> full_body
      const p3 = createProfile({
        idealTrainingDays: 3,
        availableDays: ['mon', 'wed', 'fri'],
        structurePreference: 'coach_decides',
      });
      assert.equal(
        resolveTrainingStructure(p3, resolveTrainingObjective(p3), resolveFrequency(p3)).splitFamily,
        'full_body'
      );
    });

    // -----------------------------------------------------------------------
    // G. Objective Interactions
    // -----------------------------------------------------------------------
    it('G.1. Strength objective with 6 days standard + PPL preference produces PPL when feasible', () => {
      const profile = createProfile({
        idealTrainingDays: 6,
        realisticMinimumDays: 5,
        availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        trainingHistory: '1_to_2_years',
        consistency: 'mostly_consistent',
        exerciseConfidence: 4,
        programmingConfidence: 3,
        sessionDuration: '45_60',
        goal: 'get_stronger',
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'ppl');
    });

    it('G.2. Fat loss support with 4 days + upper_lower preference produces upper_lower', () => {
      const profile = createProfile({
        idealTrainingDays: 4,
        realisticMinimumDays: 3,
        availableDays: ['mon', 'tue', 'thu', 'fri'],
        goal: 'lose_fat',
        structurePreference: 'upper_lower',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.equal(structure.splitFamily, 'upper_lower');
    });

    // -----------------------------------------------------------------------
    // H. Red-Team Failure Modes & Invariants
    // -----------------------------------------------------------------------
    it('H.1. Preference does NOT change sets, reps, or RIR on T3 output', () => {
      const profile = createProfile({ structurePreference: 'ppl' });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      const structRecord = structure as unknown as Record<string, unknown>;
      assert.strictEqual('sets' in structRecord, false);
      assert.strictEqual('reps' in structRecord, false);
      assert.strictEqual('rir' in structRecord, false);
      assert.strictEqual('exercises' in structRecord, false);
    });

    it('H.2. Infeasible 2-day schedule never receives PPL even if requested', () => {
      const profile = createProfile({
        idealTrainingDays: 2,
        realisticMinimumDays: 2,
        availableDays: ['mon', 'thu'],
        trainingHistory: '2_plus_years',
        consistency: 'very_consistent',
        exerciseConfidence: 5,
        programmingConfidence: 5,
        structurePreference: 'ppl',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.strictEqual(structure.splitFamily, 'full_body');
    });

    it('H.3. Infeasible 5-day schedule never receives full_body even if requested', () => {
      const profile = createProfile({
        idealTrainingDays: 5,
        realisticMinimumDays: 4,
        availableDays: ['mon', 'tue', 'wed', 'fri', 'sat'],
        structurePreference: 'full_body',
      });
      const structure = resolveTrainingStructure(
        profile,
        resolveTrainingObjective(profile),
        resolveFrequency(profile)
      );
      assert.notEqual(structure.splitFamily, 'full_body');
      assert.strictEqual(structure.splitFamily, 'upper_lower');
    });

    it('H.4. Determinism: identical preference produces identical decisionTrace and split', () => {
      const profile = createProfile({ structurePreference: 'ppl', idealTrainingDays: 6, availableDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
      const obj = resolveTrainingObjective(profile);
      const freq = resolveFrequency(profile);

      const r1 = resolveTrainingStructure(profile, obj, freq);
      const r2 = resolveTrainingStructure(profile, obj, freq);
      assert.deepEqual(r1, r2);
    });
  });
});
