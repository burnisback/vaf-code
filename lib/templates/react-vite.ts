/**
 * React + Vite Template
 * React with Vite and JavaScript
 */

import { FileSystemTree } from '@webcontainer/api';

export const reactViteTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'vite-react-starter',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
        devDependencies: {
          '@types/react': '^18.2.43',
          '@types/react-dom': '^18.2.17',
          '@vitejs/plugin-react': '^4.2.1',
          vite: '^5.0.8',
        },
      }, null, 2),
    },
  },
  'index.html': {
    file: {
      contents: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    },
  },
  'vite.config.js': {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })`,
    },
  },
  src: {
    directory: {
      'main.jsx': {
        file: {
          contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)`,
        },
      },
      'App.jsx': {
        file: {
          contents: `import { useState } from 'react'
function App() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Welcome to VAF Code</h1>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
    </div>
  )
}
export default App`,
        },
      },
      'index.css': {
        file: {
          contents: `body { margin: 0; font-family: system-ui, sans-serif; }`,
        },
      },
    },
  },
};
