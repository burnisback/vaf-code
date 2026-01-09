/**
 * Operation History Manager
 *
 * Tracks file operation history for undo/redo functionality.
 * Stores snapshots of file content before modifications.
 */

import type { WebContainer } from '@webcontainer/api';
import type { FileOperationV2, ExecutionResult } from '../types';

// ============================================
// TYPES
// ============================================

export interface OperationSnapshot {
  id: string;
  timestamp: number;
  operation: FileOperationV2;
  result: ExecutionResult;
  previousContent: string | null; // null for new files
  newContent: string | null; // null for deleted files
}

export interface OperationHistoryState {
  snapshots: OperationSnapshot[];
  currentIndex: number; // Points to the most recent applied operation
}

// ============================================
// OPERATION HISTORY CLASS
// ============================================

export class OperationHistory {
  private state: OperationHistoryState = {
    snapshots: [],
    currentIndex: -1
  };
  private webcontainer: WebContainer | null = null;
  private maxHistorySize: number;
  private listeners: Set<(state: OperationHistoryState) => void> = new Set();

  constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Set the WebContainer instance
   */
  setWebContainer(wc: WebContainer) {
    this.webcontainer = wc;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OperationHistoryState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Record an operation before execution
   * Returns the snapshot ID
   */
  async recordOperation(
    operation: FileOperationV2
  ): Promise<string> {
    const id = `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get previous content if file exists
    let previousContent: string | null = null;
    if (this.webcontainer && operation.type !== 'write') {
      try {
        const data = await this.webcontainer.fs.readFile(operation.path);
        previousContent = new TextDecoder().decode(data);
      } catch {
        // File doesn't exist
        previousContent = null;
      }
    } else if (this.webcontainer && operation.type === 'write') {
      // For write operations, check if file already exists
      try {
        const data = await this.webcontainer.fs.readFile(operation.path);
        previousContent = new TextDecoder().decode(data);
      } catch {
        previousContent = null;
      }
    }

    // Create snapshot (without result yet)
    const snapshot: OperationSnapshot = {
      id,
      timestamp: Date.now(),
      operation,
      result: {
        operationId: id,
        operation,
        status: 'pending',
        startTime: Date.now()
      },
      previousContent,
      newContent: null
    };

    // Trim history if at current index (discard redo history)
    if (this.state.currentIndex < this.state.snapshots.length - 1) {
      this.state.snapshots = this.state.snapshots.slice(0, this.state.currentIndex + 1);
    }

    // Add snapshot
    this.state.snapshots.push(snapshot);
    this.state.currentIndex = this.state.snapshots.length - 1;

    // Trim old history if exceeding max size
    if (this.state.snapshots.length > this.maxHistorySize) {
      const excess = this.state.snapshots.length - this.maxHistorySize;
      this.state.snapshots = this.state.snapshots.slice(excess);
      this.state.currentIndex -= excess;
    }

    this.notify();
    return id;
  }

  /**
   * Update snapshot with execution result
   */
  async updateResult(
    snapshotId: string,
    result: ExecutionResult
  ): Promise<void> {
    const snapshot = this.state.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return;

    snapshot.result = result;

    // Capture new content after successful write/edit
    if (result.status === 'success' && this.webcontainer) {
      if (snapshot.operation.type === 'write' || snapshot.operation.type === 'edit') {
        try {
          const data = await this.webcontainer.fs.readFile(snapshot.operation.path);
          snapshot.newContent = new TextDecoder().decode(data);
        } catch {
          // File might have been deleted
        }
      } else if (snapshot.operation.type === 'delete') {
        snapshot.newContent = null;
      }
    }

    this.notify();
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.state.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.state.currentIndex < this.state.snapshots.length - 1;
  }

  /**
   * Undo the most recent operation
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo() || !this.webcontainer) {
      return false;
    }

    const snapshot = this.state.snapshots[this.state.currentIndex];

    try {
      await this.revertOperation(snapshot);
      this.state.currentIndex--;
      this.notify();
      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      return false;
    }
  }

  /**
   * Redo a previously undone operation
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo() || !this.webcontainer) {
      return false;
    }

    const snapshot = this.state.snapshots[this.state.currentIndex + 1];

    try {
      await this.reapplyOperation(snapshot);
      this.state.currentIndex++;
      this.notify();
      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      return false;
    }
  }

  /**
   * Revert an operation (for undo)
   */
  private async revertOperation(snapshot: OperationSnapshot): Promise<void> {
    if (!this.webcontainer) return;

    const { operation, previousContent } = snapshot;

    switch (operation.type) {
      case 'write':
        if (previousContent === null) {
          // File was created - delete it
          await this.webcontainer.fs.rm(operation.path);
        } else {
          // File was overwritten - restore previous content
          await this.webcontainer.fs.writeFile(operation.path, previousContent);
        }
        break;

      case 'edit':
        if (previousContent !== null) {
          // Restore the original content
          await this.webcontainer.fs.writeFile(operation.path, previousContent);
        }
        break;

      case 'delete':
        if (previousContent !== null) {
          // Restore the deleted file
          await this.webcontainer.fs.writeFile(operation.path, previousContent);
        }
        break;
    }
  }

  /**
   * Reapply an operation (for redo)
   */
  private async reapplyOperation(snapshot: OperationSnapshot): Promise<void> {
    if (!this.webcontainer) return;

    const { operation, newContent } = snapshot;

    switch (operation.type) {
      case 'write':
        if (newContent !== null) {
          await this.webcontainer.fs.writeFile(operation.path, newContent);
        }
        break;

      case 'edit':
        if (newContent !== null) {
          await this.webcontainer.fs.writeFile(operation.path, newContent);
        }
        break;

      case 'delete':
        await this.webcontainer.fs.rm(operation.path, { recursive: true });
        break;
    }
  }

  /**
   * Get current state
   */
  getState(): OperationHistoryState {
    return { ...this.state };
  }

  /**
   * Get recent snapshots
   */
  getRecentSnapshots(count: number = 10): OperationSnapshot[] {
    return this.state.snapshots.slice(-count);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.state = {
      snapshots: [],
      currentIndex: -1
    };
    this.notify();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const operationHistory = new OperationHistory();

// ============================================
// REACT HOOK
// ============================================

import { useState, useEffect, useCallback } from 'react';

export function useOperationHistory() {
  const [state, setState] = useState<OperationHistoryState>(operationHistory.getState());

  useEffect(() => {
    return operationHistory.subscribe(setState);
  }, []);

  const undo = useCallback(async () => {
    return operationHistory.undo();
  }, []);

  const redo = useCallback(async () => {
    return operationHistory.redo();
  }, []);

  const clear = useCallback(() => {
    operationHistory.clear();
  }, []);

  return {
    snapshots: state.snapshots,
    currentIndex: state.currentIndex,
    canUndo: operationHistory.canUndo(),
    canRedo: operationHistory.canRedo(),
    undo,
    redo,
    clear,
    recentSnapshots: operationHistory.getRecentSnapshots()
  };
}
