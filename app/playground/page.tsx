'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Nice loading screen component matching the WebContainer loading overlay
function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-surface-primary)]">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--color-accent-primary)]/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[var(--color-accent-primary)] animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          Setting up your project
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Initializing development environment...
        </p>
        <div className="w-full h-2 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
          <div className="h-full w-[10%] bg-[var(--color-accent-primary)] animate-pulse" />
        </div>
        <div className="flex justify-between mt-4 text-xs text-[var(--color-text-tertiary)]">
          <span className="text-[var(--color-accent-primary)]">Boot</span>
          <span>Setup</span>
          <span>Install</span>
          <span>Start</span>
        </div>
      </div>
    </div>
  );
}

// Dynamically import IDELayout to prevent SSR issues with WebContainer
const IDELayout = dynamic(
  () => import('@/components/ide/IDELayout').then(mod => ({ default: mod.IDELayout })),
  {
    ssr: false,
    loading: () => <LoadingScreen />
  }
);

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template') || undefined;
  const projectName = searchParams.get('name') || undefined;

  return <IDELayout template={template} projectName={projectName} />;
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PlaygroundContent />
    </Suspense>
  );
}
