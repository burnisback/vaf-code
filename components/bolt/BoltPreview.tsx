'use client';

/**
 * BoltPreview
 *
 * Professional preview panel with bolt.new styling.
 * Includes runtime error capture from the preview iframe.
 */

import React, { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useBoltWebContainer } from '@/lib/bolt/webcontainer/context';
import {
  createRuntimeErrorCapture,
  RuntimeErrorCapture,
  type RuntimeError,
} from '@/lib/bolt/execution';
import {
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  Loader2,
  Globe,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

/** Imperative handle for BoltPreview ref */
export interface BoltPreviewHandle {
  /** Get the runtime error capture instance */
  getRuntimeErrorCapture: () => RuntimeErrorCapture;
  /** Get all captured runtime errors */
  getRuntimeErrors: () => RuntimeError[];
  /** Get formatted runtime errors for display/AI */
  formatRuntimeErrors: () => string;
  /** Clear all runtime errors */
  clearRuntimeErrors: () => void;
  /** Refresh the preview */
  refresh: () => void;
}

const VIEWPORTS: Record<ViewportSize, { width: string; label: string }> = {
  mobile: { width: '375px', label: 'Mobile' },
  tablet: { width: '768px', label: 'Tablet' },
  desktop: { width: '100%', label: 'Desktop' },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface BoltPreviewProps {
  className?: string;
  /** Callback when a runtime error is captured from the preview */
  onRuntimeError?: (error: RuntimeError) => void;
  /** Callback when runtime errors are cleared */
  onRuntimeErrorsClear?: () => void;
}

export const BoltPreview = forwardRef<BoltPreviewHandle, BoltPreviewProps>(function BoltPreview({
  className = '',
  onRuntimeError,
  onRuntimeErrorsClear,
}, ref) {
  const { previewUrl, isReady, loadingState } = useBoltWebContainer();
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [runtimeErrorCount, setRuntimeErrorCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const errorCaptureRef = useRef(createRuntimeErrorCapture({
    maxErrors: 50,
    onError: (error) => {
      setRuntimeErrorCount((prev) => prev + 1);
      onRuntimeError?.(error);
    },
    onClear: () => {
      setRuntimeErrorCount(0);
      onRuntimeErrorsClear?.();
    },
  }));

  // Start/stop listening for runtime errors
  useEffect(() => {
    const capture = errorCaptureRef.current;
    capture.startListening();
    return () => capture.stopListening();
  }, []);

  // Clear errors when preview URL changes (new build)
  useEffect(() => {
    if (previewUrl) {
      errorCaptureRef.current.clear();
    }
  }, [previewUrl]);

  useEffect(() => {
    if (previewUrl) {
      setIframeLoaded(false);
    }
  }, [previewUrl]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      setIsRefreshing(true);
      setIframeLoaded(false);
      iframeRef.current.src = previewUrl;
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [previewUrl]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (previewUrl) window.open(previewUrl, '_blank');
  }, [previewUrl]);

  // Expose imperative handle methods (after callbacks are defined)
  useImperativeHandle(ref, () => ({
    getRuntimeErrorCapture: () => errorCaptureRef.current,
    getRuntimeErrors: () => errorCaptureRef.current.getErrors(),
    formatRuntimeErrors: () => errorCaptureRef.current.formatErrors(),
    clearRuntimeErrors: () => errorCaptureRef.current.clear(),
    refresh: () => handleRefresh(),
  }), [handleRefresh]);

  // Loading state
  if (!isReady || loadingState !== 'ready') {
    return (
      <div className={`h-full flex flex-col bg-[#0a0a0a] ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
            <p className="text-zinc-400 text-sm font-medium">Starting dev server...</p>
            <p className="text-zinc-600 text-xs mt-1">This may take a moment</p>
          </div>
        </div>
      </div>
    );
  }

  // No preview URL yet
  if (!previewUrl) {
    return (
      <div className={`h-full flex flex-col bg-[#0a0a0a] ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">Waiting for server...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-[#0a0a0a] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0f0f0f] border-b border-zinc-800/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* URL bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800/50 min-w-0">
            <Globe className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">
              {previewUrl}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Viewport Controls */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 mr-2 border border-zinc-800/50">
            {(Object.entries(VIEWPORTS) as [ViewportSize, { width: string; label: string }][]).map(
              ([size, config]) => (
                <button
                  key={size}
                  onClick={() => setViewport(size)}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewport === size
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={config.label}
                >
                  {size === 'mobile' && <Smartphone className="w-4 h-4" />}
                  {size === 'tablet' && <Tablet className="w-4 h-4" />}
                  {size === 'desktop' && <Monitor className="w-4 h-4" />}
                </button>
              )
            )}
          </div>

          {/* Runtime Error Indicator */}
          {runtimeErrorCount > 0 && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg mr-2 cursor-pointer hover:bg-red-500/20 transition-colors"
              title={`${runtimeErrorCount} runtime error${runtimeErrorCount > 1 ? 's' : ''} detected`}
              onClick={() => {
                // Could open an error panel or log errors
                const errors = errorCaptureRef.current.getErrors();
                console.error('[BoltPreview] Runtime errors:', errors);
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400 font-medium">{runtimeErrorCount}</span>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={!previewUrl || isRefreshing}
            className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/50 disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Open External */}
          <button
            onClick={handleOpenExternal}
            disabled={!previewUrl}
            className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/50 disabled:opacity-50 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          className="relative bg-white rounded-lg overflow-hidden shadow-2xl shadow-black/50 transition-all duration-300"
          style={{
            width: VIEWPORTS[viewport].width,
            height: viewport === 'desktop' ? '100%' : 'calc(100% - 1rem)',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {/* Loading overlay */}
          {!iframeLoaded && (
            <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center z-10">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          )}

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
});
