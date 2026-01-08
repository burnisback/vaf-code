import type { FileOperationV2, WriteOperation, EditOperation, DeleteOperation } from '../types';

// Regex to match file operation blocks
const FILE_OP_REGEX = /<<<FILE_OPERATION>>>([\s\S]*?)<<<END_FILE_OPERATION>>>/g;

export interface ParseResult {
  operations: FileOperationV2[];
  errors: ParseError[];
  textWithoutOps: string;
}

export interface ParseError {
  index: number;
  rawContent: string;
  error: string;
}

/**
 * Parse all file operations from AI response text
 */
export function parseFileOperations(text: string): ParseResult {
  const operations: FileOperationV2[] = [];
  const errors: ParseError[] = [];
  let textWithoutOps = text;
  let match;
  let index = 0;

  // Reset regex
  FILE_OP_REGEX.lastIndex = 0;

  while ((match = FILE_OP_REGEX.exec(text)) !== null) {
    const rawJson = match[1].trim();
    textWithoutOps = textWithoutOps.replace(match[0], '');

    try {
      const operation = parseFileOperation(rawJson);
      if (operation) {
        operations.push(operation);
      }
    } catch (err) {
      errors.push({
        index,
        rawContent: rawJson,
        error: err instanceof Error ? err.message : 'Unknown parse error'
      });
    }
    index++;
  }

  return {
    operations,
    errors,
    textWithoutOps: textWithoutOps.trim()
  };
}

/**
 * Parse a single file operation from JSON string
 */
export function parseFileOperation(json: string): FileOperationV2 | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    // Try to repair common JSON issues
    const repaired = repairJson(json);
    parsed = JSON.parse(repaired);
  }

  const validated = validateOperation(parsed);
  return validated;
}

/**
 * Validate and type-narrow operation structure
 */
export function validateOperation(op: unknown): FileOperationV2 | null {
  if (!op || typeof op !== 'object') {
    throw new Error('Operation must be an object');
  }

  const obj = op as Record<string, unknown>;

  if (!obj.type || typeof obj.type !== 'string') {
    throw new Error('Operation must have a type field');
  }

  if (!obj.path || typeof obj.path !== 'string') {
    throw new Error('Operation must have a path field');
  }

  switch (obj.type) {
    case 'write':
      return validateWriteOperation(obj);
    case 'edit':
      return validateEditOperation(obj);
    case 'delete':
      return validateDeleteOperation(obj);
    default:
      throw new Error(`Unknown operation type: ${obj.type}`);
  }
}

function validateWriteOperation(obj: Record<string, unknown>): WriteOperation {
  if (typeof obj.content !== 'string') {
    throw new Error('Write operation must have content');
  }
  return {
    type: 'write',
    path: obj.path as string,
    content: obj.content,
    description: (obj.description as string) || 'No description provided'
  };
}

function validateEditOperation(obj: Record<string, unknown>): EditOperation {
  if (!Array.isArray(obj.edits)) {
    throw new Error('Edit operation must have edits array');
  }

  const edits = obj.edits.map((edit: unknown, i: number) => {
    if (!edit || typeof edit !== 'object') {
      throw new Error(`Edit ${i} must be an object`);
    }
    const e = edit as Record<string, unknown>;
    if (typeof e.oldContent !== 'string' || typeof e.newContent !== 'string') {
      throw new Error(`Edit ${i} must have oldContent and newContent strings`);
    }
    return {
      oldContent: e.oldContent,
      newContent: e.newContent,
      context: e.context as string | undefined
    };
  });

  return {
    type: 'edit',
    path: obj.path as string,
    edits,
    description: (obj.description as string) || 'No description provided'
  };
}

function validateDeleteOperation(obj: Record<string, unknown>): DeleteOperation {
  return {
    type: 'delete',
    path: obj.path as string,
    reason: (obj.reason as string) || 'No reason provided'
  };
}

/**
 * Attempt to repair common JSON issues
 */
export function repairJson(malformed: string): string {
  let repaired = malformed;

  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Add missing closing braces
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
  }

  // Fix unquoted keys (simple cases)
  repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Fix single quotes to double quotes
  repaired = repaired.replace(/'/g, '"');

  return repaired;
}

/**
 * Extract just the text content (no operations)
 */
export function extractTextContent(text: string): string {
  return text.replace(FILE_OP_REGEX, '').trim();
}

/**
 * Check if text contains any file operations
 */
export function hasFileOperations(text: string): boolean {
  FILE_OP_REGEX.lastIndex = 0;
  return FILE_OP_REGEX.test(text);
}
