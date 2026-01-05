"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/landing/ui/button";
import { Input } from "@/components/landing/ui/input";
import { submitSignup } from "@/lib/actions";
import { track } from "@/lib/analytics";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    track("signup_submit", { location: "final_cta" });

    const result = await submitSignup({ email });

    if (result.success) {
      setStatus("success");
      track("signup_success", { location: "final_cta" });
    } else {
      setStatus("error");
      setErrorMessage(result.error || "Something went wrong");
    }
  };

  return (
    <section className="py-20 bg-indigo-600">
      <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to ship faster?
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Join the waitlist and be first to experience AI-governed development.
            One prompt. Production-ready output. Quality guaranteed.
          </p>

          {status === "success" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-8 rounded-xl bg-white/10 backdrop-blur-sm p-8"
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                You&apos;re on the list!
              </h3>
              <p className="text-indigo-100">
                We&apos;ll be in touch soon with early access details.
                Check your inbox for a confirmation email.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex-1 max-w-md">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-indigo-200 focus-visible:ring-white"
                  error={status === "error" ? errorMessage : undefined}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={status === "loading"}
                className="bg-white text-indigo-600 hover:bg-indigo-50"
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Get Early Access
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          <p className="mt-4 text-sm text-indigo-200">
            No credit card required. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
