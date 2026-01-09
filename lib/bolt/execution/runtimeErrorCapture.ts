/**
 * Runtime Error Capture
 *
 * Captures browser runtime errors from the preview iframe.
 *
 * LIMITATIONS:
 * - Due to cross-origin restrictions, we can only capture errors if:
 *   1. The preview sends errors via postMessage
 *   2. The error bubbles up to the window level
 *
 * For full support, the preview app would need to:
 * - Include an error boundary that posts messages to parent
 * - Have a global error handler that communicates errors
 *
 * This module provides:
 * 1. Infrastructure for capturing runtime errors
 * 2. Error storage and retrieval
 * 3. PostMessage listener for error events
 */

// =============================================================================
// TYPES
// =============================================================================

export interface RuntimeError {
  /** Unique identifier */
  id: string;

  /** Error type (Error, TypeError, ReferenceError, etc.) */
  type: string;

  /** Error message */
  message: string;

  /** Stack trace if available */
  stack?: string;

  /** Source file if available */
  source?: string;

  /** Line number if available */
  line?: number;

  /** Column number if available */
  column?: number;

  /** When the error was captured */
  timestamp: number;

  /** Whether this error has been acknowledged/handled */
  acknowledged: boolean;
}

export interface RuntimeErrorCaptureConfig {
  /** Maximum errors to store */
  maxErrors: number;

  /** Callback when new error is captured */
  onError?: (error: RuntimeError) => void;

  /** Callback when errors are cleared */
  onClear?: () => void;
}

const DEFAULT_CONFIG: RuntimeErrorCaptureConfig = {
  maxErrors: 50,
};

// =============================================================================
// RUNTIME ERROR CAPTURE CLASS
// =============================================================================

export class RuntimeErrorCapture {
  private errors: RuntimeError[] = [];
  private config: RuntimeErrorCaptureConfig;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private errorCounter = 0;

  constructor(config: Partial<RuntimeErrorCaptureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start listening for runtime errors
   * Call this when the preview iframe is loaded
   */
  startListening(): void {
    // Listen for postMessage events from the iframe
    this.messageHandler = (event: MessageEvent) => {
      // Validate message structure
      if (event.data && event.data.type === 'RUNTIME_ERROR') {
        this.captureError({
          type: event.data.errorType || 'Error',
          message: event.data.message || 'Unknown error',
          stack: event.data.stack,
          source: event.data.source,
          line: event.data.line,
          column: event.data.column,
        });
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Stop listening for runtime errors
   */
  stopListening(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
  }

  /**
   * Capture a runtime error
   */
  captureError(error: {
    type: string;
    message: string;
    stack?: string;
    source?: string;
    line?: number;
    column?: number;
  }): RuntimeError {
    const runtimeError: RuntimeError = {
      id: `runtime_${++this.errorCounter}_${Date.now()}`,
      type: error.type,
      message: error.message,
      stack: error.stack,
      source: error.source,
      line: error.line,
      column: error.column,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.errors.push(runtimeError);

    // Trim if over max
    if (this.errors.length > this.config.maxErrors) {
      this.errors = this.errors.slice(-this.config.maxErrors);
    }

    this.config.onError?.(runtimeError);

    return runtimeError;
  }

  /**
   * Get all captured errors
   */
  getErrors(): RuntimeError[] {
    return [...this.errors];
  }

  /**
   * Get unacknowledged errors
   */
  getUnacknowledgedErrors(): RuntimeError[] {
    return this.errors.filter(e => !e.acknowledged);
  }

  /**
   * Check if there are any unacknowledged errors
   */
  hasErrors(): boolean {
    return this.getUnacknowledgedErrors().length > 0;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Acknowledge an error (mark as handled)
   */
  acknowledgeError(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.acknowledged = true;
    }
  }

  /**
   * Acknowledge all errors
   */
  acknowledgeAll(): void {
    this.errors.forEach(e => e.acknowledged = true);
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
    this.config.onClear?.();
  }

  /**
   * Format errors for display
   */
  formatErrors(): string {
    if (this.errors.length === 0) {
      return 'No runtime errors captured.';
    }

    const lines: string[] = ['## Runtime Errors', ''];

    for (const error of this.errors.slice(-10)) {
      const location = error.source && error.line
        ? ` at ${error.source}:${error.line}${error.column ? `:${error.column}` : ''}`
        : '';

      lines.push(`- **${error.type}**: ${error.message}${location}`);

      if (error.stack) {
        const stackLines = error.stack.split('\n').slice(0, 3);
        for (const line of stackLines) {
          lines.push(`  ${line.trim()}`);
        }
      }
    }

    if (this.errors.length > 10) {
      lines.push(`- ... and ${this.errors.length - 10} more errors`);
    }

    return lines.join('\n');
  }

  /**
   * Generate a script that can be injected into the preview
   * to send errors back to the parent
   *
   * NOTE: This would need to be injected into the preview's HTML
   * for full runtime error capture support.
   */
  static getInjectionScript(): string {
    return `
(function() {
  // Global error handler
  window.onerror = function(message, source, line, column, error) {
    window.parent.postMessage({
      type: 'RUNTIME_ERROR',
      errorType: error ? error.name : 'Error',
      message: message,
      source: source,
      line: line,
      column: column,
      stack: error ? error.stack : undefined,
    }, '*');
    return false;
  };

  // Unhandled promise rejection handler
  window.onunhandledrejection = function(event) {
    window.parent.postMessage({
      type: 'RUNTIME_ERROR',
      errorType: 'UnhandledPromiseRejection',
      message: event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Promise Rejection',
      stack: event.reason ? event.reason.stack : undefined,
    }, '*');
  };

  // Console error capture
  const originalConsoleError = console.error;
  console.error = function(...args) {
    window.parent.postMessage({
      type: 'RUNTIME_ERROR',
      errorType: 'ConsoleError',
      message: args.map(a => String(a)).join(' '),
    }, '*');
    originalConsoleError.apply(console, args);
  };
})();
`;
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a runtime error capture instance
 */
export function createRuntimeErrorCapture(
  config?: Partial<RuntimeErrorCaptureConfig>
): RuntimeErrorCapture {
  return new RuntimeErrorCapture(config);
}

// =============================================================================
// HOOK HELPER
// =============================================================================

/**
 * Convert RuntimeError to the format expected by useBoltChat
 */
export function toRuntimeErrorInfo(error: RuntimeError): {
  id: string;
  type: string;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
} {
  return {
    id: error.id,
    type: error.type,
    message: error.message,
    stack: error.stack,
    source: error.source,
    line: error.line,
  };
}
