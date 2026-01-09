/**
 * Bolt Playground Templates
 *
 * Template definitions for bootstrapping projects in WebContainer.
 */

import type { BoltTemplate } from '../types';
import {
  ERROR_HANDLER_SCRIPT,
  REACT_ERROR_BOUNDARY_SOURCE,
} from '../debug/error-handler';

/**
 * React + Vite + Tailwind Template
 * Default template for BoltPlayground
 */
export const reactViteTemplate: BoltTemplate = {
  id: 'react-vite',
  name: 'React + Vite',
  description: 'React with Vite and Tailwind CSS',
  framework: 'React + Vite',
  styling: 'Tailwind CSS',
  startCommand: 'npm run dev',
  files: {
    'package.json': {
      file: {
        contents: JSON.stringify(
          {
            name: 'bolt-project',
            private: true,
            version: '0.0.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'vite build',
              preview: 'vite preview',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/react': '^18.2.0',
              '@types/react-dom': '^18.2.0',
              '@vitejs/plugin-react': '^4.2.0',
              autoprefixer: '^10.4.16',
              postcss: '^8.4.32',
              tailwindcss: '^3.4.0',
              vite: '^5.0.0',
            },
          },
          null,
          2
        ),
      },
    },
    'vite.config.js': {
      file: {
        contents: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
`,
      },
    },
    'tailwind.config.js': {
      file: {
        contents: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
      },
    },
    'postcss.config.js': {
      file: {
        contents: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
      },
    },
    'index.html': {
      file: {
        contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bolt Project</title>
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
`,
      },
    },
    src: {
      directory: {
        'main.jsx': {
          file: {
            contents: `import React from 'react';
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
`,
          },
        },
        'VAFErrorBoundary.jsx': {
          file: {
            contents: REACT_ERROR_BOUNDARY_SOURCE,
          },
        },
        'App.jsx': {
          file: {
            contents: `import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to Bolt Playground
        </h1>
        <p className="text-gray-400 text-lg">
          Start building by typing in the chat!
        </p>
      </div>
    </div>
  );
}

export default App;
`,
          },
        },
        'index.css': {
          file: {
            contents: `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
          },
        },
      },
    },
  },
};

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): BoltTemplate {
  switch (templateId) {
    case 'react-vite':
    default:
      return reactViteTemplate;
  }
}

/**
 * Convert template files to WebContainer mount format
 */
export function getTemplateFiles(template: BoltTemplate): Record<string, any> {
  return template.files;
}
