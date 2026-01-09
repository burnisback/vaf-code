/**
 * Document Persistence Module Exports
 *
 * Document storage, context injection, and management for the Bolt Playground.
 */

// Types
export * from './types';

// Store
export { getDocumentStore, createResearchDocument } from './store';

// Context Injection
export { injectContext, enhancePromptWithContext } from './context';
