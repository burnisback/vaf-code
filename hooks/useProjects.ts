'use client';

/**
 * Projects Hook
 *
 * Hook for managing user projects with Firestore.
 * Provides real-time updates and CRUD operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useFirebaseAuth } from '@/providers';
import type { Project, ProjectStatus, ProjectUI } from '@/lib/firebase/types';

interface UseProjectsOptions {
  status?: ProjectStatus;
  realtime?: boolean;
}

interface UseProjectsReturn {
  projects: ProjectUI[];
  isLoading: boolean;
  error: string | null;
  createProject: (data: CreateProjectData) => Promise<string>;
  updateProject: (projectId: string, updates: UpdateProjectData) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshProjects: () => void;
}

interface CreateProjectData {
  name: string;
  description?: string;
  framework?: string;
  templateId?: string;
}

interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * Format Firestore timestamp to relative time string
 */
function formatRelativeTime(timestamp: any): string {
  const now = Date.now();
  const date = timestamp.toDate().getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  return timestamp.toDate().toLocaleDateString();
}

/**
 * Convert Firestore Project to UI-friendly format
 */
function projectToUI(project: Project): ProjectUI {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    framework: project.framework,
    updatedAt: formatRelativeTime(project.updatedAt),
    createdAt: formatRelativeTime(project.createdAt),
  };
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const { status, realtime = true } = options;
  const { user, isLoading: authLoading } = useFirebaseAuth();

  const [projects, setProjects] = useState<ProjectUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fetch/subscribe to projects
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    async function setupListener() {
      if (!user) return;

      try {
        const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
        const { collection, query, where, orderBy, onSnapshot } = await import('firebase/firestore');

        const db = await getFirebaseDbAsync();
        const projectsRef = collection(db, 'projects');

        // Build query - note: compound queries need indexes
        let q = query(
          projectsRef,
          where('userId', '==', user.id),
          orderBy('updatedAt', 'desc')
        );

        if (realtime) {
          // Real-time subscription
          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              const projectList: ProjectUI[] = snapshot.docs
                .map((doc) => {
                  const data = doc.data() as Project;
                  // Filter out deleted projects client-side
                  if (data.deletedAt) return null;
                  // Filter by status if specified
                  if (status && data.status !== status) return null;
                  return projectToUI({ ...data, id: doc.id });
                })
                .filter((p): p is ProjectUI => p !== null);
              setProjects(projectList);
              setIsLoading(false);
              setError(null);
            },
            (err) => {
              console.error('Error fetching projects:', err);
              setError('Failed to load projects');
              setIsLoading(false);
            }
          );
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error setting up projects listener:', err);
        setError('Failed to initialize projects');
        setIsLoading(false);
      }
    }

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, authLoading, status, realtime, refreshCounter]);

  const createProject = useCallback(
    async (data: CreateProjectData): Promise<string> => {
      if (!user) {
        throw new Error('Must be logged in to create a project');
      }

      const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');

      const db = await getFirebaseDbAsync();
      const now = Timestamp.now();

      const projectData: Omit<Project, 'id'> = {
        userId: user.id,
        name: data.name.trim(),
        description: data.description?.trim() || '',
        status: 'draft',
        framework: data.framework || 'React',
        templateId: data.templateId,
        createdAt: now,
        updatedAt: now,
      };

      try {
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        return docRef.id;
      } catch (err: any) {
        console.error('Error creating project:', err);
        throw new Error(err.message || 'Failed to create project');
      }
    },
    [user]
  );

  const updateProject = useCallback(
    async (projectId: string, updates: UpdateProjectData): Promise<void> => {
      if (!user) {
        throw new Error('Must be logged in to update a project');
      }

      const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

      const db = await getFirebaseDbAsync();
      const projectRef = doc(db, 'projects', projectId);

      const updateData: Record<string, any> = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name !== undefined) {
        updateData.name = updates.name.trim();
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description.trim();
      }
      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }

      try {
        await updateDoc(projectRef, updateData);
      } catch (err: any) {
        console.error('Error updating project:', err);
        throw new Error(err.message || 'Failed to update project');
      }
    },
    [user]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<void> => {
      if (!user) {
        throw new Error('Must be logged in to delete a project');
      }

      const { getFirebaseDbAsync } = await import('@/lib/firebase/client');
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');

      const db = await getFirebaseDbAsync();
      const projectRef = doc(db, 'projects', projectId);

      // Soft delete
      try {
        await updateDoc(projectRef, {
          deletedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } catch (err: any) {
        console.error('Error deleting project:', err);
        throw new Error(err.message || 'Failed to delete project');
      }
    },
    [user]
  );

  const refreshProjects = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  return {
    projects,
    isLoading: isLoading || authLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects,
  };
}
