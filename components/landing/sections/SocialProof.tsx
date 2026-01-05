"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

const logos = [
  { name: "TechFlow", className: "text-slate-400" },
  { name: "BuildLabs", className: "text-slate-400" },
  { name: "DevForge", className: "text-slate-400" },
  { name: "CodeCraft", className: "text-slate-400" },
  { name: "ShipFast", className: "text-slate-400" },
];

const testimonials = [
  {
    quote: "We went from idea to deployed MVP in 3 hours. The quality gates caught accessibility issues I would have missed.",
    author: "Sarah Chen",
    role: "Founder, TechFlow",
    avatar: "SC",
  },
  {
    quote: "The approval ledger gives us confidence. We can show clients exactly what checks passed before launch.",
    author: "Marcus Johnson",
    role: "Agency Owner, BuildLabs",
    avatar: "MJ",
  },
  {
    quote: "My team used to spend 40% of time on boilerplate and config. Now we focus on what makes our product unique.",
    author: "David Park",
    role: "Engineering Manager, DevForge",
    avatar: "DP",
  },
];

export function SocialProof() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Logos */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-8">
            Used by teams who ship
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {logos.map((logo) => (
              <div
                key={logo.name}
                className="text-2xl font-bold text-slate-300"
              >
                {logo.name}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Testimonials */}
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative rounded-2xl bg-slate-50 p-8"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="text-slate-700 mb-6">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-slate-500">
                    {testimonial.role}
                  </div>
                </div>
              </div>
              <p className="absolute top-4 right-4 text-xs text-slate-400 italic">
                Sample
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
