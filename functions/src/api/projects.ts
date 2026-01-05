/**
 * Projects API
 *
 * CRUD operations for user projects.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getDb, Collections, Subcollections } from '../utils/firebase';
import {
  Project,
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsRequest,
  ListProjectsResponse,
  UpdateProjectRequest,
  PLAN_LIMITS,
  UserPlan,
} from '../types';
import { handleError, ValidationError, NotFoundError, QuotaExceededError } from '../utils/errors';

/**
 * Create a new project
 */
export const createProject = onCall<CreateProjectRequest, Promise<CreateProjectResponse>>(
  { cors: true },
  async (request) => {
    try {
      // Auth check
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const { name, description = '', templateId, framework = 'React' } = request.data;

      // Validation
      if (!name || name.trim().length === 0) {
        throw new ValidationError('Project name is required');
      }

      if (name.length > 100) {
        throw new ValidationError('Project name must be 100 characters or less');
      }

      const db = getDb();

      // Check project quota
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const userPlan = (userDoc.data()?.plan || 'free') as UserPlan;
      const limits = PLAN_LIMITS[userPlan];

      // Count existing projects
      const existingProjects = await db
        .collection(Collections.PROJECTS)
        .where('userId', '==', userId)
        .where('deletedAt', '==', null)
        .count()
        .get();

      if (existingProjects.data().count >= limits.projects) {
        throw new QuotaExceededError('projects');
      }

      const now = Timestamp.now();
      const projectRef = db.collection(Collections.PROJECTS).doc();

      const project: Project = {
        id: projectRef.id,
        userId,
        name: name.trim(),
        description: description.trim(),
        status: 'draft',
        framework,
        templateId,
        createdAt: now,
        updatedAt: now,
      };

      await projectRef.set(project);

      // Update usage counter
      const usageRef = db
        .collection(Collections.USAGE)
        .doc(userId)
        .collection(Subcollections.SUMMARY)
        .doc('current');

      await usageRef.update({
        totalProjects: FieldValue.increment(1),
      });

      console.log(`Created project ${project.id} for user ${userId}`);

      return {
        projectId: project.id,
        project,
      };
    } catch (error) {
      throw handleError(error);
    }
  }
);

/**
 * List user's projects with optional filtering and pagination
 */
export const listProjects = onCall<ListProjectsRequest, Promise<ListProjectsResponse>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const { status, limit = 20, startAfter } = request.data || {};

      const db = getDb();
      let query = db
        .collection(Collections.PROJECTS)
        .where('userId', '==', userId)
        .where('deletedAt', '==', null)
        .orderBy('updatedAt', 'desc')
        .limit(limit + 1); // Fetch one extra to check if there are more

      if (status) {
        query = query.where('status', '==', status);
      }

      if (startAfter) {
        const startDoc = await db.collection(Collections.PROJECTS).doc(startAfter).get();
        if (startDoc.exists) {
          query = query.startAfter(startDoc);
        }
      }

      const snapshot = await query.get();
      const projects: Project[] = [];
      let hasMore = false;

      snapshot.docs.forEach((doc, index) => {
        if (index < limit) {
          projects.push(doc.data() as Project);
        } else {
          hasMore = true;
        }
      });

      return {
        projects,
        hasMore,
        nextCursor: hasMore ? projects[projects.length - 1]?.id : undefined,
      };
    } catch (error) {
      throw handleError(error);
    }
  }
);

/**
 * Get a single project by ID
 */
export const getProject = onCall<{ projectId: string }, Promise<Project>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const { projectId } = request.data;

      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }

      const db = getDb();
      const projectDoc = await db.collection(Collections.PROJECTS).doc(projectId).get();

      if (!projectDoc.exists) {
        throw new NotFoundError('Project');
      }

      const project = projectDoc.data() as Project;

      // Ownership check
      if (project.userId !== userId) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Check if soft deleted
      if (project.deletedAt) {
        throw new NotFoundError('Project');
      }

      return project;
    } catch (error) {
      throw handleError(error);
    }
  }
);

/**
 * Update a project
 */
export const updateProject = onCall<UpdateProjectRequest, Promise<{ success: boolean }>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const { projectId, updates } = request.data;

      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }

      const db = getDb();
      const projectRef = db.collection(Collections.PROJECTS).doc(projectId);
      const projectDoc = await projectRef.get();

      if (!projectDoc.exists) {
        throw new NotFoundError('Project');
      }

      const project = projectDoc.data() as Project;

      // Ownership check
      if (project.userId !== userId) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      if (project.deletedAt) {
        throw new NotFoundError('Project');
      }

      // Build update object
      const updateData: Partial<Project> & { updatedAt: Timestamp } = {
        updatedAt: Timestamp.now(),
      };

      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new ValidationError('Project name cannot be empty');
        }
        updateData.name = updates.name.trim();
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description.trim();
      }

      if (updates.status !== undefined) {
        if (!['active', 'draft', 'archived'].includes(updates.status)) {
          throw new ValidationError('Invalid status');
        }
        updateData.status = updates.status;
      }

      await projectRef.update(updateData);

      console.log(`Updated project ${projectId} for user ${userId}`);

      return { success: true };
    } catch (error) {
      throw handleError(error);
    }
  }
);

/**
 * Soft delete a project
 */
export const deleteProject = onCall<{ projectId: string }, Promise<{ success: boolean }>>(
  { cors: true },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
      }

      const userId = request.auth.uid;
      const { projectId } = request.data;

      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }

      const db = getDb();
      const projectRef = db.collection(Collections.PROJECTS).doc(projectId);
      const projectDoc = await projectRef.get();

      if (!projectDoc.exists) {
        throw new NotFoundError('Project');
      }

      const project = projectDoc.data() as Project;

      // Ownership check
      if (project.userId !== userId) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      // Soft delete
      await projectRef.update({
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log(`Soft deleted project ${projectId} for user ${userId}`);

      return { success: true };
    } catch (error) {
      throw handleError(error);
    }
  }
);
