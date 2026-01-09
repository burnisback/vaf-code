/**
 * Key Files Detector for WebContainer
 * Identifies and reads important project files for AI context injection
 */

// WebContainer type - using any for flexibility
type WebContainer = any;

// Key file patterns to look for
export const KEY_FILE_PATTERNS: string[] = [
  // Entry points
  'src/App.tsx',
  'src/app.tsx',
  'src/main.tsx',
  'src/index.tsx',
  'app/page.tsx',
  'app/layout.tsx',
  'pages/_app.tsx',
  'pages/index.tsx',

  // Configuration
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',

  // Type definitions
  'src/types.ts',
  'src/types/index.ts',

  // Router/Routes
  'src/router.tsx',
  'src/routes.tsx',
  'app/routes.tsx'
];

export interface KeyFileContent {
  path: string;
  content: string;
  truncated: boolean;
}

const DEFAULT_MAX_CONTENT_SIZE = 5000;

/**
 * Get contents of key files that exist in the project
 */
export async function getKeyFileContents(
  webcontainer: WebContainer,
  existingFiles: string[],
  maxContentSize: number = DEFAULT_MAX_CONTENT_SIZE
): Promise<KeyFileContent[]> {
  const results: KeyFileContent[] = [];

  // Filter to only files that exist
  const existingKeyFiles = KEY_FILE_PATTERNS.filter(pattern =>
    existingFiles.includes(pattern)
  );

  for (const filePath of existingKeyFiles) {
    try {
      const fileData = await webcontainer.fs.readFile(filePath);
      const decoder = new TextDecoder();
      let content = decoder.decode(fileData);
      let truncated = false;

      if (content.length > maxContentSize) {
        content = content.substring(0, maxContentSize) + '\n... [truncated]';
        truncated = true;
      }

      results.push({
        path: filePath,
        content,
        truncated
      });
    } catch (error) {
      console.warn(`Failed to read key file ${filePath}:`, error);
    }
  }

  return results;
}

/**
 * Format key files for system prompt
 */
export function formatKeyFilesForPrompt(files: KeyFileContent[]): string {
  if (files.length === 0) {
    return '';
  }

  const sections = files.map(file => {
    const extension = file.path.split('.').pop() || 'txt';
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'tsx',
      'js': 'javascript',
      'jsx': 'jsx',
      'json': 'json',
    };
    const lang = langMap[extension] || extension;
    return `### ${file.path}\n\`\`\`${lang}\n${file.content}\n\`\`\``;
  });

  return sections.join('\n\n');
}

/**
 * Detect project type from files
 */
export function detectProjectType(files: string[]): 'nextjs' | 'vite' | 'cra' | 'unknown' {
  const fileSet = new Set(files);

  // Check for Next.js
  if (
    fileSet.has('next.config.js') ||
    fileSet.has('next.config.ts') ||
    fileSet.has('app/page.tsx') ||
    fileSet.has('app/layout.tsx') ||
    files.some(f => f.startsWith('pages/'))
  ) {
    return 'nextjs';
  }

  // Check for Vite
  if (fileSet.has('vite.config.ts') || fileSet.has('vite.config.js')) {
    return 'vite';
  }

  return 'unknown';
}

/**
 * Get suggested entry point based on project type
 */
export function getSuggestedEntryPoint(
  projectType: 'nextjs' | 'vite' | 'cra' | 'unknown',
  files: string[]
): string | null {
  const fileSet = new Set(files);

  switch (projectType) {
    case 'nextjs':
      if (fileSet.has('app/page.tsx')) return 'app/page.tsx';
      if (fileSet.has('pages/index.tsx')) return 'pages/index.tsx';
      return null;

    case 'vite':
    case 'cra':
      const entryPoints = ['src/App.tsx', 'src/app.tsx', 'src/main.tsx', 'src/index.tsx'];
      for (const entry of entryPoints) {
        if (fileSet.has(entry)) return entry;
      }
      return null;

    default:
      // Find any React component with "App" in name
      for (const file of files) {
        if (file.match(/\.(tsx|jsx)$/) && file.toLowerCase().includes('app')) {
          return file;
        }
      }
      return null;
  }
}

/**
 * Enhanced detection that reads package.json
 */
export async function detectProjectTypeWithPackageJson(
  webcontainer: WebContainer,
  files: string[]
): Promise<'nextjs' | 'vite' | 'cra' | 'unknown'> {
  const basicType = detectProjectType(files);

  if (basicType !== 'unknown') {
    return basicType;
  }

  try {
    const packageJsonData = await webcontainer.fs.readFile('package.json');
    const decoder = new TextDecoder();
    const packageJson = JSON.parse(decoder.decode(packageJsonData));

    if (
      packageJson.dependencies?.['react-scripts'] ||
      packageJson.devDependencies?.['react-scripts']
    ) {
      return 'cra';
    }
  } catch {
    // Can't read package.json
  }

  return 'unknown';
}
