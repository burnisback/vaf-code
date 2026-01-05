'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

export function MarketingHeader() {
  return (
    <header className="h-16 border-b border-[var(--color-border-default)] bg-[var(--color-surface-primary)]">
      <div className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-[var(--color-text-primary)]">
            VAF Code
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              Pricing
            </Link>
            <Link href="/docs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              Docs
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
