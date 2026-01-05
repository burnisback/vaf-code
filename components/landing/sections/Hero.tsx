"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/landing/ui/button";
import { track } from "@/lib/analytics";

export function Hero() {
  const handlePrimaryCta = () => {
    track("cta_click", { location: "hero", cta: "get_early_access" });
  };

  const handleSecondaryCta = () => {
    track("cta_click", { location: "hero", cta: "see_how_it_works" });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 lg:pt-40 lg:pb-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-100/50 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20 mb-6">
              AI-Governed Development Pipeline
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl"
          >
            From one prompt to a{" "}
            <span className="text-indigo-600">production-ready</span> website
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl"
          >
            Stop wrestling with incomplete outputs and endless prompt iterations.
            Our multi-agent factory builds React+TypeScript websites with stage gates,
            quality checks, and executive sign-off — just like a real engineering team.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup" onClick={handlePrimaryCta}>
              <Button size="lg" className="w-full sm:w-auto">
                Get Early Access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works" onClick={handleSecondaryCta}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Play className="mr-2 h-4 w-4" />
                See How the Factory Works
              </Button>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
