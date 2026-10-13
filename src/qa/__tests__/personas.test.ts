import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QA_PERSONAS, getQAPersona } from '../personas';
import { buildCanonicalUserProfile, validateCanonicalUserProfile } from '../../features/profile';
import { generateWorkoutPlanFromProfile, validateWorkoutPlan } from '../../features/workout-plan';
import { runNutritionStrategyPipeline, validateNutritionStrategy } from '../../features/nutrition';

describe('QA Test Personas Contract Verification', () => {
  for (const [id, persona] of Object.entries(QA_PERSONAS)) {
    it(`persona ${id} builds valid CanonicalUserProfile and produces valid WorkoutPlan`, () => {
      const cloned = getQAPersona(id as any);
      assert.deepEqual(cloned.goal, persona.goal);

      const profile = buildCanonicalUserProfile(cloned);
      const profileValidation = validateCanonicalUserProfile(profile);
      assert.equal(profileValidation.valid, true, `Profile validation errors for ${id}: ${JSON.stringify(profileValidation.errors)}`);

      const genResult = generateWorkoutPlanFromProfile(profile);
      assert.equal(genResult.status, 'success', `Plan generation failed for ${id}`);

      const planValidation = validateWorkoutPlan(genResult.plan);
      assert.equal(planValidation.valid, true, `Plan validation failed for ${id}: ${JSON.stringify(planValidation.errors)}`);
      assert.ok(genResult.plan.sessions.length >= 2, `${id} should have at least 2 sessions`);

      // Verify nutrition pipeline contract for each persona
      const nutResult = runNutritionStrategyPipeline(profile);
      assert.equal(nutResult.status, 'completed', `Nutrition pipeline failed for ${id}`);
      if (nutResult.status === 'completed') {
        const nutValidation = validateNutritionStrategy(nutResult.strategy);
        assert.equal(nutValidation.valid, true, `Nutrition validation failed for ${id}: ${JSON.stringify(nutValidation.errors)}`);
      }
    });
  }

  it('persona D avoids excluded exercises', () => {
    const profile = buildCanonicalUserProfile(QA_PERSONAS.PERSONA_D_EQUIPMENT_RESTRICTED);
    const genResult = generateWorkoutPlanFromProfile(profile);
    assert.equal(genResult.status, 'success');

    for (const session of genResult.plan.sessions) {
      for (const ex of session.exercises) {
        assert.ok(!QA_PERSONAS.PERSONA_D_EQUIPMENT_RESTRICTED.avoid?.includes(ex.exerciseId), `Avoided exercise ${ex.exerciseId} was found`);
      }
    }
  });

  it('persona B produces PPL split family', () => {
    const profile = buildCanonicalUserProfile(QA_PERSONAS.PERSONA_B_ADVANCED_PPL);
    const genResult = generateWorkoutPlanFromProfile(profile);
    assert.equal(genResult.status, 'success');
    assert.equal(genResult.plan.structure.splitFamily, 'ppl');
    assert.equal(genResult.plan.sessions.length, 6);
  });
});
