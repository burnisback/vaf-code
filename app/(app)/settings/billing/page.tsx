'use client';

import { useState } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';

interface UsageData {
  metric: string;
  used: number;
  limit: number;
  unit: string;
}

const mockUsage: UsageData[] = [
  { metric: 'Projects', used: 3, limit: 5, unit: 'projects' },
  { metric: 'Deployments', used: 24, limit: 100, unit: 'this month' },
  { metric: 'Build Minutes', used: 450, limit: 1000, unit: 'minutes' },
  { metric: 'Bandwidth', used: 2.4, limit: 10, unit: 'GB' },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: ['5 Projects', '100 Deployments/mo', '1,000 Build Minutes', '10GB Bandwidth'],
    current: true,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    features: ['Unlimited Projects', 'Unlimited Deployments', '10,000 Build Minutes', '100GB Bandwidth', 'Priority Support'],
    current: false,
    popular: true,
  },
  {
    name: 'Team',
    price: '$50',
    period: '/month',
    features: ['Everything in Pro', 'Team Collaboration', 'Advanced Analytics', 'Custom Domains', 'SSO/SAML'],
    current: false,
  },
];

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState('Free');

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Billing</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Manage your subscription and usage
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-8 border-b border-[var(--color-border-default)]">
        <TabButton href="/settings">Account</TabButton>
        <TabButton active>Billing</TabButton>
        <TabButton href="/settings/preferences">Preferences</TabButton>
      </div>

      {/* Current Plan */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Plan</CardTitle>
            <Badge variant="success">Active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-[var(--color-text-primary)]">Free</span>
            <span className="text-[var(--color-text-tertiary)]">$0/month</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            You&apos;re on the free plan. Upgrade to unlock more features.
          </p>
          <Button>Upgrade Plan</Button>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {mockUsage.map((item) => (
              <div key={item.metric}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {item.metric}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {item.used} / {item.limit} {item.unit}
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-surface-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent-primary)] rounded-full transition-all"
                    style={{ width: `${Math.min((item.used / item.limit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-lg border transition-all cursor-pointer ${
                plan.current
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5'
                  : 'border-[var(--color-border-default)] hover:border-[var(--color-border-hover)] bg-[var(--color-surface-secondary)]'
              }`}
              onClick={() => setSelectedPlan(plan.name)}
            >
              {plan.popular && (
                <Badge variant="info" className="mb-3">Most Popular</Badge>
              )}
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {plan.price}
                </span>
                <span className="text-sm text-[var(--color-text-tertiary)]">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.current ? 'secondary' : 'primary'}
                className="w-full"
                disabled={plan.current}
              >
                {plan.current ? 'Current Plan' : 'Select Plan'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            No payment method on file. Add one to upgrade your plan.
          </p>
          <Button variant="secondary">Add Payment Method</Button>
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
