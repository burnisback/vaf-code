/**
 * Dashboard Template
 * Admin dashboard with sidebar and charts placeholder
 */

import { FileSystemTree } from '@webcontainer/api';

export const dashboardTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'admin-dashboard',
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
    <title>Admin Dashboard</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div class="dashboard">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>Dashboard</h2>
        </div>
        <nav class="sidebar-nav">
          <a href="#" class="nav-item active">
            <span class="icon">📊</span>
            Overview
          </a>
          <a href="#" class="nav-item">
            <span class="icon">👥</span>
            Users
          </a>
          <a href="#" class="nav-item">
            <span class="icon">📈</span>
            Analytics
          </a>
          <a href="#" class="nav-item">
            <span class="icon">⚙️</span>
            Settings
          </a>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <!-- Header -->
        <header class="header">
          <h1>Overview</h1>
          <div class="user-menu">
            <span>John Doe</span>
            <div class="avatar">JD</div>
          </div>
        </header>

        <!-- Stats Cards -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Users</div>
            <div class="stat-value">1,234</div>
            <div class="stat-change positive">+12.5%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Revenue</div>
            <div class="stat-value">$45,678</div>
            <div class="stat-change positive">+8.2%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Orders</div>
            <div class="stat-value">567</div>
            <div class="stat-change negative">-3.1%</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Conversion</div>
            <div class="stat-value">3.24%</div>
            <div class="stat-change positive">+0.5%</div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-grid">
          <div class="chart-card">
            <h3>Revenue Over Time</h3>
            <div class="chart-placeholder">
              <div class="chart-bars">
                <div class="bar" style="height: 60%"></div>
                <div class="bar" style="height: 80%"></div>
                <div class="bar" style="height: 65%"></div>
                <div class="bar" style="height: 90%"></div>
                <div class="bar" style="height: 75%"></div>
                <div class="bar" style="height: 85%"></div>
                <div class="bar" style="height: 95%"></div>
              </div>
            </div>
          </div>
          <div class="chart-card">
            <h3>User Activity</h3>
            <div class="chart-placeholder">
              <div class="activity-list">
                <div class="activity-item">
                  <div class="activity-dot"></div>
                  <div>New user registered</div>
                  <div class="activity-time">2m ago</div>
                </div>
                <div class="activity-item">
                  <div class="activity-dot"></div>
                  <div>Order #1234 completed</div>
                  <div class="activity-time">5m ago</div>
                </div>
                <div class="activity-item">
                  <div class="activity-dot"></div>
                  <div>Payment received</div>
                  <div class="activity-time">12m ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}

.dashboard {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: #2d3748;
  color: white;
  padding: 2rem 0;
}

.sidebar-header {
  padding: 0 1.5rem 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h2 {
  font-size: 1.5rem;
}

.sidebar-nav {
  padding: 1rem 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-item.active {
  background: rgba(66, 153, 225, 0.2);
  color: white;
  border-left: 3px solid #4299e1;
}

.icon {
  font-size: 1.25rem;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  color: #2d3748;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar {
  width: 40px;
  height: 40px;
  background: #4299e1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-label {
  color: #718096;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.stat-change {
  font-size: 0.875rem;
  font-weight: 600;
}

.stat-change.positive {
  color: #48bb78;
}

.stat-change.negative {
  color: #f56565;
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  margin-bottom: 1rem;
  color: #2d3748;
}

.chart-placeholder {
  height: 200px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 100%;
  gap: 0.5rem;
}

.bar {
  flex: 1;
  background: linear-gradient(to top, #4299e1, #63b3ed);
  border-radius: 4px 4px 0 0;
  min-height: 20px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f7fafc;
  border-radius: 6px;
}

.activity-dot {
  width: 8px;
  height: 8px;
  background: #4299e1;
  border-radius: 50%;
}

.activity-time {
  margin-left: auto;
  color: #718096;
  font-size: 0.875rem;
}`
    }
  },
  'main.js': {
    file: {
      contents: `console.log('Dashboard initialized!');

// Add navigation interactivity
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    console.log('Navigation:', item.textContent.trim());
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
