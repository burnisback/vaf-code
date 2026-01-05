import { Metadata } from "next";
import { WorkflowTimeline, ArtifactPreview, FinalCTA } from "@/components/landing/sections";
import { Badge } from "@/components/landing/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/landing/ui/card";
import { AlertTriangle, Building2, Sparkles, XCircle, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "How It Works",
  description: "Discover how the AI Agentic Factory transforms a single prompt into a production-ready website through an 8-stage governed pipeline.",
};

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero section */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4">
            The Factory Pipeline
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            How the AI Factory Works
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            Unlike single-shot code generators, our multi-agent factory mimics a real engineering
            organization with specialized roles, stage gates, and mandatory approvals.
          </p>
        </div>
      </section>

      {/* Problem / Solution / Benefits Cards */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Problem Card */}
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-amber-900">The Problem</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-amber-800">
                  Most AI code generators produce output in a single pass. This leads to:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-amber-700">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span><strong>Incomplete outputs</strong> — missing tests, docs, and edge cases</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span><strong>Inconsistent quality</strong> — no verification or review</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span><strong>Prompt churn</strong> — endless iterations to get it right</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-amber-700">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span><strong>No audit trail</strong> — can&apos;t explain why decisions were made</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Solution Card */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900">Our Solution</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-blue-800">
                  The AI Agentic Factory operates like a well-run engineering organization:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-blue-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span><strong>Specialized agents</strong> for PM, Architecture, UX, Frontend, QA, Security</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span><strong>Stage gates</strong> that prevent incomplete work from progressing</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span><strong>Mandatory approvals</strong> before each transition</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span><strong>Immutable ledger</strong> recording every decision</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <span><strong>Executive sign-off</strong> before final delivery</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Benefits Card */}
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-900">What You Get</h3>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-emerald-800">
                  Instead of hoping your prompt produces good output, you get a governed process:
                </p>
                <ol className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-xs font-medium text-emerald-700">1</span>
                    <span>Your requirements are clarified before work begins</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-xs font-medium text-emerald-700">2</span>
                    <span>Architecture is designed before implementation</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-xs font-medium text-emerald-700">3</span>
                    <span>Code is reviewed before it&apos;s delivered</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-xs font-medium text-emerald-700">4</span>
                    <span>Tests verify the code works before you see it</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-xs font-medium text-emerald-700">5</span>
                    <span>Security is checked before deployment</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <WorkflowTimeline />
      <ArtifactPreview />
      <FinalCTA />
    </>
  );
}
