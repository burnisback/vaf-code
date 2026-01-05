'use client';

import Link from 'next/link';
import { AuthProvider } from '@/providers';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-[var(--color-surface-primary)]">
        <header className="h-16 flex items-center px-4">
          <Link href="/" className="text-xl font-bold text-[var(--color-text-primary)]">
            VAF Code
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
