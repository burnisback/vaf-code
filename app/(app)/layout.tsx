'use client';

import { AuthProvider } from '@/providers';
import { AppShell } from '@/components/app';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-theme">
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </div>
  );
}
