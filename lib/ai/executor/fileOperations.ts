/**
 * File Operation Executor
 *
 * Executes file operations (write, edit, delete) against WebContainer filesystem.
 * Handles directory creation, surgical edits, and operation queueing.
 */

import type { WebContainer } from '@webcontainer/api';
import type {
  FileOperationV2,
  WriteOperation,
  EditOperation,
  DeleteOperation,
  ExecutionResult,
  BatchExecutionResult,
  StreamErrorCode
} from '../types';

// ============================================
// OPERATION QUEUE
// ============================================

interface QueuedOperation {
  id: string;
  operation: FileOperationV2;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
}

class OperationQueue {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private webcontainer: WebContainer | null = null;

  setWebContainer(wc: WebContainer) {
    this.webcontainer = wc;
  }

  async enqueue(operation: FileOperationV2): Promise<ExecutionResult> {
    const id = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      this.queue.push({ id, operation, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        const result = await this.executeOperation(item.id, item.operation);
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      }
    }

    this.processing = false;
  }

  private async executeOperation(id: string, operation: FileOperationV2): Promise<ExecutionResult> {
    if (!this.webcontainer) {
      return {
        operationId: id,
        operation,
        status: 'error',
        startTime: Date.now(),
        endTime: Date.now(),
        error: 'WebContainer not available'
      };
    }

    const startTime = Date.now();

    try {
      switch (operation.type) {
        case 'write':
          await executeWriteOperation(this.webcontainer, operation);
          break;
        case 'edit':
          await executeEditOperation(this.webcontainer, operation);
          break;
        case 'delete':
          await executeDeleteOperation(this.webcontainer, operation);
          break;
      }

      return {
        operationId: id,
        operation,
        status: 'success',
        startTime,
        endTime: Date.now()
      };
    } catch (error) {
      return {
        operationId: id,
        operation,
        status: 'error',
        startTime,
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton queue instance
const operationQueue = new OperationQueue();

// ============================================
// WRITE OPERATION
// ============================================

/**
 * Execute a write operation - creates or overwrites a file
 * Automatically creates parent directories if needed
 */
async function executeWriteOperation(
  webcontainer: WebContainer,
  operation: WriteOperation
): Promise<void> {
  const { path, content } = operation;

  // Ensure parent directory exists
  const dirPath = path.substring(0, path.lastIndexOf('/'));
  if (dirPath) {
    await ensureDirectory(webcontainer, dirPath);
  }

  // Write the file
  await webcontainer.fs.writeFile(path, content);
}

/**
 * Recursively create directories
 */
async function ensureDirectory(webcontainer: WebContainer, dirPath: string): Promise<void> {
  const parts = dirPath.split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    currentPath += '/' + part;

    try {
      await webcontainer.fs.mkdir(currentPath);
    } catch (error) {
      // Directory might already exist, which is fine
      const err = error as Error & { code?: string };
      if (err.code !== 'EEXIST') {
        // Check if it's a file (not directory) blocking us
        try {
          const stat = await webcontainer.fs.readdir(currentPath);
          // If readdir succeeds, it's a directory - continue
          if (stat) continue;
        } catch {
          // readdir failed, might be a file or other issue
          throw new Error(`Cannot create directory ${currentPath}: ${err.message}`);
        }
      }
    }
  }
}

// ============================================
// EDIT OPERATION (Surgical Edits)
// ============================================

export interface EditMatchResult {
  success: boolean;
  errorCode?: StreamErrorCode;
  errorMessage?: string;
  matchCount?: number;
}

/**
 * Execute an edit operation - surgical find/replace
 * Validates that oldContent exists exactly once before replacing
 */
async function executeEditOperation(
  webcontainer: WebContainer,
  operation: EditOperation
): Promise<void> {
  const { path, edits } = operation;

  // Read current file content
  let content: string;
  try {
    const fileData = await webcontainer.fs.readFile(path);
    content = new TextDecoder().decode(fileData);
  } catch {
    throw new EditError('FILE_NOT_FOUND', `File not found: ${path}`);
  }

  // Apply each edit sequentially
  for (const edit of edits) {
    const result = applyEdit(content, edit.oldContent, edit.newContent);

    if (!result.success) {
      throw new EditError(
        result.errorCode!,
        result.errorMessage!
      );
    }

    content = result.content!;
  }

  // Write the modified content
  await webcontainer.fs.writeFile(path, content);
}

interface ApplyEditResult {
  success: boolean;
  content?: string;
  errorCode?: StreamErrorCode;
  errorMessage?: string;
}

/**
 * Apply a single edit to content
 * Returns error if oldContent not found or found multiple times
 */
function applyEdit(
  content: string,
  oldContent: string,
  newContent: string
): ApplyEditResult {
  // Count occurrences
  const regex = escapeRegExp(oldContent);
  const matches = content.match(new RegExp(regex, 'g'));
  const matchCount = matches?.length ?? 0;

  if (matchCount === 0) {
    return {
      success: false,
      errorCode: 'EDIT_NO_MATCH',
      errorMessage: `Could not find content to replace:\n${oldContent.substring(0, 100)}...`
    };
  }

  if (matchCount > 1) {
    return {
      success: false,
      errorCode: 'EDIT_AMBIGUOUS',
      errorMessage: `Found ${matchCount} matches for content - edit is ambiguous. Add more context.`
    };
  }

  // Exactly one match - perform replacement
  return {
    success: true,
    content: content.replace(oldContent, newContent)
  };
}

/**
 * Escape special regex characters in string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// DELETE OPERATION
// ============================================

/**
 * Execute a delete operation
 */
async function executeDeleteOperation(
  webcontainer: WebContainer,
  operation: DeleteOperation
): Promise<void> {
  const { path } = operation;

  try {
    await webcontainer.fs.rm(path, { recursive: true });
  } catch {
    // File might not exist, which could be acceptable
    // Check if it exists first
    try {
      await webcontainer.fs.readFile(path);
      // If we can read it, deletion failed for another reason
      throw new Error(`Failed to delete ${path}`);
    } catch {
      // File doesn't exist - delete is a no-op
    }
  }
}

// ============================================
// CUSTOM ERROR CLASS
// ============================================

export class EditError extends Error {
  code: StreamErrorCode;

  constructor(code: StreamErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'EditError';
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize the executor with WebContainer instance
 */
export function initializeExecutor(webcontainer: WebContainer): void {
  operationQueue.setWebContainer(webcontainer);
}

/**
 * Execute a single file operation
 * Operations are queued to prevent race conditions
 */
export async function executeFileOperation(
  operation: FileOperationV2
): Promise<ExecutionResult> {
  return operationQueue.enqueue(operation);
}

/**
 * Execute multiple file operations in sequence
 * Returns aggregate results
 */
export async function executeFileOperations(
  operations: FileOperationV2[]
): Promise<BatchExecutionResult> {
  const startTime = Date.now();
  const results: ExecutionResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const operation of operations) {
    const result = await executeFileOperation(operation);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
    } else {
      errorCount++;
    }
  }

  return {
    results,
    totalTime: Date.now() - startTime,
    successCount,
    errorCount
  };
}

/**
 * Execute a write operation directly (bypasses queue)
 * Use only when you need synchronous behavior
 */
export async function writeFile(
  webcontainer: WebContainer,
  path: string,
  content: string
): Promise<void> {
  await executeWriteOperation(webcontainer, {
    type: 'write',
    path,
    content,
    description: 'Direct write'
  });
}

/**
 * Execute an edit operation directly (bypasses queue)
 * Use only when you need synchronous behavior
 */
export async function editFile(
  webcontainer: WebContainer,
  path: string,
  oldContent: string,
  newContent: string
): Promise<void> {
  await executeEditOperation(webcontainer, {
    type: 'edit',
    path,
    edits: [{ oldContent, newContent }],
    description: 'Direct edit'
  });
}

/**
 * Delete a file directly (bypasses queue)
 */
export async function deleteFile(
  webcontainer: WebContainer,
  path: string
): Promise<void> {
  await executeDeleteOperation(webcontainer, {
    type: 'delete',
    path,
    reason: 'Direct delete'
  });
}

/**
 * Read a file from WebContainer
 */
export async function readFile(
  webcontainer: WebContainer,
  path: string
): Promise<string> {
  const data = await webcontainer.fs.readFile(path);
  return new TextDecoder().decode(data);
}

/**
 * Check if a file exists in WebContainer
 */
export async function fileExists(
  webcontainer: WebContainer,
  path: string
): Promise<boolean> {
  try {
    await webcontainer.fs.readFile(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files in a directory
 */
export async function listDirectory(
  webcontainer: WebContainer,
  path: string
): Promise<string[]> {
  return webcontainer.fs.readdir(path);
}

// ============================================
// CONFIG FILE DETECTION
// ============================================

const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production'
];

/**
 * Check if a path is a config file that might require dev server restart
 */
export function isConfigFile(path: string): boolean {
  const filename = path.split('/').pop() || '';
  return CONFIG_FILES.includes(filename);
}

/**
 * Get the type of config change for restart decision
 */
export function getConfigChangeType(path: string): 'restart' | 'hmr' | 'none' {
  const filename = path.split('/').pop() || '';

  // Files that always need restart
  const restartFiles = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'next.config.js',
    'next.config.ts',
    'next.config.mjs',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production'
  ];

  if (restartFiles.includes(filename)) {
    return 'restart';
  }

  // Tailwind/PostCSS might work with HMR
  if (filename.includes('tailwind') || filename.includes('postcss')) {
    return 'hmr';
  }

  return 'none';
}
