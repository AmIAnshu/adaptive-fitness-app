/**
 * Local Workout History Repository (Stage W6.1)
 *
 * Implements persistent storage for WorkoutPlan and WorkoutExecution history using
 * AsyncStorage on mobile/web, with an automatic in-memory fallback for pure Node/test environments.
 *
 * INVARIANTS & INTEGRITY GUARDS:
 * 1. Schema versioning (WorkoutHistoryStoreV1) for safe future evolution.
 * 2. Writes are queued and serialized via a Promise mutex to prevent race conditions during rapid logs.
 * 3. Validation on save and hydration:
 *    - Validates WorkoutExecution via validateWorkoutExecution() before write and after read.
 *    - Validates WorkoutPlan via validateWorkoutPlan() before write and after read.
 * 4. Fault-tolerant corruption handling:
 *    - Never crashes the host application on malformed JSON or invalid schema.
 *    - Gracefully isolates corrupt records and preserves uncorrupted data.
 * 5. Deterministic, pure updates without Math.random().
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutPlan } from '../workout-plan';
import { validateWorkoutPlan } from '../workout-plan';
import type { WorkoutExecution } from '../workout-runtime';
import { validateWorkoutExecution } from '../workout-runtime';
import type {
  IWorkoutHistoryRepository,
  WorkoutHistoryStoreV1,
  WorkoutHistoryFilter,
} from './types';
import { selectExecutions } from './historySelectors';

export const WORKOUT_HISTORY_STORAGE_KEY = '@adaptive_fitness:workout_history_v1';

/**
 * Serialized Write Mutex Queue
 */
class SerializedQueue {
  private currentPromise: Promise<any> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const nextPromise = this.currentPromise.then(task, task);
    this.currentPromise = nextPromise;
    return nextPromise;
  }
}

/**
 * Check if AsyncStorage is operational in the current runtime environment.
 * In raw Node test runners without mock setups, AsyncStorage native calls may be unavailable.
 */
let _inMemoryStore: string | null = null;

export function setRawStorageItemForTesting(value: string | null): void {
  _inMemoryStore = value;
}

async function rawGetItem(key: string): Promise<string | null> {
  // If in-memory store is explicitly populated or we're in Node environment
  if (typeof window === 'undefined' && typeof navigator === 'undefined') {
    return _inMemoryStore;
  }
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      const val = await AsyncStorage.getItem(key);
      if (val !== undefined && val !== null) return val;
    }
  } catch {
    // Fall back to in-memory store
  }
  return _inMemoryStore;
}

async function rawSetItem(key: string, value: string): Promise<void> {
  _inMemoryStore = value;
  if (typeof window === 'undefined' && typeof navigator === 'undefined') {
    return;
  }
  try {
    if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    // In-memory store already updated
  }
}

async function rawRemoveItem(key: string): Promise<void> {
  _inMemoryStore = null;
  if (typeof window === 'undefined' && typeof navigator === 'undefined') {
    return;
  }
  try {
    if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // In-memory store already cleared
  }
}

/**
 * Concrete Workout History Repository
 */
export class LocalWorkoutHistoryRepository implements IWorkoutHistoryRepository {
  private writeQueue = new SerializedQueue();

  /**
   * Internal reader: retrieves and validates store contents.
   * If corrupted or missing, returns an initialized empty V1 store.
   */
  private async readStore(): Promise<WorkoutHistoryStoreV1> {
    const raw = await rawGetItem(WORKOUT_HISTORY_STORAGE_KEY);
    if (!raw) {
      return {
        schemaVersion: 1,
        activePlan: null,
        executions: [],
        lastUpdatedTimestamp: Date.now(),
      };
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1) {
        console.warn('[WorkoutHistoryRepository] Corrupt or unknown schema version. Resetting store.');
        return {
          schemaVersion: 1,
          activePlan: null,
          executions: [],
          lastUpdatedTimestamp: Date.now(),
        };
      }

      // Validate hydrated activePlan
      let validatedPlan: WorkoutPlan | null = null;
      if (parsed.activePlan) {
        const planResult = validateWorkoutPlan(parsed.activePlan);
        if (planResult.valid) {
          validatedPlan = parsed.activePlan;
        } else {
          console.warn('[WorkoutHistoryRepository] Hydrated plan failed validation:', planResult.errors);
        }
      }

      // Validate hydrated executions; preserve valid ones
      const validExecutions: WorkoutExecution[] = [];
      if (Array.isArray(parsed.executions)) {
        for (const exec of parsed.executions) {
          const execResult = validateWorkoutExecution(exec);
          if (execResult.isValid) {
            validExecutions.push(exec);
          } else {
            console.warn(`[WorkoutHistoryRepository] Discarding invalid execution '${exec?.executionId}':`, execResult.errors);
          }
        }
      }

      return {
        schemaVersion: 1,
        activePlan: validatedPlan,
        executions: validExecutions,
        lastUpdatedTimestamp: typeof parsed.lastUpdatedTimestamp === 'number' ? parsed.lastUpdatedTimestamp : Date.now(),
      };
    } catch (err) {
      console.warn('[WorkoutHistoryRepository] JSON parse failure during readStore. Resetting store.', err);
      return {
        schemaVersion: 1,
        activePlan: null,
        executions: [],
        lastUpdatedTimestamp: Date.now(),
      };
    }
  }

  /**
   * Internal writer: writes validated store contents through rawSetItem.
   */
  private async writeStore(store: WorkoutHistoryStoreV1): Promise<void> {
    const serialized = JSON.stringify(store);
    await rawSetItem(WORKOUT_HISTORY_STORAGE_KEY, serialized);
  }

  /**
   * Save or update the active WorkoutPlan.
   */
  async saveActivePlan(plan: WorkoutPlan | null): Promise<void> {
    if (plan !== null) {
      const validation = validateWorkoutPlan(plan);
      if (!validation.valid) {
        throw new Error(
          `Cannot persist invalid WorkoutPlan: ${validation.errors.map((e) => e.message).join('; ')}`
        );
      }
    }

    return this.writeQueue.enqueue(async () => {
      const store = await this.readStore();
      const updatedStore: WorkoutHistoryStoreV1 = {
        ...store,
        activePlan: plan,
        lastUpdatedTimestamp: Date.now(),
      };
      await this.writeStore(updatedStore);
    });
  }

  /**
   * Load the active WorkoutPlan.
   */
  async loadActivePlan(): Promise<WorkoutPlan | null> {
    const store = await this.readStore();
    return store.activePlan;
  }

  /**
   * Save or update an active/in-progress execution.
   */
  async saveActiveExecution(execution: WorkoutExecution): Promise<void> {
    const validation = validateWorkoutExecution(execution);
    if (!validation.isValid) {
      throw new Error(
        `Cannot persist invalid WorkoutExecution: ${validation.errors.map((e) => e.message).join('; ')}`
      );
    }

    return this.writeQueue.enqueue(async () => {
      const store = await this.readStore();
      const existingIdx = store.executions.findIndex((e) => e.executionId === execution.executionId);

      let nextExecutions: WorkoutExecution[];
      if (existingIdx >= 0) {
        nextExecutions = [
          ...store.executions.slice(0, existingIdx),
          execution,
          ...store.executions.slice(existingIdx + 1),
        ];
      } else {
        // Also check if an active execution for this sessionId exists under another temporary ID and replace it
        const sessionActiveIdx = store.executions.findIndex(
          (e) =>
            e.sessionId === execution.sessionId &&
            (e.status === 'not_started' || e.status === 'in_progress')
        );
        if (sessionActiveIdx >= 0) {
          nextExecutions = [
            ...store.executions.slice(0, sessionActiveIdx),
            execution,
            ...store.executions.slice(sessionActiveIdx + 1),
          ];
        } else {
          nextExecutions = [execution, ...store.executions];
        }
      }

      const updatedStore: WorkoutHistoryStoreV1 = {
        ...store,
        executions: nextExecutions,
        lastUpdatedTimestamp: Date.now(),
      };
      await this.writeStore(updatedStore);
    });
  }

  /**
   * Load the current active/in-progress execution for a plan and session.
   */
  async loadActiveExecution(planId?: string, sessionId?: string): Promise<WorkoutExecution | null> {
    const store = await this.readStore();
    const active = store.executions.filter(
      (e) => e.status === 'not_started' || e.status === 'in_progress'
    );

    if (sessionId) {
      return active.find((e) => e.sessionId === sessionId) ?? null;
    }

    if (planId) {
      return active.find((e) => e.planId === planId) ?? null;
    }

    return active.length > 0 ? active[0] : null;
  }

  /**
   * Save a completed, abandoned, or skipped WorkoutExecution to history.
   * Terminal executions are immutable factual records.
   */
  async saveTerminalExecution(execution: WorkoutExecution): Promise<void> {
    if (
      execution.status !== 'completed' &&
      execution.status !== 'abandoned' &&
      execution.status !== 'skipped'
    ) {
      throw new Error(
        `saveTerminalExecution expects status 'completed', 'abandoned', or 'skipped'. Received '${execution.status}'.`
      );
    }

    const validation = validateWorkoutExecution(execution);
    if (!validation.isValid) {
      throw new Error(
        `Cannot persist invalid terminal WorkoutExecution: ${validation.errors.map((e) => e.message).join('; ')}`
      );
    }

    return this.writeQueue.enqueue(async () => {
      const store = await this.readStore();
      const existingIdx = store.executions.findIndex((e) => e.executionId === execution.executionId);

      let nextExecutions: WorkoutExecution[];
      if (existingIdx >= 0) {
        nextExecutions = [
          ...store.executions.slice(0, existingIdx),
          execution,
          ...store.executions.slice(existingIdx + 1),
        ];
      } else {
        // Append terminal record
        nextExecutions = [execution, ...store.executions];
      }

      const updatedStore: WorkoutHistoryStoreV1 = {
        ...store,
        executions: nextExecutions,
        lastUpdatedTimestamp: Date.now(),
      };
      await this.writeStore(updatedStore);
    });
  }

  /**
   * Query historical executions with optional filter.
   */
  async getExecutions(filter?: WorkoutHistoryFilter): Promise<WorkoutExecution[]> {
    const store = await this.readStore();
    return selectExecutions(store.executions, filter);
  }

  /**
   * Find an execution by its executionId.
   */
  async getExecutionById(executionId: string): Promise<WorkoutExecution | null> {
    const store = await this.readStore();
    return store.executions.find((e) => e.executionId === executionId) ?? null;
  }

  /**
   * Clear all stored history.
   */
  async clearAll(): Promise<void> {
    return this.writeQueue.enqueue(async () => {
      await rawRemoveItem(WORKOUT_HISTORY_STORAGE_KEY);
    });
  }
}

/**
 * Shared Singleton Instance for App Use
 */
export const defaultWorkoutHistoryRepository = new LocalWorkoutHistoryRepository();
