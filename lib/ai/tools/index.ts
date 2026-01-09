/**
 * AI Tools Index
 *
 * Central export for all AI tools available to the Agentic Factory.
 * These tools allow the AI to interact with the WebContainer filesystem
 * and execute commands.
 */

// File operations
export {
  fileWriteTool,
  fileWriteInputSchema,
  fileWriteOutputSchema,
  type FileWriteInput,
  type FileWriteOutput,
} from './fileWrite';

export {
  fileReadTool,
  fileReadInputSchema,
  fileReadOutputSchema,
  type FileReadInput,
  type FileReadOutput,
} from './fileRead';

export {
  directoryListTool,
  directoryListInputSchema,
  directoryListOutputSchema,
  directoryEntrySchema,
  type DirectoryEntry,
  type DirectoryListInput,
  type DirectoryListOutput,
} from './directoryList';

// Shell operations
export {
  shellCommandTool,
  shellCommandInputSchema,
  shellCommandOutputSchema,
  type ShellCommandInput,
  type ShellCommandOutput,
} from './shellCommand';

// Convenience array of all tools for registration
import { fileWriteTool } from './fileWrite';
import { fileReadTool } from './fileRead';
import { directoryListTool } from './directoryList';
import { shellCommandTool } from './shellCommand';

export const allTools = [
  fileWriteTool,
  fileReadTool,
  directoryListTool,
  shellCommandTool,
];
