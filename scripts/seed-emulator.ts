/**
 * Seed Script for Firebase Emulators
 *
 * This script populates the local Firestore emulator with sample data
 * for development and testing.
 *
 * Usage:
 *   npx ts-node scripts/seed-emulator.ts
 *
 * Prerequisites:
 *   - Firebase emulators must be running
 *   - Run from the src directory
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';

// Firebase config (same as app)
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'vaf-system',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Connect to emulators
connectFirestoreEmulator(db, 'localhost', 8080);
connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

// Sample data
const SAMPLE_USER = {
  email: 'demo@example.com',
  password: 'demo123456',
  name: 'Demo User',
};

const SAMPLE_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with a clean slate. Perfect for experienced developers.',
    icon: '📄',
    category: 'Basic',
    tags: ['starter', 'minimal'],
    popularity: 100,
    active: true,
  },
  {
    id: 'nextjs',
    name: 'Next.js App',
    description: 'Full-stack React framework with SSR, API routes, and optimized performance.',
    icon: '▲',
    category: 'Framework',
    tags: ['react', 'ssr', 'fullstack'],
    popularity: 95,
    active: true,
  },
  {
    id: 'react',
    name: 'React SPA',
    description: 'Single page application powered by Vite for lightning-fast development.',
    icon: '⚛️',
    category: 'Framework',
    tags: ['react', 'vite', 'spa'],
    popularity: 90,
    active: true,
  },
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Beautiful marketing landing page with hero, features, and CTA sections.',
    icon: '🚀',
    category: 'Marketing',
    tags: ['marketing', 'responsive', 'conversion'],
    popularity: 88,
    active: true,
  },
  {
    id: 'dashboard',
    name: 'Admin Dashboard',
    description: 'Feature-rich admin dashboard with charts, tables, and user management.',
    icon: '📊',
    category: 'Application',
    tags: ['admin', 'charts', 'tables'],
    popularity: 85,
    active: true,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Store',
    description: 'Complete online store with product catalog, cart, and checkout.',
    icon: '🛒',
    category: 'Application',
    tags: ['shop', 'payments', 'cart'],
    popularity: 82,
    active: true,
  },
];

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');

  try {
    // 1. Create demo user in Auth
    console.log('Creating demo user...');
    let userId: string;

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        SAMPLE_USER.email,
        SAMPLE_USER.password
      );
      userId = credential.user.uid;
      console.log(`  ✓ Created auth user: ${SAMPLE_USER.email}`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`  ⚠ User already exists, using existing...`);
        // In real scenario, you'd sign in and get the UID
        userId = 'demo-user-id';
      } else {
        throw error;
      }
    }

    // 2. Create user document
    console.log('\nCreating user document...');
    const now = Timestamp.now();
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      email: SAMPLE_USER.email,
      name: SAMPLE_USER.name,
      createdAt: now,
      updatedAt: now,
      plan: 'free',
    });
    console.log('  ✓ User document created');

    // 3. Create user preferences
    console.log('\nCreating user preferences...');
    await setDoc(doc(db, 'users', userId, 'preferences', 'settings'), {
      theme: 'dark',
      editorFontSize: 14,
      notifications: {
        email: true,
        push: false,
        marketing: false,
      },
      editor: {
        autoSave: true,
        wordWrap: true,
        minimap: false,
      },
      updatedAt: now,
    });
    console.log('  ✓ Preferences created');

    // 4. Create usage summary
    console.log('\nCreating usage summary...');
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await setDoc(doc(db, 'usage', userId, 'summary', 'current'), {
      period: 'monthly',
      periodStart: Timestamp.fromDate(periodStart),
      periodEnd: Timestamp.fromDate(periodEnd),
      totalProjects: 3,
      deployments: 24,
      buildMinutes: 450,
      bandwidth: 2.4,
      aiTokens: 15000,
    });
    console.log('  ✓ Usage summary created');

    // 5. Create sample projects
    console.log('\nCreating sample projects...');
    const sampleProjects = [
      {
        userId,
        name: 'E-commerce Dashboard',
        description: 'A modern e-commerce admin dashboard with analytics',
        status: 'active',
        framework: 'Next.js',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)),
      },
      {
        userId,
        name: 'Portfolio Website',
        description: 'Personal portfolio with blog integration',
        status: 'active',
        framework: 'React',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
      },
      {
        userId,
        name: 'API Documentation',
        description: 'Interactive API docs with live examples',
        status: 'draft',
        framework: 'Next.js',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
      },
    ];

    for (const project of sampleProjects) {
      const docRef = await addDoc(collection(db, 'projects'), project);
      console.log(`  ✓ Created project: ${project.name} (${docRef.id})`);
    }

    // 6. Seed templates
    console.log('\nSeeding templates...');
    for (const template of SAMPLE_TEMPLATES) {
      await setDoc(doc(db, 'templates', template.id), template);
      console.log(`  ✓ Created template: ${template.name}`);
    }

    console.log('\n✅ Database seeded successfully!\n');
    console.log('Demo credentials:');
    console.log(`  Email: ${SAMPLE_USER.email}`);
    console.log(`  Password: ${SAMPLE_USER.password}`);
    console.log('\nYou can now use these credentials to log in.\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the seed
seedDatabase();
