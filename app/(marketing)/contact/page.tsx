'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock submission
    setSubmitted(true);
  };

  return (
    <div className="py-12 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">Contact Us</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          Have a question or feedback? We&apos;d love to hear from you.
        </p>

        {submitted ? (
          <div className="p-6 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
            <h2 className="text-lg font-semibold text-[var(--color-success)] mb-2">
              Message Sent!
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Name"
              placeholder="Your name"
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
            />
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Message
              </label>
              <textarea
                className="w-full min-h-[150px] px-3 py-2 rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
                placeholder="How can we help?"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
        )}

        <div className="mt-12 pt-8 border-t border-[var(--color-border-default)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Other Ways to Reach Us
          </h2>
          <div className="space-y-3 text-[var(--color-text-secondary)]">
            <p>Email: support@vafcode.com</p>
            <p>Twitter: @vafcode</p>
            <p>GitHub: github.com/vafcode</p>
          </div>
        </div>
      </div>
    </div>
  );
}
