'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useEditorStore } from '@/lib/store';

export function Preview() {
  const { previewUrl } = useEditorStore();
  const [key, setKey] = useState(0);

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 bg-background/50 justify-between">
        <span className="text-sm font-medium">Preview</span>
        {previewUrl && (
          <button
            onClick={() => setKey(k => k + 1)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 bg-white">
        {previewUrl ? (
          <iframe key={key} src={previewUrl} className="w-full h-full border-0" title="Preview" />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            Starting dev server...
          </div>
        )}
      </div>
    </div>
  );
}
