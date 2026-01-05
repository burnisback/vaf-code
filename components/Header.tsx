'use client';

import { Moon, Sun, Code2 } from 'lucide-react';
import { useEditorStore } from '@/lib/store';

export function Header() {
  const { theme, toggleTheme } = useEditorStore();

  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-4 justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-vaf-gradient flex items-center justify-center">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-bold bg-vaf-gradient bg-clip-text text-transparent">
          VAF Code
        </h1>
      </div>
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </header>
  );
}
