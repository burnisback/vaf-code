'use client';

/**
 * BoltTerminal
 *
 * Professional xterm.js terminal with bolt.new styling.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useBoltWebContainer } from '@/lib/bolt/webcontainer/context';
import { Trash2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface BoltTerminalProps {
  className?: string;
}

export function BoltTerminal({ className = '' }: BoltTerminalProps) {
  const { registerTerminalWriter } = useBoltWebContainer();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    const initTerminal = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
        theme: {
          background: '#0a0a0a',
          foreground: '#e4e4e7',
          cursor: '#a78bfa',
          cursorAccent: '#0a0a0a',
          selectionBackground: '#8b5cf640',
          black: '#18181b',
          red: '#f87171',
          green: '#34d399',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e4e4e7',
          brightBlack: '#71717a',
          brightRed: '#fca5a5',
          brightGreen: '#6ee7b7',
          brightYellow: '#fcd34d',
          brightBlue: '#93c5fd',
          brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9',
          brightWhite: '#ffffff',
        },
        scrollback: 5000,
        convertEol: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current!);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      initializedRef.current = true;

      registerTerminalWriter((data: string) => terminal.write(data));

      // Welcome message
      terminal.writeln('\x1b[38;5;141m┌────────────────────────────────────┐\x1b[0m');
      terminal.writeln('\x1b[38;5;141m│\x1b[0m   \x1b[1;37mBolt Playground Terminal\x1b[0m        \x1b[38;5;141m│\x1b[0m');
      terminal.writeln('\x1b[38;5;141m└────────────────────────────────────┘\x1b[0m');
      terminal.writeln('');
    };

    initTerminal();

    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [registerTerminalWriter]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // Ignore fit errors during resize
        }
      }
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Clear terminal
  const handleClear = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
  }, []);

  return (
    <div className={`h-full flex flex-col bg-[#0a0a0a] ${className}`}>
      {/* Terminal Container */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="absolute inset-0 p-2"
        />
        {/* Clear button */}
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 p-1.5 text-zinc-600 hover:text-zinc-400 rounded hover:bg-zinc-800/50 transition-colors z-10"
          title="Clear terminal"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
