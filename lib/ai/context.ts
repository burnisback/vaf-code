/**
 * Chat Context Manager
 *
 * Manages conversation context including message history,
 * context window management, and token counting.
 */

import type { ChatMessage, ConversationContext } from './types';
import {
  scanFileTree,
  formatFileTreeForPrompt,
  flattenTree,
  getKeyFileContents,
  formatKeyFilesForPrompt,
  detectProjectType,
  getSuggestedEntryPoint
} from './context/index';

// Approximate tokens per character (rough estimate for English text)
const TOKENS_PER_CHAR = 0.25;

// Maximum context window (Gemini 1.5 Flash supports 1M tokens, but we'll be conservative)
const MAX_CONTEXT_TOKENS = 30000;

// Reserved tokens for the response
const RESERVED_RESPONSE_TOKENS = 8000;

/**
 * Generate a unique conversation ID
 */
export function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Estimate token count for a string (text-based estimation)
 */
export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

/**
 * Chat Context Manager class
 * Handles conversation state and context window management
 */
export class ChatContextManager {
  private contexts: Map<string, ConversationContext> = new Map();

  /**
   * Create a new conversation context
   */
  createContext(conversationId?: string): ConversationContext {
    const id = conversationId || generateConversationId();
    const now = new Date().toISOString();

    const context: ConversationContext = {
      conversationId: id,
      messages: [],
      projectFiles: [],
      currentFile: null,
      createdAt: now,
      updatedAt: now,
    };

    this.contexts.set(id, context);
    return context;
  }

  /**
   * Get an existing context or create a new one
   */
  getOrCreateContext(conversationId?: string): ConversationContext {
    if (conversationId && this.contexts.has(conversationId)) {
      return this.contexts.get(conversationId)!;
    }
    return this.createContext(conversationId);
  }

  /**
   * Add a message to the conversation
   */
  addMessage(conversationId: string, message: ChatMessage): void {
    const context = this.contexts.get(conversationId);
    if (!context) {
      throw new Error(`Context not found: ${conversationId}`);
    }

    context.messages.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });
    context.updatedAt = new Date().toISOString();

    // Trim context if it exceeds limits
    this.trimContext(conversationId);
  }

  /**
   * Get messages formatted for the AI model
   */
  getMessagesForModel(conversationId: string): ChatMessage[] {
    const context = this.contexts.get(conversationId);
    if (!context) {
      return [];
    }
    return context.messages;
  }

  /**
   * Get total token count for a conversation
   */
  getTokenCount(conversationId: string): number {
    const context = this.contexts.get(conversationId);
    if (!context) {
      return 0;
    }

    return context.messages.reduce((total, msg) => {
      return total + estimateTextTokens(msg.content);
    }, 0);
  }

  /**
   * Trim context to fit within token limits
   * Keeps the system message (if any) and recent messages
   */
  private trimContext(conversationId: string): void {
    const context = this.contexts.get(conversationId);
    if (!context) return;

    const maxTokens = MAX_CONTEXT_TOKENS - RESERVED_RESPONSE_TOKENS;
    let currentTokens = this.getTokenCount(conversationId);

    // Keep removing oldest non-system messages until we're under the limit
    while (currentTokens > maxTokens && context.messages.length > 1) {
      // Find the first non-system message
      const indexToRemove = context.messages.findIndex(
        (msg, idx) => idx > 0 && msg.role !== 'system'
      );

      if (indexToRemove === -1) break;

      // Remove the message
      context.messages.splice(indexToRemove, 1);
      currentTokens = this.getTokenCount(conversationId);
    }
  }

  /**
   * Update project context (files in the project)
   */
  updateProjectContext(
    conversationId: string,
    projectFiles: string[],
    currentFile: string | null = null
  ): void {
    const context = this.contexts.get(conversationId);
    if (!context) return;

    context.projectFiles = projectFiles;
    context.currentFile = currentFile;
    context.updatedAt = new Date().toISOString();
  }

  /**
   * Update project context from WebContainer filesystem
   * Scans file tree, extracts key files, detects project type
   */
  async updateProjectContextFromWebContainer(
    conversationId: string,
    webcontainer: any
  ): Promise<void> {
    const context = this.contexts.get(conversationId);
    if (!context) return;

    try {
      // Scan file tree from WebContainer
      const tree = await scanFileTree(webcontainer, '/', {
        maxDepth: 4,
        maxFiles: 150,
        ignorePaths: ['node_modules', '.git', 'dist', '.next', 'build', 'out', '.turbo']
      });

      // Flatten to file paths
      const files = flattenTree(tree);

      // Get key file contents
      const keyFiles = await getKeyFileContents(webcontainer, files);

      // Detect project type and entry point
      const projectType = detectProjectType(files);
      const entryPoint = getSuggestedEntryPoint(projectType, files);

      // Update context
      context.fileTree = tree;
      context.projectFiles = files;
      context.keyFileContents = keyFiles;
      context.projectType = projectType;
      context.suggestedEntryPoint = entryPoint;
      context.updatedAt = new Date().toISOString();
    } catch (error) {
      console.error('Failed to update project context from WebContainer:', error);
    }
  }

  /**
   * Build the system prompt with project context
   */
  buildSystemPrompt(conversationId: string): string {
    const context = this.contexts.get(conversationId);

    let systemPrompt = `You are VAF Code, an AI coding assistant that helps users build web applications.
You have DIRECT ACCESS to the user's project filesystem through WebContainer.

## YOUR CAPABILITIES
- Create new files
- Edit existing files (surgical edits)
- Delete files
- The changes you make are IMMEDIATELY applied to the project and visible in the preview

## CRITICAL: FILE OPERATION FORMAT
When you need to create, edit, or delete files, you MUST use this EXACT format:

### To CREATE or OVERWRITE a file:
<<<FILE_OPERATION>>>
{"type":"write","path":"src/components/Example.tsx","content":"// Your full file content here","description":"Brief description of what this file does"}
<<<END_FILE_OPERATION>>>

### To EDIT part of an existing file (surgical edit):
<<<FILE_OPERATION>>>
{"type":"edit","path":"src/App.tsx","edits":[{"oldContent":"const old = 'code';","newContent":"const new = 'code';"}],"description":"What this edit does"}
<<<END_FILE_OPERATION>>>

### To DELETE a file:
<<<FILE_OPERATION>>>
{"type":"delete","path":"src/unused.tsx","reason":"Why deleting this file"}
<<<END_FILE_OPERATION>>>

## RULES
1. ALWAYS use the FILE_OPERATION format when making file changes - never just show code in markdown
2. For NEW files, use "write" type with full content
3. For SMALL changes to existing files, use "edit" type with oldContent/newContent
4. For LARGE changes or rewrites, use "write" type to replace the whole file
5. The "path" should be relative to project root (e.g., "src/components/Button.tsx")
6. JSON must be valid - escape quotes and newlines in content properly
7. You can include multiple FILE_OPERATION blocks in one response
8. Add brief explanatory text before/after operations to explain what you're doing

## CODE STANDARDS
- Use TypeScript with proper types
- Use React functional components with hooks
- Use Tailwind CSS for styling
- Keep code clean, readable, and well-organized
- Follow existing project conventions`;

    // Add project type hint
    if (context?.projectType && context.projectType !== 'unknown') {
      systemPrompt += `\n\n## PROJECT TYPE\nThis is a **${context.projectType.toUpperCase()}** project.`;
      if (context.suggestedEntryPoint) {
        systemPrompt += ` The main entry point is: \`${context.suggestedEntryPoint}\``;
      }
    }

    // Add file tree structure (prefer pre-formatted string from client)
    const fileTreeStr = (context as any)?.fileTreeFormatted ||
      (context?.fileTree && context.fileTree.length > 0 ? formatFileTreeForPrompt(context.fileTree) : null);
    if (fileTreeStr) {
      systemPrompt += `\n\n## PROJECT STRUCTURE\n\`\`\`\n${fileTreeStr}\n\`\`\``;
    }

    // Add key file contents
    if (context?.keyFileContents && context.keyFileContents.length > 0) {
      systemPrompt += `\n\n## KEY FILE CONTENTS\nThese are important files in the project. Reference these when making edits:\n\n`;
      systemPrompt += formatKeyFilesForPrompt(context.keyFileContents);
    }

    // Add all project files list
    if (context?.projectFiles.length) {
      systemPrompt += `\n\n## ALL PROJECT FILES (${context.projectFiles.length} total)\n`;
      systemPrompt += context.projectFiles.slice(0, 100).join('\n');
      if (context.projectFiles.length > 100) {
        systemPrompt += `\n... and ${context.projectFiles.length - 100} more files`;
      }
    }

    // Add currently viewing file
    if (context?.currentFile) {
      systemPrompt += `\n\n## CURRENTLY VIEWING\nUser is viewing: \`${context.currentFile}\``;
    }

    // Important reminder
    systemPrompt += `\n\n## IMPORTANT REMINDER
- ONLY edit files that exist in the PROJECT STRUCTURE above
- For NEW files, create them in appropriate directories
- Check the entry point file when adding imports`;

    return systemPrompt;
  }

  /**
   * Clear a conversation context
   */
  clearContext(conversationId: string): void {
    this.contexts.delete(conversationId);
  }

  /**
   * Get all active conversation IDs
   */
  getActiveConversations(): string[] {
    return Array.from(this.contexts.keys());
  }
}

// Singleton instance for use across the application
export const chatContextManager = new ChatContextManager();
