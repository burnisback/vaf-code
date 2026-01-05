'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { getFirebaseDbAsync } from '@/lib/firebase/client';

export default function SettingsPage() {
  const { user, updateUserProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      // Update via auth provider (handles both Firebase Auth and Firestore)
      if (updateUserProfile) {
        await updateUserProfile({ name });
      } else {
        // Fallback: direct Firestore update
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const db = await getFirebaseDbAsync();

        if (user) {
          await updateDoc(doc(db, 'users', user.id), {
            name,
            updatedAt: Timestamp.now(),
          });
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-8 border-b border-[var(--color-border-default)]">
        <TabButton active>Account</TabButton>
        <TabButton href="/settings/billing">Billing</TabButton>
        <TabButton href="/settings/preferences">Preferences</TabButton>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm">
                {error}
              </div>
            )}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center text-white text-2xl font-medium">
                {name.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <Button type="button" variant="secondary" size="sm">
                  Change Avatar
                </Button>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  JPG, PNG or GIF. Max 2MB.
                </p>
              </div>
            </div>

            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isSaving}>
                Save Changes
              </Button>
              {saved && (
                <span className="text-sm text-[var(--color-success)]">
                  Changes saved successfully
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Update your password to keep your account secure.
          </p>
          <Button variant="secondary">Change Password</Button>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <ConnectedAccount
              name="GitHub"
              icon={<GitHubIcon />}
              connected={true}
              username="@username"
            />
            <ConnectedAccount
              name="Google"
              icon={<GoogleIcon />}
              connected={false}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-[var(--color-error)]/30">
        <CardHeader>
          <CardTitle className="text-[var(--color-error)]">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TabButton({
  children,
  active,
  href,
}: {
  children: React.ReactNode;
  active?: boolean;
  href?: string;
}) {
  const className = `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
    active
      ? 'border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]'
      : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
  }`;

  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return <button className={className}>{children}</button>;
}

function ConnectedAccount({
  name,
  icon,
  connected,
  username,
}: {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  username?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-secondary)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-tertiary)] flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{name}</p>
          {connected && username && (
            <p className="text-sm text-[var(--color-text-tertiary)]">{username}</p>
          )}
        </div>
      </div>
      <Button variant={connected ? 'secondary' : 'primary'} size="sm">
        {connected ? 'Disconnect' : 'Connect'}
      </Button>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
