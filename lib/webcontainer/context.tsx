'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import { getTemplate, Template } from '../templates';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

async function getWebContainerInstance(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;
  if (bootPromise) return bootPromise;

  console.log('[WebContainer] Starting boot...');
  bootPromise = WebContainer.boot();

  try {
    webcontainerInstance = await bootPromise;
    console.log('[WebContainer] Boot complete!');
    return webcontainerInstance;
  } catch (err) {
    bootPromise = null;
    throw err;
  }
}

export type LoadingState = 'idle' | 'booting' | 'mounting' | 'installing' | 'starting' | 'ready' | 'error';

// Terminal writer function type
type TerminalWriter = (data: string) => void;

interface WebContainerContextValue {
  webcontainer: WebContainer | null;
  isBooting: boolean;
  isMounted: boolean;
  isReady: boolean;
  error: string | null;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  filesystemVersion: number;
  triggerFilesystemRefresh: () => void;
  loadingState: LoadingState;
  loadingMessage: string;
  retryInit: () => void;
  templateData: Template | null;
  registerTerminalWriter: (writer: TerminalWriter) => void;
  writeToTerminal: (data: string) => void;
}

const LOADING_MESSAGES: Record<LoadingState, string> = {
  idle: 'Initializing...',
  booting: 'Booting development environment...',
  mounting: 'Setting up project files...',
  installing: 'Installing dependencies...',
  starting: 'Starting development server...',
  ready: 'Ready!',
  error: 'An error occurred',
};

const WebContainerContext = createContext<WebContainerContextValue | null>(null);

interface WebContainerProviderProps {
  children: ReactNode;
  template?: string;
}

export function WebContainerProvider({ children, template = 'blank' }: WebContainerProviderProps) {
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filesystemVersion, setFilesystemVersion] = useState(0);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [loadingMessage, setLoadingMessage] = useState<string>(LOADING_MESSAGES.idle);
  const [retryCount, setRetryCount] = useState(0);
  const [templateData, setTemplateData] = useState<Template | null>(null);

  // Terminal writer ref - stores the function to write to the visible terminal
  const terminalWriterRef = useRef<TerminalWriter | null>(null);
  // Buffer for messages before terminal is ready
  const outputBufferRef = useRef<string[]>([]);

  const triggerFilesystemRefresh = useCallback(() => {
    setFilesystemVersion(v => v + 1);
  }, []);

  const updateLoadingState = useCallback((state: LoadingState, customMessage?: string) => {
    setLoadingState(state);
    setLoadingMessage(customMessage || LOADING_MESSAGES[state]);
  }, []);

  // Register terminal writer - called by TerminalPanel
  const registerTerminalWriter = useCallback((writer: TerminalWriter) => {
    console.log('[WebContainerProvider] Registering terminal writer, buffered items:', outputBufferRef.current.length);
    terminalWriterRef.current = writer;
    // Flush buffered output
    if (outputBufferRef.current.length > 0) {
      console.log('[WebContainerProvider] Flushing', outputBufferRef.current.length, 'buffered items');
      outputBufferRef.current.forEach(data => writer(data));
      outputBufferRef.current = [];
    }
  }, []);

  // Write to terminal (buffers if terminal not ready)
  const writeToTerminal = useCallback((data: string) => {
    if (terminalWriterRef.current) {
      console.log('[WebContainerProvider] Writing to terminal:', data.substring(0, 30));
      terminalWriterRef.current(data);
    } else {
      console.log('[WebContainerProvider] Buffering output (no writer yet):', data.substring(0, 30));
      outputBufferRef.current.push(data);
    }
  }, []);

  const retryInit = useCallback(() => {
    // Reset all state for retry
    webcontainerInstance = null;
    bootPromise = null;
    setWebcontainer(null);
    setIsBooting(true);
    setIsMounted(false);
    setIsReady(false);
    setError(null);
    setPreviewUrl(null);
    setTemplateData(null);
    outputBufferRef.current = [];
    updateLoadingState('idle');
    setRetryCount(prev => prev + 1);
  }, [updateLoadingState]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Step 1: Boot WebContainer
        updateLoadingState('booting');
        writeToTerminal('\x1b[36m▶ Booting development environment...\x1b[0m\r\n');

        const instance = await getWebContainerInstance();
        if (!mounted) return;

        setWebcontainer(instance);
        setIsBooting(false);

        // Step 2: Get and mount template files
        updateLoadingState('mounting');
        writeToTerminal('\x1b[36m▶ Setting up project files...\x1b[0m\r\n');

        const tplData = getTemplate(template);
        if (!tplData) {
          throw new Error(`Template "${template}" not found. Available: blank, nextjs, react, landing, dashboard, ecommerce`);
        }
        setTemplateData(tplData);

        await instance.mount(tplData.files);
        writeToTerminal(`\x1b[32m✓ Template "${template}" mounted\x1b[0m\r\n\r\n`);
        if (!mounted) return;

        setIsMounted(true);

        // Step 3: Install dependencies
        updateLoadingState('installing', 'Installing dependencies (this may take a minute)...');
        writeToTerminal('\x1b[36m▶ Installing dependencies...\x1b[0m\r\n');
        writeToTerminal('$ npm install\r\n');

        const installProcess = await instance.spawn('npm', ['install']);

        // Stream install output to terminal
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (mounted) {
                writeToTerminal(data);
              }
            },
          })
        );

        const installExitCode = await installProcess.exit;
        if (!mounted) return;

        if (installExitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installExitCode}`);
        }

        writeToTerminal('\r\n\x1b[32m✓ Dependencies installed\x1b[0m\r\n\r\n');

        // Step 4: Start dev server
        updateLoadingState('starting');
        const startCommand = tplData.startCommand.split(' ');
        writeToTerminal(`\x1b[36m▶ Starting development server...\x1b[0m\r\n`);
        writeToTerminal(`$ ${tplData.startCommand}\r\n`);

        const devProcess = await instance.spawn(startCommand[0], startCommand.slice(1));

        // Stream dev server output to terminal
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (mounted) {
                writeToTerminal(data);
              }
            },
          })
        );

        // Listen for server ready
        instance.on('server-ready', (port, url) => {
          console.log(`[WebContainerProvider] Server ready at ${url} on port ${port}`);
          if (mounted) {
            setPreviewUrl(url);
            updateLoadingState('ready');
            setIsReady(true);
            writeToTerminal(`\r\n\x1b[32m✓ Server ready at ${url}\x1b[0m\r\n`);
          }
        });

        // Handle WebContainer errors
        instance.on('error', (err) => {
          console.error('[WebContainerProvider] Error:', err);
          if (mounted) {
            setError(err.message);
            updateLoadingState('error', `Error: ${err.message}`);
            writeToTerminal(`\r\n\x1b[31m✗ Error: ${err.message}\x1b[0m\r\n`);
          }
        });

      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
          console.error('[WebContainerProvider] Init failed:', errorMessage);
          setError(errorMessage);
          setIsBooting(false);
          updateLoadingState('error', `Failed: ${errorMessage}`);
          writeToTerminal(`\r\n\x1b[31m✗ Failed: ${errorMessage}\x1b[0m\r\n`);
        }
      }
    }

    init();
    return () => { mounted = false; };
  }, [template, retryCount, updateLoadingState, writeToTerminal]);

  return (
    <WebContainerContext.Provider value={{
      webcontainer,
      isBooting,
      isMounted,
      isReady,
      error,
      previewUrl,
      setPreviewUrl,
      filesystemVersion,
      triggerFilesystemRefresh,
      loadingState,
      loadingMessage,
      retryInit,
      templateData,
      registerTerminalWriter,
      writeToTerminal,
    }}>
      {children}
    </WebContainerContext.Provider>
  );
}

export function useWebContainer(): WebContainerContextValue {
  const context = useContext(WebContainerContext);
  if (!context) throw new Error('useWebContainer must be used within WebContainerProvider');
  return context;
}
