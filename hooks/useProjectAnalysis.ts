/**
 * useProjectAnalysis Hook
 *
 * Analyzes project structure on load and saves summary to docs folder.
 * Uses Gemini AI for intelligent file analysis.
 *
 * Architecture:
 * - Client-side hash computation and change detection (eliminates server/client mismatch)
 * - Smart filtering: Skips unimportant files (lock files, generated, minified)
 * - Project-local caching: Uses docs/project-summary.json as cache
 * - Only sends changed files to server for analysis
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FileNode } from '@/lib/ai/context/fileTreeScanner';
import type { ProjectSummary, ProjectSummaryWithHashes, AnalysisStats, FileAnalysis, FileHash } from '@/lib/ai/projectAnalyzer';

// =============================================================================
// SMART FILTERING - Same patterns as server to filter before sending
// =============================================================================

const SKIP_PATTERNS = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  '.next/', 'dist/', 'build/', '.turbo/', 'coverage/', '.cache/',
  '.min.js', '.min.css', '.map',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.pdf',
];

function shouldSkipFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return SKIP_PATTERNS.some(pattern => lowerPath.includes(pattern.toLowerCase()));
}

// =============================================================================
// HASHING - Client-side hash computation for accurate change detection
// =============================================================================

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectAnalysisState {
  isAnalyzing: boolean;
  isComplete: boolean;
  error: string | null;
  summary: ProjectSummaryWithHashes | null;
  stats: AnalysisStats | null;
  progress: {
    phase: 'idle' | 'scanning' | 'hashing' | 'analyzing' | 'saving' | 'complete' | 'error';
    message: string;
  };
}

export interface UseProjectAnalysisOptions {
  webcontainer: any;
  autoAnalyze?: boolean;
  mode?: 'quick' | 'full';
  maxFiles?: number;
  forceFullAnalysis?: boolean;
  onComplete?: (summary: ProjectSummaryWithHashes) => void;
  onError?: (error: string) => void;
}

const DOCS_FOLDER = 'docs';
const SUMMARY_FILE = 'project-summary.json';
const ANALYZABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];

async function scanFileTree(
  webcontainer: any,
  path: string = '',
  depth: number = 0,
  maxDepth: number = 5
): Promise<FileNode[]> {
  if (depth > maxDepth) return [];
  const ignorePaths = ['node_modules', '.git', 'dist', '.next', 'build', 'out', '.turbo', 'coverage', 'docs'];
  const nodes: FileNode[] = [];
  try {
    const entries = await webcontainer.fs.readdir(path || '.', { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      const fullPath = path ? `${path}/${name}` : name;
      if (name.startsWith('.') || ignorePaths.includes(name)) continue;
      if (entry.isDirectory()) {
        const children = await scanFileTree(webcontainer, fullPath, depth + 1, maxDepth);
        nodes.push({ name, path: fullPath, type: 'directory', children: children.length > 0 ? children : undefined });
      } else if (entry.isFile()) {
        nodes.push({ name, path: fullPath, type: 'file', extension: name.includes('.') ? name.split('.').pop() : undefined });
      }
    }
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.warn(`[useProjectAnalysis] Failed to read ${path}:`, error);
  }
  return nodes;
}

async function readFileContent(webcontainer: any, path: string): Promise<string | null> {
  try {
    return await webcontainer.fs.readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

function flattenTree(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  function traverse(node: FileNode): void {
    if (node.type === 'file') paths.push(node.path);
    if (node.children) node.children.forEach(traverse);
  }
  nodes.forEach(traverse);
  return paths;
}

async function saveSummary(webcontainer: any, summary: ProjectSummary): Promise<void> {
  try {
    try { await webcontainer.fs.readdir(DOCS_FOLDER); } catch { await webcontainer.fs.mkdir(DOCS_FOLDER); }
    await webcontainer.fs.writeFile(`${DOCS_FOLDER}/${SUMMARY_FILE}`, JSON.stringify(summary, null, 2));
    console.log(`[useProjectAnalysis] Summary saved to ${DOCS_FOLDER}/${SUMMARY_FILE}`);
  } catch (error) {
    console.error('[useProjectAnalysis] Failed to save summary:', error);
    throw error;
  }
}

export function useProjectAnalysis(options: UseProjectAnalysisOptions) {
  const { webcontainer, autoAnalyze = false, mode = 'quick', maxFiles = 50, forceFullAnalysis = false, onComplete, onError } = options;

  const [state, setState] = useState<ProjectAnalysisState>({
    isAnalyzing: false, isComplete: false, error: null, summary: null, stats: null,
    progress: { phase: 'idle', message: 'Ready to analyze' },
  });

  const hasAnalyzedRef = useRef(false);

  const analyze = useCallback(async (forceRefresh: boolean = false) => {
    if (!webcontainer || state.isAnalyzing) return;

    const startTime = Date.now();
    console.log('[useProjectAnalysis] ========== ANALYSIS STARTED ==========');

    setState(prev => ({ ...prev, isAnalyzing: true, error: null, progress: { phase: 'scanning', message: 'Scanning project structure...' } }));

    try {
      // STEP 1: Scan file tree
      const fileTree = await scanFileTree(webcontainer);
      if (fileTree.length === 0) throw new Error('No files found in project');
      const allFiles = flattenTree(fileTree);
      console.log(`[useProjectAnalysis] Found ${allFiles.length} files in tree`);

      // STEP 2: Read files and compute hashes CLIENT-SIDE
      setState(prev => ({ ...prev, progress: { phase: 'hashing', message: 'Reading files and computing hashes...' } }));

      const fileContents: Record<string, string> = {};
      const currentHashes: Record<string, string> = {};
      const filesToRead = allFiles.filter(f => ANALYZABLE_EXTENSIONS.some(ext => f.endsWith(ext)) && !shouldSkipFile(f));

      console.log(`[useProjectAnalysis] Reading ${filesToRead.length} analyzable files`);

      for (const filePath of filesToRead) {
        const content = await readFileContent(webcontainer, filePath);
        if (content !== null) {
          fileContents[filePath] = content;
          currentHashes[filePath] = simpleHash(content);
        }
      }
      console.log(`[useProjectAnalysis] Read and hashed ${Object.keys(fileContents).length} files`);

      // STEP 3: Load previous summary
      let previousHashes: Record<string, string> = {};
      let previousAnalyses: Record<string, FileAnalysis> = {};

      if (!forceRefresh && !forceFullAnalysis && mode === 'full') {
        const existingContent = await readFileContent(webcontainer, `${DOCS_FOLDER}/${SUMMARY_FILE}`);
        if (existingContent) {
          try {
            const previousSummary = JSON.parse(existingContent) as ProjectSummaryWithHashes;
            if (previousSummary.fileHashes) {
              for (const h of previousSummary.fileHashes) previousHashes[h.path] = h.hash;
            }
            if (previousSummary.files) {
              for (const f of previousSummary.files) if (f.type === 'file') previousAnalyses[f.path] = f;
            }
            console.log(`[useProjectAnalysis] Loaded previous: ${Object.keys(previousHashes).length} hashes, ${Object.keys(previousAnalyses).length} analyses`);
          } catch { console.warn('[useProjectAnalysis] Failed to parse previous summary'); }
        }
      }

      // STEP 4: Compare hashes CLIENT-SIDE
      const changedFiles: string[] = [];
      const unchangedFiles: string[] = [];
      const newFiles: string[] = [];

      console.log('[useProjectAnalysis] ---- Hash Comparison ----');
      for (const [path, currentHash] of Object.entries(currentHashes)) {
        const previousHash = previousHashes[path];
        if (!previousHash) {
          newFiles.push(path);
          console.log(`[useProjectAnalysis]   ${path}: NEW`);
        } else if (previousHash !== currentHash) {
          changedFiles.push(path);
          console.log(`[useProjectAnalysis]   ${path}: CHANGED (${previousHash} -> ${currentHash})`);
        } else {
          unchangedFiles.push(path);
          console.log(`[useProjectAnalysis]   ${path}: UNCHANGED`);
        }
      }
      console.log(`[useProjectAnalysis] Summary: ${newFiles.length} new, ${changedFiles.length} changed, ${unchangedFiles.length} unchanged`);

      // STEP 5: Prepare payload - only changed files
      const filesToAnalyze = [...newFiles, ...changedFiles];
      const isIncremental = unchangedFiles.length > 0 && Object.keys(previousHashes).length > 0;

      setState(prev => ({ ...prev, progress: { phase: 'analyzing', message: isIncremental ? `Analyzing ${filesToAnalyze.length} changed files (${unchangedFiles.length} cached)...` : `Analyzing ${filesToAnalyze.length} files...` } }));

      const changedFileContents: Record<string, string> = {};
      for (const path of filesToAnalyze.slice(0, maxFiles)) changedFileContents[path] = fileContents[path];

      const cachedAnalyses: FileAnalysis[] = unchangedFiles.filter(path => previousAnalyses[path]).map(path => previousAnalyses[path]);

      console.log(`[useProjectAnalysis] Sending: ${Object.keys(changedFileContents).length} to analyze, ${cachedAnalyses.length} cached`);

      // STEP 6: Call API
      let packageJson: Record<string, unknown> | undefined;
      const pkgContent = await readFileContent(webcontainer, 'package.json');
      if (pkgContent) try { packageJson = JSON.parse(pkgContent); } catch {}

      const response = await fetch('/api/project/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileTree, fileContents: mode === 'full' ? changedFileContents : undefined, cachedAnalyses: mode === 'full' ? cachedAnalyses : undefined, packageJson, mode, maxFiles }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      const summary = result.summary as ProjectSummaryWithHashes;

      // STEP 7: Build final summary with CLIENT-COMPUTED hashes
      setState(prev => ({ ...prev, progress: { phase: 'saving', message: 'Saving analysis...' } }));

      const fileHashes: FileHash[] = Object.entries(currentHashes).map(([path, hash]) => ({ path, hash, analyzedAt: new Date().toISOString() }));

      const stats: AnalysisStats = {
        totalFiles: allFiles.length,
        analyzedFiles: Object.keys(changedFileContents).length,
        skippedFiles: allFiles.length - filesToRead.length,
        cachedFiles: cachedAnalyses.length,
        apiCallsMade: result.stats?.apiCallsMade || 1,
        priorityBreakdown: result.stats?.priorityBreakdown || { high: 0, medium: 0, low: 0, skip: 0 },
      };

      const fullSummary: ProjectSummaryWithHashes = { ...summary, fileHashes, analysisStats: stats };
      await saveSummary(webcontainer, fullSummary);

      const duration = Date.now() - startTime;
      const statsMessage = `Done! ${stats.analyzedFiles} analyzed, ${stats.cachedFiles} cached, ${stats.apiCallsMade} API calls (${duration}ms)`;

      console.log(`[useProjectAnalysis] ========== COMPLETE (${duration}ms) ==========`);

      setState({ isAnalyzing: false, isComplete: true, error: null, summary: fullSummary, stats, progress: { phase: 'complete', message: statsMessage } });
      onComplete?.(fullSummary);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error('[useProjectAnalysis] Error:', error);
      setState(prev => ({ ...prev, isAnalyzing: false, error: errorMessage, progress: { phase: 'error', message: errorMessage } }));
      onError?.(errorMessage);
    }
  }, [webcontainer, state.isAnalyzing, mode, maxFiles, forceFullAnalysis, onComplete, onError]);

  const reset = useCallback(() => {
    setState({ isAnalyzing: false, isComplete: false, error: null, summary: null, stats: null, progress: { phase: 'idle', message: 'Ready to analyze' } });
    hasAnalyzedRef.current = false;
  }, []);

  const clearCache = useCallback(() => { console.log('[useProjectAnalysis] Cache in docs/project-summary.json - overwritten on next analysis'); }, []);

  const loadExistingSummary = useCallback(async () => {
    if (!webcontainer) return null;
    try {
      const content = await readFileContent(webcontainer, `${DOCS_FOLDER}/${SUMMARY_FILE}`);
      if (content) {
        const summary = JSON.parse(content) as ProjectSummaryWithHashes;
        setState(prev => ({ ...prev, summary, stats: summary.analysisStats || null, isComplete: true, progress: { phase: 'complete', message: 'Loaded existing analysis' } }));
        return summary;
      }
    } catch {}
    return null;
  }, [webcontainer]);

  useEffect(() => {
    if (autoAnalyze && webcontainer && !hasAnalyzedRef.current) {
      hasAnalyzedRef.current = true;
      loadExistingSummary().then(existing => { if (!existing) analyze(); });
    }
  }, [autoAnalyze, webcontainer, analyze, loadExistingSummary]);

  return { ...state, analyze, reset, clearCache, loadExistingSummary };
}

export type { ProjectSummary, ProjectSummaryWithHashes, AnalysisStats };
