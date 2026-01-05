'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useWebContainer } from '@/lib/webcontainer/context';
import '@xterm/xterm/css/xterm.css';

export function TerminalPanel() {
  const { registerTerminalWriter } = useWebContainer();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);

  // Initialize terminal once on mount
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    console.log('[TerminalPanel] Initializing terminal...');

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal in container
    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit after a short delay to ensure container has dimensions
    const fitTimer = setTimeout(() => {
      try {
        fitAddon.fit();
        console.log('[TerminalPanel] Terminal fitted, cols:', terminal.cols, 'rows:', terminal.rows);
      } catch (e) {
        console.warn('[TerminalPanel] Fit failed:', e);
      }
    }, 50);

    // Show initial message
    terminal.writeln('\x1b[90m╭─────────────────────────────────────────╮\x1b[0m');
    terminal.writeln('\x1b[90m│\x1b[0m  \x1b[36mVAF Code\x1b[0m - Development Environment     \x1b[90m│\x1b[0m');
    terminal.writeln('\x1b[90m╰─────────────────────────────────────────╯\x1b[0m');
    terminal.writeln('');

    setIsTerminalReady(true);
    console.log('[TerminalPanel] Terminal initialized');

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore fit errors during rapid resize
        }
      }
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // Cleanup only on unmount
    return () => {
      clearTimeout(fitTimer);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, []); // Empty deps - only run once on mount

  // Register terminal writer with context after terminal is ready
  useEffect(() => {
    if (!isTerminalReady || !terminalRef.current) return;

    console.log('[TerminalPanel] Registering terminal writer...');
    registerTerminalWriter((data: string) => {
      if (terminalRef.current) {
        terminalRef.current.write(data);
      }
    });
    console.log('[TerminalPanel] Terminal writer registered');
  }, [isTerminalReady, registerTerminalWriter]);

  // No interactive shell - terminal just shows dev server output

  return (
    <div
      ref={containerRef}
      className="bg-[#0a0a0a]"
      style={{ width: '100%', height: '100%', minHeight: '100px' }}
    />
  );
}
