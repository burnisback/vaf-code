/**
 * Landing Page Template
 * Marketing landing page with hero, features, CTA
 */

import { FileSystemTree } from '@webcontainer/api';

export const landingTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'landing-page',
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
    <title>Product Landing Page</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <h1>Build Faster. Ship Smarter.</h1>
        <p class="hero-subtitle">
          The ultimate platform for developers who want to focus on what matters
        </p>
        <div class="cta-buttons">
          <button class="btn btn-primary">Get Started</button>
          <button class="btn btn-secondary">Learn More</button>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="container">
        <h2>Why Choose Us</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>Lightning Fast</h3>
            <p>Optimized performance out of the box</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Secure by Default</h3>
            <p>Enterprise-grade security built in</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🚀</div>
            <h3>Easy to Deploy</h3>
            <p>One-click deployment to the cloud</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💎</div>
            <h3>Beautiful UI</h3>
            <p>Stunning components that just work</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="container">
        <h2>Ready to Get Started?</h2>
        <p>Join thousands of developers building the future</p>
        <button class="btn btn-primary btn-large">Start Building Now</button>
      </div>
    </section>

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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  line-height: 1.6;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8rem 0;
  text-align: center;
}

.hero h1 {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: white;
  color: #667eea;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: #667eea;
}

/* Features Section */
.features {
  padding: 6rem 0;
  background: #f8f9fa;
}

.features h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #667eea;
}

.feature-card p {
  color: #666;
}

/* CTA Section */
.cta {
  background: #2d3748;
  color: white;
  padding: 6rem 0;
  text-align: center;
}

.cta h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.cta p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.btn-large {
  padding: 1.25rem 3rem;
  font-size: 1.125rem;
}`
    }
  },
  'main.js': {
    file: {
      contents: `console.log('Landing page initialized!');

// Add interactivity
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    console.log('Button clicked:', e.target.textContent);
  });
});
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
