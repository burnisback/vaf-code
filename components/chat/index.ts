/**
 * Chat Components
 *
 * Central export for all chat-related components.
 */

// Enhanced message component
export { EnhancedChatMessage, parseMessageContent } from './EnhancedChatMessage';
export type { EnhancedChatMessageProps, ParsedContent } from './EnhancedChatMessage';

// Artifact cards
export {
  ArtifactCard,
  ArtifactGroup,
  ShellCommandCard,
} from './messages';
export type {
  ArtifactType,
  ArtifactStatus,
  FileOperation,
  ArtifactMetadata,
  ArtifactCardProps,
} from './messages';

// Markdown rendering
export {
  RichMarkdownRenderer,
  MermaidDiagram,
  CodeBlock,
  CollapsibleSection,
} from './markdown';

// Progress components
export {
  ExecutionProgress,
  ThinkingSkeleton,
  PlanningSkeleton,
  CompactProgress,
} from './progress';
export type {
  ExecutionPhase,
  ExecutionTask,
  ExecutionProgressProps,
} from './progress';

// Legacy exports (for backwards compatibility)
export { MessageRenderer } from './MessageRenderer';
export { StreamingMessage } from './operations';
export { FileOperationCard } from './operations';
export { PhaseIndicator } from './operations';
