import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Force dynamic rendering for API routes
export const dynamic = 'force-dynamic';

// Base path for workflow files (project root, outside src/)
const WORKFLOW_BASE = path.join(process.cwd(), '..', '.claude', 'workflow');

/**
 * Security: Validate path to prevent directory traversal
 */
function validatePath(filepath: string): boolean {
  const normalized = path.normalize(filepath);
  const resolved = path.resolve(WORKFLOW_BASE, normalized);
  return resolved.startsWith(WORKFLOW_BASE);
}

/**
 * Read a JSON file safely
 */
async function readJsonFile<T>(filepath: string): Promise<T | null> {
  try {
    const fullPath = path.join(WORKFLOW_BASE, filepath);
    if (!validatePath(filepath)) {
      console.error('Invalid path attempt:', filepath);
      return null;
    }
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; // File not found is OK
    }
    console.error(`Failed to read ${filepath}:`, error);
    return null;
  }
}

/**
 * Read ledger.jsonl file (newline-delimited JSON)
 */
async function readLedger(): Promise<unknown[]> {
  try {
    const fullPath = path.join(WORKFLOW_BASE, 'ledger.jsonl');
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter((e): e is unknown => e !== null);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    console.error('Failed to read ledger.jsonl:', error);
    return [];
  }
}

/**
 * GET /api/workflow
 * Returns current workflow state, work item, and events
 */
export async function GET() {
  try {
    // Read current.json to get active work item
    const current = await readJsonFile<{
      activeWorkItem?: string;
      currentStage?: string;
    }>('current.json');

    if (!current?.activeWorkItem) {
      // No active workflow - return empty state (not an error)
      return NextResponse.json({
        workItem: null,
        events: [],
        current: null,
      });
    }

    // Validate work item ID format
    if (!/^WI-\d{8}-\d{3}$/.test(current.activeWorkItem)) {
      return NextResponse.json({
        workItem: null,
        events: [],
        current: null,
        error: 'Invalid work item ID format',
      });
    }

    // Read work item and ledger in parallel
    const [workItem, events] = await Promise.all([
      readJsonFile(`work-items/${current.activeWorkItem}.json`),
      readLedger(),
    ]);

    return NextResponse.json({
      workItem,
      events,
      current,
    });
  } catch (error) {
    console.error('Workflow API error:', error);
    return NextResponse.json(
      { error: 'Failed to read workflow data' },
      { status: 500 }
    );
  }
}
