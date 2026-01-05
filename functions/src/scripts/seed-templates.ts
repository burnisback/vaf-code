/**
 * Seed Templates Script
 *
 * Seeds the templates collection in Firestore.
 * Run this after deploying to production to populate templates.
 *
 * Usage (from functions directory):
 *   npx ts-node src/scripts/seed-templates.ts
 */

import * as admin from 'firebase-admin';

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp();
const db = admin.firestore();

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with a clean slate. Perfect for experienced developers who want full control.',
    icon: '📄',
    category: 'Basic',
    tags: ['starter', 'minimal'],
    popularity: 100,
    active: true,
  },
  {
    id: 'nextjs',
    name: 'Next.js App',
    description: 'Full-stack React framework with server-side rendering, API routes, and optimized performance.',
    icon: '▲',
    category: 'Framework',
    tags: ['react', 'ssr', 'fullstack'],
    popularity: 95,
    active: true,
  },
  {
    id: 'react',
    name: 'React SPA',
    description: 'Single page application powered by Vite for lightning-fast development and HMR.',
    icon: '⚛️',
    category: 'Framework',
    tags: ['react', 'vite', 'spa'],
    popularity: 90,
    active: true,
  },
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Beautiful marketing landing page with hero section, features, testimonials, and CTA.',
    icon: '🚀',
    category: 'Marketing',
    tags: ['marketing', 'responsive', 'conversion'],
    popularity: 88,
    active: true,
  },
  {
    id: 'dashboard',
    name: 'Admin Dashboard',
    description: 'Feature-rich admin dashboard with charts, data tables, and user management.',
    icon: '📊',
    category: 'Application',
    tags: ['admin', 'charts', 'tables'],
    popularity: 85,
    active: true,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Store',
    description: 'Complete online store with product catalog, cart, checkout, and payment integration.',
    icon: '🛒',
    category: 'Application',
    tags: ['shop', 'payments', 'cart'],
    popularity: 82,
    active: true,
  },
  {
    id: 'blog',
    name: 'Blog Platform',
    description: 'Modern blog with MDX support, syntax highlighting, and SEO optimization.',
    icon: '✍️',
    category: 'Content',
    tags: ['blog', 'mdx', 'seo'],
    popularity: 78,
    active: true,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Showcase your work with a stunning portfolio site featuring project galleries.',
    icon: '🎨',
    category: 'Personal',
    tags: ['portfolio', 'gallery', 'personal'],
    popularity: 75,
    active: true,
  },
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Complete SaaS boilerplate with auth, billing, teams, and subscription management.',
    icon: '💼',
    category: 'Application',
    tags: ['saas', 'auth', 'billing'],
    popularity: 80,
    active: true,
  },
  {
    id: 'docs',
    name: 'Documentation',
    description: 'Beautiful documentation site with search, versioning, and code examples.',
    icon: '📚',
    category: 'Content',
    tags: ['docs', 'search', 'versioning'],
    popularity: 72,
    active: true,
  },
  {
    id: 'api',
    name: 'API Starter',
    description: 'Backend API boilerplate with authentication, rate limiting, and OpenAPI docs.',
    icon: '🔌',
    category: 'Backend',
    tags: ['api', 'rest', 'openapi'],
    popularity: 70,
    active: true,
  },
  {
    id: 'mobile',
    name: 'Mobile Web App',
    description: 'Progressive Web App optimized for mobile devices with offline support.',
    icon: '📱',
    category: 'Application',
    tags: ['pwa', 'mobile', 'offline'],
    popularity: 68,
    active: true,
  },
];

async function seedTemplates() {
  console.log('🌱 Seeding templates...\n');

  const batch = db.batch();

  for (const template of TEMPLATES) {
    const ref = db.collection('templates').doc(template.id);
    batch.set(ref, template);
    console.log(`  Preparing: ${template.name}`);
  }

  await batch.commit();

  console.log(`\n✅ Successfully seeded ${TEMPLATES.length} templates!\n`);
  process.exit(0);
}

seedTemplates().catch((error) => {
  console.error('❌ Failed to seed templates:', error);
  process.exit(1);
});
