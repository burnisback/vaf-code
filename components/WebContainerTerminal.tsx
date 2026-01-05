'use client';

import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const initialFiles = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'playground',
        version: '1.0.0',
        scripts: { start: 'node index.js' }
      }, null, 2)
    }
  },
  'README.md': {
    file: {
      contents: '# WebContainer Playground\n\nTry: node --version, npm install cowsay, npx cowsay hello'
    }
  },
  'index.js': {
    file: {
      contents: 'console.log("Hello from Node.js!", process.version);'
    }
  }
};

// Singleton to prevent multiple WebContainer instances
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;
  if (bootPromise) return bootPromise;

  bootPromise = WebContainer.boot();
  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
}

export default function WebContainerTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<'booting' | 'ready' | 'error'>('booting');

  useEffect(() => {
    if (!containerRef.current) return;
    mountedRef.current = true;

    async function boot() {
      const termEl = document.createElement('div');
      termEl.style.width = '100%';
      termEl.style.height = '100%';
      containerRef.current!.appendChild(termEl);

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, monospace',
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' }
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(termEl);
      fitAddon.fit();

      terminal.writeln('\x1b[36m🚀 Booting WebContainer...\x1b[0m');
      console.log('[Debug] Step 1: Starting WebContainer.boot()...');

      try {
        // Add timeout to detect hanging boot
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('WebContainer.boot() timed out after 30s')), 30000);
        });

        console.log('[Debug] Step 2: Calling getWebContainer()...');
        const wc = await Promise.race([getWebContainer(), timeoutPromise]);
        console.log('[Debug] Step 3: WebContainer ready!');
        console.log('[Debug] Step 3.5: mountedRef.current =', mountedRef.current);

        if (!mountedRef.current) {
          console.log('[Debug] ABORT: component unmounted, returning early');
          return;
        }

        terminal.writeln('\x1b[32m✓ Booted\x1b[0m');
        console.log('[Debug] Step 4: Mounting files...');
        await wc.mount(initialFiles);
        terminal.writeln('\x1b[32m✓ Files mounted\x1b[0m');

        const shell = await wc.spawn('jsh', {
          terminal: { cols: terminal.cols, rows: terminal.rows }
        });

        shell.output.pipeTo(new WritableStream({
          write(data) { terminal.write(data); }
        }));

        const writer = shell.input.getWriter();
        terminal.onData(data => writer.write(data));
        terminal.onResize(({ cols, rows }) => shell.resize({ cols, rows }));

        const ro = new ResizeObserver(() => fitAddon.fit());
        ro.observe(containerRef.current!);

        setStatus('ready');
      } catch (err) {
        terminal.writeln(`\x1b[31m✗ Error: ${err}\x1b[0m`);
        setStatus('error');
      }
    }

    boot();
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#1e1e1e]">
      {status === 'booting' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
