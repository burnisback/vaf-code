'use client';

import React, { useState } from 'react';
import { RefreshCw, ExternalLink, Smartphone, Monitor, Tablet } from 'lucide-react';
import { useWebContainer } from '@/lib/webcontainer/context';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

export function PreviewPanel() {
  const { previewUrl, isReady, isBooting } = useWebContainer();
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewport, setViewport] = useState<ViewportSize>('desktop');

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const getViewportWidth = (): string => {
    switch (viewport) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      case 'desktop': return '100%';
    }
  };

  if (isBooting) {
    return (
      <div className="h-full bg-[#1e1e1e] flex flex-col">
        <PreviewHeader
          url={null}
          viewport={viewport}
          setViewport={setViewport}
          onRefresh={handleRefresh}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-[#007acc] border-t-transparent rounded-full mx-auto mb-3" />
            <div className="text-[#808080] text-sm">Booting WebContainer...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-full bg-[#1e1e1e] flex flex-col">
        <PreviewHeader
          url={null}
          viewport={viewport}
          setViewport={setViewport}
          onRefresh={handleRefresh}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#808080] text-sm">WebContainer not ready</div>
        </div>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="h-full bg-[#1e1e1e] flex flex-col">
        <PreviewHeader
          url={null}
          viewport={viewport}
          setViewport={setViewport}
          onRefresh={handleRefresh}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#808080]">
            <div className="text-lg mb-2">No preview available</div>
            <div className="text-sm">Run a dev server to see the preview</div>
            <div className="text-xs mt-2 font-mono">npm run dev</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#1e1e1e] flex flex-col">
      <PreviewHeader
        url={previewUrl}
        viewport={viewport}
        setViewport={setViewport}
        onRefresh={handleRefresh}
      />
      <div className="flex-1 bg-white flex justify-center overflow-hidden">
        <iframe
          key={refreshKey}
          src={previewUrl}
          className="h-full border-0 transition-all duration-200"
          style={{ width: getViewportWidth() }}
          title="Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}

interface PreviewHeaderProps {
  url: string | null;
  viewport: ViewportSize;
  setViewport: (v: ViewportSize) => void;
  onRefresh: () => void;
}

function PreviewHeader({ url, viewport, setViewport, onRefresh }: PreviewHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#3e3e42]">
      {/* Viewport buttons */}
      <div className="flex items-center gap-1 border-r border-[#3e3e42] pr-2 mr-2">
        <button
          onClick={() => setViewport('mobile')}
          className={`p-1.5 rounded ${viewport === 'mobile' ? 'bg-[#094771]' : 'hover:bg-[#3e3e42]'}`}
          title="Mobile (375px)"
        >
          <Smartphone className="w-4 h-4 text-[#cccccc]" />
        </button>
        <button
          onClick={() => setViewport('tablet')}
          className={`p-1.5 rounded ${viewport === 'tablet' ? 'bg-[#094771]' : 'hover:bg-[#3e3e42]'}`}
          title="Tablet (768px)"
        >
          <Tablet className="w-4 h-4 text-[#cccccc]" />
        </button>
        <button
          onClick={() => setViewport('desktop')}
          className={`p-1.5 rounded ${viewport === 'desktop' ? 'bg-[#094771]' : 'hover:bg-[#3e3e42]'}`}
          title="Desktop (100%)"
        >
          <Monitor className="w-4 h-4 text-[#cccccc]" />
        </button>
      </div>

      {/* URL bar */}
      <div className="flex-1 flex items-center gap-2 bg-[#3c3c3c] rounded px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-sm text-[#cccccc] truncate font-mono">
          {url || 'No URL'}
        </span>
      </div>

      {/* Actions */}
      <button
        onClick={onRefresh}
        className="p-1.5 rounded hover:bg-[#3e3e42]"
        title="Refresh"
      >
        <RefreshCw className="w-4 h-4 text-[#cccccc]" />
      </button>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-[#3e3e42]"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4 text-[#cccccc]" />
        </a>
      )}
    </div>
  );
}
