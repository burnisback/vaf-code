/**
 * VAF Code Cloud Functions
 *
 * Firebase Cloud Functions (Gen 2) for the VAF Code application.
 * Handles auth triggers, project CRUD, preferences, usage tracking, and AI.
 */

// Auth triggers
export { onUserCreated, onUserDeleted } from './triggers/auth';

// Project API
export {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
} from './api/projects';

// Preferences API
export { getPreferences, updatePreferences } from './api/preferences';

// Usage API
export { getUsageSummary, recordUsage } from './api/usage';

// Templates API
export { listTemplates, getTemplate } from './api/templates';

// AI API
export { aiChat, aiGenerateProject } from './api/ai';
