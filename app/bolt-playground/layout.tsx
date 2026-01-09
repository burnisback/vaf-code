/**
 * Bolt Playground Layout
 *
 * Root layout for the /bolt-playground route.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bolt Playground | VAF',
  description: 'AI-powered code generation playground',
};

export default function BoltPlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bolt-playground-root">
      {children}
    </div>
  );
}
