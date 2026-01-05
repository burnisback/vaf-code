'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Card, CardContent } from '@/components/ui';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

const templates: Template[] = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with a clean slate',
    icon: '📄',
    category: 'Basic',
  },
  {
    id: 'nextjs',
    name: 'Next.js App',
    description: 'Full-stack React framework with SSR',
    icon: '▲',
    category: 'Framework',
  },
  {
    id: 'react',
    name: 'React SPA',
    description: 'Single page application with Vite',
    icon: '⚛️',
    category: 'Framework',
  },
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Marketing landing page template',
    icon: '🚀',
    category: 'Template',
  },
  {
    id: 'dashboard',
    name: 'Admin Dashboard',
    description: 'Dashboard with charts and tables',
    icon: '📊',
    category: 'Template',
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Online store with cart and checkout',
    icon: '🛒',
    category: 'Template',
  },
];

type Step = 'template' | 'details' | 'creating';

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleContinue = () => {
    if (step === 'template' && selectedTemplate) {
      setStep('details');
    } else if (step === 'details' && projectName) {
      handleCreate();
    }
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName) {
      setError('Please select a template and enter a project name');
      return;
    }

    setStep('creating');
    setIsCreating(true);
    setError('');

    // Redirect to playground-terminal with template and project name
    router.push(`/playground-terminal?template=${selectedTemplate}&name=${encodeURIComponent(projectName)}`);
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('template');
    }
  };

  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Projects
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Create New Project</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          {step === 'template' && 'Choose a template to get started'}
          {step === 'details' && 'Configure your project details'}
          {step === 'creating' && 'Setting up your project...'}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        <StepIndicator number={1} label="Template" active={step === 'template'} completed={step !== 'template'} />
        <div className="flex-1 h-px bg-[var(--color-border-default)]" />
        <StepIndicator number={2} label="Details" active={step === 'details'} completed={step === 'creating'} />
        <div className="flex-1 h-px bg-[var(--color-border-default)]" />
        <StepIndicator number={3} label="Create" active={step === 'creating'} completed={false} />
      </div>

      {/* Step Content */}
      {step === 'template' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  selectedTemplate === template.id
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                    : 'border-[var(--color-border-default)] hover:border-[var(--color-border-hover)] bg-[var(--color-surface-secondary)]'
                }`}
              >
                <div className="text-3xl mb-3">{template.icon}</div>
                <h3 className="font-medium text-[var(--color-text-primary)] mb-1">
                  {template.name}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {template.description}
                </p>
                <span className="inline-block mt-3 text-xs px-2 py-1 rounded bg-[var(--color-surface-tertiary)] text-[var(--color-text-tertiary)]">
                  {template.category}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleContinue} disabled={!selectedTemplate}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="max-w-lg">
          <Card>
            <CardContent className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm">
                  {error}
                </div>
              )}
              <Input
                label="Project Name"
                placeholder="My Awesome Project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  placeholder="A brief description of your project"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-transparent resize-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <Button variant="secondary" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleContinue} disabled={!projectName}>
                  Create Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'creating' && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 mb-6 relative">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--color-surface-tertiary)]" />
            <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent-primary)] border-t-transparent animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Creating your project...
          </h2>
          <p className="text-[var(--color-text-secondary)]">
            This may take a few moments
          </p>
        </div>
      )}
    </div>
  );
}

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          completed
            ? 'bg-[var(--color-success)] text-white'
            : active
            ? 'bg-[var(--color-accent-primary)] text-white'
            : 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-tertiary)]'
        }`}
      >
        {completed ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <span
        className={`text-sm ${
          active ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-tertiary)]'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
