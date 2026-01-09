import { z } from 'genkit';
import { ai } from '../genkit';

/**
 * Directory List Tool
 *
 * Allows the AI to list contents of directories in the WebContainer filesystem.
 * Used for exploring project structure, finding files, etc.
 */

// Entry type for directory listing
export const directoryEntrySchema = z.object({
  name: z.string().describe('Name of the file or directory'),
  type: z.enum(['file', 'directory']).describe('Whether this is a file or directory'),
  size: z.number().optional().describe('File size in bytes (only for files)'),
});

// Input schema for the directory list tool
export const directoryListInputSchema = z.object({
  path: z.string().describe('The directory path relative to project root (e.g., "src/components")'),
  recursive: z.boolean().optional().describe('Whether to list contents recursively'),
});

// Output schema for the directory list tool
export const directoryListOutputSchema = z.object({
  entries: z.array(directoryEntrySchema).describe('List of files and directories'),
  exists: z.boolean().describe('Whether the directory exists'),
  error: z.string().optional().describe('Error message if the listing failed'),
});

export type DirectoryEntry = z.infer<typeof directoryEntrySchema>;
export type DirectoryListInput = z.infer<typeof directoryListInputSchema>;
export type DirectoryListOutput = z.infer<typeof directoryListOutputSchema>;

/**
 * Directory list tool definition for Genkit
 *
 * Note: The actual implementation will be provided at runtime
 * by connecting to the WebContainer context.
 */
export const directoryListTool = ai.defineTool(
  {
    name: 'directoryList',
    description: 'List the contents of a directory in the project. Use this to explore project structure, find files, or understand the codebase layout.',
    inputSchema: directoryListInputSchema,
    outputSchema: directoryListOutputSchema,
  },
  async (input): Promise<DirectoryListOutput> => {
    // This is a placeholder implementation.
    // The actual implementation will be injected at runtime
    // when the WebContainer context is available.
    console.log(`[directoryList] Listing ${input.path}`);

    // Return a placeholder response
    return {
      entries: [],
      exists: false,
    };
  }
);
