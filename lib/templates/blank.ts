/**
 * Blank Template
 * Minimal HTML/CSS/JS project
 */

import { FileSystemTree } from '@webcontainer/api';

export const blankTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'blank-project',
        version: '1.0.0',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview'
        },
        devDependencies: {
          vite: '^5.0.0'
        }
      }, null, 2)
    }
  },
  'index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blank Project</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="app">
      <h1>Welcome to Your Blank Project</h1>
      <p>Start building something amazing!</p>
    </div>
    <script type="module" src="/main.js"></script>
  </body>
</html>`
    }
  },
  'style.css': {
    file: {
      contents: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f5f5f5;
  padding: 2rem;
}

#app {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 3rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #2563eb;
  margin-bottom: 1rem;
}

p {
  color: #666;
}`
    }
  },
  'main.js': {
    file: {
      contents: `console.log('Blank project initialized!');

// Your code here
`
    }
  },
  'vite.config.js': {
    file: {
      contents: `import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
});`
    }
  }
};
