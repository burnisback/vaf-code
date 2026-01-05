'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      await signup(email, password, name);
      router.push('/projects');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm">
              {error}
            </div>
          )}

          <Input
            label="Name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Create a password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Create Account
          </Button>

          <p className="text-center text-sm text-[var(--color-text-secondary)]">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--color-accent-primary)] hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-[var(--color-text-tertiary)]">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-[var(--color-text-secondary)]">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-[var(--color-text-secondary)]">
              Privacy Policy
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
