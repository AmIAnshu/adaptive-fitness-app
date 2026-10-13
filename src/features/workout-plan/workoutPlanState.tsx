/**
 * Workout Plan In-Memory State Manager (Stage W5.1)
 *
 * Provides an app-level, in-memory store and React context for managing
 * the active, real generated WorkoutPlan across onboarding, plan overview,
 * and the W4.2 workout player.
 *
 * INVARIANTS:
 * - Purely in-memory; no external databases or network calls.
 * - Non-mutating; updates replace the plan reference immutably.
 * - Provides both React Hook access (useWorkoutPlan) and module-level
 *   singleton access (getSharedWorkoutPlan) for zero-latency lookups.
 * - Isolated from the development fixture (devFixture.ts).
 */

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import type { WorkoutPlan, WorkoutSession } from './types';
import type { WorkoutPlanGenerationResult } from './workoutPlanGenerator';
import { defaultWorkoutHistoryRepository } from '../workout-history/localRepository';

// ============================================================================
// MODULE-LEVEL IN-MEMORY STORE (Singleton for zero-latency/cross-context access)
// ============================================================================

let _sharedPlan: WorkoutPlan | null = null;
let _sharedResult: WorkoutPlanGenerationResult | null = null;

export function setSharedWorkoutPlan(
  plan: WorkoutPlan | null,
  result: WorkoutPlanGenerationResult | null = null
): void {
  _sharedPlan = plan;
  _sharedResult = result;
}

export function getSharedWorkoutPlan(): WorkoutPlan | null {
  return _sharedPlan;
}

export function getSharedWorkoutPlanResult(): WorkoutPlanGenerationResult | null {
  return _sharedResult;
}

export function getSharedWorkoutSession(sessionId?: string): WorkoutSession | undefined {
  if (!_sharedPlan || !_sharedPlan.sessions || _sharedPlan.sessions.length === 0) {
    return undefined;
  }
  if (!sessionId || sessionId === 'first' || sessionId === 'session_1') {
    return _sharedPlan.sessions[0];
  }
  return _sharedPlan.sessions.find((s) => s.sessionId === sessionId);
}

export function clearSharedWorkoutPlan(): void {
  _sharedPlan = null;
  _sharedResult = null;
}

// ============================================================================
// REACT CONTEXT & PROVIDER
// ============================================================================

export type WorkoutPlanContextValue = {
  activePlan: WorkoutPlan | null;
  generationResult: WorkoutPlanGenerationResult | null;
  isHydrating: boolean;
  setActivePlan: (plan: WorkoutPlan | null) => void;
  setGenerationResult: (result: WorkoutPlanGenerationResult | null) => void;
  setPlanAndResult: (plan: WorkoutPlan | null, result: WorkoutPlanGenerationResult | null) => void;
  getSession: (sessionId?: string) => WorkoutSession | undefined;
  getAllSessions: () => WorkoutSession[];
  clearPlan: () => void;
};

const WorkoutPlanContext = createContext<WorkoutPlanContextValue | null>(null);

export function WorkoutPlanProvider({ children }: { children: ReactNode }) {
  const [activePlan, setActivePlanState] = useState<WorkoutPlan | null>(_sharedPlan);
  const [generationResult, setGenerationResultState] = useState<WorkoutPlanGenerationResult | null>(_sharedResult);
  const [isHydrating, setIsHydrating] = useState<boolean>(true);

  // Hydrate activePlan from local repository on startup
  useEffect(() => {
    let isMounted = true;
    defaultWorkoutHistoryRepository
      .loadActivePlan()
      .then((persistedPlan) => {
        if (!isMounted) return;
        if (persistedPlan && !_sharedPlan) {
          setActivePlanState(persistedPlan);
          _sharedPlan = persistedPlan;
        }
      })
      .catch((err) => {
        console.warn('[WorkoutPlanProvider] Failed to hydrate persisted plan:', err);
      })
      .finally(() => {
        if (isMounted) setIsHydrating(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setActivePlan = useCallback((plan: WorkoutPlan | null) => {
    setActivePlanState(plan);
    _sharedPlan = plan;
    defaultWorkoutHistoryRepository.saveActivePlan(plan).catch((err) => {
      console.warn('[WorkoutPlanProvider] Failed to persist active plan:', err);
    });
  }, []);

  const setGenerationResult = useCallback((result: WorkoutPlanGenerationResult | null) => {
    setGenerationResultState(result);
    _sharedResult = result;
  }, []);

  const setPlanAndResult = useCallback((plan: WorkoutPlan | null, result: WorkoutPlanGenerationResult | null) => {
    setActivePlanState(plan);
    setGenerationResultState(result);
    setSharedWorkoutPlan(plan, result);
    defaultWorkoutHistoryRepository.saveActivePlan(plan).catch((err) => {
      console.warn('[WorkoutPlanProvider] Failed to persist active plan:', err);
    });
  }, []);

  const clearPlan = useCallback(() => {
    setActivePlanState(null);
    setGenerationResultState(null);
    clearSharedWorkoutPlan();
    defaultWorkoutHistoryRepository.saveActivePlan(null).catch((err) => {
      console.warn('[WorkoutPlanProvider] Failed to clear persisted plan:', err);
    });
  }, []);

  const getSession = useCallback(
    (sessionId?: string): WorkoutSession | undefined => {
      const plan = activePlan ?? _sharedPlan;
      if (!plan || !plan.sessions || plan.sessions.length === 0) {
        return undefined;
      }
      if (!sessionId || sessionId === 'first' || sessionId === 'session_1') {
        return plan.sessions[0];
      }
      return plan.sessions.find((s) => s.sessionId === sessionId);
    },
    [activePlan]
  );

  const getAllSessions = useCallback((): WorkoutSession[] => {
    const plan = activePlan ?? _sharedPlan;
    return plan?.sessions ?? [];
  }, [activePlan]);

  const value = useMemo<WorkoutPlanContextValue>(
    () => ({
      activePlan,
      generationResult,
      isHydrating,
      setActivePlan,
      setGenerationResult,
      setPlanAndResult,
      getSession,
      getAllSessions,
      clearPlan,
    }),
    [activePlan, generationResult, isHydrating, setActivePlan, setGenerationResult, setPlanAndResult, getSession, getAllSessions, clearPlan]
  );

  return (
    <WorkoutPlanContext.Provider value={value}>
      {children}
    </WorkoutPlanContext.Provider>
  );
}

export function useWorkoutPlan(): WorkoutPlanContextValue {
  const context = useContext(WorkoutPlanContext);
  if (!context) {
    // Graceful fallback for non-provider components/tests
    return {
      activePlan: _sharedPlan,
      generationResult: _sharedResult,
      isHydrating: false,
      setActivePlan: (p) => setSharedWorkoutPlan(p),
      setGenerationResult: (r) => { _sharedResult = r; },
      setPlanAndResult: (p, r) => setSharedWorkoutPlan(p, r),
      getSession: getSharedWorkoutSession,
      getAllSessions: () => _sharedPlan?.sessions ?? [],
      clearPlan: clearSharedWorkoutPlan,
    };
  }
  return context;
}
