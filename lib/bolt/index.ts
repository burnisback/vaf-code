/**
 * Bolt Library Index
 *
 * Re-exports for the Bolt playground system.
 */

// Types
export * from './types';

// WebContainer
export { BoltWebContainerProvider, useBoltWebContainer } from './webcontainer/context';
export { getTemplate, getTemplateFiles, reactViteTemplate } from './webcontainer/templates';

// AI
export * from './ai/prompts';
export * from './ai/parser';
