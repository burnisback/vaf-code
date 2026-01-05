'use client';

import { AuthProvider } from '@/providers';
import { AppShell } from '@/components/app';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
