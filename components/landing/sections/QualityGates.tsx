"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Accessibility,
  TestTube,
  FileSearch,
  Lock,
  Gauge,
  Check,
} from "lucide-react";
import { Badge } from "@/components/landing/ui/badge";

const gates = [
  {
    icon: FileSearch,
    name: "TypeScript Strict",
    description: "Zero type errors, strict null checks enabled",
  },
  {
    icon: TestTube,
    name: "Automated Tests",
    description: "Unit tests for components, integration tests for flows",
  },
  {
    icon: Accessibility,
    name: "Accessibility",
    description: "WCAG 2.1 AA compliance, screen reader tested",
  },
  {
    icon: Lock,
    name: "Security Scan",
    description: "OWASP Top 10 checks, dependency vulnerability audit",
  },
  {
    icon: Gauge,
    name: "Performance",
    description: "Lighthouse > 90, optimized bundle size",
  },
  {
    icon: ShieldCheck,
    name: "Code Quality",
    description: "ESLint rules, consistent patterns, no warnings",
  },
];

const checklist = [
  "Complete PRD with user stories",
  "Architecture Decision Records",
  "Component-level documentation",
  "Unit test suite with coverage",
  "Security review report",
  "Deployment guide and env docs",
  "Approval ledger with all sign-offs",
];

export function QualityGates() {
  return (
    <section className="py-20 bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 items-start">
          {/* Left: Quality Gates */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              Risk Reversal
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Quality gates that catch issues
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              Every build passes through automated checks before reaching you.
              Problems are caught and fixed in the pipeline — not in production.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {gates.map((gate, index) => (
                <motion.div
                  key={gate.name}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-4"
                >
                  <gate.icon className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-white">{gate.name}</h3>
                    <p className="text-sm text-slate-400">{gate.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Checklist */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              Definition of Done
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              What you get every time
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              No surprises. Every delivery includes these artifacts,
              verified and documented.
            </p>

            <ul className="space-y-4">
              {checklist.map((item, index) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-slate-300">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
