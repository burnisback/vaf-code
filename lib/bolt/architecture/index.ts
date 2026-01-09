/**
 * Architecture Module (Client-Safe)
 *
 * Exports types and client-safe utilities for working with architecture documents.
 * Server-side generation must go through the API route.
 *
 * @example
 * ```ts
 * import {
 *   type ArchitectureDocument,
 *   exportArchitectureToMarkdown,
 *   getArchitectureStats,
 *   convertPhasesToPlans,
 * } from '@/lib/bolt/architecture';
 * ```
 */

// Types
export type {
  ArchitectureDocument,
  TechnicalDecision,
  TechnologyStack,
  LibrarySpec,
  ExternalService,
  ComponentArchitecture,
  ComponentNode,
  ComponentSpec,
  PropSpec,
  PageSpec,
  FeatureModule,
  DataArchitecture,
  DataModel,
  FieldSpec,
  ModelRelationship,
  APIArchitecture,
  EndpointSpec,
  FileStructure,
  DirectorySpec,
  FileSpec,
  ImplementationPhase,
  ImplementationTask,
  ArchitectureGenerationRequest,
  ArchitectureGenerationResult,
} from './types';

// Client-safe utilities
export {
  exportArchitectureToMarkdown,
  getArchitectureStats,
  getArchitectureCompleteness,
  validateArchitecture,
  getPhasesInOrder,
  getPhaseDependencyTree,
  canStartPhase,
} from './utils';

// Phase planning utilities
export {
  convertPhasesToPlans,
  getNextPhase,
  calculateProgress,
  getPhaseById,
  getPhaseTasks,
  getPhaseComplexitySummary,
  type PhaseConversionResult,
} from './phaser';
