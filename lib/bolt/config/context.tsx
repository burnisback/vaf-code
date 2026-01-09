'use client';

/**
 * Bolt Configuration Context
 *
 * Provides configuration to all Bolt components with localStorage persistence.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  type BoltConfig,
  type ComplexModeConfig,
  type ClassificationConfig,
  type ExecutionConfig,
  type UIConfig,
  DEFAULT_BOLT_CONFIG,
  mergeConfig,
} from './types';

// =============================================================================
// CONTEXT
// =============================================================================

interface BoltConfigContextValue {
  /** Current configuration */
  config: BoltConfig;

  /** Update complex mode settings */
  updateComplexMode: (updates: Partial<ComplexModeConfig>) => void;

  /** Update classification settings */
  updateClassification: (updates: Partial<ClassificationConfig>) => void;

  /** Update execution settings */
  updateExecution: (updates: Partial<ExecutionConfig>) => void;

  /** Update UI settings */
  updateUI: (updates: Partial<UIConfig>) => void;

  /** Reset all settings to defaults */
  resetToDefaults: () => void;

  /** Whether config has been loaded from storage */
  isLoaded: boolean;
}

const BoltConfigContext = createContext<BoltConfigContextValue | null>(null);

// =============================================================================
// STORAGE
// =============================================================================

const STORAGE_KEY = 'bolt-playground-config';

function loadConfig(): BoltConfig {
  if (typeof window === 'undefined') return DEFAULT_BOLT_CONFIG;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return mergeConfig(DEFAULT_BOLT_CONFIG, parsed);
    }
  } catch {
    // Ignore parse errors
    console.warn('[BoltConfig] Failed to load config from localStorage');
  }

  return DEFAULT_BOLT_CONFIG;
}

function saveConfig(config: BoltConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
    console.warn('[BoltConfig] Failed to save config to localStorage');
  }
}

// =============================================================================
// PROVIDER
// =============================================================================

interface BoltConfigProviderProps {
  children: ReactNode;
  /** Optional initial config override */
  initialConfig?: Partial<BoltConfig>;
}

export function BoltConfigProvider({
  children,
  initialConfig,
}: BoltConfigProviderProps) {
  const [config, setConfig] = useState<BoltConfig>(DEFAULT_BOLT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    const loaded = loadConfig();
    if (initialConfig) {
      setConfig(mergeConfig(loaded, initialConfig));
    } else {
      setConfig(loaded);
    }
    setIsLoaded(true);
  }, [initialConfig]);

  // Save config whenever it changes (after initial load)
  useEffect(() => {
    if (isLoaded) {
      saveConfig(config);
    }
  }, [config, isLoaded]);

  const updateComplexMode = useCallback((updates: Partial<ComplexModeConfig>) => {
    setConfig(prev => ({
      ...prev,
      complexMode: { ...prev.complexMode, ...updates },
    }));
  }, []);

  const updateClassification = useCallback((updates: Partial<ClassificationConfig>) => {
    setConfig(prev => ({
      ...prev,
      classification: { ...prev.classification, ...updates },
    }));
  }, []);

  const updateExecution = useCallback((updates: Partial<ExecutionConfig>) => {
    setConfig(prev => ({
      ...prev,
      execution: { ...prev.execution, ...updates },
    }));
  }, []);

  const updateUI = useCallback((updates: Partial<UIConfig>) => {
    setConfig(prev => ({
      ...prev,
      ui: { ...prev.ui, ...updates },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_BOLT_CONFIG);
    saveConfig(DEFAULT_BOLT_CONFIG);
  }, []);

  return (
    <BoltConfigContext.Provider
      value={{
        config,
        updateComplexMode,
        updateClassification,
        updateExecution,
        updateUI,
        resetToDefaults,
        isLoaded,
      }}
    >
      {children}
    </BoltConfigContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access Bolt configuration
 * Must be used within a BoltConfigProvider
 */
export function useBoltConfig(): BoltConfigContextValue {
  const context = useContext(BoltConfigContext);
  if (!context) {
    throw new Error('useBoltConfig must be used within a BoltConfigProvider');
  }
  return context;
}

/**
 * Hook to access Bolt configuration with fallback to defaults
 * Safe to use outside of BoltConfigProvider
 */
export function useBoltConfigSafe(): BoltConfig {
  const context = useContext(BoltConfigContext);
  return context?.config ?? DEFAULT_BOLT_CONFIG;
}

// =============================================================================
// SELECTOR HOOKS
// =============================================================================

/**
 * Hook to access just complex mode config
 */
export function useComplexModeConfig(): ComplexModeConfig {
  const config = useBoltConfigSafe();
  return config.complexMode;
}

/**
 * Hook to access just classification config
 */
export function useClassificationConfig(): ClassificationConfig {
  const config = useBoltConfigSafe();
  return config.classification;
}

/**
 * Hook to access just execution config
 */
export function useExecutionConfig(): ExecutionConfig {
  const config = useBoltConfigSafe();
  return config.execution;
}

/**
 * Hook to access just UI config
 */
export function useUIConfig(): UIConfig {
  const config = useBoltConfigSafe();
  return config.ui;
}
