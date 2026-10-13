/**
 * T7 — Progression Strategy
 *
 * Deterministically establishes HOW training progressions, plateaus, and regressions
 * are evaluated and updated over time based on objective, programming complexity,
 * effort boundaries, exercise progression profiles, and workout performance feedback.
 *
 * DESIGN INVARIANTS:
 * 1. T7 is NOT a workout generator:
 *    - Does NOT output exact sets, reps, load increments, weights, calendar days, or RIR prescriptions.
 * 2. Autoregulation & Uncertainty:
 *    - Missing feedback is explicitly handled and never assumed to be perfect performance.
 *    - Progression decisions require repeated evidence; single anomalous workouts do not trigger plateaus.
 * 3. Scope & Safety:
 *    - Does NOT make medical or injury diagnoses.
 *    - Does NOT perform independent recovery deloads (reserved for T9).
 * 4. Pure, deterministic, non-mutating, zero dependencies.
 */

import type { CanonicalUserProfile } from '../profile';
import type {
  ResolvedObjective,
  TrainingStructure,
  TrainingLoadStrategy,
  ProgressionMethod,
  ProgressionStrategy,
} from './types';
import type {
  ExerciseProgressionProfile,
  ExerciseDefinition,
} from './exerciseCatalog';
import type { ComprehensiveTrainingDemandAllocation } from './trainingDemand';

export type PlateauState = 'none' | 'possible' | 'confirmed';

export type PerformanceTrend = 'improving' | 'stable' | 'declining' | 'uncertain';

export type ExecutionQuality = 'clean' | 'acceptable' | 'degraded' | 'unreported';

export type ExercisePerformanceFeedback = {
  exerciseId: string;
  completed: boolean;
  targetRepsAchieved?: boolean;
  perceivedEffortRIR?: number;
  executionQuality?: ExecutionQuality;
  isSubstituted?: boolean;
};

export type ExercisePerformanceHistoryEntry = {
  sessionTimestamp?: number;
  feedback: ExercisePerformanceFeedback;
};

export type ProgressionDecisionOutcome =
  | 'progress'
  | 'maintain'
  | 'repeat'
  | 'regress'
  | 'pause_progression';

export type ExerciseProgressionPlan = {
  exerciseId: string;
  method: ProgressionMethod;
  rationale: string;
};

export type EvaluatedPerformanceOutcome = {
  exerciseId: string;
  decision: ProgressionDecisionOutcome;
  progressionPaused: boolean;
  regressionReason?: string;
  plateauState: PlateauState;
  trend: PerformanceTrend;
  rationale: string;
};

export type ComprehensiveProgressionStrategy = ProgressionStrategy & {
  exerciseProgressionPlans: ExerciseProgressionPlan[];
  plateauPolicy: {
    detectionWindowSessions: number;
    confirmedThresholdSessions: number;
    actionOnPossible: string;
    actionOnConfirmed: string;
  };
  regressionPolicy: {
    declineThresholdSessions: number;
    actionOnRegression: string;
  };
};

/**
 * Resolves the primary progression method based on training objective,
 * programming complexity, and starting workload.
 */
function resolvePrimaryProgressionMethod(
  objective: ResolvedObjective,
  structure: TrainingStructure,
  load: TrainingLoadStrategy
): { method: ProgressionMethod; reason: string } {
  const { programmingComplexity } = structure;
  const primaryGoal = objective.primary;

  // Foundational trainees always use conservative progression
  if (programmingComplexity === 'foundational') {
    return {
      method: 'conservative_progression',
      reason:
        'Foundational programming complexity prioritizes technical consistency and conservative progression before escalating demand.',
    };
  }

  // Objective-based mapping for standard and advanced
  if (primaryGoal === 'strength') {
    return {
      method: 'load_progression',
      reason:
        'Strength objective prioritizes structured load progression on key movement patterns with repeated exposure.',
    };
  }

  if (primaryGoal === 'hypertrophy') {
    return {
      method: 'double_progression',
      reason:
        'Hypertrophy objective leverages double progression (advancing reps within target range prior to increasing resistance).',
    };
  }

  if (primaryGoal === 'fat_loss_support') {
    return {
      method: 'conservative_progression',
      reason:
        'Fat loss support emphasizes performance preservation and consistent stimulus over aggressive progression.',
    };
  }

  if (primaryGoal === 'body_composition') {
    return {
      method: 'double_progression',
      reason:
        'Body composition objective utilizes double progression to sustain muscular stimulus and progressive overload.',
    };
  }

  // General fitness
  return {
    method: 'performance_progression',
    reason:
      'General fitness objective emphasizes broad performance progression and movement execution quality.',
  };
}

/**
 * Assigns exercise-specific progression methods based on exercise progression profiles and roles.
 */
function resolveExerciseSpecificProgression(
  demandAllocation: ComprehensiveTrainingDemandAllocation,
  baseMethod: ProgressionMethod
): ExerciseProgressionPlan[] {
  const plans: ExerciseProgressionPlan[] = [];
  const processedExerciseIds = new Set<string>();

  for (const session of demandAllocation.sessions) {
    for (const allocated of session.allocatedExercises) {
      if (processedExerciseIds.has(allocated.exerciseId)) {
        continue;
      }
      processedExerciseIds.add(allocated.exerciseId);

      let method: ProgressionMethod = baseMethod;
      let rationale = `Inherits baseline strategy method (${baseMethod}).`;

      // Role and movement profile specialization
      if (allocated.role === 'accessory') {
        method = 'double_progression';
        rationale = 'Accessory and isolation exercises prioritize repetition double progression before load.';
      } else if (allocated.role === 'primary' && baseMethod === 'load_progression') {
        method = 'load_progression';
        rationale = 'Primary compound exercise utilizes structured load progression.';
      }

      plans.push({
        exerciseId: allocated.exerciseId,
        method,
        rationale,
      });
    }
  }

  return plans;
}

/**
 * Evaluates exercise performance feedback across history to deterministically
 * compute progression outcome, plateau status, and performance trend.
 *
 * @param currentFeedback - Current session performance feedback
 * @param recentHistory - Recent chronological performance history entries (most recent last)
 * @returns EvaluatedPerformanceOutcome
 */
export function evaluateExercisePerformance(
  currentFeedback: ExercisePerformanceFeedback,
  recentHistory: readonly ExercisePerformanceHistoryEntry[] = []
): EvaluatedPerformanceOutcome {
  const { exerciseId, completed, targetRepsAchieved, perceivedEffortRIR, executionQuality, isSubstituted } =
    currentFeedback;

  // 1. Exercise substitution: reset/re-establish baseline
  if (isSubstituted) {
    return {
      exerciseId,
      decision: 'maintain',
      progressionPaused: false,
      plateauState: 'none',
      trend: 'uncertain',
      rationale: 'Exercise was substituted; re-establishing new performance baseline before evaluating progression.',
    };
  }

  // 2. Incomplete session / exercise abandoned
  if (!completed) {
    return {
      exerciseId,
      decision: 'repeat',
      progressionPaused: false,
      plateauState: 'none',
      trend: 'declining',
      rationale: 'Exercise was incomplete; repeat target at current baseline without progression.',
    };
  }

  // 3. Technique / execution degradation: do NOT reward with progression
  if (executionQuality === 'degraded') {
    return {
      exerciseId,
      decision: 'maintain',
      progressionPaused: false,
      plateauState: 'none',
      trend: 'declining',
      rationale: 'Technique quality degraded; progression halted to prioritize execution mastery.',
    };
  }

  // 4. Missing performance data: conservative maintain
  if (targetRepsAchieved === undefined) {
    return {
      exerciseId,
      decision: 'maintain',
      progressionPaused: false,
      plateauState: 'none',
      trend: 'uncertain',
      rationale: 'Repetition feedback not recorded; conservative maintain applied without assuming success.',
    };
  }

  // 5. Evaluate history for plateaus and regression
  // Look back at recent sessions
  const missedCount = recentHistory.filter(
    (h) => h.feedback.targetRepsAchieved === false || h.feedback.completed === false
  ).length + (targetRepsAchieved ? 0 : 1);

  const degradedCount = recentHistory.filter(
    (h) => h.feedback.executionQuality === 'degraded'
  ).length;

  // Repeated performance decline (at least 3 missed or 2 degraded sessions in recent history)
  if (missedCount >= 3 || degradedCount >= 2) {
    const regressionReason = `Repeated performance decline detected (${missedCount} misses, ${degradedCount} degraded execution sessions); progression paused.`;
    return {
      exerciseId,
      decision: 'regress',
      progressionPaused: true,
      regressionReason,
      plateauState: 'confirmed',
      trend: 'declining',
      rationale: `Regression signaled: ${regressionReason} Does not directly modify training demand or execute deloads.`,
    };
  }

  // Stagnation / missed target in current session
  if (!targetRepsAchieved) {
    const isPossiblePlateau = missedCount === 2;
    return {
      exerciseId,
      decision: 'repeat',
      progressionPaused: false,
      plateauState: isPossiblePlateau ? 'possible' : 'none',
      trend: isPossiblePlateau ? 'stable' : 'uncertain',
      rationale: isPossiblePlateau
        ? 'Target missed in consecutive sessions; possible plateau flagged, repeat target.'
        : 'Target reps not achieved; repeat current baseline.',
    };
  }

  // 6. Successful performance
  // If RIR was provided and was below 1 (overshot target effort dangerously)
  if (perceivedEffortRIR !== undefined && perceivedEffortRIR < 1) {
    return {
      exerciseId,
      decision: 'maintain',
      progressionPaused: false,
      plateauState: 'none',
      trend: 'stable',
      rationale: 'Target reps achieved but effort exceeded safety boundary (<1 RIR); maintain target.',
    };
  }

  return {
    exerciseId,
    decision: 'progress',
    progressionPaused: false,
    plateauState: 'none',
    trend: 'improving',
    rationale: 'Target reps and execution criteria successfully met; eligible for progression.',
  };
}

/**
 * Resolves the deterministic Progression Strategy given user profile,
 * objective, structure, load, and allocated training demand.
 *
 * @param profile - Validated canonical user profile
 * @param objective - Resolved objective from T1
 * @param structure - Resolved structure from T3
 * @param load - Resolved load from T4
 * @param demandAllocation - Allocated demand from T6
 * @returns ComprehensiveProgressionStrategy
 */
export function resolveProgressionStrategy(
  profile: CanonicalUserProfile,
  objective: ResolvedObjective,
  structure: TrainingStructure,
  load: TrainingLoadStrategy,
  demandAllocation: ComprehensiveTrainingDemandAllocation
): ComprehensiveProgressionStrategy {
  const { method, reason: primaryReason } = resolvePrimaryProgressionMethod(
    objective,
    structure,
    load
  );

  const exerciseProgressionPlans = resolveExerciseSpecificProgression(
    demandAllocation,
    method
  );

  const decisionTrace: string[] = [
    `Primary objective: ${objective.primary}`,
    `Programming complexity: ${structure.programmingComplexity}`,
    `Baseline progression method: ${method}`,
    primaryReason,
    `Exercise progression plans generated: ${exerciseProgressionPlans.length}`,
    'Plateau policy window: 3 consecutive stagnant sessions',
    'Regression policy window: 3 consecutive misses or 2 degraded execution sessions',
    'Performance feedback evaluation: active and autoregulated',
  ];

  return {
    method,
    performanceCriteria: {
      requiresTargetReps: true,
      requiresEffortWithinRange: true,
      requiredSuccessfulExposures: structure.programmingComplexity === 'foundational' ? 2 : 1,
    },
    decisions: {
      progress: 'Advance progression target when repetitions and technique quality criteria are satisfied.',
      maintain: 'Maintain current target if performance is stable, data is missing, or effort boundary was overshot.',
      regress: 'Signal regression and pause progression if 3 consecutive misses or repeated technique degradation occurs (does not modify demand or execute deloads).',
    },
    stallPolicy: {
      detectionWindow: 3,
      enabled: true,
    },
    exerciseProgressionPlans,
    plateauPolicy: {
      detectionWindowSessions: 3,
      confirmedThresholdSessions: 3,
      actionOnPossible: 'Maintain progression target and observe next session execution.',
      actionOnConfirmed: 'Pause progression, flag plateau, and consider rep/load strategy variation.',
    },
    regressionPolicy: {
      declineThresholdSessions: 3,
      actionOnRegression: 'Pause progression and signal regression; does not directly alter training demand or make recovery deload decisions.',
    },
    decisionTrace,
  };
}
