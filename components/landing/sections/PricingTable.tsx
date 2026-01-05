"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/landing/ui/button";
import { Badge } from "@/components/landing/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/landing/ui/card";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

const tiers = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for solo founders testing their ideas.",
    features: [
      "5 site generations per month",
      "React + TypeScript + Tailwind",
      "Basic quality gates",
      "Email support",
      "Standard templates",
    ],
    cta: "Start Building",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/month",
    description: "For teams shipping products regularly.",
    features: [
      "25 site generations per month",
      "Full agent pipeline",
      "Advanced quality gates",
      "Priority support",
      "Custom templates",
      "Approval ledger export",
      "CI/CD integration",
    ],
    cta: "Get Pro Access",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Agency",
    price: "$399",
    period: "/month",
    description: "For agencies delivering client projects.",
    features: [
      "Unlimited generations",
      "White-label output",
      "Custom agent configuration",
      "Dedicated support",
      "Team collaboration",
      "Client handoff package",
      "SLA guarantee",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function PricingTable({ showComparison = false }: { showComparison?: boolean }) {
  const handlePlanSelect = (plan: string) => {
    track("plan_select", { plan });
  };

  return (
    <section className="py-20 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="mb-4">
            Pricing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Ship faster, pay less
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Choose the plan that fits your shipping velocity.
            All plans include core quality gates and documentation.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={cn(
                  "relative h-full flex flex-col",
                  tier.highlighted && "border-indigo-500 border-2 shadow-xl"
                )}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-indigo-600 text-white shadow-lg">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                    <span className="text-slate-500">{tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link
                    href="/signup"
                    className="w-full"
                    onClick={() => handlePlanSelect(tier.name)}
                  >
                    <Button
                      variant={tier.highlighted ? "default" : "outline"}
                      className="w-full"
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Enterprise callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-slate-600">
            Need enterprise features, custom SLAs, or on-premise deployment?{" "}
            <Link href="/demo" className="text-indigo-600 font-semibold hover:underline">
              Contact us for Enterprise pricing
            </Link>
          </p>
        </motion.div>

        {showComparison && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20"
          >
            <h3 className="text-2xl font-bold text-center mb-8">Plan Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold">Feature</th>
                    <th className="text-center py-3 px-4 font-semibold">Starter</th>
                    <th className="text-center py-3 px-4 font-semibold bg-indigo-50">Pro</th>
                    <th className="text-center py-3 px-4 font-semibold">Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Generations/month", "5", "25", "Unlimited"],
                    ["Quality gates", "Basic", "Advanced", "Advanced"],
                    ["Custom templates", "—", "✓", "✓"],
                    ["Team seats", "1", "5", "Unlimited"],
                    ["Approval ledger", "View only", "Export", "Full API"],
                    ["Support", "Email", "Priority", "Dedicated"],
                    ["White-label", "—", "—", "✓"],
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 px-4 text-slate-700 font-medium">{row[0]}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{row[1]}</td>
                      <td className="py-3 px-4 text-center text-slate-600 bg-indigo-50">{row[2]}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
