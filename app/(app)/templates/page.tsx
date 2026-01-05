'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, Badge, Card, CardContent } from '@/components/ui';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  popularity: number;
}

const allTemplates: Template[] = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start from scratch with a clean slate. Perfect for experienced developers who want full control.',
    icon: '📄',
    category: 'Basic',
    tags: ['starter', 'minimal'],
    popularity: 100,
  },
  {
    id: 'nextjs',
    name: 'Next.js App',
    description: 'Full-stack React framework with server-side rendering, API routes, and optimized performance.',
    icon: '▲',
    category: 'Framework',
    tags: ['react', 'ssr', 'fullstack'],
    popularity: 95,
  },
  {
    id: 'react',
    name: 'React SPA',
    description: 'Single page application powered by Vite for lightning-fast development and HMR.',
    icon: '⚛️',
    category: 'Framework',
    tags: ['react', 'vite', 'spa'],
    popularity: 90,
  },
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Beautiful marketing landing page with hero section, features, testimonials, and CTA.',
    icon: '🚀',
    category: 'Marketing',
    tags: ['marketing', 'responsive', 'conversion'],
    popularity: 88,
  },
  {
    id: 'dashboard',
    name: 'Admin Dashboard',
    description: 'Feature-rich admin dashboard with charts, data tables, and user management.',
    icon: '📊',
    category: 'Application',
    tags: ['admin', 'charts', 'tables'],
    popularity: 85,
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Store',
    description: 'Complete online store with product catalog, cart, checkout, and payment integration.',
    icon: '🛒',
    category: 'Application',
    tags: ['shop', 'payments', 'cart'],
    popularity: 82,
  },
  {
    id: 'blog',
    name: 'Blog Platform',
    description: 'Modern blog with MDX support, syntax highlighting, and SEO optimization.',
    icon: '✍️',
    category: 'Content',
    tags: ['blog', 'mdx', 'seo'],
    popularity: 78,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Showcase your work with a stunning portfolio site featuring project galleries.',
    icon: '🎨',
    category: 'Personal',
    tags: ['portfolio', 'gallery', 'personal'],
    popularity: 75,
  },
  {
    id: 'saas',
    name: 'SaaS Starter',
    description: 'Complete SaaS boilerplate with auth, billing, teams, and subscription management.',
    icon: '💼',
    category: 'Application',
    tags: ['saas', 'auth', 'billing'],
    popularity: 80,
  },
  {
    id: 'docs',
    name: 'Documentation',
    description: 'Beautiful documentation site with search, versioning, and code examples.',
    icon: '📚',
    category: 'Content',
    tags: ['docs', 'search', 'versioning'],
    popularity: 72,
  },
  {
    id: 'api',
    name: 'API Starter',
    description: 'Backend API boilerplate with authentication, rate limiting, and OpenAPI docs.',
    icon: '🔌',
    category: 'Backend',
    tags: ['api', 'rest', 'openapi'],
    popularity: 70,
  },
  {
    id: 'mobile',
    name: 'Mobile Web App',
    description: 'Progressive Web App optimized for mobile devices with offline support.',
    icon: '📱',
    category: 'Application',
    tags: ['pwa', 'mobile', 'offline'],
    popularity: 68,
  },
];

const categories = ['All', 'Basic', 'Framework', 'Marketing', 'Application', 'Content', 'Personal', 'Backend'];

export default function TemplatesPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredTemplates = allTemplates
    .filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(search.toLowerCase()) ||
        template.description.toLowerCase().includes(search.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => b.popularity - a.popularity);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Templates</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Start your project with a professionally designed template
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-[var(--color-accent-primary)] text-white'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-secondary)]">No templates match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Card className="hover:border-[var(--color-border-hover)] transition-all group overflow-hidden">
      {/* Preview Area */}
      <div className="h-40 bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)] flex items-center justify-center text-6xl">
        {template.icon}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-[var(--color-text-primary)]">
            {template.name}
          </h3>
          <Badge variant="default">{template.category}</Badge>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">
          {template.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-4">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface-tertiary)] text-[var(--color-text-tertiary)]"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/new?template=${template.id}`} className="flex-1">
            <Button className="w-full" size="sm">
              Use Template
            </Button>
          </Link>
          <Button variant="secondary" size="sm">
            Preview
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
