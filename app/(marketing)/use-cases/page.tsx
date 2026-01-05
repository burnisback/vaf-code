import { Metadata } from "next";
import { Badge } from "@/components/landing/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/landing/ui/card";
import { FinalCTA } from "@/components/landing/sections";
import { Rocket, Building2, Users, Globe, ArrowRight, Code2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Use Cases",
  description: "See how founders, agencies, product teams, and enterprises use VAF to ship faster.",
};

const useCases = [
  {
    icon: Rocket,
    title: "Founders & Startups",
    description: "Validate ideas faster with production-quality MVPs",
    examples: [
      {
        prompt: "Build a SaaS landing page for an AI writing assistant with pricing, testimonials, and waitlist signup",
        outcome: "Complete landing page with email capture, Stripe-ready pricing section, and mobile-responsive design. Deployed in 45 minutes.",
      },
      {
        prompt: "Create a dashboard for users to track their API usage with charts and billing history",
        outcome: "Full dashboard with Recharts integration, mock data structure, authentication layout, and export functionality.",
      },
      {
        prompt: "Build a simple booking system for a consulting business",
        outcome: "Calendar-based booking interface with time slot selection, confirmation emails (template), and admin view.",
      },
    ],
  },
  {
    icon: Building2,
    title: "Agencies",
    description: "Deliver client projects faster with consistent quality",
    examples: [
      {
        prompt: "Create a portfolio website for an architecture firm with project galleries and contact form",
        outcome: "Elegant portfolio with image galleries, project filtering, team section, and validated contact form.",
      },
      {
        prompt: "Build an e-commerce landing page for a product launch with countdown timer and pre-order form",
        outcome: "Conversion-optimized landing page with countdown component, social proof section, and pre-order capture.",
      },
      {
        prompt: "Design a job board for a recruiting agency with search and application tracking",
        outcome: "Searchable job listings with filters, application form, and admin interface for managing postings.",
      },
    ],
  },
  {
    icon: Users,
    title: "Product Teams",
    description: "Prototype and iterate on features without blocking engineering",
    examples: [
      {
        prompt: "Build an internal tool for the support team to manage customer tickets with status tracking",
        outcome: "Ticket management interface with status workflow, assignment, priority levels, and search.",
      },
      {
        prompt: "Create a settings page for our app with profile, notifications, and billing sections",
        outcome: "Tabbed settings interface with form validation, toggle components, and plan upgrade flow.",
      },
      {
        prompt: "Design a feature request voting board for our users",
        outcome: "Voting interface with upvote/downvote, status badges, and sorting by popularity or recency.",
      },
    ],
  },
  {
    icon: Globe,
    title: "Enterprise Microsites",
    description: "Launch campaign sites and internal tools with enterprise-grade quality",
    examples: [
      {
        prompt: "Build a compliance training portal with module tracking and quiz completion",
        outcome: "Learning management interface with progress tracking, quiz components, and completion certificates.",
      },
      {
        prompt: "Create an internal company directory with search and org chart visualization",
        outcome: "Employee directory with search, department filtering, profile pages, and org chart component.",
      },
      {
        prompt: "Design an event registration site for our annual conference",
        outcome: "Multi-step registration form with session selection, payment integration ready, and confirmation emails.",
      },
    ],
  },
];

export default function UseCasesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <Badge variant="secondary" className="mb-4">
            Use Cases
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            See What Teams Are Building
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            From startup MVPs to enterprise tools, see real examples of prompts and their
            production-ready outputs.
          </p>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="space-y-20">
            {useCases.map((useCase) => (
              <div key={useCase.title}>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-xl bg-indigo-100">
                    <useCase.icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{useCase.title}</h2>
                    <p className="text-slate-600">{useCase.description}</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {useCase.examples.map((example, index) => (
                    <Card key={index} className="flex flex-col">
                      <CardHeader>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                          <Code2 className="h-4 w-4" />
                          <span>Example Prompt</span>
                        </div>
                        <CardDescription className="text-slate-700 font-medium">
                          &ldquo;{example.prompt}&rdquo;
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <div className="flex items-center gap-2 text-sm text-emerald-600 mb-2">
                          <ArrowRight className="h-4 w-4" />
                          <span>Output</span>
                        </div>
                        <p className="text-sm text-slate-600">{example.outcome}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
