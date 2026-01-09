'use client';

/**
 * Bolt WebContainer Context
 *
 * Isolated WebContainer provider for the BoltPlayground.
 * Completely separate from the main playground's WebContainer.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { WebContainer } from '@webcontainer/api';
import { getTemplate, getTemplateFiles } from './templates';
import type { BoltLoadingState, BoltWebContainerState } from '../types';

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/** Terminal error parsed from dev server output */
export interface TerminalError {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

interface BoltWebContainerContextValue extends BoltWebContainerState {
  webcontainer: WebContainer | null;
  previewUrl: string | null;
  filesystemVersion: number;
  triggerFilesystemRefresh: () => void;
  writeToTerminal: (data: string) => void;
  registerTerminalWriter: (writer: (data: string) => void) => void;
  retryInit: () => void;
  /** Get raw terminal history for debugging */
  getTerminalHistory: () => string[];
  /** Get parsed errors from terminal output */
  getTerminalErrors: () => TerminalError[];
  /** Clear terminal history */
  clearTerminalHistory: () => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const BoltWebContainerContext = createContext<BoltWebContainerContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface BoltWebContainerProviderProps {
  children: ReactNode;
  templateId?: string;
}

// Singleton for WebContainer instance (isolated from main playground)
let boltWebcontainerInstance: WebContainer | null = null;
let boltBootPromise: Promise<WebContainer> | null = null;

export function BoltWebContainerProvider({
  children,
  templateId = 'react-vite',
}: BoltWebContainerProviderProps) {
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<BoltLoadingState>('idle');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [filesystemVersion, setFilesystemVersion] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  const terminalWriterRef = useRef<((data: string) => void) | null>(null);
  const outputBufferRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  // Persistent terminal buffer for error detection (keep last 200 entries)
  const terminalHistoryRef = useRef<string[]>([]);
  const MAX_TERMINAL_HISTORY = 200;

  // Update loading state helper
  const updateLoadingState = useCallback((state: BoltLoadingState, message?: string) => {
    setLoadingState(state);
    if (message) {
      setLoadingMessage(message);
    }
  }, []);

  // Write to terminal
  const writeToTerminal = useCallback((data: string) => {
    // Always save to history buffer for error detection
    terminalHistoryRef.current.push(data);
    if (terminalHistoryRef.current.length > MAX_TERMINAL_HISTORY) {
      terminalHistoryRef.current.shift();
    }

    if (terminalWriterRef.current) {
      terminalWriterRef.current(data);
    } else {
      outputBufferRef.current.push(data);
    }
  }, []);

  // Get terminal history for error detection
  const getTerminalHistory = useCallback((): string[] => {
    return [...terminalHistoryRef.current];
  }, []);

  // Parse terminal history for errors
  const getTerminalErrors = useCallback((): Array<{ type: string; message: string; file?: string; line?: number }> => {
    const errors: Array<{ type: string; message: string; file?: string; line?: number }> = [];
    const fullOutput = terminalHistoryRef.current.join('');

    // Vite internal server error pattern
    const viteErrorRegex = /\[vite\] Internal server error: (.+?)(?:\r?\n|$)/gi;
    let match;
    while ((match = viteErrorRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'vite', message: match[1] });
    }

    // ESBuild/Rollup error pattern: ✘ [ERROR] message
    const esbuildErrorRegex = /✘ \[ERROR\] (.+?)(?:\r?\n|$)/gi;
    while ((match = esbuildErrorRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'esbuild', message: match[1] });
    }

    // SyntaxError pattern
    const syntaxErrorRegex = /SyntaxError: (.+?)(?:\r?\n|$)/gi;
    while ((match = syntaxErrorRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'syntax', message: match[1] });
    }

    // Transform error pattern (Vite/ESBuild): file.jsx:line:col - error message
    const transformErrorRegex = /(?:error|Error)[:\s]+(.+\.(?:jsx?|tsx?|vue|svelte))(?::(\d+))?(?::(\d+))?[:\s]+(.+?)(?:\r?\n|$)/gi;
    while ((match = transformErrorRegex.exec(fullOutput)) !== null) {
      errors.push({
        type: 'transform',
        message: match[4],
        file: match[1],
        line: match[2] ? parseInt(match[2], 10) : undefined,
      });
    }

    // Failed to parse/transform pattern
    const failedParseRegex = /(?:Failed to parse|Failed to transform|Could not resolve)[:\s]+(.+?)(?:\r?\n|$)/gi;
    while ((match = failedParseRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'parse', message: match[1] });
    }

    // Module not found pattern
    const moduleNotFoundRegex = /(?:Cannot find module|Module not found)[:\s]+['"]?([^'"]+)['"]?/gi;
    while ((match = moduleNotFoundRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'module', message: `Cannot find module: ${match[1]}` });
    }

    // React/JSX compilation errors
    const jsxErrorRegex = /(?:Unexpected token|Expected corresponding JSX closing tag)(.+?)(?:\r?\n|$)/gi;
    while ((match = jsxErrorRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'jsx', message: match[0].trim() });
    }

    // npm ERR pattern
    const npmErrorRegex = /npm ERR! (.+?)(?:\r?\n|$)/gi;
    while ((match = npmErrorRegex.exec(fullOutput)) !== null) {
      errors.push({ type: 'npm', message: match[1] });
    }

    return errors;
  }, []);

  // Clear terminal history (useful when project is reset)
  const clearTerminalHistory = useCallback(() => {
    terminalHistoryRef.current = [];
  }, []);

  // Register terminal writer
  const registerTerminalWriter = useCallback((writer: (data: string) => void) => {
    terminalWriterRef.current = writer;
    // Flush buffer
    for (const data of outputBufferRef.current) {
      writer(data);
    }
    outputBufferRef.current = [];
  }, []);

  // Trigger filesystem refresh
  const triggerFilesystemRefresh = useCallback(() => {
    setFilesystemVersion((v) => v + 1);
  }, []);

  // Retry initialization
  const retryInit = useCallback(() => {
    boltWebcontainerInstance = null;
    boltBootPromise = null;
    setWebcontainer(null);
    setIsBooting(true);
    setIsReady(false);
    setError(null);
    setPreviewUrl(null);
    setRetryCount((c) => c + 1);
  }, []);

  // Initialize WebContainer
  useEffect(() => {
    mountedRef.current = true;

    const initWebContainer = async () => {
      try {
        updateLoadingState('booting', 'Booting WebContainer...');
        writeToTerminal('\x1b[36m[Bolt] Booting WebContainer...\x1b[0m\r\n');

        // Boot WebContainer (reuse if already booted)
        if (!boltBootPromise) {
          boltBootPromise = WebContainer.boot();
        }

        const instance = await boltBootPromise;
        boltWebcontainerInstance = instance;

        if (!mountedRef.current) return;

        setWebcontainer(instance);
        setIsBooting(false);

        // Get template
        const template = getTemplate(templateId);
        const files = getTemplateFiles(template);

        // Mount template files
        updateLoadingState('mounting', 'Mounting project files...');
        writeToTerminal('\x1b[36m[Bolt] Mounting project files...\x1b[0m\r\n');

        await instance.mount(files);

        if (!mountedRef.current) return;

        // Install dependencies
        updateLoadingState('installing', 'Installing dependencies...');
        writeToTerminal('\x1b[36m[Bolt] Installing dependencies...\x1b[0m\r\n');

        const installProcess = await instance.spawn('npm', ['install']);

        // Stream install output to terminal
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              writeToTerminal(data);
            },
          })
        );

        const installExitCode = await installProcess.exit;

        if (!mountedRef.current) return;

        if (installExitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installExitCode}`);
        }

        writeToTerminal('\x1b[32m[Bolt] Dependencies installed successfully!\x1b[0m\r\n');

        // Start dev server
        updateLoadingState('starting', 'Starting development server...');
        writeToTerminal('\x1b[36m[Bolt] Starting development server...\x1b[0m\r\n');

        const devProcess = await instance.spawn('npm', ['run', 'dev']);

        // Stream dev output to terminal
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              writeToTerminal(data);
            },
          })
        );

        // Listen for server ready
        instance.on('server-ready', (port, url) => {
          if (mountedRef.current) {
            setPreviewUrl(url);
            updateLoadingState('ready', 'Ready!');
            setIsReady(true);
            writeToTerminal(`\r\n\x1b[32m[Bolt] ✓ Server ready at ${url}\x1b[0m\r\n`);
          }
        });

        // Listen for errors
        instance.on('error', (err) => {
          if (mountedRef.current) {
            setError(err.message);
            updateLoadingState('error', `Error: ${err.message}`);
            writeToTerminal(`\x1b[31m[Bolt] ✗ Error: ${err.message}\x1b[0m\r\n`);
          }
        });
      } catch (err) {
        if (mountedRef.current) {
          const message = err instanceof Error ? err.message : 'Failed to initialize';
          setError(message);
          setIsBooting(false);
          updateLoadingState('error', message);
          writeToTerminal(`\x1b[31m[Bolt] ✗ Error: ${message}\x1b[0m\r\n`);
        }
      }
    };

    initWebContainer();

    return () => {
      mountedRef.current = false;
    };
  }, [templateId, retryCount, updateLoadingState, writeToTerminal]);

  const value: BoltWebContainerContextValue = {
    webcontainer,
    isBooting,
    isReady,
    error,
    previewUrl,
    loadingState,
    loadingMessage,
    filesystemVersion,
    triggerFilesystemRefresh,
    writeToTerminal,
    registerTerminalWriter,
    retryInit,
    getTerminalHistory,
    getTerminalErrors,
    clearTerminalHistory,
  };

  return (
    <BoltWebContainerContext.Provider value={value}>
      {children}
    </BoltWebContainerContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useBoltWebContainer(): BoltWebContainerContextValue {
  const context = useContext(BoltWebContainerContext);
  if (!context) {
    throw new Error('useBoltWebContainer must be used within a BoltWebContainerProvider');
  }
  return context;
}
