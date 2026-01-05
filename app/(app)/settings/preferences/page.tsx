'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { getFirebaseDbAsync } from '@/lib/firebase/client';

export default function PreferencesPage() {
  const { user } = useAuth();
  const [theme, setTheme] = useState('dark');
  const [editorFontSize, setEditorFontSize] = useState('14');
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false,
  });
  const [editorSettings, setEditorSettings] = useState({
    autoSave: true,
    wordWrap: true,
    minimap: false,
  });
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load preferences from Firestore
  useEffect(() => {
    async function loadPreferences() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const db = await getFirebaseDbAsync();

        const prefsDoc = await getDoc(doc(db, 'users', user.id, 'preferences', 'settings'));

        if (prefsDoc.exists()) {
          const data = prefsDoc.data();
          if (data.theme) setTheme(data.theme);
          if (data.editorFontSize) setEditorFontSize(String(data.editorFontSize));
          if (data.notifications) setNotifications(data.notifications);
          if (data.editor) setEditorSettings(data.editor);
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      setError('You must be logged in to save preferences');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const { doc, setDoc, Timestamp } = await import('firebase/firestore');
      const db = await getFirebaseDbAsync();

      await setDoc(doc(db, 'users', user.id, 'preferences', 'settings'), {
        theme,
        editorFontSize: parseInt(editorFontSize),
        notifications,
        editor: editorSettings,
        updatedAt: Timestamp.now(),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      setError(err.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Preferences</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Customize your experience
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-8 border-b border-[var(--color-border-default)]">
        <TabButton href="/settings">Account</TabButton>
        <TabButton href="/settings/billing">Billing</TabButton>
        <TabButton active>Preferences</TabButton>
      </div>

      {/* Appearance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {['light', 'dark', 'system'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    theme === t
                      ? 'bg-[var(--color-accent-primary)] text-white'
                      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Editor Font Size
            </label>
            <select
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(e.target.value)}
              className="px-3 py-2 rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-sm"
            >
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Email Notifications"
            description="Receive updates about your projects via email"
            checked={notifications.email}
            onChange={(checked) => setNotifications((prev) => ({ ...prev, email: checked }))}
          />
          <ToggleSetting
            label="Push Notifications"
            description="Get notified about builds and deployments"
            checked={notifications.push}
            onChange={(checked) => setNotifications((prev) => ({ ...prev, push: checked }))}
          />
          <ToggleSetting
            label="Marketing Emails"
            description="Receive tips, updates, and promotional content"
            checked={notifications.marketing}
            onChange={(checked) => setNotifications((prev) => ({ ...prev, marketing: checked }))}
          />
        </CardContent>
      </Card>

      {/* Editor Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSetting
            label="Auto Save"
            description="Automatically save files as you edit"
            checked={editorSettings.autoSave}
            onChange={(checked) => setEditorSettings(prev => ({ ...prev, autoSave: checked }))}
          />
          <ToggleSetting
            label="Word Wrap"
            description="Wrap long lines in the editor"
            checked={editorSettings.wordWrap}
            onChange={(checked) => setEditorSettings(prev => ({ ...prev, wordWrap: checked }))}
          />
          <ToggleSetting
            label="Minimap"
            description="Show code minimap in the editor"
            checked={editorSettings.minimap}
            onChange={(checked) => setEditorSettings(prev => ({ ...prev, minimap: checked }))}
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        {error && (
          <span className="text-sm text-[var(--color-error)]">{error}</span>
        )}
        <Button onClick={handleSave} isLoading={isSaving} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Save Preferences'}
        </Button>
        {saved && (
          <span className="text-sm text-[var(--color-success)]">
            Preferences saved successfully
          </span>
        )}
      </div>
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

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="text-sm text-[var(--color-text-tertiary)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[var(--color-accent-primary)]' : 'bg-[var(--color-surface-tertiary)]'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
