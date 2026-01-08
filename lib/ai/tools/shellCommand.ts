import { z } from 'genkit';
import { ai } from '../genkit';

/**
 * Shell Command Tool
 *
 * Allows the AI to execute shell commands in the WebContainer.
 * Used for running npm commands, build scripts, etc.
 */

// Input schema for the shell command tool
export const shellCommandInputSchema = z.object({
  command: z.string().describe('The shell command to execute (e.g., "npm install", "npm run build")'),
  cwd: z.string().optional().describe('Working directory for the command (relative to project root)'),
});

// Output schema for the shell command tool
export const shellCommandOutputSchema = z.object({
  output: z.string().describe('Combined stdout and stderr output from the command'),
  exitCode: z.number().describe('Exit code of the command (0 = success)'),
  success: z.boolean().describe('Whether the command succeeded (exitCode === 0)'),
  error: z.string().optional().describe('Error message if the command failed to execute'),
});

export type ShellCommandInput = z.infer<typeof shellCommandInputSchema>;
export type ShellCommandOutput = z.infer<typeof shellCommandOutputSchema>;

/**
 * Shell command tool definition for Genkit
 *
 * Note: The actual implementation will be provided at runtime
 * by connecting to the WebContainer context.
 */
export const shellCommandTool = ai.defineTool(
  {
    name: 'shellCommand',
    description: 'Execute a shell command in the project environment. Use this to run npm install, npm run build, npm run dev, and other CLI commands. Commands run in a sandboxed WebContainer environment.',
    inputSchema: shellCommandInputSchema,
    outputSchema: shellCommandOutputSchema,
  },
  async (input): Promise<ShellCommandOutput> => {
    // This is a placeholder implementation.
    // The actual implementation will be injected at runtime
    // when the WebContainer context is available.
    console.log(`[shellCommand] Executing: ${input.command}`);

    // Return a placeholder response
    return {
      output: `Executed: ${input.command}`,
      exitCode: 0,
      success: true,
    };
  }
);
