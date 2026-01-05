'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Please enter your email');
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check Your Email</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--color-text-secondary)] mb-6">
            We&apos;ve sent a password reset link to <strong className="text-[var(--color-text-primary)]">{email}</strong>.
            Please check your inbox and follow the instructions.
          </p>
          <Link href="/login">
            <Button variant="secondary" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[var(--color-text-secondary)] mb-6">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Send Reset Link
          </Button>

          <p className="text-center text-sm text-[var(--color-text-secondary)]">
            Remember your password?{' '}
            <Link href="/login" className="text-[var(--color-accent-primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
