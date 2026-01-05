'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, Input, Badge, Card, CardContent } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { getFirebaseDbAsync } from '@/lib/firebase/client';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'draft';
  updatedAt: any;
  framework: string;
  userId?: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'updated' | 'name' | 'status';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    async function loadProjects() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { collection, query, where, orderBy, onSnapshot } = await import('firebase/firestore');
        const db = await getFirebaseDbAsync();

        const projectsQuery = query(
          collection(db, 'projects'),
          where('userId', '==', user.id),
          orderBy('updatedAt', 'desc')
        );

        const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
          const projectsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Project[];
          setProjects(projectsData);
          setIsLoading(false);
        }, (error) => {
          console.error('Error loading projects:', error);
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up projects listener:', error);
        setIsLoading(false);
      }
    }

    loadProjects();
  }, [user]);

  const formatUpdatedAt = (timestamp: any): string => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const filteredProjects = projects
    .filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.description.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0; // Keep original order for 'updated'
    });

  const statusVariant = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'warning';
      case 'archived': return 'default';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-secondary)]">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            No projects yet
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Create your first project to get started with VAF Code.
          </p>
          <Link href="/projects/new">
            <Button>Create Your First Project</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Projects</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Manage and organize your web projects
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-2 rounded-md bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-sm"
        >
          <option value="updated">Last Updated</option>
          <option value="name">Name</option>
          <option value="status">Status</option>
        </select>

        <div className="flex rounded-md border border-[var(--color-border-default)] overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
            aria-label="Grid view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'}`}
            aria-label="List view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-secondary)]">No projects match your filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} statusVariant={statusVariant} formatUpdatedAt={formatUpdatedAt} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProjects.map((project) => (
            <ProjectListItem key={project.id} project={project} statusVariant={statusVariant} formatUpdatedAt={formatUpdatedAt} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  statusVariant,
  formatUpdatedAt
}: {
  project: Project;
  statusVariant: (status: Project['status']) => 'success' | 'warning' | 'default';
  formatUpdatedAt: (timestamp: any) => string;
}) {
  return (
    <Card className="hover:border-[var(--color-border-hover)] transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <Link
              href={`/playground?project=${project.id}`}
              className="text-[var(--color-text-primary)] font-medium hover:text-[var(--color-accent-primary)] transition-colors block truncate"
            >
              {project.name}
            </Link>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
              {project.description}
            </p>
          </div>
          <ProjectMenu />
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(project.status)}>
              {project.status}
            </Badge>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {project.framework}
            </span>
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {formatUpdatedAt(project.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectListItem({
  project,
  statusVariant,
  formatUpdatedAt
}: {
  project: Project;
  statusVariant: (status: Project['status']) => 'success' | 'warning' | 'default';
  formatUpdatedAt: (timestamp: any) => string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-[var(--color-border-default)] hover:border-[var(--color-border-hover)] transition-colors bg-[var(--color-surface-secondary)]">
      <div className="flex-1 min-w-0">
        <Link
          href={`/playground?project=${project.id}`}
          className="text-[var(--color-text-primary)] font-medium hover:text-[var(--color-accent-primary)] transition-colors"
        >
          {project.name}
        </Link>
        <p className="text-sm text-[var(--color-text-secondary)] truncate">
          {project.description}
        </p>
      </div>
      <Badge variant={statusVariant(project.status)}>
        {project.status}
      </Badge>
      <span className="text-sm text-[var(--color-text-tertiary)] whitespace-nowrap">
        {project.framework}
      </span>
      <span className="text-sm text-[var(--color-text-tertiary)] whitespace-nowrap">
        {formatUpdatedAt(project.updatedAt)}
      </span>
      <ProjectMenu />
    </div>
  );
}

function ProjectMenu() {
  return (
    <button
      className="p-1 rounded hover:bg-[var(--color-surface-tertiary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
      aria-label="Project options"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
    </button>
  );
}
