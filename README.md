# VAF Code

> AI-powered web development platform with a browser-based IDE

VAF Code is a modern web development environment that runs entirely in your browser. It leverages WebContainer technology to provide a full Node.js development experience without requiring any local setup.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38bdf8)

## Features

- **Browser-Based IDE** - Full development environment running in WebContainer
- **Live Preview** - See your changes instantly in a side-by-side preview panel
- **Template Scaffolding** - Start with pre-built templates (React, Next.js, Landing Page, Dashboard, E-commerce)
- **Monaco Editor** - VS Code-like editing experience with syntax highlighting
- **Real-Time Terminal** - Watch npm install and dev server output live
- **Firebase Integration** - Authentication and cloud storage built-in
- **Project Management** - Create, save, and manage multiple projects

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VAF Code                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Marketing  │  │     Auth     │  │     App      │  │  Playground  │ │
│  │    Pages     │  │    Pages     │  │    Pages     │  │     IDE      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           Core Services                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    WebContainerProvider                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│  │  │   Boot     │  │   Mount    │  │  Install   │  │   Start    │  │   │
│  │  │  Manager   │  │  Templates │  │    Deps    │  │ Dev Server │  │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         External Services                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Firebase   │  │  WebContainer│  │    Monaco    │                   │
│  │  Auth + DB   │  │     API      │  │    Editor    │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### IDE Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            IDELayout                                     │
├───────────────────┬─────────────────────────────────────────────────────┤
│                   │                                                      │
│    ChatPanel      │              Workspace                               │
│                   │  ┌───────────────────────────────────────────────┐  │
│  ┌─────────────┐  │  │  Tab Bar (Preview | Code | Database)          │  │
│  │   AI Chat   │  │  ├───────────────────────────────────────────────┤  │
│  │  Interface  │  │  │                                               │  │
│  │             │  │  │  ┌─────────────────────────────────────────┐  │  │
│  │             │  │  │  │         Content Area                    │  │  │
│  │             │  │  │  │  ┌───────────┬───────────────────────┐  │  │  │
│  │             │  │  │  │  │   File    │    Monaco Editor /    │  │  │  │
│  │             │  │  │  │  │ Explorer  │    Preview Panel      │  │  │  │
│  │             │  │  │  │  │           │                       │  │  │  │
│  │             │  │  │  │  └───────────┴───────────────────────┘  │  │  │
│  │             │  │  │  └─────────────────────────────────────────┘  │  │
│  │             │  │  ├───────────────────────────────────────────────┤  │
│  │             │  │  │              Terminal Panel                   │  │
│  │             │  │  │  ┌─────────────────────────────────────────┐  │  │
│  │             │  │  │  │  $ npm install                          │  │  │
│  │             │  │  │  │  $ npm run dev                          │  │  │
│  └─────────────┘  │  │  └─────────────────────────────────────────┘  │  │
│                   │  └───────────────────────────────────────────────┘  │
│                   │  ┌───────────────────────────────────────────────┐  │
│                   │  │              Status Bar                       │  │
│                   │  └───────────────────────────────────────────────┘  │
└───────────────────┴─────────────────────────────────────────────────────┘
```

### WebContainer Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│    BOOT     │────▶│    MOUNT    │────▶│   INSTALL   │────▶│    START    │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
 WebContainer       Template Files       npm install        npm run dev
   .boot()           mounted to         dependencies         starts
                    filesystem           installed          dev server
                                                                │
                                                                ▼
                                                         server-ready
                                                           event
                                                                │
                                                                ▼
                                                          Preview URL
                                                           available
```

### Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │     │   AuthProvider│     │   Firebase   │     │  Firestore   │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
     │                  │                    │                    │
     │  Login/Signup    │                    │                    │
     │─────────────────▶│                    │                    │
     │                  │  signInWithEmail   │                    │
     │                  │───────────────────▶│                    │
     │                  │                    │                    │
     │                  │    User Token      │                    │
     │                  │◀───────────────────│                    │
     │                  │                    │                    │
     │                  │              Create/Update User Doc     │
     │                  │────────────────────────────────────────▶│
     │                  │                    │                    │
     │   Authenticated  │                    │                    │
     │◀─────────────────│                    │                    │
     │                  │                    │                    │
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
| Authentication | Firebase Auth |
| Database | Cloud Firestore |
| Backend | Firebase Functions |
| State Management | React Context + Hooks |

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (app)/                    # Protected app routes
│   │   ├── projects/             # Project management
│   │   ├── settings/             # User settings
│   │   └── templates/            # Template browser
│   ├── (auth)/                   # Authentication routes
│   │   ├── login/
│   │   ├── signup/
│   │   └── forgot-password/
│   ├── (marketing)/              # Public marketing pages
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/
│   │   ├── docs/
│   │   └── contact/
│   ├── playground/               # Main IDE entry point
│   └── api/                      # API routes
│
├── components/
│   ├── ide/                      # IDE components
│   │   ├── IDELayout.tsx         # Main IDE layout
│   │   ├── FileExplorer.tsx      # File tree sidebar
│   │   ├── MonacoEditorWrapper.tsx
│   │   ├── PreviewPanel.tsx      # Live preview iframe
│   │   ├── TerminalPanel.tsx     # xterm.js terminal
│   │   └── StatusBar.tsx
│   ├── ui/                       # Reusable UI components
│   ├── marketing/                # Marketing page components
│   └── app/                      # App shell components
│
├── lib/
│   ├── webcontainer/             # WebContainer integration
│   │   ├── context.tsx           # WebContainerProvider
│   │   ├── manager.ts            # WebContainer utilities
│   │   └── filesystem.ts         # File system helpers
│   ├── templates/                # Project templates
│   │   ├── blank.ts
│   │   ├── react-vite.ts
│   │   ├── nextjs.ts
│   │   ├── landing.ts
│   │   ├── dashboard.ts
│   │   └── ecommerce.ts
│   └── firebase/                 # Firebase configuration
│
├── providers/                    # React context providers
│   ├── AuthProvider.tsx
│   ├── FirebaseAuthProvider.tsx
│   └── MockAuthProvider.tsx
│
├── hooks/                        # Custom React hooks
│   ├── useProjects.ts
│   ├── usePreferences.ts
│   └── useUsage.ts
│
└── functions/                    # Firebase Cloud Functions
    └── src/
        ├── api/                  # API endpoints
        ├── triggers/             # Database triggers
        └── utils/                # Shared utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/burnisback/vaf-code.git
   cd vaf-code
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `env.example.txt` to `.env.local` and fill in your Firebase credentials:
   ```bash
   cp env.example.txt .env.local
   ```

   Required variables:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Running with Mock Auth (No Firebase)

For development without Firebase, set:
```env
NEXT_PUBLIC_USE_MOCK_AUTH=true
```

This enables a mock authentication provider with test credentials.

## Key Components

### WebContainerProvider

The core context provider that manages the WebContainer lifecycle:

```typescript
// Usage
import { useWebContainer } from '@/lib/webcontainer/context';

function MyComponent() {
  const {
    webcontainer,    // WebContainer instance
    isReady,         // Ready to use
    loadingState,    // Current loading stage
    previewUrl,      // Dev server URL
    writeToTerminal  // Write to terminal output
  } = useWebContainer();
}
```

**Loading States:**
- `idle` - Not started
- `booting` - WebContainer booting
- `mounting` - Mounting template files
- `installing` - Running npm install
- `starting` - Starting dev server
- `ready` - Ready to use
- `error` - Error occurred

### IDELayout

The main IDE container that orchestrates all panels:

```typescript
<IDELayout
  template="react"      // Template to scaffold
  projectName="My App"  // Display name
/>
```

### TerminalPanel

Displays real-time output from WebContainer processes:

- Shows boot progress
- Displays npm install output
- Shows dev server logs
- Auto-scrolls to latest output

## Templates

| Template | Description | Stack |
|----------|-------------|-------|
| `blank` | Empty starter | Vite + React |
| `react` | React with Vite | Vite + React + Tailwind |
| `nextjs` | Next.js starter | Next.js 14 |
| `landing` | Landing page | Vite + React + Tailwind |
| `dashboard` | Admin dashboard | Vite + React + Tailwind |
| `ecommerce` | E-commerce store | Vite + React + Tailwind |

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
- [xterm.js](https://xtermjs.org/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Firebase](https://firebase.google.com/)

---

Built with [Claude Code](https://claude.com/claude-code)
