/**
 * Runtime Error Injector
 *
 * Automatically injects error capture scripts into index.html files
 * to enable browser runtime error capture.
 *
 * The injected script:
 * - Captures window.onerror events
 * - Captures unhandled promise rejections
 * - Captures console.error calls
 * - Captures Web Worker errors
 * - Captures Service Worker errors
 * - Posts errors to parent window via postMessage
 */

import type { WebContainer } from '@webcontainer/api';
import { WorkerErrorCapture, getWorkerCaptureScript } from './workerErrorCapture';

// =============================================================================
// TYPES
// =============================================================================

export interface InjectionResult {
  /** Whether injection was successful */
  success: boolean;
  /** File that was modified */
  file: string;
  /** Whether file was already injected */
  alreadyInjected: boolean;
  /** Error message if failed */
  error?: string;
}

export interface InjectionConfig {
  /** HTML files to inject into */
  htmlFiles?: string[];
  /** Whether to inject into all found HTML files */
  injectAll?: boolean;
  /** Custom script to inject instead of default */
  customScript?: string;
  /** ID marker for the injected script */
  scriptId?: string;
  /** Whether to also inject worker error capture */
  captureWorkerErrors?: boolean;
  /** Callback for progress */
  onProgress?: (message: string) => void;
}

// =============================================================================
// ERROR CAPTURE SCRIPT
// =============================================================================

const ERROR_CAPTURE_SCRIPT = `
<!-- VAF Runtime Error Capture -->
<script id="vaf-error-capture">
(function() {
  // Prevent double injection
  if (window.__vafErrorCaptureInstalled) return;
  window.__vafErrorCaptureInstalled = true;

  // Error reporter function
  function reportError(errorData) {
    try {
      window.parent.postMessage({
        type: 'RUNTIME_ERROR',
        ...errorData,
        timestamp: Date.now(),
        url: window.location.href,
      }, '*');
    } catch (e) {
      // Can't post message, ignore
    }
  }

  // Global error handler
  window.onerror = function(message, source, line, column, error) {
    reportError({
      errorType: error ? error.name : 'Error',
      message: String(message),
      source: source,
      line: line,
      column: column,
      stack: error ? error.stack : undefined,
    });
    return false; // Don't prevent default handling
  };

  // Unhandled promise rejection handler
  window.onunhandledrejection = function(event) {
    var reason = event.reason;
    reportError({
      errorType: 'UnhandledPromiseRejection',
      message: reason ? (reason.message || String(reason)) : 'Unhandled Promise Rejection',
      stack: reason ? reason.stack : undefined,
    });
  };

  // Console error capture
  var originalConsoleError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    reportError({
      errorType: 'ConsoleError',
      message: args.map(function(a) {
        if (a instanceof Error) {
          return a.message;
        }
        return String(a);
      }).join(' '),
    });
    originalConsoleError.apply(console, arguments);
  };

  // React error boundary helper
  // This creates a minimal error boundary if React is loaded
  window.__vafReportReactError = function(error, errorInfo) {
    reportError({
      errorType: 'ReactError',
      message: error ? error.message : 'React Error',
      stack: error ? error.stack : undefined,
      componentStack: errorInfo ? errorInfo.componentStack : undefined,
    });
  };

  console.log('[VAF] Runtime error capture installed');
})();
</script>
`;

const SCRIPT_MARKER = 'vaf-error-capture';

// =============================================================================
// RUNTIME ERROR INJECTOR CLASS
// =============================================================================

export class RuntimeErrorInjector {
  private webcontainer: WebContainer;
  private config: Required<InjectionConfig>;
  private workerErrorCapture: WorkerErrorCapture;

  constructor(webcontainer: WebContainer, config: InjectionConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      htmlFiles: config.htmlFiles || ['index.html', 'public/index.html'],
      injectAll: config.injectAll ?? false,
      customScript: config.customScript || ERROR_CAPTURE_SCRIPT,
      scriptId: config.scriptId || SCRIPT_MARKER,
      captureWorkerErrors: config.captureWorkerErrors ?? true,
      onProgress: config.onProgress || (() => {}),
    };
    this.workerErrorCapture = new WorkerErrorCapture(webcontainer, {
      onProgress: config.onProgress,
    });
  }

  /**
   * Inject error capture script into HTML files
   */
  async inject(): Promise<InjectionResult[]> {
    const results: InjectionResult[] = [];

    const filesToInject = this.config.injectAll
      ? await this.findHtmlFiles()
      : this.config.htmlFiles;

    for (const file of filesToInject) {
      const result = await this.injectIntoFile(file);
      results.push(result);

      // Also inject worker error capture if enabled and main injection succeeded
      if (this.config.captureWorkerErrors && result.success && !result.alreadyInjected) {
        await this.workerErrorCapture.injectIntoFile(file);
      }
    }

    return results;
  }

  /**
   * Inject into a single file
   */
  async injectIntoFile(filePath: string): Promise<InjectionResult> {
    this.config.onProgress?.(`Injecting error capture into ${filePath}...`);

    try {
      // Read the file
      let content: string;
      try {
        content = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      } catch {
        return {
          success: false,
          file: filePath,
          alreadyInjected: false,
          error: 'File not found',
        };
      }

      // Check if already injected
      if (content.includes(this.config.scriptId)) {
        return {
          success: true,
          file: filePath,
          alreadyInjected: true,
        };
      }

      // Find injection point (right after <head> or at start of <body>)
      const injectedContent = this.insertScript(content);

      if (injectedContent === content) {
        return {
          success: false,
          file: filePath,
          alreadyInjected: false,
          error: 'Could not find injection point (no <head> or <body> tag)',
        };
      }

      // Write the modified file
      await this.webcontainer.fs.writeFile(filePath, injectedContent);

      return {
        success: true,
        file: filePath,
        alreadyInjected: false,
      };
    } catch (error) {
      return {
        success: false,
        file: filePath,
        alreadyInjected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove injected script from a file
   */
  async removeFromFile(filePath: string): Promise<InjectionResult> {
    this.config.onProgress?.(`Removing error capture from ${filePath}...`);

    try {
      let content: string;
      try {
        content = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      } catch {
        return {
          success: false,
          file: filePath,
          alreadyInjected: false,
          error: 'File not found',
        };
      }

      // Check if script exists
      if (!content.includes(this.config.scriptId)) {
        return {
          success: true,
          file: filePath,
          alreadyInjected: false,
        };
      }

      // Remove the script block
      const scriptPattern = new RegExp(
        `<!-- VAF Runtime Error Capture -->\\s*<script id="${this.config.scriptId}">[\\s\\S]*?</script>\\s*`,
        'g'
      );

      const cleanedContent = content.replace(scriptPattern, '');

      await this.webcontainer.fs.writeFile(filePath, cleanedContent);

      return {
        success: true,
        file: filePath,
        alreadyInjected: false,
      };
    } catch (error) {
      return {
        success: false,
        file: filePath,
        alreadyInjected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if a file has the injection
   */
  async isInjected(filePath: string): Promise<boolean> {
    try {
      const content = await this.webcontainer.fs.readFile(filePath, 'utf-8');
      return content.includes(this.config.scriptId);
    } catch {
      return false;
    }
  }

  /**
   * Insert script into HTML content
   */
  private insertScript(content: string): string {
    // Try to insert after <head>
    const headMatch = content.match(/<head[^>]*>/i);
    if (headMatch) {
      const insertIndex = headMatch.index! + headMatch[0].length;
      return (
        content.slice(0, insertIndex) +
        '\n' + this.config.customScript +
        content.slice(insertIndex)
      );
    }

    // Try to insert at start of <body>
    const bodyMatch = content.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const insertIndex = bodyMatch.index! + bodyMatch[0].length;
      return (
        content.slice(0, insertIndex) +
        '\n' + this.config.customScript +
        content.slice(insertIndex)
      );
    }

    // Try to insert after <!DOCTYPE> or at the very beginning
    const doctypeMatch = content.match(/<!DOCTYPE[^>]*>/i);
    if (doctypeMatch) {
      const insertIndex = doctypeMatch.index! + doctypeMatch[0].length;
      return (
        content.slice(0, insertIndex) +
        '\n<head>' + this.config.customScript + '</head>\n' +
        content.slice(insertIndex)
      );
    }

    return content; // Could not find injection point
  }

  /**
   * Find all HTML files in the project
   */
  private async findHtmlFiles(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await this.webcontainer.fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dir === '/' ? `/${entry.name}` : `${dir}/${entry.name}`;

          // Skip non-source directories
          if (entry.name.startsWith('.') ||
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name === 'build') {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.name.endsWith('.html')) {
            files.push(fullPath.replace(/^\//, ''));
          }
        }
      } catch {
        // Can't read directory
      }
    };

    await walk('/');
    return files;
  }

  /**
   * Format injection results for display
   */
  formatResults(results: InjectionResult[]): string {
    const lines: string[] = ['## Runtime Error Capture Injection', ''];

    const successful = results.filter(r => r.success && !r.alreadyInjected);
    const alreadyDone = results.filter(r => r.alreadyInjected);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      lines.push('### Injected');
      for (const result of successful) {
        lines.push(`- ✅ ${result.file}`);
      }
      lines.push('');
    }

    if (alreadyDone.length > 0) {
      lines.push('### Already Injected');
      for (const result of alreadyDone) {
        lines.push(`- ℹ️ ${result.file}`);
      }
      lines.push('');
    }

    if (failed.length > 0) {
      lines.push('### Failed');
      for (const result of failed) {
        lines.push(`- ❌ ${result.file}: ${result.error}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get the error capture script for manual injection
   */
  static getScript(): string {
    return ERROR_CAPTURE_SCRIPT;
  }

  /**
   * Get a React error boundary component code
   */
  static getReactErrorBoundary(): string {
    return `
import React from 'react';

class VAFErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Report to VAF error capture
    if (window.__vafReportReactError) {
      window.__vafReportReactError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

export default VAFErrorBoundary;
`;
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a runtime error injector
 */
export function createRuntimeErrorInjector(
  webcontainer: WebContainer,
  config?: InjectionConfig
): RuntimeErrorInjector {
  return new RuntimeErrorInjector(webcontainer, config);
}

/**
 * Quick inject into default HTML files
 */
export async function injectRuntimeErrorCapture(
  webcontainer: WebContainer
): Promise<InjectionResult[]> {
  const injector = new RuntimeErrorInjector(webcontainer);
  return injector.inject();
}

/**
 * Check if error capture is already injected
 */
export async function isErrorCaptureInjected(webcontainer: WebContainer): Promise<boolean> {
  const injector = new RuntimeErrorInjector(webcontainer);
  // Check common locations
  for (const file of ['index.html', 'public/index.html']) {
    if (await injector.isInjected(file)) {
      return true;
    }
  }
  return false;
}
