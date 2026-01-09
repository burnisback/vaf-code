/**
 * Error Handler Injection Templates
 *
 * This module provides error handler scripts that are injected into every
 * generated React application to capture runtime errors and communicate
 * them back to the parent VAF window.
 */

// =============================================================================
// ERROR HANDLER SCRIPT
// =============================================================================

/**
 * JavaScript code injected into index.html to capture browser runtime errors.
 * This script must load BEFORE the React application to catch all errors.
 */
export const ERROR_HANDLER_SCRIPT = `
// VAF Error Handler - Injected automatically
(function() {
  'use strict';

  var VAF_ERROR_TYPES = {
    UNCAUGHT: 'uncaught_error',
    PROMISE_REJECTION: 'unhandled_rejection',
    CONSOLE_ERROR: 'console_error',
    REACT_ERROR: 'react_error',
    NETWORK_ERROR: 'network_error'
  };

  // Error queue to batch errors
  var errorQueue = [];
  var flushTimeout = null;
  var errorRateLimit = { count: 0, resetTime: Date.now() };
  var MAX_ERRORS_PER_SECOND = 10;

  function sendErrorToParent(error) {
    // Rate limiting to prevent error flooding
    var now = Date.now();
    if (now - errorRateLimit.resetTime > 1000) {
      errorRateLimit.count = 0;
      errorRateLimit.resetTime = now;
    }

    if (errorRateLimit.count >= MAX_ERRORS_PER_SECOND) {
      return; // Skip this error due to rate limiting
    }
    errorRateLimit.count++;

    errorQueue.push(error);

    // Debounce to batch rapid errors
    if (!flushTimeout) {
      flushTimeout = setTimeout(function() {
        if (errorQueue.length > 0) {
          try {
            window.parent.postMessage({
              type: 'VAF_RUNTIME_ERROR',
              errors: errorQueue,
              timestamp: Date.now(),
              url: window.location.href
            }, '*');
          } catch (e) {
            // Silently fail if postMessage fails
          }
          errorQueue = [];
        }
        flushTimeout = null;
      }, 100);
    }
  }

  // 1. Capture uncaught errors
  window.onerror = function(message, source, lineno, colno, error) {
    sendErrorToParent({
      type: VAF_ERROR_TYPES.UNCAUGHT,
      message: String(message),
      source: source,
      line: lineno,
      column: colno,
      stack: error && error.stack ? error.stack : null,
      timestamp: Date.now()
    });
    return false; // Don't suppress the error
  };

  // 2. Capture unhandled Promise rejections
  window.onunhandledrejection = function(event) {
    var error = event.reason;
    sendErrorToParent({
      type: VAF_ERROR_TYPES.PROMISE_REJECTION,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : null,
      timestamp: Date.now()
    });
  };

  // 3. Override console.error to capture explicit error logs
  var originalConsoleError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);

    // Extract meaningful error info
    var message = args.map(function(arg) {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); }
        catch(e) { return String(arg); }
      }
      return String(arg);
    }).join(' ');

    // Find any Error object for stack trace
    var stack = null;
    for (var i = 0; i < args.length; i++) {
      if (args[i] instanceof Error) {
        stack = args[i].stack;
        break;
      }
    }

    sendErrorToParent({
      type: VAF_ERROR_TYPES.CONSOLE_ERROR,
      message: message,
      stack: stack,
      timestamp: Date.now()
    });

    // Call original
    originalConsoleError.apply(console, args);
  };

  // 4. Capture network errors (fetch failures)
  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function() {
      var args = arguments;
      var url = args[0] && args[0].url ? args[0].url : args[0];

      return originalFetch.apply(this, args).catch(function(error) {
        sendErrorToParent({
          type: VAF_ERROR_TYPES.NETWORK_ERROR,
          message: 'Fetch failed: ' + (error.message || String(error)),
          url: String(url),
          timestamp: Date.now()
        });
        throw error;
      });
    };
  }

  // 5. Send heartbeat to confirm handler is active
  try {
    window.parent.postMessage({
      type: 'VAF_ERROR_HANDLER_READY',
      timestamp: Date.now()
    }, '*');
  } catch (e) {
    // Silently fail if postMessage fails
  }

  // Log initialization (can be removed in production)
  console.log('[VAF] Error handler initialized');
})();
`;

// =============================================================================
// REACT ERROR BOUNDARY COMPONENT
// =============================================================================

/**
 * React Error Boundary component source code to inject into generated apps.
 * This catches React component errors and reports them to the parent window.
 */
export const REACT_ERROR_BOUNDARY_SOURCE = `import React from 'react';

/**
 * VAF Error Boundary
 * Catches React component errors and reports them to the parent VAF window.
 */
class VAFErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Send to parent window
    try {
      window.parent.postMessage({
        type: 'VAF_RUNTIME_ERROR',
        errors: [{
          type: 'react_error',
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: Date.now()
        }],
        timestamp: Date.now()
      }, '*');
    } catch (e) {
      // Silently fail if postMessage fails
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid #e94560',
          borderRadius: '12px',
          margin: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e94560" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h2 style={{
              color: '#e94560',
              margin: 0,
              fontSize: '18px',
              fontWeight: 600
            }}>
              Something went wrong
            </h2>
          </div>
          <pre style={{
            fontSize: '13px',
            color: '#f1f1f1',
            overflow: 'auto',
            padding: '16px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {this.state.error?.message}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <details style={{ marginTop: '12px' }}>
              <summary style={{
                color: '#a0a0a0',
                cursor: 'pointer',
                fontSize: '13px'
              }}>
                Component Stack
              </summary>
              <pre style={{
                fontSize: '11px',
                color: '#808080',
                overflow: 'auto',
                padding: '12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '6px',
                marginTop: '8px',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: '#e94560',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VAFErrorBoundary;
`;

// =============================================================================
// TEMPLATE CONTENT GENERATORS
// =============================================================================

/**
 * Generate index.html content with error handler injected
 */
export function generateIndexHtml(title: string = 'VAF Project'): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <!-- VAF Error Handler - Must load before app -->
    <script>
${ERROR_HANDLER_SCRIPT}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

/**
 * Generate main.jsx content with Error Boundary wrapper
 */
export function generateMainJsx(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import VAFErrorBoundary from './VAFErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <VAFErrorBoundary>
      <App />
    </VAFErrorBoundary>
  </React.StrictMode>
);
`;
}

/**
 * Generate main.tsx content for TypeScript projects
 */
export function generateMainTsx(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import VAFErrorBoundary from './VAFErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VAFErrorBoundary>
      <App />
    </VAFErrorBoundary>
  </React.StrictMode>
);
`;
}
