'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function XTerminal() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Create container dynamically - React won't track it
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.padding = '10px';
    wrapper.appendChild(container);

    // Initialize terminal with dark theme
    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#f5f5f5',
        cursor: '#f5f5f5',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 1000,
    });

    // Initialize FitAddon for responsive sizing
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Mount terminal to DOM
    terminal.open(container);

    // Small delay to ensure container is sized
    setTimeout(() => fitAddon.fit(), 0);

    // Welcome message
    terminal.writeln('\x1b[1;36m╔════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;36m║       Terminal Playground              ║\x1b[0m');
    terminal.writeln('\x1b[1;36m╚════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    terminal.writeln('Type \x1b[33mhelp\x1b[0m for available commands.');
    terminal.writeln('');
    terminal.write('\x1b[32m$ \x1b[0m');

    // Command handling
    let currentLine = '';

    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      // Handle Enter key
      if (code === 13) {
        terminal.write('\r\n');
        handleCommand(terminal, currentLine.trim());
        currentLine = '';
        terminal.write('\x1b[32m$ \x1b[0m');
      }
      // Handle Backspace
      else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      }
      // Handle Ctrl+C
      else if (code === 3) {
        terminal.write('^C\r\n\x1b[32m$ \x1b[0m');
        currentLine = '';
      }
      // Regular character input
      else if (code >= 32 && code < 127) {
        currentLine += data;
        terminal.write(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore fit errors during unmount
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      if (wrapper.contains(container)) {
        wrapper.removeChild(container);
      }
    };
  }, []);

  return <div ref={wrapperRef} className="w-full h-full" />;
}

function handleCommand(terminal: Terminal, cmd: string) {
  const args = cmd.split(' ');
  const command = args[0].toLowerCase();

  switch (command) {
    case 'help':
      terminal.writeln('\x1b[1mAvailable commands:\x1b[0m');
      terminal.writeln('  \x1b[33mhelp\x1b[0m     - Show this help message');
      terminal.writeln('  \x1b[33mclear\x1b[0m    - Clear the terminal screen');
      terminal.writeln('  \x1b[33mdate\x1b[0m     - Show current date and time');
      terminal.writeln('  \x1b[33mecho\x1b[0m     - Echo back the input text');
      terminal.writeln('  \x1b[33mwhoami\x1b[0m   - Display current user info');
      terminal.writeln('  \x1b[33muname\x1b[0m    - Show system information');
      terminal.writeln('  \x1b[33mls\x1b[0m       - List files (demo)');
      terminal.writeln('  \x1b[33mpwd\x1b[0m      - Print working directory');
      break;

    case 'clear':
      terminal.clear();
      break;

    case 'date':
      terminal.writeln(new Date().toString());
      break;

    case 'echo':
      terminal.writeln(args.slice(1).join(' '));
      break;

    case 'whoami':
      terminal.writeln('guest@terminal-playground');
      break;

    case 'uname':
      terminal.writeln('VAF-OS 1.0.0 (Browser Terminal Emulator)');
      break;

    case 'ls':
      terminal.writeln('\x1b[34mDocuments\x1b[0m  \x1b[34mDownloads\x1b[0m  \x1b[32mREADME.md\x1b[0m  \x1b[32mpackage.json\x1b[0m');
      break;

    case 'pwd':
      terminal.writeln('/home/guest');
      break;

    case '':
      // Empty command, do nothing
      break;

    default:
      terminal.writeln(`\x1b[31mCommand not found: ${command}\x1b[0m`);
      terminal.writeln('Type \x1b[33mhelp\x1b[0m for available commands.');
      break;
  }
}
