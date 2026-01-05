import Link from 'next/link';
import { Button } from '@/components/ui';

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] mb-6">
            Build Web Apps with AI
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] mb-8 max-w-2xl mx-auto">
            VAF Code is an AI-powered web IDE that helps you create, edit, and deploy
            web applications faster than ever before.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg">Start Building Free</Button>
            </Link>
            <Link href="/docs">
              <Button variant="secondary" size="lg">View Documentation</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-[var(--color-surface-secondary)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="AI-Powered Coding"
              description="Get intelligent code suggestions and let AI help you build features faster."
            />
            <FeatureCard
              title="Live Preview"
              description="See your changes instantly with real-time preview as you code."
            />
            <FeatureCard
              title="Built-in Terminal"
              description="Run commands and manage your project without leaving the browser."
            />
            <FeatureCard
              title="File Management"
              description="Organize your project with an intuitive file explorer and editor tabs."
            />
            <FeatureCard
              title="Modern Stack"
              description="Built for React, Next.js, TypeScript, and modern web development."
            />
            <FeatureCard
              title="Easy Deployment"
              description="Deploy your projects with one click to your preferred hosting platform."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] mb-8">
            Join thousands of developers building with VAF Code.
          </p>
          <Link href="/signup">
            <Button size="lg">Create Free Account</Button>
          </Link>
        </div>
      </section>
    </>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-default)]">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
      <p className="text-[var(--color-text-secondary)]">{description}</p>
    </div>
  );
}
