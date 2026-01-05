"use client";

import { motion } from "framer-motion";
import {
  ClipboardList,
  FileText,
  Layers,
  Palette,
  Code2,
  TestTube,
  Shield,
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/landing/ui/badge";

const stages = [
  {
    name: "Intake",
    description: "Your prompt is analyzed and requirements are extracted. Ambiguities are clarified.",
    icon: ClipboardList,
    owner: "PM Agent",
    artifacts: ["Requirements Doc"],
    color: "bg-blue-500",
  },
  {
    name: "PRD",
    description: "A complete Product Requirements Document with user stories and acceptance criteria.",
    icon: FileText,
    owner: "PM Agent",
    artifacts: ["PRD", "User Stories"],
    color: "bg-indigo-500",
  },
  {
    name: "Architecture",
    description: "Technical design decisions, component structure, and data flow patterns.",
    icon: Layers,
    owner: "Architect Agent",
    artifacts: ["ADR", "Tech Spec"],
    color: "bg-violet-500",
  },
  {
    name: "Design",
    description: "UI/UX considerations, component specs, and design system alignment.",
    icon: Palette,
    owner: "UX Agent",
    artifacts: ["Component Spec", "UX Notes"],
    color: "bg-purple-500",
  },
  {
    name: "Implementation",
    description: "Production-quality React+TypeScript code with proper patterns and structure.",
    icon: Code2,
    owner: "Frontend Agent",
    artifacts: ["Source Code", "Components"],
    color: "bg-pink-500",
  },
  {
    name: "Verification",
    description: "Automated tests, linting, type checking, accessibility, and security scans.",
    icon: TestTube,
    owner: "QA Agent",
    artifacts: ["Test Results", "Coverage Report"],
    color: "bg-rose-500",
  },
  {
    name: "Security Review",
    description: "OWASP checks, dependency audit, and vulnerability assessment.",
    icon: Shield,
    owner: "Security Agent",
    artifacts: ["Security Report"],
    color: "bg-orange-500",
  },
  {
    name: "Release",
    description: "Final executive sign-off, deployment prep, and handoff documentation.",
    icon: Rocket,
    owner: "Orchestrator",
    artifacts: ["Release Notes", "Deploy Guide"],
    color: "bg-emerald-500",
  },
];

export function WorkflowTimeline() {
  return (
    <section id="how-it-works" className="py-20 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            How the Factory Works
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            8 stages. Zero shortcuts.
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Every build passes through a rigorous pipeline with specialized agents,
            mandatory approvals, and an immutable audit trail.
          </p>
        </motion.div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200 md:left-1/2 md:-translate-x-0.5" />

          <div className="space-y-12">
            {stages.map((stage, index) => (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex items-start gap-6 md:gap-12 ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute left-8 md:left-1/2 w-4 h-4 -translate-x-1/2 rounded-full bg-white border-4 border-indigo-500 z-10" />

                {/* Content card */}
                <div className={`ml-20 md:ml-0 md:w-[calc(50%-3rem)] ${index % 2 === 0 ? "md:pr-12" : "md:pl-12"}`}>
                  <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${stage.color}`}>
                        <stage.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{stage.name}</h3>
                        <p className="text-xs text-slate-500">{stage.owner}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{stage.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {stage.artifacts.map((artifact) => (
                        <Badge key={artifact} variant="outline" className="text-xs">
                          {artifact}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Requires approval to proceed</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
