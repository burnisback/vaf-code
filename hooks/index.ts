/**
 * Hooks Index
 *
 * Exports all custom hooks for the application.
 */

export { useProjects } from './useProjects';
export { usePreferences } from './usePreferences';
export { useUsage } from './useUsage';
export { useChat } from './useChat';
export { useStreamingFileOperations, parseSSEStream } from './useStreamingFileOperations';
export type { StreamingState, UseStreamingFileOperationsReturn } from './useStreamingFileOperations';
export { useProjectAnalysis } from './useProjectAnalysis';
export type { ProjectAnalysisState, UseProjectAnalysisOptions, ProjectSummary } from './useProjectAnalysis';
