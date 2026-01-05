/**
 * Next.js Template
 * Next.js App Router starter
 */

import { FileSystemTree } from '@webcontainer/api';

export const nextjsTemplate: FileSystemTree = {
  'package.json': {
    file: {
      contents: JSON.stringify({
        name: 'nextjs-app',
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          next: '^14.0.0'
        },
        devDependencies: {
          '@types/node': '^20',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          typescript: '^5',
          autoprefixer: '^10.4.16',
          postcss: '^8.4.32',
          tailwindcss: '^3.4.0'
        }
      }, null, 2)
    }
  },
  'next.config.js': {
    file: {
      contents: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;`
    }
  },
  'tsconfig.json': {
    file: {
      contents: JSON.stringify({
        compilerOptions: {
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] }
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules']
      }, null, 2)
    }
  },
  'tailwind.config.ts': {
    file: {
      contents: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;`
    }
  },
  'postcss.config.js': {
    file: {
      contents: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`
    }
  },
  src: {
    directory: {
      app: {
        directory: {
          'layout.tsx': {
            file: {
              contents: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next.js App",
  description: "Built with Next.js App Router",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`
            }
          },
          'page.tsx': {
            file: {
              contents: `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Welcome to Next.js
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Start building your app with the App Router
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://nextjs.org/docs"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            target="_blank"
          >
            Documentation
          </a>
          <a
            href="https://nextjs.org/learn"
            className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition"
            target="_blank"
          >
            Learn Next.js
          </a>
        </div>
      </div>
    </main>
  );
}`
            }
          },
          'globals.css': {
            file: {
              contents: `@tailwind base;
@tailwind components;
@tailwind utilities;`
            }
          }
        }
      }
    }
  }
};
