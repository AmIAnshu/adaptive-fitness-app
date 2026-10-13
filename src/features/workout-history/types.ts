/**
 * Workout History Contracts & Interfaces (Stage W6.1)
 *
 * Strongly-typed contracts for persistent workout history, active executions,
 * and historical session querying.
 *
 * ARCHITECTURAL BOUNDARY:
 * - W6.1 stores and retrieves evidence.
 * - W6.1 does NOT decide progression (T7), deloads (T9), or recovery constraints (T9).
 * - Immutability: Once an execution completes, abandons, or is skipped, it is an immutable factual record.
 */

import type { WorkoutPlan, WorkoutSession } from '../workout-plan';
import type {
  WorkoutExecution,
  WorkoutFeedbackSnapshot,
  SessionExecutionHistorySummary,
  WorkoutExecutionStatus,
} from '../workout-runtime';

/**
 * Storage Schema Version 1
 */
export interface WorkoutHistoryStoreV1 {
  schemaVersion: 1;
  activePlan: WorkoutPlan | null;
  executions: WorkoutExecution[];
  lastUpdatedTimestamp: number;
}

/**
 * Query filters for historical executions
 */
export interface WorkoutHistoryFilter {
  planId?: string;
  sessionId?: string;
  status?: WorkoutExecutionStatus | WorkoutExecutionStatus[];
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
}

/**
 * Workout History Repository Interface
 */
export interface IWorkoutHistoryRepository {
  /**
   * Save or update the active WorkoutPlan.
   * Passing null clears the active plan.
   */
  saveActivePlan(plan: WorkoutPlan | null): Promise<void>;

  /**
   * Load the currently active WorkoutPlan.
   * Returns null if no active plan exists or storage is empty/invalid.
   */
  loadActivePlan(): Promise<WorkoutPlan | null>;

  /**
   * Save or update an in-progress or not-started WorkoutExecution.
   * Validates structure prior to persisting.
   */
  saveActiveExecution(execution: WorkoutExecution): Promise<void>;

  /**
   * Load an in-progress or not-started WorkoutExecution for the given plan and session.
   * If sessionId is omitted, returns the latest in-flight execution if any.
   */
  loadActiveExecution(planId?: string, sessionId?: string): Promise<WorkoutExecution | null>;

  /**
   * Save a completed, abandoned, or skipped WorkoutExecution to history.
   * If an in-progress execution exists with the same executionId, it is transitioned to terminal history.
   */
  saveTerminalExecution(execution: WorkoutExecution): Promise<void>;

  /**
   * Retrieve all executions matching the optional filter, sorted newest to oldest.
   */
  getExecutions(filter?: WorkoutHistoryFilter): Promise<WorkoutExecution[]>;

  /**
   * Retrieve a single execution by its unique executionId.
   */
  getExecutionById(executionId: string): Promise<WorkoutExecution | null>;

  /**
   * Clear all stored history and active plan. (Useful for tests and explicit user resets).
   */
  clearAll(): Promise<void>;
}
