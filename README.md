# VAF Code - Bolt Playground

> AI-powered web development platform with intelligent code generation and browser-based IDE

VAF Code is a modern web development environment that runs entirely in your browser. It combines WebContainer technology with AI-powered code generation to transform natural language prompts into production-ready React/TypeScript applications.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8)
![Gemini AI](https://img.shields.io/badge/Gemini-2.5-4285F4)

## Features

### Core IDE
- **Browser-Based IDE** - Full development environment running in WebContainer
- **Live Preview** - See your changes instantly in a side-by-side preview panel
- **Monaco Editor** - VS Code-like editing experience with syntax highlighting
- **Real-Time Terminal** - Watch npm install and dev server output live
- **Template Scaffolding** - Start with pre-built templates (React, Next.js, Landing Page, Dashboard, E-commerce)

### AI-Powered Development
- **Smart Request Classification** - Automatically categorizes requests by complexity
- **Todo-Driven Workflow** - Transparent task tracking visible to users
- **Investigation-First Approach** - AI reads and understands code before modifying
- **Multi-Model Architecture** - Cost-optimized model selection (Flash-Lite, Flash, Pro)
- **Evidence-Based Debugging** - Root cause analysis with minimal, targeted fixes

### Complexity Modes

| Mode | Files | Use Case |
|------|-------|----------|
| **Question** | 0 | Explanations, clarifications |
| **Simple** | 1-2 | Small changes, single features |
| **Moderate** | 3-5 | Multi-file features, integrations |
| **Complex** | 6-15 | Authentication, large features |
| **Mega-Complex** | 16+ | Full applications, platforms |
| **Debug** | Varies | Error fixing, bug resolution |

### Mega-Complex Pipeline
For large-scale projects, the system provides:
- **Research Phase** - Competitor analysis, best practices discovery
- **PRD Generation** - Feature specifications with acceptance criteria
- **Architecture Design** - Technology stack, component hierarchy, data models
- **Phased Implementation** - Dependency-ordered execution with checkpoints
- **Continuous Verification** - TypeScript, ESLint, and build checks at each step

## Architecture

### High-Level System Architecture

```
+-----------------------------------------------------------------------------+
|                              VAF Code - Bolt Playground                      |
+-----------------------------------------------------------------------------+
|                                                                              |
|  +------------------+  +------------------+  +------------------+            |
|  |    AI Layer      |  |   Execution      |  |   WebContainer   |            |
|  |                  |  |    Layer         |  |      Layer       |            |
|  |  - Classifier    |  |  - Action Queue  |  |  - File System   |            |
|  |  - Model Router  |  |  - Verifier      |  |  - Dev Server    |            |
|  |  - Planner       |  |  - Checkpoints   |  |  - Terminal      |            |
|  |  - Generator     |  |  - Debugger      |  |  - Preview       |            |
|  +------------------+  +------------------+  +------------------+            |
|                                                                              |
+-----------------------------------------------------------------------------+
|                           Orchestration Layer                                |
|  +------------------------------------------------------------------------+ |
|  |                        State Machine                                    | |
|  |  idle -> researching -> defining -> architecture -> executing -> done   | |
|  +------------------------------------------------------------------------+ |
|                                                                              |
+-----------------------------------------------------------------------------+
|                              UI Layer                                        |
|  +------------------+  +------------------+  +------------------+            |
|  |   Chat Panel     |  |   Todo Panel     |  |   Workspace      |            |
|  |   (Collapsible)  |  |   (Real-time)    |  |   (Editor/Preview)|           |
|  +------------------+  +------------------+  +------------------+            |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Request Classification Flow

```
User Prompt
     |
     v
+------------------+
| Is it a question?| --Yes--> QUESTION MODE (Flash-Lite)
+------------------+
     | No
     v
+------------------+
| Error keywords?  | --Yes--> DEBUG MODE (Flash-Lite + Flash)
+------------------+
     | No
     v
+------------------+
| Estimate         |
| Complexity       |
+------------------+
     |
     +---> 1-2 files  ---> SIMPLE (Flash-Lite + Flash)
     |
     +---> 3-5 files  ---> MODERATE (Flash-Lite + Flash)
     |
     +---> 6-15 files ---> COMPLEX (Flash-Lite + Flash + Pro)
     |
     +---> 16+ files  ---> MEGA-COMPLEX (Full Pipeline)
```

### Mega-Complex State Machine

```
IDLE
  |
  v (START_RESEARCH)
RESEARCHING ---------> AWAITING_APPROVAL
  |                          |
  v (USER_APPROVE)           |
DEFINING_PRODUCT -------> AWAITING_APPROVAL
  |                          |
  v (USER_APPROVE)           |
GENERATING_ARCHITECTURE -> AWAITING_APPROVAL
  |                          |
  v (USER_APPROVE)           |
PLANNING_PHASE                |
  |                          |
  v (START_PHASE)            |
EXECUTING_PHASE               |
  |                          |
  v (PHASE_COMPLETE)         |
VERIFYING ---(error)---> REFINING
  |                          |
  v (SUCCESS)                |
AWAITING_APPROVAL <----------+
  |
  v (More phases? -> PLANNING_PHASE)
  v (Last phase?)
COMPLETE
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| UI Library | React 18 |
| Styling | Tailwind CSS |
| Code Editor | Monaco Editor |
| Terminal | xterm.js |
| Browser Runtime | WebContainer API |
| AI Models | Gemini 2.5 (Flash-Lite, Flash, Pro) |
| AI Framework | Firebase Genkit |
| Authentication | Firebase Auth |
| Database | Cloud Firestore |

## Project Structure

```
src/
+-- app/
|   +-- api/
|   |   +-- bolt-classify/         # Request classification
|   |   +-- bolt-generate/         # Code generation
|   |   +-- bolt-debug/            # Debug analysis
|   |   +-- bolt-refine/           # Refinement endpoint
|   |   +-- bolt-plan/             # Task planning
|   |   +-- bolt-execute-task/     # Task execution
|   |   +-- bolt-prd/              # PRD generation
|   |   +-- bolt-architecture/     # Architecture generation
|   |   +-- research/              # Research endpoints
|   |   +-- ...
|   +-- bolt-playground/           # Main playground page
|   +-- (app)/                     # Protected app routes
|   +-- (auth)/                    # Authentication routes
|   +-- (marketing)/               # Public marketing pages
|
+-- components/
|   +-- bolt/
|   |   +-- BoltPlaygroundLayout.tsx    # Main layout
|   |   +-- BoltCodeEditor.tsx          # Monaco editor wrapper
|   |   +-- BoltFileExplorer.tsx        # File tree
|   |   +-- BoltPreview.tsx             # Live preview
|   |   +-- mega/                       # Mega-complex UI
|   |   +-- research/                   # Research components
|   |   +-- architecture/               # Architecture display
|   |   +-- product/                    # PRD components
|   |   +-- orchestration/              # State machine UI
|   |   +-- settings/                   # Settings panel
|   |   +-- ui/                         # Shared UI components
|   +-- chat/                           # Enhanced chat components
|   +-- debug/                          # Debug UI components
|
+-- hooks/
|   +-- useBoltChat.ts                  # Main chat hook (1800+ lines)
|   +-- useRuntimeErrors.ts             # Error capture
|   +-- index.ts
|
+-- lib/
|   +-- ai/
|   |   +-- genkit.ts                   # Gemini model configuration
|   |   +-- orchestrator.ts             # AI orchestration
|   |   +-- projectAnalyzer.ts          # Project analysis
|   +-- bolt/
|   |   +-- ai/
|   |   |   +-- classifier/             # Request classification
|   |   |   |   +-- types.ts
|   |   |   |   +-- keywordClassifier.ts
|   |   |   |   +-- llmClassifier.ts
|   |   |   +-- planner/                # Task planning
|   |   |   +-- prompts.ts              # System prompts
|   |   +-- execution/
|   |   |   +-- actionQueue.ts          # Action queue
|   |   |   +-- actionProcessor.ts      # Process actions
|   |   |   +-- preVerifier.ts          # Pre-verification
|   |   |   +-- verifier.ts             # Build verification
|   |   |   +-- checkpointManager.ts    # Rollback system
|   |   |   +-- errorTracker.ts         # Error tracking
|   |   |   +-- ...
|   |   +-- orchestration/
|   |   |   +-- machine.ts              # State machine
|   |   +-- research/
|   |   |   +-- planner.ts              # Research planning
|   |   |   +-- executor.ts             # Search execution
|   |   |   +-- synthesizer.ts          # Result synthesis
|   |   +-- product/                    # PRD generation
|   |   +-- architecture/               # Architecture generation
|   |   +-- webcontainer/               # WebContainer integration
|   |   +-- types.ts                    # Shared types
|   +-- firebase/                       # Firebase configuration
|
+-- providers/                          # React context providers
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google AI API key (for Gemini models)
- Firebase account (optional, for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/burnisback/vaf-code.git
   cd vaf-code/src
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `env.example.txt` to `.env.local`:
   ```bash
   cp env.example.txt .env.local
   ```

   Required variables:
   ```env
   # Google AI (Required)
   GOOGLE_GENAI_API_KEY=your_google_ai_api_key

   # Firebase (Optional - for auth)
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**

   Navigate to [http://localhost:3000/bolt-playground](http://localhost:3000/bolt-playground)

### Running with Mock Auth

For development without Firebase:
```env
NEXT_PUBLIC_USE_MOCK_AUTH=true
```

## AI Model Configuration

### Available Models

| Model | Best For | Cost (per 1M tokens) |
|-------|----------|---------------------|
| **gemini-2.5-flash-lite** | Classification, verification | $0.10 in / $0.40 out |
| **gemini-2.5-flash** | Code generation, planning | $0.30 in / $2.50 out |
| **gemini-2.5-pro** | Architecture, PRD, complex reasoning | $1.25 in / $10.00 out |

### Smart Model Routing

The system automatically selects the optimal model:

```
Classify    -> Flash-Lite (always)
Verify      -> Flash-Lite (always)
Investigate -> Flash-Lite (simple/moderate) | Flash (complex)
Plan        -> Flash (standard) | Pro (mega-complex)
Execute     -> Flash (always)
PRD         -> Pro (always)
Architecture-> Pro (always)
```

## Usage Examples

### Simple Request
```
User: "Add a console.log to the handleClick function"

AI Process:
1. [Flash-Lite] Search for handleClick
2. [Flash-Lite] Read target file
3. [Flash] Add console.log
4. [Flash-Lite] Verify no errors
```

### Moderate Request
```
User: "Add dark mode toggle to settings"

AI Process:
1. [Flash-Lite] Investigate theming setup
2. [Flash-Lite] Find settings page
3. [Flash-Lite] Analyze state management
4. [Flash] Plan: Create ThemeContext, CSS vars, Toggle, integrate
5. [Flash] Execute each task
6. [Flash-Lite] Verify build
```

### Mega-Complex Request
```
User: "Build a full e-commerce platform"

AI Process:
1. [Flash] Research competitors, best practices
2. [Pro] Generate PRD with requirements
3. [Pro] Design architecture with phases
4. For each phase:
   - [Flash] Plan tasks
   - [Flash] Execute tasks
   - [Flash-Lite] Verify
5. [Flash-Lite] Final verification
```

## Development

### Running Tests
```bash
npm run test
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## Key Files

| File | Description |
|------|-------------|
| `hooks/useBoltChat.ts` | Main chat logic, message handling |
| `lib/bolt/ai/classifier/` | Request classification system |
| `lib/bolt/execution/actionQueue.ts` | Action execution queue |
| `lib/bolt/orchestration/machine.ts` | Mega-complex state machine |
| `lib/bolt/research/` | Research pipeline |
| `lib/ai/genkit.ts` | Gemini model configuration |
| `components/bolt/BoltPlaygroundLayout.tsx` | Main UI layout |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns
- Add proper types for all props and state
- Use Tailwind CSS for styling
- Write meaningful commit messages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [WebContainer API](https://webcontainers.io/) by StackBlitz
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Google Gemini](https://ai.google.dev/)
- [Firebase Genkit](https://firebase.google.com/docs/genkit)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)

---

Built with [Claude Code](https://claude.com/claude-code)
