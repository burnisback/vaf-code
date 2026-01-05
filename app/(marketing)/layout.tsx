import { MarketingHeader, Footer } from '@/components/marketing';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-primary)]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
