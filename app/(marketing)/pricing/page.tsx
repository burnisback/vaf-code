import { Metadata } from "next";
import { PricingTable, FAQ, FinalCTA } from "@/components/landing/sections";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose the plan that fits your shipping velocity. All plans include core quality gates and documentation.",
};

export default function PricingPage() {
  return (
    <>
      {/* Add padding for header */}
      <div className="pt-20" />

      <PricingTable showComparison={true} />

      {/* Pricing FAQ */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8">Pricing FAQ</h2>
          <div className="space-y-6">
            {[
              {
                q: "What counts as a 'generation'?",
                a: "Each time you submit a prompt and receive a complete output package, that's one generation. Iterations on the same prompt during the review stage don't count as additional generations.",
              },
              {
                q: "Can I upgrade or downgrade my plan?",
                a: "Yes, you can change plans at any time. Upgrades are prorated immediately. Downgrades take effect at the next billing cycle.",
              },
              {
                q: "Is there a free trial?",
                a: "We offer a 14-day trial on the Pro plan. You'll have access to all Pro features to evaluate the full pipeline.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards through Stripe. Enterprise customers can pay by invoice.",
              },
              {
                q: "What's included in 'priority support'?",
                a: "Pro and Agency plans get faster response times (under 4 hours), dedicated Slack channel, and direct access to our engineering team for complex issues.",
              },
            ].map((faq, i) => (
              <div key={i} className="border-b border-slate-200 pb-6">
                <h3 className="font-semibold text-slate-900 mb-2">{faq.q}</h3>
                <p className="text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FinalCTA />
    </>
  );
}
