'use client';

/**
 * BoltStatusBar
 *
 * Status bar showing current state and indicators.
 */

import React from 'react';
import { useBoltWebContainer } from '@/lib/bolt/webcontainer/context';
import { Circle, Wifi, WifiOff } from 'lucide-react';

interface BoltStatusBarProps {
  activeFile?: string | null;
  className?: string;
}

export function BoltStatusBar({ activeFile, className = '' }: BoltStatusBarProps) {
  const { isReady, loadingState, previewUrl } = useBoltWebContainer();

  // Get file info
  const getFileInfo = () => {
    if (!activeFile) return null;
    const ext = activeFile.split('.').pop()?.toUpperCase() || 'FILE';
    return ext;
  };

  const fileType = getFileInfo();

  return (
    <div
      className={`h-6 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-3 text-xs ${className}`}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          {isReady ? (
            <>
              <Circle className="w-2 h-2 fill-green-500 text-green-500" />
              <span className="text-green-500">Ready</span>
            </>
          ) : (
            <>
              <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500 animate-pulse" />
              <span className="text-yellow-500 capitalize">{loadingState}</span>
            </>
          )}
        </div>

        {/* Server Status */}
        {isReady && (
          <div className="flex items-center gap-1.5 text-gray-500">
            {previewUrl ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span className="text-gray-400">Dev server running</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-gray-500" />
                <span>No server</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 text-gray-500">
        {/* File Type */}
        {fileType && (
          <span className="text-gray-400">{fileType}</span>
        )}

        {/* File Path */}
        {activeFile && (
          <span className="text-gray-500 truncate max-w-[200px]" title={activeFile}>
            {activeFile}
          </span>
        )}
      </div>
    </div>
  );
}
