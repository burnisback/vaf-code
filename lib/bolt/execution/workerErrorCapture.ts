/**
 * Worker Error Capture
 *
 * Captures errors from Web Workers and Service Workers by:
 * 1. Intercepting Worker/SharedWorker constructors
 * 2. Wrapping worker scripts with error capture
 * 3. Using MessageChannel for cross-context communication
 *
 * This complements the main thread RuntimeErrorCapture to provide
 * complete error coverage across all JavaScript execution contexts.
 */

import type { WebContainer } from '@webcontainer/api';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkerError {
  /** Type of worker */
  workerType: 'web-worker' | 'shared-worker' | 'service-worker';
  /** Worker script URL */
  workerUrl?: string;
  /** Error type */
  errorType: string;
  /** Error message */
  message: string;
  /** Source file */
  source?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Stack trace */
  stack?: string;
  /** Timestamp */
  timestamp: number;
}

export interface WorkerErrorCaptureConfig {
  /** Capture Web Worker errors */
  captureWebWorkers?: boolean;
  /** Capture SharedWorker errors */
  captureSharedWorkers?: boolean;
  /** Capture Service Worker errors */
  captureServiceWorkers?: boolean;
  /** ID marker for the injected script */
  scriptId?: string;
  /** Callback for progress */
  onProgress?: (message: string) => void;
}

export interface WorkerInjectionResult {
  /** Whether injection was successful */
  success: boolean;
  /** File that was modified */
  file: string;
  /** Whether file was already injected */
  alreadyInjected: boolean;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// WORKER ERROR CAPTURE SCRIPT
// =============================================================================

/**
 * Script that intercepts Worker constructors and wraps them with error capture
 */
const WORKER_ERROR_CAPTURE_SCRIPT = `
<!-- VAF Worker Error Capture -->
<script id="vaf-worker-error-capture">
(function() {
  // Prevent double injection
  if (window.__vafWorkerCaptureInstalled) return;
  window.__vafWorkerCaptureInstalled = true;

  // Store original constructors
  const OriginalWorker = window.Worker;
  const OriginalSharedWorker = window.SharedWorker;

  // Error reporter function (reuse from main error capture if available)
  function reportWorkerError(errorData) {
    try {
      window.parent.postMessage({
        type: 'WORKER_ERROR',
        ...errorData,
        timestamp: Date.now(),
        url: window.location.href,
      }, '*');
    } catch (e) {
      // Can't post message, ignore
    }
  }

  // Wrapper code to inject into workers
  const workerErrorHandler = \`
    // Worker-side error capture
    self.onerror = function(message, source, line, column, error) {
      self.postMessage({
        __vaf_worker_error: true,
        errorType: error ? error.name : 'Error',
        message: String(message),
        source: source,
        line: line,
        column: column,
        stack: error ? error.stack : undefined,
      });
      return false;
    };

    self.onunhandledrejection = function(event) {
      var reason = event.reason;
      self.postMessage({
        __vaf_worker_error: true,
        errorType: 'UnhandledPromiseRejection',
        message: reason ? (reason.message || String(reason)) : 'Unhandled Promise Rejection',
        stack: reason ? reason.stack : undefined,
      });
    };
  \`;

  // Create a blob with error handler prepended
  function createWrappedWorkerUrl(originalUrl) {
    try {
      // Fetch the original worker script
      var xhr = new XMLHttpRequest();
      xhr.open('GET', originalUrl, false); // Synchronous for simplicity
      xhr.send();

      if (xhr.status === 200) {
        var wrappedCode = workerErrorHandler + '\\n' + xhr.responseText;
        var blob = new Blob([wrappedCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      // Fallback to original URL
    }
    return originalUrl;
  }

  // Wrap Worker constructor
  if (OriginalWorker) {
    window.Worker = function(scriptURL, options) {
      var worker;
      try {
        // Try to wrap the worker script
        var wrappedUrl = typeof scriptURL === 'string' ? createWrappedWorkerUrl(scriptURL) : scriptURL;
        worker = new OriginalWorker(wrappedUrl, options);
      } catch (e) {
        // Fallback to original
        worker = new OriginalWorker(scriptURL, options);
      }

      // Intercept error messages
      var originalOnMessage = null;
      worker.addEventListener('message', function(event) {
        if (event.data && event.data.__vaf_worker_error) {
          reportWorkerError({
            workerType: 'web-worker',
            workerUrl: String(scriptURL),
            errorType: event.data.errorType,
            message: event.data.message,
            source: event.data.source,
            line: event.data.line,
            column: event.data.column,
            stack: event.data.stack,
          });
        }
      });

      // Capture worker error events
      worker.addEventListener('error', function(event) {
        reportWorkerError({
          workerType: 'web-worker',
          workerUrl: String(scriptURL),
          errorType: 'WorkerError',
          message: event.message || 'Worker error',
          source: event.filename,
          line: event.lineno,
          column: event.colno,
        });
      });

      return worker;
    };
    window.Worker.prototype = OriginalWorker.prototype;
  }

  // Wrap SharedWorker constructor
  if (OriginalSharedWorker) {
    window.SharedWorker = function(scriptURL, options) {
      var worker;
      try {
        worker = new OriginalSharedWorker(scriptURL, options);
      } catch (e) {
        reportWorkerError({
          workerType: 'shared-worker',
          workerUrl: String(scriptURL),
          errorType: 'SharedWorkerError',
          message: e.message,
          stack: e.stack,
        });
        throw e;
      }

      // Capture port errors
      worker.port.addEventListener('error', function(event) {
        reportWorkerError({
          workerType: 'shared-worker',
          workerUrl: String(scriptURL),
          errorType: 'SharedWorkerPortError',
          message: event.message || 'SharedWorker port error',
        });
      });

      return worker;
    };
    window.SharedWorker.prototype = OriginalSharedWorker.prototype;
  }

  // Service Worker error capture
  if ('serviceWorker' in navigator) {
    // Capture registration errors
    var originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function(scriptURL, options) {
      return originalRegister.call(navigator.serviceWorker, scriptURL, options)
        .catch(function(error) {
          reportWorkerError({
            workerType: 'service-worker',
            workerUrl: String(scriptURL),
            errorType: 'ServiceWorkerRegistrationError',
            message: error.message,
            stack: error.stack,
          });
          throw error;
        });
    };

    // Listen for service worker errors
    navigator.serviceWorker.addEventListener('error', function(event) {
      reportWorkerError({
        workerType: 'service-worker',
        errorType: 'ServiceWorkerError',
        message: event.message || 'Service Worker error',
      });
    });

    // Listen for controller changes that might indicate issues
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      // Log for debugging, not an error
      console.log('[VAF] Service Worker controller changed');
    });
  }

  console.log('[VAF] Worker error capture installed');
})();
</script>
`;

const WORKER_SCRIPT_MARKER = 'vaf-worker-error-capture';

// =============================================================================
// WORKER ERROR CAPTURE CLASS
// =============================================================================

export class WorkerErrorCapture {
  private webcontainer: WebContainer;
  private config: Required<WorkerErrorCaptureConfig>;

  constructor(webcontainer: WebContainer, config: WorkerErrorCaptureConfig = {}) {
    this.webcontainer = webcontainer;
    this.config = {
      captureWebWorkers: config.captureWebWorkers ?? true,
      captureSharedWorkers: config.captureSharedWorkers ?? true,
      captureServiceWorkers: config.captureServiceWorkers ?? true,
      scriptId: config.scriptId || WORKER_SCRIPT_MARKER,
      onProgress: config.onProgress || (() => {}),
    };
  }

  /**
   * Get the worker error capture script
   */
  getScript(): string {
    return WORKER_ERROR_CAPTURE_SCRIPT;
  }

  /**
   * Inject worker error capture into HTML files
   */
  async inject(htmlFiles: string[] = ['index.html', 'public/index.html']): Promise<WorkerInjectionResult[]> {
    const results: WorkerInjectionResult[] = [];

    for (const file of htmlFiles) {
      const result = await this.injectIntoFile(file);
      results.push(result);
    }

    return results;
  }

  /**
   * Inject into a single file
   */
  async injectIntoFile(filePath: string): Promise<WorkerInjectionResult> {
    this.config.onProgress?.(`Injecting worker error capture into ${filePath}...`);

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

      // Find injection point (after the main error capture script, or after <head>)
      let injectedContent: string;

      // Try to inject after main error capture script
      if (content.includes('vaf-error-capture')) {
        const mainScriptEnd = content.indexOf('</script>', content.indexOf('vaf-error-capture'));
        if (mainScriptEnd !== -1) {
          const insertIndex = mainScriptEnd + '</script>'.length;
          injectedContent = content.slice(0, insertIndex) + '\n' + WORKER_ERROR_CAPTURE_SCRIPT + content.slice(insertIndex);
        } else {
          injectedContent = this.insertAfterHead(content);
        }
      } else {
        injectedContent = this.insertAfterHead(content);
      }

      if (injectedContent === content) {
        return {
          success: false,
          file: filePath,
          alreadyInjected: false,
          error: 'Could not find injection point',
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
   * Remove the injection from a file
   */
  async removeFromFile(filePath: string): Promise<WorkerInjectionResult> {
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

      if (!content.includes(this.config.scriptId)) {
        return {
          success: true,
          file: filePath,
          alreadyInjected: false,
        };
      }

      // Remove the script block
      const scriptPattern = new RegExp(
        `<!-- VAF Worker Error Capture -->\\s*<script id="${this.config.scriptId}">[\\s\\S]*?</script>\\s*`,
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
   * Insert script after <head> tag
   */
  private insertAfterHead(content: string): string {
    const headMatch = content.match(/<head[^>]*>/i);
    if (headMatch) {
      const insertIndex = headMatch.index! + headMatch[0].length;
      return (
        content.slice(0, insertIndex) +
        '\n' + WORKER_ERROR_CAPTURE_SCRIPT +
        content.slice(insertIndex)
      );
    }

    // Try body
    const bodyMatch = content.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const insertIndex = bodyMatch.index! + bodyMatch[0].length;
      return (
        content.slice(0, insertIndex) +
        '\n' + WORKER_ERROR_CAPTURE_SCRIPT +
        content.slice(insertIndex)
      );
    }

    return content;
  }

  /**
   * Parse a WorkerError from a message event
   */
  static parseFromMessage(data: unknown): WorkerError | null {
    if (!data || typeof data !== 'object') return null;
    const obj = data as Record<string, unknown>;

    if (obj.type !== 'WORKER_ERROR') return null;

    return {
      workerType: (obj.workerType as WorkerError['workerType']) || 'web-worker',
      workerUrl: obj.workerUrl as string | undefined,
      errorType: (obj.errorType as string) || 'WorkerError',
      message: (obj.message as string) || 'Unknown worker error',
      source: obj.source as string | undefined,
      line: obj.line as number | undefined,
      column: obj.column as number | undefined,
      stack: obj.stack as string | undefined,
      timestamp: (obj.timestamp as number) || Date.now(),
    };
  }

  /**
   * Format a worker error for display
   */
  static formatError(error: WorkerError): string {
    const parts: string[] = [
      `[${error.workerType.toUpperCase()}]`,
      error.errorType,
      error.message,
    ];

    if (error.workerUrl) {
      parts.push(`(${error.workerUrl})`);
    }

    if (error.line) {
      parts.push(`at line ${error.line}${error.column ? `:${error.column}` : ''}`);
    }

    return parts.join(' ');
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a worker error capture instance
 */
export function createWorkerErrorCapture(
  webcontainer: WebContainer,
  config?: WorkerErrorCaptureConfig
): WorkerErrorCapture {
  return new WorkerErrorCapture(webcontainer, config);
}

/**
 * Quick inject worker error capture
 */
export async function injectWorkerErrorCapture(
  webcontainer: WebContainer,
  htmlFiles?: string[]
): Promise<WorkerInjectionResult[]> {
  const capture = new WorkerErrorCapture(webcontainer);
  return capture.inject(htmlFiles);
}

/**
 * Check if worker error capture is injected
 */
export async function isWorkerCaptureInjected(webcontainer: WebContainer): Promise<boolean> {
  const capture = new WorkerErrorCapture(webcontainer);
  for (const file of ['index.html', 'public/index.html']) {
    if (await capture.isInjected(file)) {
      return true;
    }
  }
  return false;
}

/**
 * Get the worker error capture script for manual use
 */
export function getWorkerCaptureScript(): string {
  return WORKER_ERROR_CAPTURE_SCRIPT;
}
