'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import IDELayout to prevent SSR issues with WebContainer
const IDELayout = dynamic(
  () => import('@/components/ide/IDELayout').then(mod => ({ default: mod.IDELayout })),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen bg-[var(--color-surface-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full mx-auto mb-3" />
          <div className="text-[var(--color-text-secondary)] text-sm">Loading IDE...</div>
        </div>
      </div>
    )
  }
);

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const template = searchParams.get('template') || 'blank';
  const projectName = searchParams.get('name') || 'Untitled Project';

  return <IDELayout template={template} projectName={projectName} />;
}

export default function PlaygroundTerminalPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[var(--color-surface-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full mx-auto mb-3" />
          <div className="text-[var(--color-text-secondary)] text-sm">Loading...</div>
        </div>
      </div>
    }>
      <PlaygroundContent />
    </Suspense>
  );
}
