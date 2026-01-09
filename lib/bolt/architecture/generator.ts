/**
 * Architecture Generator (Server-Side Only)
 *
 * Generates technical architecture from PRD.
 * ONLY import this file in server-side code (API routes).
 */

import { ai, MODELS } from '@/lib/ai/genkit';
import type { ProductRequirementsDocument } from '../product/types';
import type {
  ArchitectureDocument,
  ArchitectureGenerationRequest,
  ArchitectureGenerationResult,
  TechnologyStack,
  ComponentArchitecture,
  DataArchitecture,
  APIArchitecture,
  ImplementationPhase,
  TechnicalDecision,
} from './types';
import { getDocumentStore } from '../documents/store';

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const ARCHITECTURE_SYSTEM_PROMPT = `You are a senior software architect designing technical architecture for web applications.

Given a PRD, create a comprehensive architecture that will guide implementation.

<rules>
1. Choose proven, modern technologies appropriate for the use case
2. Design for scalability and maintainability
3. Create clear component hierarchies
4. Define data models with proper relationships
5. Specify RESTful or GraphQL APIs as appropriate
6. Plan implementation in logical phases
7. Consider security at every layer
</rules>

<technology_defaults>
Unless requirements suggest otherwise, prefer:
- Next.js 14+ with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- React Query/TanStack Query for server state
- Zustand for client state
- Zod for validation
- NextAuth.js for authentication
</technology_defaults>

<output_format>
Return JSON architecture:
\`\`\`json
{
  "name": "Architecture name",
  "overview": "Brief overview",
  "decisions": [
    {
      "id": "dec_1",
      "title": "Decision title",
      "decision": "What was decided",
      "rationale": "Why",
      "alternatives": ["alt 1"],
      "consequences": ["consequence 1"],
      "category": "framework|database|api|security|infrastructure|patterns|other"
    }
  ],
  "stack": {
    "frontend": {
      "framework": "Next.js 14",
      "language": "TypeScript",
      "styling": "Tailwind CSS",
      "stateManagement": "Zustand",
      "routing": "App Router",
      "buildTool": "Turbopack",
      "testing": ["Vitest", "Playwright"],
      "libraries": [{"name": "lib", "purpose": "why"}]
    },
    "backend": { ... },
    "database": { "type": "...", "engine": "..." },
    "infrastructure": { "hosting": "Vercel", ... },
    "services": [{"name": "...", "purpose": "...", "type": "api", "required": true}]
  },
  "components": {
    "hierarchy": [{"name": "App", "type": "provider", "children": [...]}],
    "shared": [...],
    "pages": [...],
    "features": [...],
    "layouts": [...]
  },
  "data": {
    "models": [{"name": "User", "description": "...", "fields": [...]}],
    "relationships": [...],
    "stateStrategy": {...},
    "caching": {...}
  },
  "api": {
    "style": "rest",
    "baseUrl": "/api",
    "auth": {...},
    "endpoints": [...],
    "errorHandling": {...}
  },
  "fileStructure": {
    "directories": [...],
    "conventions": {...},
    "keyFiles": [...]
  },
  "phases": [
    {
      "id": "phase_1",
      "name": "Foundation",
      "description": "Set up project structure",
      "goals": ["goal 1"],
      "tasks": [
        {
          "id": "task_1",
          "description": "Create project structure",
          "files": ["src/app/layout.tsx"],
          "type": "create",
          "dependsOn": [],
          "complexity": 2
        }
      ],
      "dependsOn": [],
      "complexity": 3,
      "status": "pending"
    }
  ]
}
\`\`\`
</output_format>`;

// =============================================================================
// GENERATOR FUNCTION
// =============================================================================

/**
 * Generate architecture from PRD
 * NOTE: This function uses genkit and must only be called from server-side code
 */
export async function generateArchitecture(
  request: ArchitectureGenerationRequest
): Promise<ArchitectureGenerationResult> {
  try {
    // Get PRD data
    let prd: ProductRequirementsDocument | null = null;

    if (request.prdId) {
      const store = getDocumentStore();
      const doc = await store.get(request.prdId);
      if (doc?.structuredData) {
        prd = doc.structuredData as unknown as ProductRequirementsDocument;
      }
    } else if (request.prdData) {
      prd = request.prdData as unknown as ProductRequirementsDocument;
    }

    if (!prd) {
      return {
        success: false,
        error: 'No PRD data provided or found',
      };
    }

    // Build architecture prompt
    const prompt = buildArchitecturePrompt(prd, request.stackPreferences);

    // Generate architecture
    const response = await ai.generate({
      model: MODELS.PRO,
      system: ARCHITECTURE_SYSTEM_PROMPT,
      prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 16384,
      },
    });

    // Parse response
    const architecture = parseArchitectureResponse(response.text, prd);

    // Add metadata
    architecture.prdRef = request.prdId || '';

    // Validate and generate warnings
    const warnings = validateArchitecture(architecture, prd);

    return {
      success: true,
      architecture,
      warnings,
    };
  } catch (error) {
    console.error('[architecture] Error generating architecture:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Architecture generation failed',
    };
  }
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildArchitecturePrompt(
  prd: ProductRequirementsDocument,
  stackPreferences?: Partial<TechnologyStack>
): string {
  const parts: string[] = [];

  parts.push('<product>');
  parts.push(`Name: ${prd.name}`);
  parts.push(`Summary: ${prd.summary}`);
  parts.push('</product>');

  parts.push('<problem>');
  parts.push(prd.problem.statement);
  parts.push('</problem>');

  parts.push('<features>');
  for (const feature of prd.features) {
    const priority = feature.priority === 'must' ? '[MUST]' :
                     feature.priority === 'should' ? '[SHOULD]' : '[COULD]';
    parts.push(`${priority} ${feature.name}: ${feature.description}`);
    if (feature.technicalNotes) {
      parts.push(`  Technical: ${feature.technicalNotes}`);
    }
  }
  parts.push('</features>');

  parts.push('<non_functional>');
  parts.push(`Performance: Load ${prd.nonFunctional.performance.pageLoadTime}, API ${prd.nonFunctional.performance.apiResponseTime}`);
  parts.push(`Users: ${prd.nonFunctional.performance.concurrentUsers}`);
  parts.push(`Security: ${prd.nonFunctional.security.authentication.join(', ')}`);
  parts.push(`Accessibility: WCAG ${prd.nonFunctional.accessibility.wcagLevel}`);
  parts.push(`Devices: ${prd.nonFunctional.usability.targetDevices.join(', ')}`);
  parts.push('</non_functional>');

  if (stackPreferences) {
    parts.push('<stack_preferences>');
    if (stackPreferences.frontend?.framework) {
      parts.push(`Frontend: ${stackPreferences.frontend.framework}`);
    }
    if (stackPreferences.database?.engine) {
      parts.push(`Database: ${stackPreferences.database.engine}`);
    }
    parts.push('</stack_preferences>');
  }

  parts.push('<instructions>');
  parts.push('Generate a complete technical architecture for this product.');
  parts.push('');
  parts.push('Ensure you:');
  parts.push('1. Cover all must-have features in MVP phase');
  parts.push('2. Design data models for all entities');
  parts.push('3. Specify API endpoints for all features');
  parts.push('4. Create implementation phases in logical order');
  parts.push('5. Include component hierarchy for UI');
  parts.push('</instructions>');

  return parts.join('\n');
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

function parseArchitectureResponse(
  responseText: string,
  prd: ProductRequirementsDocument
): ArchitectureDocument {
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : responseText;

  const jsonStart = jsonText.indexOf('{');
  const jsonEnd = jsonText.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No valid JSON found in architecture response');
  }

  const cleanJson = jsonText.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(cleanJson);

  // Build architecture with defaults
  const arch: ArchitectureDocument = {
    id: `arch_${Date.now()}`,
    name: parsed.name || `${prd.name} Architecture`,
    overview: parsed.overview || '',
    decisions: parseDecisions(parsed.decisions),
    stack: parseStack(parsed.stack),
    components: parseComponents(parsed.components),
    data: parseData(parsed.data),
    api: parseAPI(parsed.api),
    fileStructure: parseFileStructure(parsed.fileStructure),
    phases: parsePhases(parsed.phases),
    prdRef: '',
    createdAt: Date.now(),
    status: 'draft',
    version: 1,
  };

  return arch;
}

function parseDecisions(decisions: unknown): TechnicalDecision[] {
  if (!Array.isArray(decisions)) return [];

  return decisions.map((d: Record<string, unknown>, i: number) => ({
    id: String(d.id || `dec_${i + 1}`),
    title: String(d.title || ''),
    decision: String(d.decision || ''),
    rationale: String(d.rationale || ''),
    alternatives: Array.isArray(d.alternatives) ? d.alternatives.map(String) : [],
    consequences: Array.isArray(d.consequences) ? d.consequences.map(String) : [],
    category: (d.category as TechnicalDecision['category']) || 'other',
  }));
}

function parseStack(stack: Record<string, unknown> | undefined): TechnologyStack {
  const frontend = stack?.frontend as Record<string, unknown> | undefined;
  const backend = stack?.backend as Record<string, unknown> | undefined;
  const database = stack?.database as Record<string, unknown> | undefined;
  const infrastructure = stack?.infrastructure as Record<string, unknown> | undefined;

  return {
    frontend: {
      framework: String(frontend?.framework || 'Next.js'),
      language: String(frontend?.language || 'TypeScript'),
      styling: String(frontend?.styling || 'Tailwind CSS'),
      stateManagement: String(frontend?.stateManagement || 'Zustand'),
      routing: String(frontend?.routing || 'App Router'),
      buildTool: String(frontend?.buildTool || 'Turbopack'),
      testing: Array.isArray(frontend?.testing) ? frontend.testing.map(String) : ['Vitest'],
      libraries: Array.isArray(frontend?.libraries) ? frontend.libraries.map((l: Record<string, unknown>) => ({
        name: String(l.name || ''),
        purpose: String(l.purpose || ''),
        version: l.version ? String(l.version) : undefined,
      })) : [],
    },
    backend: backend ? {
      runtime: String(backend.runtime || 'Node.js'),
      framework: String(backend.framework || 'Next.js API Routes'),
      language: String(backend.language || 'TypeScript'),
      orm: backend.orm ? String(backend.orm) : undefined,
      testing: Array.isArray(backend.testing) ? backend.testing.map(String) : [],
      libraries: Array.isArray(backend.libraries) ? backend.libraries.map((l: Record<string, unknown>) => ({
        name: String(l.name || ''),
        purpose: String(l.purpose || ''),
        version: l.version ? String(l.version) : undefined,
      })) : [],
    } : undefined,
    database: database ? {
      type: (database.type as 'sql' | 'nosql' | 'graph' | 'key-value') || 'nosql',
      engine: String(database.engine || ''),
      hosted: database.hosted ? String(database.hosted) : undefined,
    } : undefined,
    infrastructure: {
      hosting: String(infrastructure?.hosting || 'Vercel'),
      cdn: infrastructure?.cdn ? String(infrastructure.cdn) : undefined,
      storage: infrastructure?.storage ? String(infrastructure.storage) : undefined,
      auth: infrastructure?.auth ? String(infrastructure.auth) : undefined,
      analytics: infrastructure?.analytics ? String(infrastructure.analytics) : undefined,
      monitoring: infrastructure?.monitoring ? String(infrastructure.monitoring) : undefined,
    },
    services: Array.isArray(stack?.services) ? (stack.services as Record<string, unknown>[]).map(s => ({
      name: String(s.name || ''),
      purpose: String(s.purpose || ''),
      type: (s.type as 'api' | 'saas' | 'paas') || 'api',
      required: Boolean(s.required),
    })) : [],
  };
}

function parseComponents(components: Record<string, unknown> | undefined): ComponentArchitecture {
  return {
    hierarchy: Array.isArray(components?.hierarchy) ? components.hierarchy : [],
    shared: Array.isArray(components?.shared) ? components.shared : [],
    pages: Array.isArray(components?.pages) ? components.pages : [],
    features: Array.isArray(components?.features) ? components.features : [],
    layouts: Array.isArray(components?.layouts) ? components.layouts : [],
  };
}

function parseData(data: Record<string, unknown> | undefined): DataArchitecture {
  const stateStrategy = data?.stateStrategy as Record<string, unknown> | undefined;
  const caching = data?.caching as Record<string, unknown> | undefined;

  return {
    models: Array.isArray(data?.models) ? (data.models as Record<string, unknown>[]).map(m => ({
      name: String(m.name || ''),
      description: String(m.description || ''),
      fields: Array.isArray(m.fields) ? m.fields.map((f: Record<string, unknown>) => ({
        name: String(f.name || ''),
        type: String(f.type || 'string'),
        required: Boolean(f.required),
        unique: f.unique ? Boolean(f.unique) : undefined,
        default: f.default ? String(f.default) : undefined,
        description: String(f.description || ''),
      })) : [],
      indexes: Array.isArray(m.indexes) ? m.indexes.map(String) : undefined,
      validations: Array.isArray(m.validations) ? m.validations.map(String) : undefined,
    })) : [],
    relationships: Array.isArray(data?.relationships) ? (data.relationships as Record<string, unknown>[]).map(r => ({
      from: String(r.from || ''),
      to: String(r.to || ''),
      type: (r.type as 'one-to-one' | 'one-to-many' | 'many-to-many') || 'one-to-many',
      field: String(r.field || ''),
    })) : [],
    stateStrategy: {
      global: String(stateStrategy?.global || 'Zustand'),
      server: String(stateStrategy?.server || 'React Query'),
      local: String(stateStrategy?.local || 'useState'),
    },
    caching: {
      strategy: String(caching?.strategy || 'stale-while-revalidate'),
      ttl: (caching?.ttl as Record<string, number>) || {},
    },
  };
}

function parseAPI(api: Record<string, unknown> | undefined): APIArchitecture {
  const auth = api?.auth as Record<string, unknown> | undefined;
  const errorHandling = api?.errorHandling as Record<string, unknown> | undefined;

  return {
    style: (api?.style as 'rest' | 'graphql' | 'trpc' | 'hybrid') || 'rest',
    baseUrl: String(api?.baseUrl || '/api'),
    auth: {
      method: String(auth?.method || 'Bearer token'),
      headerName: auth?.headerName ? String(auth.headerName) : undefined,
      tokenLocation: auth?.tokenLocation ? String(auth.tokenLocation) : undefined,
    },
    endpoints: Array.isArray(api?.endpoints) ? (api.endpoints as Record<string, unknown>[]).map(e => ({
      path: String(e.path || ''),
      method: (e.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') || 'GET',
      description: String(e.description || ''),
      requestBody: e.requestBody ? String(e.requestBody) : undefined,
      response: String(e.response || 'unknown'),
      authRequired: e.authRequired !== false,
      rateLimit: e.rateLimit ? String(e.rateLimit) : undefined,
      feature: e.feature ? String(e.feature) : undefined,
    })) : [],
    errorHandling: {
      format: String(errorHandling?.format || 'JSON'),
      codes: (errorHandling?.codes as Record<string, string>) || {},
    },
  };
}

function parseFileStructure(fs: Record<string, unknown> | undefined): ArchitectureDocument['fileStructure'] {
  const conventions = fs?.conventions as Record<string, unknown> | undefined;

  return {
    directories: Array.isArray(fs?.directories) ? fs.directories : [
      { path: 'src/app', purpose: 'Next.js app router pages' },
      { path: 'src/components', purpose: 'React components' },
      { path: 'src/lib', purpose: 'Utility libraries' },
    ],
    conventions: {
      components: String(conventions?.components || 'PascalCase'),
      pages: String(conventions?.pages || 'lowercase with dashes'),
      utils: String(conventions?.utils || 'camelCase'),
      types: String(conventions?.types || 'PascalCase'),
    },
    keyFiles: Array.isArray(fs?.keyFiles) ? fs.keyFiles : [],
  };
}

function parsePhases(phases: unknown): ImplementationPhase[] {
  if (!Array.isArray(phases)) return [];

  return phases.map((p: Record<string, unknown>, i: number) => ({
    id: String(p.id || `phase_${i + 1}`),
    name: String(p.name || `Phase ${i + 1}`),
    description: String(p.description || ''),
    goals: Array.isArray(p.goals) ? p.goals.map(String) : [],
    tasks: Array.isArray(p.tasks) ? (p.tasks as Record<string, unknown>[]).map((t, j) => ({
      id: String(t.id || `task_${i}_${j}`),
      description: String(t.description || ''),
      files: Array.isArray(t.files) ? t.files.map(String) : [],
      type: (t.type as 'create' | 'modify' | 'config' | 'install') || 'create',
      prompt: t.prompt ? String(t.prompt) : undefined,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String) : [],
      complexity: Number(t.complexity) || 2,
    })) : [],
    dependsOn: Array.isArray(p.dependsOn) ? p.dependsOn.map(String) : [],
    complexity: Number(p.complexity) || 5,
    status: 'pending' as const,
  }));
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateArchitecture(
  arch: ArchitectureDocument,
  prd: ProductRequirementsDocument
): string[] {
  const warnings: string[] = [];

  // Check all must-have features have corresponding components/endpoints
  const mustFeatures = prd.features.filter(f => f.priority === 'must');
  const componentNames = new Set(arch.components.features.map(f => f.name.toLowerCase()));
  const endpointFeatures = new Set(arch.api.endpoints.map(e => e.feature?.toLowerCase()).filter(Boolean));

  for (const feature of mustFeatures) {
    const featureLower = feature.name.toLowerCase();
    if (!componentNames.has(featureLower) && !endpointFeatures.has(featureLower)) {
      warnings.push(`Must-have feature "${feature.name}" may not be covered in architecture`);
    }
  }

  // Check phases cover MVP features
  const mvpTasks = arch.phases
    .filter(p => p.name.toLowerCase().includes('mvp') || p.id.includes('1'))
    .flatMap(p => p.tasks);

  if (mvpTasks.length === 0) {
    warnings.push('No clear MVP phase identified');
  }

  // Check data models exist
  if (arch.data.models.length === 0) {
    warnings.push('No data models defined');
  }

  // Check API endpoints exist
  if (arch.api.endpoints.length === 0) {
    warnings.push('No API endpoints defined');
  }

  return warnings;
}
