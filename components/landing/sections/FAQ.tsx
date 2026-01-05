"use client";

import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/landing/ui/accordion";
import { Badge } from "@/components/landing/ui/badge";
import { track } from "@/lib/analytics";

const faqs = [
  {
    question: "How accurate is the generated code?",
    answer: "The factory generates production-quality code that passes TypeScript strict mode, ESLint, and automated tests. Our multi-agent review process catches issues that single-pass generation misses. That said, you should always review the output — the quality gates catch common issues, but domain-specific logic may need adjustment.",
  },
  {
    question: "Can I control the scope of what gets built?",
    answer: "Yes. The intake stage extracts clear requirements from your prompt, and you can review the PRD before implementation begins. Complex prompts are broken into phases, and you can approve or modify the scope at each gate. The system is designed to prevent scope creep through explicit stage boundaries.",
  },
  {
    question: "What frameworks and integrations are supported?",
    answer: "We currently generate React + TypeScript + Tailwind CSS projects using Next.js. The output includes shadcn/ui components, proper SEO setup, and is deployment-ready for Vercel or any Node.js host. We're actively adding support for additional frameworks — Vue and Svelte are on the roadmap.",
  },
  {
    question: "How do you handle my data and intellectual property?",
    answer: "Your prompts and generated code are yours. We don't use customer code to train models. Generated projects are delivered with full source code and no runtime dependencies on our service. Enterprise customers can opt for on-premise deployment. See our privacy policy for details.",
  },
  {
    question: "How long does a typical build take?",
    answer: "A landing page typically completes in 10-15 minutes including all quality gates. More complex multi-page sites may take 30-45 minutes. The time is spent on thorough review and testing — not just generation. You'll see real-time progress through each stage.",
  },
  {
    question: "Can I extend or customize the generated code?",
    answer: "Absolutely. The output is clean, well-structured code following React best practices. There are no proprietary dependencies or lock-in. The codebase is designed to be maintainable by your team. We also provide documentation on the architectural decisions made.",
  },
  {
    question: "What if the generation fails or produces errors?",
    answer: "Our verification stage catches most issues before delivery. If a build fails quality gates, the system attempts remediation automatically. For persistent issues, our support team can investigate. Pro and Agency plans include priority support with faster response times.",
  },
  {
    question: "Can I deploy directly from the factory?",
    answer: "The release stage prepares deployment-ready output including environment variable documentation and deployment guides. While we don't deploy directly to your infrastructure, the output is optimized for one-click deployment on Vercel, Netlify, or similar platforms.",
  },
];

export function FAQ() {
  const handleExpand = (value: string) => {
    track("faq_expand", { question: value });
  };

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Common questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="w-full" onValueChange={handleExpand}>
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
