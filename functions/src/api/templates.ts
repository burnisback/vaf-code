/**
 * Templates API
 *
 * Template listing and retrieval (read-only for users).
 */

import { onCall } from 'firebase-functions/v2/https';
import { getDb, Collections } from '../utils/firebase';
import { Template } from '../types';
import { handleError, NotFoundError } from '../utils/errors';

interface ListTemplatesRequest {
  category?: string;
  limit?: number;
}

interface ListTemplatesResponse {
  templates: Template[];
}

/**
 * List available templates
 */
export const listTemplates = onCall<ListTemplatesRequest, Promise<ListTemplatesResponse>>(
  { cors: true },
  async (request) => {
    try {
      // Templates are public - no auth required
      const { category, limit = 50 } = request.data || {};

      const db = getDb();
      let query = db
        .collection(Collections.TEMPLATES)
        .where('active', '==', true)
        .orderBy('popularity', 'desc')
        .limit(limit);

      if (category && category !== 'All') {
        query = query.where('category', '==', category);
      }

      const snapshot = await query.get();
      const templates: Template[] = snapshot.docs.map((doc) => doc.data() as Template);

      return { templates };
    } catch (error) {
      throw handleError(error);
    }
  }
);

/**
 * Get a single template by ID
 */
export const getTemplate = onCall<{ templateId: string }, Promise<Template>>(
  { cors: true },
  async (request) => {
    try {
      const { templateId } = request.data;

      if (!templateId) {
        throw new NotFoundError('Template');
      }

      const db = getDb();
      const templateDoc = await db.collection(Collections.TEMPLATES).doc(templateId).get();

      if (!templateDoc.exists) {
        throw new NotFoundError('Template');
      }

      const template = templateDoc.data() as Template;

      if (!template.active) {
        throw new NotFoundError('Template');
      }

      return template;
    } catch (error) {
      throw handleError(error);
    }
  }
);
