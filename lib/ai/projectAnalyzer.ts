/**
 * Project Analyzer - Scans project structure and uses Gemini AI to analyze files
 * Creates a comprehensive JSON summary of the project
 *
 * Optimizations:
 * - Smart filtering: Skip unimportant files (lock files, generated, minified)
 * - Incremental analysis: Only re-analyze changed files using content hashing
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type { FileNode } from '@/lib/ai/context/fileTreeScanner';

// =============================================================================
// SMART FILTERING - Skip unimportant files to reduce API calls
// =============================================================================

/** File priority levels for analysis */
export type FilePriority = 'high' | 'medium' | 'low' | 'skip';

/** Files that should never be analyzed (always skip) */
const SKIP_PATTERNS = [
  // Lock files
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'Gemfile.lock',
  // Generated/build output
  '.next/',
  'dist/',
  'build/',
  '.turbo/',
  'coverage/',
  '.cache/',
  '__pycache__/',
  // IDE/editor
  '.vscode/',
  '.idea/',
  '.DS_Store',
  'Thumbs.db',
  // Source maps
  '.map',
  // Minified files (detect by pattern)
  '.min.js',
  '.min.css',
  // Binary files
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.pdf',
];

/** Files that are low priority (analyze last, only if budget allows) */
const LOW_PRIORITY_PATTERNS = [
  // Type definitions (usually generated or external)
  '.d.ts',
  // Test files
  '.test.',
  '.spec.',
  '__tests__/',
  '__mocks__/',
  // Stories
  '.stories.',
  // Snapshots
  '__snapshots__/',
];

/** Files that are high priority (analyze first) */
const HIGH_PRIORITY_PATTERNS = [
  // Entry points
  'layout.tsx',
  'layout.ts',
  'page.tsx',
  'page.ts',
  'index.tsx',
  'index.ts',
  // Config files
  'package.json',
  'tsconfig.json',
  'next.config.',
  'tailwind.config.',
  // Main application files
  'app.tsx',
  'app.ts',
  '_app.tsx',
  '_document.tsx',
];

/**
 * Determine the analysis priority for a file
 */
export function getFilePriority(filePath: string): FilePriority {
  const lowerPath = filePath.toLowerCase();

  // Check skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (lowerPath.includes(pattern.toLowerCase())) {
      return 'skip';
    }
  }

  // Check high priority patterns
  for (const pattern of HIGH_PRIORITY_PATTERNS) {
    if (lowerPath.includes(pattern.toLowerCase())) {
      return 'high';
    }
  }

  // Check low priority patterns
  for (const pattern of LOW_PRIORITY_PATTERNS) {
    if (lowerPath.includes(pattern.toLowerCase())) {
      return 'low';
    }
  }

  // Default to medium priority
  return 'medium';
}

/**
 * Filter and sort files by priority
 * Returns files in order: high -> medium -> low (skip excluded)
 */
export function filterAndSortByPriority(
  files: string[],
  maxFiles: number = 50
): { files: string[]; skipped: number; breakdown: Record<FilePriority, number> } {
  const breakdown: Record<FilePriority, number> = { high: 0, medium: 0, low: 0, skip: 0 };
  const prioritized: { path: string; priority: FilePriority }[] = [];

  for (const file of files) {
    const priority = getFilePriority(file);
    breakdown[priority]++;

    if (priority !== 'skip') {
      prioritized.push({ path: file, priority });
    }
  }

  // Sort by priority (high first, then medium, then low)
  const priorityOrder: Record<FilePriority, number> = { high: 0, medium: 1, low: 2, skip: 3 };
  prioritized.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Take top N files
  const selected = prioritized.slice(0, maxFiles).map(p => p.path);
  const skipped = breakdown.skip + Math.max(0, prioritized.length - maxFiles);

  return { files: selected, skipped, breakdown };
}

// =============================================================================
// HASHING AND ANALYSIS TYPES
// =============================================================================

/** Simple hash function for content comparison */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/** File hash record for incremental analysis (used by client) */
export interface FileHash {
  path: string;
  hash: string;
  analyzedAt: string;
}

/** Extended summary with hash data for incremental updates */
export interface ProjectSummaryWithHashes extends ProjectSummary {
  fileHashes?: FileHash[];
  analysisStats?: AnalysisStats;
}

/** Statistics about the analysis */
export interface AnalysisStats {
  totalFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  cachedFiles: number;
  apiCallsMade: number;
  priorityBreakdown: Record<FilePriority, number>;
}

// =============================================================================
// ORIGINAL TYPES
// =============================================================================

export interface FileAnalysis {
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  purpose: string;
  category: FileCategory;
  dependencies?: string[];
  exports?: string[];
  complexity?: 'low' | 'medium' | 'high';
  /** Hash of file content for incremental updates */
  contentHash?: string;
}

export type FileCategory =
  | 'component'
  | 'page'
  | 'api'
  | 'hook'
  | 'utility'
  | 'store'
  | 'type'
  | 'config'
  | 'style'
  | 'test'
  | 'asset'
  | 'documentation'
  | 'other';

export interface TechnologyStack {
  framework: string;
  language: string;
  styling: string[];
  stateManagement: string[];
  testing: string[];
  buildTools: string[];
  other: string[];
}

export interface ProjectSummary {
  name: string;
  description: string;
  generatedAt: string;
  structure: {
    totalFiles: number;
    totalDirectories: number;
    maxDepth: number;
  };
  technology: TechnologyStack;
  architecture: {
    pattern: string;
    entryPoints: string[];
    keyModules: string[];
  };
  files: FileAnalysis[];
  insights: string[];
}

/**
 * Analyze a batch of files using Gemini AI
 */
async function analyzeFileBatch(
  files: { path: string; content: string }[],
  projectContext: string
): Promise<FileAnalysis[]> {
  if (files.length === 0) return [];

  const fileList = files.map(f => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``).join('\n\n');

  const prompt = `You are analyzing files from a web development project.

Project Context:
${projectContext}

Files to analyze:
${fileList}

For each file, provide a JSON analysis with this structure:
{
  "path": "file path",
  "purpose": "One sentence describing what this file does",
  "category": "component|page|api|hook|utility|store|type|config|style|test|asset|documentation|other",
  "dependencies": ["list of key imports/dependencies"],
  "exports": ["list of main exports"],
  "complexity": "low|medium|high"
}

Respond with a JSON array containing analysis for each file. Only output valid JSON, no markdown.`;

  try {
    const response = await ai.generate({
      model: MODELS.FLASH,
      prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    const text = response.text || '[]';
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const analyses = JSON.parse(jsonMatch[0]) as Partial<FileAnalysis>[];
      return analyses.map((a, i) => ({
        path: a.path || files[i]?.path || 'unknown',
        type: 'file' as const,
        extension: files[i]?.path.split('.').pop(),
        purpose: a.purpose || 'Unknown purpose',
        category: (a.category as FileCategory) || 'other',
        dependencies: a.dependencies || [],
        exports: a.exports || [],
        complexity: a.complexity || 'medium',
      }));
    }
    return [];
  } catch (error) {
    console.error('[ProjectAnalyzer] Batch analysis error:', error);
    // Return basic analysis on error
    return files.map(f => ({
      path: f.path,
      type: 'file' as const,
      extension: f.path.split('.').pop(),
      purpose: 'Analysis unavailable',
      category: 'other' as FileCategory,
    }));
  }
}

/**
 * Detect technology stack from file patterns and contents
 */
function detectTechnologyStack(
  files: string[],
  packageJson?: Record<string, unknown>
): TechnologyStack {
  const deps = packageJson?.dependencies as Record<string, string> || {};
  const devDeps = packageJson?.devDependencies as Record<string, string> || {};
  const allDeps = { ...deps, ...devDeps };

  const stack: TechnologyStack = {
    framework: 'unknown',
    language: 'javascript',
    styling: [],
    stateManagement: [],
    testing: [],
    buildTools: [],
    other: [],
  };

  // Detect framework
  if (allDeps['next']) stack.framework = 'Next.js';
  else if (allDeps['gatsby']) stack.framework = 'Gatsby';
  else if (allDeps['@remix-run/react']) stack.framework = 'Remix';
  else if (allDeps['vite']) stack.framework = 'Vite';
  else if (allDeps['react-scripts']) stack.framework = 'Create React App';
  else if (allDeps['react']) stack.framework = 'React';

  // Detect language
  if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
    stack.language = 'typescript';
  }

  // Detect styling
  if (allDeps['tailwindcss']) stack.styling.push('Tailwind CSS');
  if (allDeps['styled-components']) stack.styling.push('Styled Components');
  if (allDeps['@emotion/react']) stack.styling.push('Emotion');
  if (allDeps['sass'] || allDeps['node-sass']) stack.styling.push('Sass');
  if (files.some(f => f.endsWith('.css'))) stack.styling.push('CSS');

  // Detect state management
  if (allDeps['zustand']) stack.stateManagement.push('Zustand');
  if (allDeps['redux'] || allDeps['@reduxjs/toolkit']) stack.stateManagement.push('Redux');
  if (allDeps['mobx']) stack.stateManagement.push('MobX');
  if (allDeps['jotai']) stack.stateManagement.push('Jotai');
  if (allDeps['recoil']) stack.stateManagement.push('Recoil');

  // Detect testing
  if (allDeps['jest']) stack.testing.push('Jest');
  if (allDeps['vitest']) stack.testing.push('Vitest');
  if (allDeps['@playwright/test']) stack.testing.push('Playwright');
  if (allDeps['cypress']) stack.testing.push('Cypress');
  if (allDeps['@testing-library/react']) stack.testing.push('Testing Library');

  // Detect build tools
  if (allDeps['webpack']) stack.buildTools.push('Webpack');
  if (allDeps['esbuild']) stack.buildTools.push('esbuild');
  if (allDeps['turbo']) stack.buildTools.push('Turborepo');

  // Other notable dependencies
  if (allDeps['genkit'] || allDeps['@genkit-ai/googleai']) stack.other.push('Genkit AI');
  if (allDeps['prisma'] || allDeps['@prisma/client']) stack.other.push('Prisma');
  if (allDeps['trpc'] || allDeps['@trpc/server']) stack.other.push('tRPC');
  if (allDeps['graphql']) stack.other.push('GraphQL');

  return stack;
}

/**
 * Detect architectural pattern from file structure
 */
function detectArchitecturePattern(files: string[]): string {
  const hasAppDir = files.some(f => f.includes('/app/'));
  const hasPagesDir = files.some(f => f.includes('/pages/'));
  const hasSrcDir = files.some(f => f.startsWith('src/'));
  const hasFeatures = files.some(f => f.includes('/features/'));
  const hasModules = files.some(f => f.includes('/modules/'));

  if (hasAppDir && hasSrcDir) return 'Next.js App Router with src directory';
  if (hasAppDir) return 'Next.js App Router';
  if (hasPagesDir) return 'Next.js Pages Router';
  if (hasFeatures) return 'Feature-based architecture';
  if (hasModules) return 'Module-based architecture';
  if (hasSrcDir) return 'Standard src directory structure';
  return 'Flat structure';
}

/**
 * Find entry points in the project
 */
function findEntryPoints(files: string[]): string[] {
  const entryPoints: string[] = [];

  // Next.js entry points
  const layoutFile = files.find(f => f.match(/app\/layout\.(tsx?|jsx?)$/));
  const pageFile = files.find(f => f.match(/app\/page\.(tsx?|jsx?)$/));
  const indexPage = files.find(f => f.match(/pages\/index\.(tsx?|jsx?)$/));

  if (layoutFile) entryPoints.push(layoutFile);
  if (pageFile) entryPoints.push(pageFile);
  if (indexPage) entryPoints.push(indexPage);

  // Generic entry points
  const mainFile = files.find(f => f.match(/src\/(main|index)\.(tsx?|jsx?)$/));
  if (mainFile) entryPoints.push(mainFile);

  return entryPoints;
}

/**
 * Find key modules based on directory structure
 */
function findKeyModules(files: string[]): string[] {
  const modules = new Set<string>();

  for (const file of files) {
    // Extract top-level directories under src
    const match = file.match(/^src\/([^/]+)\//);
    if (match) {
      modules.add(`src/${match[1]}`);
    }
  }

  return Array.from(modules).slice(0, 10);
}

/**
 * Count directories and calculate max depth from file tree
 */
function analyzeStructure(tree: FileNode[]): { totalFiles: number; totalDirectories: number; maxDepth: number } {
  let totalFiles = 0;
  let totalDirectories = 0;
  let maxDepth = 0;

  function traverse(nodes: FileNode[], depth: number): void {
    for (const node of nodes) {
      if (node.type === 'file') {
        totalFiles++;
      } else {
        totalDirectories++;
        if (node.children) {
          traverse(node.children, depth + 1);
        }
      }
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  traverse(tree, 1);
  return { totalFiles, totalDirectories, maxDepth };
}

/**
 * Generate project insights using AI
 */
async function generateInsights(
  technology: TechnologyStack,
  architecture: string,
  fileCount: number
): Promise<string[]> {
  const prompt = `Based on this project analysis, provide 3-5 brief insights (one sentence each):
- Framework: ${technology.framework}
- Language: ${technology.language}
- Styling: ${technology.styling.join(', ') || 'None detected'}
- State Management: ${technology.stateManagement.join(', ') || 'None detected'}
- Testing: ${technology.testing.join(', ') || 'None detected'}
- Architecture: ${architecture}
- File Count: ${fileCount}

Respond with a JSON array of strings. Only output valid JSON, no markdown.`;

  try {
    const response = await ai.generate({
      model: MODELS.FLASH,
      prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as string[];
    }
    return [];
  } catch (error) {
    console.error('[ProjectAnalyzer] Insights generation error:', error);
    return ['Project analysis completed'];
  }
}

/** Options for project analysis */
export interface AnalyzeOptions {
  /** Cached analyses for unchanged files (from client) */
  cachedAnalyses?: FileAnalysis[];
  /** Maximum files to analyze (default: 50) */
  maxFiles?: number;
}

/**
 * Main function to analyze a project
 * Client handles change detection; server analyzes all files it receives and combines with cached
 */
export async function analyzeProject(
  fileTree: FileNode[],
  fileContents: Map<string, string>,
  packageJson?: Record<string, unknown>,
  options: AnalyzeOptions = {}
): Promise<ProjectSummaryWithHashes> {
  // =========================================================================
  // COMBINE WITH CACHED ANALYSES
  // =========================================================================
  // Client has already determined which files need analysis
  // We just analyze all files we received and combine with cached

  const { cachedAnalyses = [], maxFiles = 50 } = options;

  // Flatten file tree to get all file paths
  const allFiles: string[] = [];
  function flattenTree(nodes: FileNode[]): void {
    for (const node of nodes) {
      if (node.type === 'file') {
        allFiles.push(node.path);
      }
      if (node.children) {
        flattenTree(node.children);
      }
    }
  }
  flattenTree(fileTree);

  // Analyze structure
  const structure = analyzeStructure(fileTree);

  // Detect technology stack
  const technology = detectTechnologyStack(allFiles, packageJson);

  // Detect architecture
  const architecturePattern = detectArchitecturePattern(allFiles);
  const entryPoints = findEntryPoints(allFiles);
  const keyModules = findKeyModules(allFiles);

  // =========================================================================
  // SMART FILTERING - Only analyze important files
  // =========================================================================
  const analyzableExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
  const extensionFiltered = allFiles.filter(f =>
    analyzableExtensions.some(ext => f.endsWith(ext))
  );

  // Apply smart priority filtering
  const { files: prioritizedFiles, skipped: skippedByPriority, breakdown } =
    filterAndSortByPriority(extensionFiltered, maxFiles);

  console.log(`[ProjectAnalyzer] Smart filtering: ${prioritizedFiles.length} files selected, ${skippedByPriority} skipped`);
  console.log(`[ProjectAnalyzer] Priority breakdown: high=${breakdown.high}, medium=${breakdown.medium}, low=${breakdown.low}, skip=${breakdown.skip}`);

  // All files we received need to be analyzed (client filtered)
  const filesToAnalyze = prioritizedFiles;

  console.log(`[ProjectAnalyzer] Analyzing ${filesToAnalyze.length} files, ${cachedAnalyses.length} cached from client`);

  // =========================================================================
  // AI ANALYSIS - Batch process files that need analysis
  // =========================================================================
  const BATCH_SIZE = 10;
  const projectContext = `Framework: ${technology.framework}, Language: ${technology.language}`;
  const newAnalyses: FileAnalysis[] = [];
  let apiCallsMade = 0;

  for (let i = 0; i < filesToAnalyze.length; i += BATCH_SIZE) {
    const batch = filesToAnalyze.slice(i, i + BATCH_SIZE);
    const batchWithContent = batch
      .filter(path => fileContents.has(path))
      .map(path => ({
        path,
        content: fileContents.get(path) || '',
      }));

    if (batchWithContent.length > 0) {
      apiCallsMade++;
      const analyses = await analyzeFileBatch(batchWithContent, projectContext);

      // Add content hashes for incremental updates
      for (const analysis of analyses) {
        const content = fileContents.get(analysis.path);
        if (content) {
          analysis.contentHash = simpleHash(content);
        }
      }

      newAnalyses.push(...analyses);
    }
  }

  // Combine cached (from client) + new analyses
  const seenPaths = new Set<string>();
  const fileAnalyses: FileAnalysis[] = [];

  // Add cached analyses first
  for (const analysis of cachedAnalyses) {
    if (!seenPaths.has(analysis.path)) {
      seenPaths.add(analysis.path);
      fileAnalyses.push(analysis);
    }
  }

  // Add new analyses
  for (const analysis of newAnalyses) {
    if (!seenPaths.has(analysis.path)) {
      seenPaths.add(analysis.path);
      fileAnalyses.push(analysis);
    }
  }

  // Add directory analysis for main folders
  for (const node of fileTree) {
    if (node.type === 'directory') {
      fileAnalyses.push({
        path: node.path,
        type: 'directory',
        purpose: `Directory containing ${node.children?.length || 0} items`,
        category: 'other',
      });
    }
  }

  // Generate insights
  apiCallsMade++;
  const insights = await generateInsights(
    technology,
    architecturePattern,
    structure.totalFiles
  );

  // Build summary with stats
  const projectName = (packageJson?.name as string) || 'Unknown Project';
  const description = (packageJson?.description as string) ||
    `A ${technology.framework} project with ${structure.totalFiles} files`;

  const analysisStats: AnalysisStats = {
    totalFiles: allFiles.length,
    analyzedFiles: newAnalyses.length,
    skippedFiles: skippedByPriority,
    cachedFiles: cachedAnalyses.length,
    apiCallsMade,
    priorityBreakdown: breakdown,
  };

  console.log(`[ProjectAnalyzer] Analysis complete: ${apiCallsMade} API calls, ${newAnalyses.length} files analyzed, ${cachedAnalyses.length} cached`);

  return {
    name: projectName,
    description,
    generatedAt: new Date().toISOString(),
    structure,
    technology,
    architecture: {
      pattern: architecturePattern,
      entryPoints,
      keyModules,
    },
    files: fileAnalyses,
    insights,
    analysisStats,
  };
}

/**
 * Quick analysis without AI (for fast initial scan)
 */
export function quickAnalyze(
  fileTree: FileNode[],
  packageJson?: Record<string, unknown>
): Omit<ProjectSummary, 'files' | 'insights'> {
  const allFiles: string[] = [];
  function flattenTree(nodes: FileNode[]): void {
    for (const node of nodes) {
      if (node.type === 'file') {
        allFiles.push(node.path);
      }
      if (node.children) {
        flattenTree(node.children);
      }
    }
  }
  flattenTree(fileTree);

  const structure = analyzeStructure(fileTree);
  const technology = detectTechnologyStack(allFiles, packageJson);
  const architecturePattern = detectArchitecturePattern(allFiles);
  const entryPoints = findEntryPoints(allFiles);
  const keyModules = findKeyModules(allFiles);

  const projectName = (packageJson?.name as string) || 'Unknown Project';
  const description = (packageJson?.description as string) ||
    `A ${technology.framework} project with ${structure.totalFiles} files`;

  return {
    name: projectName,
    description,
    generatedAt: new Date().toISOString(),
    structure,
    technology,
    architecture: {
      pattern: architecturePattern,
      entryPoints,
      keyModules,
    },
  };
}
