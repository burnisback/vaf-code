"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Layers,
  Palette,
  Code2,
  TestTube,
  Shield,
  FileCheck,
  BookOpen,
} from "lucide-react";

const deliverables = [
  { icon: FileText, label: "PRD" },
  { icon: Layers, label: "Architecture" },
  { icon: Palette, label: "Design System" },
  { icon: Code2, label: "Implementation" },
  { icon: TestTube, label: "Tests" },
  { icon: Shield, label: "Security Review" },
  { icon: FileCheck, label: "Release Pack" },
  { icon: BookOpen, label: "Docs" },
];

export function TrustStrip() {
  return (
    <section className="bg-slate-900 py-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10"
        >
          <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Every build includes:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            {deliverables.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-2 text-slate-300"
              >
                <item.icon className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-medium">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
