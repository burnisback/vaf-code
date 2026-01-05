"use client";

import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/landing/ui/tabs";
import { Badge } from "@/components/landing/ui/badge";
import { FolderTree, FileText, CheckCircle2, TestTube } from "lucide-react";

const repoStructure = `my-landing-page/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   └── sections/
│   │       ├── Hero.tsx
│   │       ├── Features.tsx
│   │       └── ...
│   └── lib/
│       └── utils.ts
├── tests/
│   └── components.test.tsx
├── public/
├── package.json
├── tsconfig.json
└── README.md`;

const prdSnippet = `## Product Requirements Document

### 1. Overview
**Product**: Landing page for SaaS analytics platform
**Goal**: Convert visitors to trial signups

### 2. User Stories
- As a visitor, I can understand the product value in 5 seconds
- As a visitor, I can sign up with just my email
- As a visitor, I can view pricing tiers

### 3. Acceptance Criteria
- [ ] Hero section with clear value proposition
- [ ] Social proof section with testimonials
- [ ] Pricing table with 3 tiers
- [ ] Mobile-responsive design
- [ ] Lighthouse score > 90 on all metrics`;

const ledgerEntries = [
  { stage: "PRD", agent: "vaf-pm", decision: "APPROVED", time: "14:32:01" },
  { stage: "Architecture", agent: "vaf-architect", decision: "APPROVED", time: "14:33:15" },
  { stage: "Design", agent: "vaf-ux", decision: "APPROVED", time: "14:34:02" },
  { stage: "Implementation", agent: "vaf-frontend", decision: "APPROVED", time: "14:41:33" },
  { stage: "Verification", agent: "vaf-qa", decision: "APPROVED", time: "14:43:07" },
  { stage: "Security", agent: "vaf-security", decision: "APPROVED", time: "14:43:52" },
  { stage: "Release", agent: "vaf-orchestrator", decision: "SIGNED OFF", time: "14:44:18" },
];

const testResults = `✓ Header renders with navigation (23ms)
✓ Hero section displays value proposition (18ms)
✓ CTA button triggers signup flow (45ms)
✓ Pricing cards render all tiers (31ms)
✓ Mobile menu toggles correctly (29ms)
✓ Form validation shows errors (42ms)
✓ Accessibility: all images have alt text (15ms)
✓ Accessibility: focus states visible (12ms)

Test Suites: 4 passed, 4 total
Tests:       24 passed, 24 total
Coverage:    87.3%
Time:        2.847s`;

export function ArtifactPreview() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            What You Get
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Production-ready output, every time
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Not just code — a complete delivery package with documentation,
            tests, and a verified approval trail.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-2"
        >
          <Tabs defaultValue="repo" className="w-full">
            <TabsList className="w-full justify-start bg-white rounded-xl p-1 mb-2">
              <TabsTrigger value="repo" className="gap-2">
                <FolderTree className="h-4 w-4" />
                Repo Structure
              </TabsTrigger>
              <TabsTrigger value="prd" className="gap-2">
                <FileText className="h-4 w-4" />
                PRD Sample
              </TabsTrigger>
              <TabsTrigger value="ledger" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approval Ledger
              </TabsTrigger>
              <TabsTrigger value="tests" className="gap-2">
                <TestTube className="h-4 w-4" />
                Test Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="repo" className="mt-0">
              <div className="rounded-xl bg-slate-900 p-6 overflow-x-auto">
                <pre className="text-sm text-slate-300 font-mono">{repoStructure}</pre>
              </div>
            </TabsContent>

            <TabsContent value="prd" className="mt-0">
              <div className="rounded-xl bg-white p-6 border border-slate-200 overflow-x-auto">
                <pre className="text-sm text-slate-700 font-mono whitespace-pre-wrap">{prdSnippet}</pre>
              </div>
            </TabsContent>

            <TabsContent value="ledger" className="mt-0">
              <div className="rounded-xl bg-white p-6 border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-900">Stage</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-900">Agent</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-900">Decision</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-900">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 px-3 text-slate-700">{entry.stage}</td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-500">{entry.agent}</td>
                        <td className="py-2 px-3">
                          <Badge variant="success" className="text-xs">
                            {entry.decision}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-500">{entry.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="tests" className="mt-0">
              <div className="rounded-xl bg-slate-900 p-6 overflow-x-auto">
                <pre className="text-sm text-emerald-400 font-mono">{testResults}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </section>
  );
}
