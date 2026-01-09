/**
 * Architecture Types
 *
 * Types for technical architecture, component design, and implementation planning.
 */

// =============================================================================
// ARCHITECTURE DOCUMENT
// =============================================================================

export interface ArchitectureDocument {
  /** Unique architecture ID */
  id: string;

  /** Architecture name (derived from product) */
  name: string;

  /** Architecture overview */
  overview: string;

  /** Technical decisions */
  decisions: TechnicalDecision[];

  /** Technology stack */
  stack: TechnologyStack;

  /** Component architecture */
  components: ComponentArchitecture;

  /** Data architecture */
  data: DataArchitecture;

  /** API specification */
  api: APIArchitecture;

  /** File structure plan */
  fileStructure: FileStructure;

  /** Implementation phases */
  phases: ImplementationPhase[];

  /** Source PRD ID */
  prdRef: string;

  /** Creation timestamp */
  createdAt: number;

  /** Status */
  status: 'draft' | 'review' | 'approved';

  /** Version */
  version: number;
}

// =============================================================================
// TECHNICAL DECISIONS
// =============================================================================

export interface TechnicalDecision {
  /** Decision ID */
  id: string;

  /** Decision title */
  title: string;

  /** What was decided */
  decision: string;

  /** Why this decision was made */
  rationale: string;

  /** Alternatives considered */
  alternatives: string[];

  /** Consequences/trade-offs */
  consequences: string[];

  /** Category */
  category: 'framework' | 'database' | 'api' | 'security' | 'infrastructure' | 'patterns' | 'other';
}

// =============================================================================
// TECHNOLOGY STACK
// =============================================================================

export interface TechnologyStack {
  /** Frontend technologies */
  frontend: {
    framework: string;
    language: string;
    styling: string;
    stateManagement: string;
    routing: string;
    buildTool: string;
    testing: string[];
    libraries: LibrarySpec[];
  };

  /** Backend technologies (if applicable) */
  backend?: {
    runtime: string;
    framework: string;
    language: string;
    orm?: string;
    testing: string[];
    libraries: LibrarySpec[];
  };

  /** Database */
  database?: {
    type: 'sql' | 'nosql' | 'graph' | 'key-value';
    engine: string;
    hosted?: string;
  };

  /** Infrastructure */
  infrastructure: {
    hosting: string;
    cdn?: string;
    storage?: string;
    auth?: string;
    analytics?: string;
    monitoring?: string;
  };

  /** External services */
  services: ExternalService[];
}

export interface LibrarySpec {
  name: string;
  purpose: string;
  version?: string;
}

export interface ExternalService {
  name: string;
  purpose: string;
  type: 'api' | 'saas' | 'paas';
  required: boolean;
}

// =============================================================================
// COMPONENT ARCHITECTURE
// =============================================================================

export interface ComponentArchitecture {
  /** Component hierarchy */
  hierarchy: ComponentNode[];

  /** Shared/common components */
  shared: ComponentSpec[];

  /** Page components */
  pages: PageSpec[];

  /** Feature modules */
  features: FeatureModule[];

  /** Layout components */
  layouts: ComponentSpec[];
}

export interface ComponentNode {
  /** Component name */
  name: string;

  /** Component type */
  type: 'page' | 'feature' | 'shared' | 'layout' | 'provider';

  /** Child components */
  children: ComponentNode[];
}

export interface ComponentSpec {
  /** Component name */
  name: string;

  /** File path */
  path: string;

  /** Description */
  description: string;

  /** Props interface */
  props: PropSpec[];

  /** State requirements */
  state?: string[];

  /** Dependencies */
  dependencies: string[];

  /** Complexity estimate */
  complexity: number;
}

export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface PageSpec extends ComponentSpec {
  /** Route path */
  route: string;

  /** Page title */
  title: string;

  /** Data requirements */
  dataRequirements: string[];

  /** Auth required */
  authRequired: boolean;

  /** SEO meta */
  seo?: {
    title: string;
    description: string;
  };
}

export interface FeatureModule {
  /** Feature name */
  name: string;

  /** Feature description */
  description: string;

  /** Components in this feature */
  components: ComponentSpec[];

  /** API endpoints used */
  endpoints: string[];

  /** Related PRD feature IDs */
  prdFeatureRefs: string[];
}

// =============================================================================
// DATA ARCHITECTURE
// =============================================================================

export interface DataArchitecture {
  /** Data models */
  models: DataModel[];

  /** Relationships */
  relationships: ModelRelationship[];

  /** State management approach */
  stateStrategy: {
    global: string;
    server: string;
    local: string;
  };

  /** Caching strategy */
  caching: {
    strategy: string;
    ttl: Record<string, number>;
  };
}

export interface DataModel {
  /** Model name */
  name: string;

  /** Description */
  description: string;

  /** Fields */
  fields: FieldSpec[];

  /** Indexes */
  indexes?: string[];

  /** Validation rules */
  validations?: string[];
}

export interface FieldSpec {
  name: string;
  type: string;
  required: boolean;
  unique?: boolean;
  default?: string;
  description: string;
}

export interface ModelRelationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  field: string;
}

// =============================================================================
// API ARCHITECTURE
// =============================================================================

export interface APIArchitecture {
  /** API style */
  style: 'rest' | 'graphql' | 'trpc' | 'hybrid';

  /** Base URL pattern */
  baseUrl: string;

  /** Authentication method */
  auth: {
    method: string;
    headerName?: string;
    tokenLocation?: string;
  };

  /** Endpoints */
  endpoints: EndpointSpec[];

  /** Error handling pattern */
  errorHandling: {
    format: string;
    codes: Record<string, string>;
  };
}

export interface EndpointSpec {
  /** Endpoint path */
  path: string;

  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** Description */
  description: string;

  /** Request body schema */
  requestBody?: string;

  /** Response schema */
  response: string;

  /** Auth required */
  authRequired: boolean;

  /** Rate limit */
  rateLimit?: string;

  /** Related feature */
  feature?: string;
}

// =============================================================================
// FILE STRUCTURE
// =============================================================================

export interface FileStructure {
  /** Root directories */
  directories: DirectorySpec[];

  /** Naming conventions */
  conventions: {
    components: string;
    pages: string;
    utils: string;
    types: string;
  };

  /** Key files to create */
  keyFiles: FileSpec[];
}

export interface DirectorySpec {
  path: string;
  purpose: string;
  children?: DirectorySpec[];
}

export interface FileSpec {
  path: string;
  purpose: string;
  template?: string;
  priority: 'core' | 'feature' | 'optional';
}

// =============================================================================
// IMPLEMENTATION PHASES
// =============================================================================

export interface ImplementationPhase {
  /** Phase ID */
  id: string;

  /** Phase name */
  name: string;

  /** Description */
  description: string;

  /** Goals for this phase */
  goals: string[];

  /** Tasks */
  tasks: ImplementationTask[];

  /** Dependencies on other phases */
  dependsOn: string[];

  /** Estimated complexity (1-10) */
  complexity: number;

  /** Status */
  status: 'pending' | 'in_progress' | 'complete';
}

export interface ImplementationTask {
  /** Task ID */
  id: string;

  /** Task description */
  description: string;

  /** Files to create/modify */
  files: string[];

  /** Type of task */
  type: 'create' | 'modify' | 'config' | 'install';

  /** Prompt for AI generation */
  prompt?: string;

  /** Dependencies */
  dependsOn: string[];

  /** Complexity (1-5) */
  complexity: number;
}

// =============================================================================
// GENERATION TYPES
// =============================================================================

export interface ArchitectureGenerationRequest {
  /** PRD to generate architecture from */
  prdId?: string;

  /** Direct PRD data */
  prdData?: unknown;

  /** Stack preferences */
  stackPreferences?: Partial<TechnologyStack>;

  /** Focus on specific aspects */
  focus?: ('components' | 'data' | 'api' | 'phases')[];
}

export interface ArchitectureGenerationResult {
  /** Success status */
  success: boolean;

  /** Generated architecture */
  architecture?: ArchitectureDocument;

  /** Error if failed */
  error?: string;

  /** Warnings */
  warnings?: string[];
}
