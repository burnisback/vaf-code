import Link from 'next/link';
import { Button, Badge } from '@/components/ui';

export default function PricingPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)]">
            Choose the plan that fits your needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <PricingCard
            name="Free"
            price="$0"
            description="Perfect for getting started"
            features={[
              "1 project",
              "Basic AI assistance",
              "Community support",
              "Public projects only",
            ]}
            buttonText="Get Started"
            buttonVariant="secondary"
          />

          {/* Pro Plan */}
          <PricingCard
            name="Pro"
            price="$19"
            description="For individual developers"
            features={[
              "Unlimited projects",
              "Advanced AI features",
              "Priority support",
              "Private projects",
              "Custom domains",
            ]}
            buttonText="Start Free Trial"
            buttonVariant="primary"
            popular
          />

          {/* Team Plan */}
          <PricingCard
            name="Team"
            price="$49"
            description="For teams and organizations"
            features={[
              "Everything in Pro",
              "Team collaboration",
              "Admin dashboard",
              "SSO authentication",
              "Dedicated support",
            ]}
            buttonText="Contact Sales"
            buttonVariant="secondary"
          />
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  description,
  features,
  buttonText,
  buttonVariant,
  popular,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant: "primary" | "secondary";
  popular?: boolean;
}) {
  return (
    <div className={`p-8 rounded-lg border ${popular ? 'border-[var(--color-accent-primary)] bg-[var(--color-surface-raised)]' : 'border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]'}`}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{name}</h3>
        {popular && <Badge variant="info">Popular</Badge>}
      </div>
      <div className="mb-4">
        <span className="text-4xl font-bold text-[var(--color-text-primary)]">{price}</span>
        <span className="text-[var(--color-text-secondary)]">/month</span>
      </div>
      <p className="text-[var(--color-text-secondary)] mb-6">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>
      <Link href="/signup">
        <Button variant={buttonVariant} className="w-full">{buttonText}</Button>
      </Link>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
