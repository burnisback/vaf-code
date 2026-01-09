'use client';

/**
 * Bolt Playground Page
 *
 * Entry point for the /bolt-playground route.
 * Uses dynamic import to avoid SSR issues with WebContainer.
 */

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2, Zap } from 'lucide-react';

// Dynamic import with SSR disabled (WebContainer requires browser environment)
const BoltPlaygroundLayout = dynamic(
  () => import('@/components/bolt/BoltPlaygroundLayout').then((mod) => mod.BoltPlaygroundLayout),
  {
    ssr: false,
    loading: () => <InitialLoadingScreen />,
  }
);

/**
 * Initial loading screen shown before the component loads
 */
function InitialLoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Bolt Playground</h1>
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main page component
 */
export default function BoltPlaygroundPage() {
  return (
    <Suspense fallback={<InitialLoadingScreen />}>
      <BoltPlaygroundLayout templateId="react-vite" />
    </Suspense>
  );
}
