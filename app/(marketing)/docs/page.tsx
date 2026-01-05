import { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/landing/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/landing/ui/card";
import { Button } from "@/components/landing/ui/button";
import { FinalCTA } from "@/components/landing/sections";
import {
  FileText,
  Layers,
  Palette,
  TestTube,
  Rocket,
  Settings,
  BookOpen,
  Download,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation & Output",
  description: "Explore what you receive with every VAF build: PRD, architecture, tests, and complete deployment documentation.",
};

const artifacts = [
  {
    icon: FileText,
    title: "Product Requirements Document",
    description: "Complete PRD with user stories, acceptance criteria, and scope definition.",
    filename: "prd-template.md",
  },
  {
    icon: Layers,
    title: "Architecture Decision Record",
    description: "Technical decisions, component structure, data flow, and rationale.",
    filename: "adr-template.md",
  },
  {
    icon: Palette,
    title: "UI System Notes",
    description: "Design tokens, component specifications, and styling guidelines.",
    filename: "ui-system.md",
  },
  {
    icon: TestTube,
    title: "Test Pack",
    description: "Unit tests, integration tests, and test coverage report.",
    filename: "test-results.json",
  },
  {
    icon: Rocket,
    title: "Release Checklist",
    description: "Pre-deployment checklist, deployment guide, and rollback procedures.",
    filename: "release-checklist.md",
  },
  {
    icon: Settings,
    title: "Environment Variables",
    description: "Required environment variables with descriptions and examples.",
    filename: "env-docs.md",
  },
  {
    icon: BookOpen,
    title: "Approval Ledger",
    description: "Complete audit trail of all decisions, approvals, and sign-offs.",
    filename: "ledger-example.jsonl",
  },
];

export default function DocsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4">
            Documentation
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            What You Receive
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            Every VAF build includes a complete documentation package.
            No more guessing what was built or why decisions were made.
          </p>
        </div>
      </section>

      {/* Artifacts Grid */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {artifacts.map((artifact) => (
              <Card key={artifact.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100">
                      <artifact.icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <CardTitle className="text-lg">{artifact.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">{artifact.description}</CardDescription>
                  <Link href={`/docs/samples/${artifact.filename}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      View Sample
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Content */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8">Sample Artifacts</h2>

          <div className="space-y-8">
            {/* PRD Sample */}
            <Card>
              <CardHeader>
                <CardTitle>PRD Sample</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`# Product Requirements Document

## 1. Overview
**Product**: Landing page for SaaS analytics platform
**Version**: 1.0.0
**Date**: 2024-01-15

## 2. User Stories
### US-001: Value Proposition
As a visitor, I can understand the product value within 5 seconds
of landing on the page.

**Acceptance Criteria:**
- Headline clearly states the main benefit
- Subheadline explains how it works
- Hero section is above the fold

### US-002: Sign Up Flow
As a visitor, I can sign up with just my email address.

**Acceptance Criteria:**
- Email input field with validation
- Submit button with loading state
- Success confirmation message`}
                </pre>
              </CardContent>
            </Card>

            {/* Ledger Sample */}
            <Card>
              <CardHeader>
                <CardTitle>Approval Ledger Sample</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg overflow-x-auto text-sm">
{`{"stage":"PRD","agent":"vaf-pm","decision":"APPROVED","timestamp":"2024-01-15T14:32:01Z"}
{"stage":"Architecture","agent":"vaf-architect","decision":"APPROVED","timestamp":"2024-01-15T14:33:15Z"}
{"stage":"Design","agent":"vaf-ux","decision":"APPROVED","timestamp":"2024-01-15T14:34:02Z"}
{"stage":"Implementation","agent":"vaf-frontend","decision":"APPROVED","timestamp":"2024-01-15T14:41:33Z"}
{"stage":"Verification","agent":"vaf-qa","decision":"APPROVED","timestamp":"2024-01-15T14:43:07Z"}
{"stage":"Security","agent":"vaf-security","decision":"APPROVED","timestamp":"2024-01-15T14:43:52Z"}
{"stage":"Release","agent":"vaf-orchestrator","decision":"SIGNED_OFF","timestamp":"2024-01-15T14:44:18Z"}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
