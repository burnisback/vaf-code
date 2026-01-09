/**
 * Investigation Module Tests
 *
 * Comprehensive test suite for file search, investigation, and read tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  searchByFilename,
  searchByContent,
  searchByRelatedConcept,
  findRelatedByImports,
  extractKeywords,
} from './fileSearch';
import {
  Investigator,
  createInvestigator,
  investigate,
} from './investigator';
import {
  createReadTracker,
  hasBeenRead,
  markAsRead,
  getCachedContent,
} from './types';
import type { InvestigationContext } from './types';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockProjectFiles = [
  'src/components/Button.tsx',
  'src/components/Button.test.tsx',
  'src/components/Input.tsx',
  'src/components/Input.test.tsx',
  'src/components/Modal/index.tsx',
  'src/components/Modal/Modal.tsx',
  'src/components/Modal/Modal.test.tsx',
  'src/hooks/useAuth.ts',
  'src/hooks/useAuth.test.ts',
  'src/hooks/useForm.ts',
  'src/lib/api/client.ts',
  'src/lib/api/types.ts',
  'src/lib/utils/helpers.ts',
  'src/pages/Home.tsx',
  'src/pages/Login.tsx',
  'src/pages/Dashboard.tsx',
  'src/styles/globals.css',
  'tsconfig.json',
  'package.json',
  'node_modules/react/index.js',
];

const mockFileContents = new Map<string, string>([
  ['src/components/Button.tsx', `
import React from 'react';
import { cn } from '@/lib/utils/helpers';

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  return (
    <button className={cn('btn', variant)} onClick={onClick}>
      {children}
    </button>
  );
}
`],
  ['src/hooks/useAuth.ts', `
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getUser().then(setUser).finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
`],
  ['src/lib/api/client.ts', `
const BASE_URL = '/api';

export const apiClient = {
  async getUser() {
    const response = await fetch(\`\${BASE_URL}/user\`);
    return response.json();
  },
  async login(email: string, password: string) {
    const response = await fetch(\`\${BASE_URL}/login\`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },
};
`],
]);

function createMockContext(overrides: Partial<InvestigationContext> = {}): InvestigationContext {
  return {
    prompt: 'Add a new Button component',
    mode: 'simple',
    projectFiles: mockProjectFiles,
    fileTree: mockProjectFiles.join('\n'),
    framework: 'React',
    styling: 'Tailwind',
    ...overrides,
  };
}

// =============================================================================
// FILE SEARCH TESTS
// =============================================================================

describe('File Search', () => {
  describe('searchByFilename', () => {
    it('should find files matching pattern', () => {
      const results = searchByFilename('Button', mockProjectFiles);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath).toContain('Button');
    });

    it('should support glob patterns', () => {
      const results = searchByFilename('*.tsx', mockProjectFiles);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.filePath.endsWith('.tsx'))).toBe(true);
    });

    it('should exclude node_modules by default', () => {
      const results = searchByFilename('react', mockProjectFiles);

      expect(results.every((r) => !r.filePath.includes('node_modules'))).toBe(true);
    });

    it('should respect maxResults option', () => {
      const results = searchByFilename('ts', mockProjectFiles, { maxResults: 3 });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should sort by relevance', () => {
      const results = searchByFilename('Button', mockProjectFiles);

      // Exact match should be first
      expect(results[0].filePath).toContain('Button.tsx');
      expect(results[0].relevance).toBeGreaterThan(results[results.length - 1].relevance);
    });

    it('should handle case insensitive search', () => {
      const results = searchByFilename('button', mockProjectFiles, { caseSensitive: false });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath.toLowerCase()).toContain('button');
    });
  });

  describe('searchByContent', () => {
    it('should find files containing pattern', () => {
      const results = searchByContent('useState', mockProjectFiles, mockFileContents);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchType).toBe('content');
    });

    it('should include line numbers', () => {
      const results = searchByContent('useState', mockProjectFiles, mockFileContents);

      expect(results[0].lineNumbers).toBeDefined();
      expect(results[0].lineNumbers!.length).toBeGreaterThan(0);
    });

    it('should include match context', () => {
      const results = searchByContent('apiClient', mockProjectFiles, mockFileContents);

      expect(results[0].matchContext).toBeDefined();
      expect(results[0].matchContext).toContain('apiClient');
    });

    it('should handle regex patterns', () => {
      const results = searchByContent('use[A-Z]\\w+', mockProjectFiles, mockFileContents);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should escape invalid regex and search as literal', () => {
      // Should not throw
      const results = searchByContent('[invalid(regex', mockProjectFiles, mockFileContents);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('searchByRelatedConcept', () => {
    it('should find files related to concept', () => {
      const results = searchByRelatedConcept('authentication login', mockProjectFiles);

      expect(results.length).toBeGreaterThan(0);
      // Should find auth-related files
      const hasAuthFile = results.some(
        (r) => r.filePath.includes('Auth') || r.filePath.includes('Login')
      );
      expect(hasAuthFile).toBe(true);
    });

    it('should extract keywords from natural language', () => {
      const keywords = extractKeywords('Please add a new Button component for the login page');

      expect(keywords).toContain('button');
      expect(keywords).toContain('component');
      expect(keywords).toContain('login');
      expect(keywords).toContain('page');
      // Should not contain stop words
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('for');
    });
  });

  describe('findRelatedByImports', () => {
    it('should find imported files', () => {
      const related = findRelatedByImports('src/hooks/useAuth.ts', mockFileContents);

      // Should find the api client import
      expect(related.some((f) => f.includes('api'))).toBe(true);
    });

    it('should handle files with no imports', () => {
      const related = findRelatedByImports('src/styles/globals.css', mockFileContents);

      expect(Array.isArray(related)).toBe(true);
    });
  });
});

// =============================================================================
// INVESTIGATOR TESTS
// =============================================================================

describe('Investigator', () => {
  let investigator: Investigator;

  beforeEach(() => {
    investigator = createInvestigator();
  });

  describe('investigateImplementation', () => {
    it('should return investigation result', async () => {
      const context = createMockContext({
        prompt: 'Add a new Input component',
      });

      const result = await investigator.investigateImplementation(context);

      expect(result.success).toBe(true);
      expect(result.filesToRead).toBeDefined();
      expect(result.findings).toBeDefined();
    });

    it('should identify files to read', async () => {
      const context = createMockContext({
        prompt: 'Update the Button component',
      });

      const result = await investigator.investigateImplementation(context);

      expect(result.filesToRead.required.length).toBeGreaterThan(0);
      // Should find Button-related files
      const hasButtonFile = result.filesToRead.required.some((f) =>
        f.filePath.includes('Button')
      );
      expect(hasButtonFile).toBe(true);
    });

    it('should generate suggested todos', async () => {
      const context = createMockContext({
        mode: 'moderate',
      });

      const result = await investigator.investigateImplementation(context);

      expect(result.suggestedTodos).toBeDefined();
      expect(result.suggestedTodos!.length).toBeGreaterThan(0);
      // Should have different todo types
      const types = new Set(result.suggestedTodos!.map((t) => t.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('should generate appropriate approach', async () => {
      const context = createMockContext({
        mode: 'complex',
        framework: 'React',
      });

      const result = await investigator.investigateImplementation(context);

      expect(result.suggestedApproach).toBeDefined();
      expect(result.suggestedApproach).toContain('complex');
      expect(result.suggestedApproach).toContain('React');
    });

    it('should track duration', async () => {
      const context = createMockContext();

      const result = await investigator.investigateImplementation(context);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('investigateErrors', () => {
    it('should identify affected files from errors', async () => {
      const context = createMockContext({
        errors: [
          'src/components/Button.tsx:10:5: Type error: Property does not exist',
          'src/hooks/useAuth.ts:15:3: Module not found: @/lib/api/client',
        ],
      });

      const result = await investigator.investigateErrors(context);

      expect(result.success).toBe(true);
      expect(result.filesToRead.required.length).toBeGreaterThan(0);

      // Should include files from error messages
      const filePaths = result.filesToRead.required.map((f) => f.filePath);
      expect(filePaths.some((f) => f.includes('Button'))).toBe(true);
      expect(filePaths.some((f) => f.includes('useAuth'))).toBe(true);
    });

    it('should categorize errors in findings', async () => {
      const context = createMockContext({
        errors: [
          'Type error: Property X does not exist',
          'Module not found: ./missing',
        ],
      });

      const result = await investigator.investigateErrors(context);

      expect(result.findings.length).toBeGreaterThan(0);
      // Should have type error finding
      const typeErrorFinding = result.findings.find((f) =>
        f.description.includes('type error')
      );
      expect(typeErrorFinding).toBeDefined();
    });

    it('should generate debug todos', async () => {
      const context = createMockContext({
        errors: ['src/components/Button.tsx:10:5: Error'],
      });

      const result = await investigator.investigateErrors(context);

      expect(result.suggestedTodos).toBeDefined();
      // Debug todos should follow the pattern
      const todoContents = result.suggestedTodos!.map((t) => t.content);
      expect(todoContents.some((c) => c.includes('Collect'))).toBe(true);
      expect(todoContents.some((c) => c.includes('root cause'))).toBe(true);
      expect(todoContents.some((c) => c.includes('Verify'))).toBe(true);
    });
  });

  describe('investigateQuestion', () => {
    it('should find relevant files for question', async () => {
      const context = createMockContext({
        prompt: 'How does the useAuth hook work?',
        mode: 'question',
      });

      const result = await investigator.investigateQuestion(context);

      expect(result.success).toBe(true);
      // Should find auth-related files (useAuth matches the keyword 'useauth')
      const allFiles = [
        ...result.filesToRead.required,
        ...result.filesToRead.optional,
      ];
      const hasAuthFile = allFiles.some((f) => f.filePath.toLowerCase().includes('auth'));
      expect(hasAuthFile).toBe(true);
    });

    it('should generate minimal todos for questions', async () => {
      const context = createMockContext({
        prompt: 'What is this project about?',
        mode: 'question',
      });

      const result = await investigator.investigateQuestion(context);

      expect(result.suggestedTodos).toBeDefined();
      expect(result.suggestedTodos!.length).toBe(2);
    });
  });
});

// =============================================================================
// READ TRACKER TESTS
// =============================================================================

describe('Read Tracker', () => {
  it('should create empty tracker', () => {
    const tracker = createReadTracker();

    expect(tracker.filesRead.size).toBe(0);
    expect(tracker.readTimestamps.size).toBe(0);
    expect(tracker.contentCache.size).toBe(0);
  });

  it('should track read files', () => {
    const tracker = createReadTracker();

    expect(hasBeenRead(tracker, 'src/file.ts')).toBe(false);

    markAsRead(tracker, 'src/file.ts');

    expect(hasBeenRead(tracker, 'src/file.ts')).toBe(true);
  });

  it('should normalize file paths', () => {
    const tracker = createReadTracker();

    markAsRead(tracker, 'src\\file.ts');

    // Should find with forward slashes
    expect(hasBeenRead(tracker, 'src/file.ts')).toBe(true);
    // Should find with leading ./
    expect(hasBeenRead(tracker, './src/file.ts')).toBe(true);
    // Should be case insensitive
    expect(hasBeenRead(tracker, 'SRC/FILE.ts')).toBe(true);
  });

  it('should cache file content', () => {
    const tracker = createReadTracker();
    const content = 'const x = 1;';

    markAsRead(tracker, 'src/file.ts', content);

    expect(getCachedContent(tracker, 'src/file.ts')).toBe(content);
  });

  it('should track timestamps', () => {
    const tracker = createReadTracker();
    const before = Date.now();

    markAsRead(tracker, 'src/file.ts');

    const timestamp = tracker.readTimestamps.get('src/file.ts');
    expect(timestamp).toBeDefined();
    expect(timestamp).toBeGreaterThanOrEqual(before);
  });
});

// =============================================================================
// CONVENIENCE FUNCTION TESTS
// =============================================================================

describe('investigate convenience function', () => {
  it('should route to implementation investigation', async () => {
    const context = createMockContext({
      mode: 'simple',
    });

    const result = await investigate(context);

    expect(result.success).toBe(true);
  });

  it('should route to error investigation when errors present', async () => {
    const context = createMockContext({
      errors: ['Error in src/file.ts'],
    });

    const result = await investigate(context);

    expect(result.success).toBe(true);
    // Should have debug-related todos
    expect(result.suggestedTodos?.some((t) => t.content.includes('error'))).toBe(true);
  });

  it('should route to question investigation for question mode', async () => {
    const context = createMockContext({
      mode: 'question',
      prompt: 'What is X?',
    });

    const result = await investigate(context);

    expect(result.success).toBe(true);
    expect(result.suggestedTodos?.length).toBe(2);
  });
});

// =============================================================================
// INVESTIGATOR INSTANCE TESTS
// =============================================================================

describe('Investigator instance methods', () => {
  let investigator: Investigator;

  beforeEach(() => {
    investigator = createInvestigator();
  });

  it('should track files as read', () => {
    expect(investigator.hasFileBeenRead('src/file.ts')).toBe(false);

    investigator.markFileAsRead('src/file.ts');

    expect(investigator.hasFileBeenRead('src/file.ts')).toBe(true);
  });

  it('should reset read tracker', () => {
    investigator.markFileAsRead('src/file.ts');
    expect(investigator.hasFileBeenRead('src/file.ts')).toBe(true);

    investigator.resetReadTracker();

    expect(investigator.hasFileBeenRead('src/file.ts')).toBe(false);
  });

  it('should expose read tracker', () => {
    const tracker = investigator.getReadTracker();

    expect(tracker).toBeDefined();
    expect(tracker.filesRead).toBeDefined();
  });
});
