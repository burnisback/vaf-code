'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + K to open
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
      setSearch('');
    }
    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const executeCommand = (command: Command) => {
    command.action();
    setIsOpen(false);
    setSearch('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Dialog */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="bg-[var(--color-surface-secondary)] rounded-xl border border-[var(--color-border-default)] shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-default)]">
            <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] outline-none"
              autoFocus
            />
            <kbd className="px-2 py-1 text-xs bg-[var(--color-surface-tertiary)] text-[var(--color-text-tertiary)] rounded">
              ESC
            </kbd>
          </div>

          {/* Commands List */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="p-4 text-center text-[var(--color-text-tertiary)]">
                No commands found
              </div>
            ) : (
              filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--color-surface-tertiary)] transition-colors group"
                >
                  {cmd.icon && (
                    <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]">
                      {cmd.icon}
                    </span>
                  )}
                  <span className="flex-1 text-[var(--color-text-primary)]">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-1 text-xs bg-[var(--color-surface-primary)] text-[var(--color-text-tertiary)] rounded">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--color-border-default)] flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-tertiary)] rounded">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-tertiary)] rounded">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-tertiary)] rounded">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Default commands for the app
export const defaultCommands: Command[] = [
  {
    id: 'new-project',
    label: 'Create New Project',
    shortcut: '⌘N',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    action: () => (window.location.href = '/projects/new'),
  },
  {
    id: 'projects',
    label: 'Go to Projects',
    shortcut: '⌘P',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    action: () => (window.location.href = '/projects'),
  },
  {
    id: 'templates',
    label: 'Browse Templates',
    shortcut: '⌘T',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    action: () => (window.location.href = '/templates'),
  },
  {
    id: 'settings',
    label: 'Open Settings',
    shortcut: '⌘,',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    action: () => (window.location.href = '/settings'),
  },
  {
    id: 'docs',
    label: 'View Documentation',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    action: () => (window.location.href = '/docs'),
  },
];
