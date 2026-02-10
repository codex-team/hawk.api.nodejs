/**
 * Interface for GitHub App installation state store implementations
 *
 * Defines contract for storing temporary GitHub App installation state:
 * - Installation state: maps state ID to projectId, userId, and timestamp
 * Used for CSRF protection during GitHub App installation flow
 */
export interface InstallStateStoreInterface {
  /**
   * Store type identifier
   * Used for logging and debugging purposes
   *
   * @example "redis" or "memory"
   */
  readonly type: string;

  /**
   * Save installation state data
   *
   * @param stateId - unique state identifier (usually UUID)
   * @param data - installation state data (projectId, userId, timestamp)
   */
  saveState(stateId: string, data: { projectId: string; userId: string; timestamp: number }): Promise<void>;

  /**
   * Get and consume installation state data
   *
   * @param stateId - state identifier
   * @returns installation state data or null if not found/expired
   */
  getState(stateId: string): Promise<{ projectId: string; userId: string; timestamp: number } | null>;

  /**
   * Stop cleanup timer (for testing)
   * Optional method - only needed for in-memory store
   */
  stopCleanupTimer?(): void;

  /**
   * Clear all stored state (for testing)
   * Optional method - only needed for in-memory store
   */
  clear?(): void;
}
