import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[250px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="hidden md:block">
            <nav className="sticky top-24 space-y-6">
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">Getting Started</h3>
                <ul className="space-y-1">
                  <li><Link href="/docs" className="text-sm text-[var(--color-accent-primary)]">Introduction</Link></li>
                  <li><Link href="/docs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Quick Start</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">Features</h3>
                <ul className="space-y-1">
                  <li><Link href="/docs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">AI Assistant</Link></li>
                  <li><Link href="/docs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Code Editor</Link></li>
                  <li><Link href="/docs" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Terminal</Link></li>
                </ul>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <article className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-6">Documentation</h1>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Introduction</h2>
              <p className="text-[var(--color-text-secondary)] mb-4">
                VAF Code is an AI-powered web IDE that helps you build web applications faster.
                This documentation will help you get started and make the most of the platform.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Quick Start</h2>
              <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)]">
                <li>Create an account or sign in</li>
                <li>Create a new project from a template or start from scratch</li>
                <li>Use the AI chat to describe what you want to build</li>
                <li>Edit code in the integrated editor</li>
                <li>Preview your changes in real-time</li>
                <li>Deploy when ready</li>
              </ol>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Editor Features</h2>
              <div className="grid gap-4">
                <div className="p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-default)]">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">AI Chat</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Describe what you want to build and let AI generate the code for you.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-default)]">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">Live Preview</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    See your changes instantly with hot module replacement.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border-default)]">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-2">Integrated Terminal</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Run npm commands and manage your project without leaving the browser.
                  </p>
                </div>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
