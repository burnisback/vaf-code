'use client';

/**
 * useRuntimeErrors Hook
 *
 * Manages runtime error state from browser console errors captured in the preview iframe.
 * Listens for postMessage events from the injected error handler and maintains
 * error state with deduplication.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  RuntimeError,
  DebugSession,
  DebugSessionStatus,
  FixAttempt,
} from '@/lib/bolt/types';
import { generateId } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface RuntimeErrorsState {
  errors: RuntimeError[];
  debugSession: DebugSession | null;
  isHandlerActive: boolean;
}

interface UseRuntimeErrorsReturn {
  /** Current list of runtime errors */
  errors: RuntimeError[];
  /** Current debug session if one is active */
  debugSession: DebugSession | null;
  /** Whether the error handler in the iframe is active */
  isHandlerActive: boolean;
  /** Whether there are any errors */
  hasErrors: boolean;
  /** Start a debug session for an error */
  startDebugSession: (error: RuntimeError) => DebugSession;
  /** Update the current debug session */
  updateDebugSession: (updates: Partial<DebugSession>) => void;
  /** Add a fix attempt to the current session */
  addFixAttempt: (attempt: Omit<FixAttempt, 'id'>) => void;
  /** Update a specific fix attempt */
  updateFixAttempt: (attemptId: string, updates: Partial<FixAttempt>) => void;
  /** Clear a specific error by ID */
  clearError: (errorId: string) => void;
  /** Clear all errors */
  clearAllErrors: () => void;
  /** End the current debug session */
  endDebugSession: (success: boolean) => void;
  /** Reset error handler active state */
  resetHandlerState: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useRuntimeErrors(): UseRuntimeErrorsReturn {
  const [state, setState] = useState<RuntimeErrorsState>({
    errors: [],
    debugSession: null,
    isHandlerActive: false,
  });

  // Track errors by signature to deduplicate
  const errorSignatures = useRef<Map<string, string>>(new Map());

  /**
   * Create error signature for deduplication
   */
  const getErrorSignature = useCallback((error: Partial<RuntimeError>): string => {
    return `${error.type}:${error.message}:${error.source || ''}:${error.line || ''}`;
  }, []);

  /**
   * Handle incoming postMessage from iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { data } = event;

      // Handle error handler ready signal
      if (data?.type === 'VAF_ERROR_HANDLER_READY') {
        setState(prev => ({ ...prev, isHandlerActive: true }));
        return;
      }

      // Handle runtime errors
      if (data?.type === 'VAF_RUNTIME_ERROR' && Array.isArray(data.errors)) {
        setState(prev => {
          const newErrors = [...prev.errors];

          for (const incomingError of data.errors) {
            const signature = getErrorSignature(incomingError);
            const existingId = errorSignatures.current.get(signature);

            if (existingId) {
              // Increment occurrence count for existing error
              const index = newErrors.findIndex(e => e.id === existingId);
              if (index !== -1) {
                newErrors[index] = {
                  ...newErrors[index],
                  occurrenceCount: newErrors[index].occurrenceCount + 1,
                  timestamp: incomingError.timestamp,
                };
              }
            } else {
              // Add new error
              const id = generateId();
              errorSignatures.current.set(signature, id);
              newErrors.push({
                ...incomingError,
                id,
                occurrenceCount: 1,
              } as RuntimeError);
            }
          }

          return { ...prev, errors: newErrors };
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [getErrorSignature]);

  /**
   * Start a debug session for an error
   */
  const startDebugSession = useCallback((error: RuntimeError): DebugSession => {
    const session: DebugSession = {
      id: generateId(),
      status: 'detecting',
      currentError: error,
      fixAttempts: [],
      startedAt: Date.now(),
      maxAttempts: 3,
    };

    setState(prev => ({ ...prev, debugSession: session }));
    return session;
  }, []);

  /**
   * Update debug session
   */
  const updateDebugSession = useCallback((updates: Partial<DebugSession>) => {
    setState(prev => {
      if (!prev.debugSession) return prev;
      return {
        ...prev,
        debugSession: { ...prev.debugSession, ...updates },
      };
    });
  }, []);

  /**
   * Add fix attempt to session
   */
  const addFixAttempt = useCallback((attempt: Omit<FixAttempt, 'id'>) => {
    setState(prev => {
      if (!prev.debugSession) return prev;
      const newAttempt: FixAttempt = {
        ...attempt,
        id: generateId(),
      };
      return {
        ...prev,
        debugSession: {
          ...prev.debugSession,
          fixAttempts: [...prev.debugSession.fixAttempts, newAttempt],
        },
      };
    });
  }, []);

  /**
   * Update a specific fix attempt
   */
  const updateFixAttempt = useCallback((attemptId: string, updates: Partial<FixAttempt>) => {
    setState(prev => {
      if (!prev.debugSession) return prev;
      const fixAttempts = prev.debugSession.fixAttempts.map(attempt =>
        attempt.id === attemptId ? { ...attempt, ...updates } : attempt
      );
      return {
        ...prev,
        debugSession: {
          ...prev.debugSession,
          fixAttempts,
        },
      };
    });
  }, []);

  /**
   * Clear specific error
   */
  const clearError = useCallback((errorId: string) => {
    setState(prev => {
      // Find and remove the signature for this error
      const errorToRemove = prev.errors.find(e => e.id === errorId);
      if (errorToRemove) {
        const signature = getErrorSignature(errorToRemove);
        errorSignatures.current.delete(signature);
      }

      return {
        ...prev,
        errors: prev.errors.filter(e => e.id !== errorId),
      };
    });
  }, [getErrorSignature]);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    errorSignatures.current.clear();
    setState(prev => ({
      ...prev,
      errors: [],
    }));
  }, []);

  /**
   * End debug session
   */
  const endDebugSession = useCallback((success: boolean) => {
    setState(prev => ({
      ...prev,
      debugSession: prev.debugSession
        ? {
            ...prev.debugSession,
            status: success ? 'resolved' : 'failed',
            resolvedAt: Date.now(),
          }
        : null,
    }));
  }, []);

  /**
   * Reset handler state (useful when iframe reloads)
   */
  const resetHandlerState = useCallback(() => {
    setState(prev => ({ ...prev, isHandlerActive: false }));
  }, []);

  return {
    errors: state.errors,
    debugSession: state.debugSession,
    isHandlerActive: state.isHandlerActive,
    hasErrors: state.errors.length > 0,
    startDebugSession,
    updateDebugSession,
    addFixAttempt,
    updateFixAttempt,
    clearError,
    clearAllErrors,
    endDebugSession,
    resetHandlerState,
  };
}
