import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Product</h3>
            <ul className="space-y-2">
              <li><Link href="/pricing" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Pricing</Link></li>
              <li><Link href="/docs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Documentation</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Company</h3>
            <ul className="space-y-2">
              <li><Link href="/contact" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Privacy</Link></li>
              <li><Link href="/terms" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-[var(--color-border-default)]">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            &copy; {new Date().getFullYear()} VAF Code. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
