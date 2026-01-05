import { Metadata } from "next";
import { Badge } from "@/components/landing/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/landing/ui/card";
import { FinalCTA } from "@/components/landing/sections";
import {
  Users,
  ShieldCheck,
  FileText,
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Agents & Governance",
  description: "Learn about the specialized AI agents, approval hierarchy, and governance model that ensures quality output.",
};

const agents = [
  {
    role: "Orchestrator",
    level: "Executive",
    description: "Final sign-off authority. Coordinates all agents and resolves escalations.",
    decisions: ["Stage transitions", "Risk acceptance", "Escalation resolution"],
  },
  {
    role: "PM Agent",
    level: "Lead",
    description: "Owns requirements and PRD. Ensures scope is clear and complete.",
    decisions: ["Requirements approval", "Scope changes", "PRD sign-off"],
  },
  {
    role: "Architect Agent",
    level: "Lead",
    description: "Technical design authority. Makes technology and pattern decisions.",
    decisions: ["Architecture approval", "Tech stack", "Implementation approach"],
  },
  {
    role: "UX Agent",
    level: "Lead",
    description: "User experience owner. Ensures usability and accessibility.",
    decisions: ["Design approval", "Component patterns", "A11y compliance"],
  },
  {
    role: "QA Agent",
    level: "Lead",
    description: "Quality gatekeeper. Approves test coverage and results.",
    decisions: ["Test strategy", "Coverage thresholds", "Release readiness"],
  },
  {
    role: "Security Agent",
    level: "IC",
    description: "Security reviewer. Identifies vulnerabilities and risks.",
    decisions: ["Security review", "Vulnerability assessment"],
  },
  {
    role: "Frontend Agent",
    level: "IC",
    description: "Implementation specialist. Builds React components and pages.",
    decisions: ["Code review", "Component architecture"],
  },
];

const decisionTypes = [
  {
    type: "APPROVED",
    icon: CheckCircle2,
    color: "text-emerald-600",
    description: "Work meets all criteria and can proceed",
  },
  {
    type: "CHANGES_REQUIRED",
    icon: Clock,
    color: "text-amber-600",
    description: "Minor issues found; rework needed before approval",
  },
  {
    type: "REJECTED",
    icon: XCircle,
    color: "text-red-600",
    description: "Fundamental issues; requires significant rework",
  },
  {
    type: "APPROVED_WITH_RISKS",
    icon: AlertTriangle,
    color: "text-orange-600",
    description: "Approved with documented known risks",
  },
];

export default function GovernancePage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4">
            AI Governance
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Agents & Governance Model
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            Our multi-agent system mirrors a real engineering organization with clear roles,
            approval hierarchies, and an immutable decision ledger.
          </p>
        </div>
      </section>

      {/* Agent Hierarchy */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Agent Hierarchy</h2>
            <p className="mt-4 text-slate-600">
              Specialized agents with clear responsibilities and decision authority
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.role}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <div>
                      <CardTitle className="text-lg">{agent.role}</CardTitle>
                      <CardDescription>
                        <Badge variant="outline" className="mt-1">
                          {agent.level}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">{agent.description}</p>
                  <div className="space-y-2">
                    {agent.decisions.map((decision) => (
                      <div key={decision} className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-slate-700">{decision}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Decision Types */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Decision Types</h2>
            <p className="mt-4 text-slate-600">
              Every review results in a structured decision recorded in the ledger
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {decisionTypes.map((decision) => (
              <Card key={decision.type}>
                <CardContent className="flex items-start gap-4 pt-6">
                  <decision.icon className={`h-6 w-6 ${decision.color}`} />
                  <div>
                    <h3 className="font-semibold text-slate-900">{decision.type}</h3>
                    <p className="text-sm text-slate-600">{decision.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stage Gate Rules */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Stage Gate Rules</h2>
            <p className="mt-4 text-slate-600">
              Strict rules govern what can progress and what requires rework
            </p>
          </div>

          <div className="prose prose-slate max-w-none">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold m-0">Transition Requirements</h3>
                </div>
                <ul className="mt-0 space-y-2 text-sm">
                  <li>All required artifacts must be complete</li>
                  <li>Peer review from designated reviewer</li>
                  <li>Lead approval for the domain</li>
                  <li>Orchestrator sign-off for stage transition</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold m-0">Rework Policy</h3>
                </div>
                <ul className="mt-0 space-y-2 text-sm">
                  <li>Max 3 iterations before escalation</li>
                  <li>Each rejection requires specific feedback</li>
                  <li>Escalations go to Orchestrator for resolution</li>
                  <li>All rework is logged in the ledger</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
