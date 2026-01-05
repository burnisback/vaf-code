"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/landing/ui/button";
import { Input } from "@/components/landing/ui/input";
import { Select } from "@/components/landing/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/landing/ui/card";
import { submitDemo, type DemoData } from "@/lib/actions";
import { track } from "@/lib/analytics";

const useCaseOptions = [
  { value: "mvp", label: "MVP / New Product" },
  { value: "agency-projects", label: "Client Projects (Agency)" },
  { value: "internal-tools", label: "Internal Tools" },
  { value: "microsites", label: "Marketing / Microsites" },
  { value: "other", label: "Other" },
];

export default function DemoPage() {
  const [formData, setFormData] = useState<DemoData>({
    name: "",
    email: "",
    company: "",
    useCase: "mvp",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrors({});

    track("demo_submit", { useCase: formData.useCase });

    const result = await submitDemo(formData);

    if (result.success) {
      setStatus("success");
      track("demo_success", {});
    } else {
      setStatus("error");
      setErrors({ form: result.error || "Something went wrong" });
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Demo Request Received!</h1>
          <p className="text-slate-600 mb-8">
            Thanks for your interest in VAF. Our team will reach out within 24 hours to
            schedule your personalized demo.
          </p>
          <div className="bg-slate-50 rounded-xl p-6 text-left">
            <h2 className="font-semibold text-slate-900 mb-3">In the meantime:</h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Explore our <a href="/how-it-works" className="text-indigo-600 hover:underline">How It Works</a> page
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Check out <a href="/use-cases" className="text-indigo-600 hover:underline">Use Cases</a> for inspiration
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-600">•</span>
                Review our <a href="/docs" className="text-indigo-600 hover:underline">Documentation</a>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 py-32">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Calendar className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-900">Request a Demo</h1>
          <p className="text-slate-600 mt-2">
            See the AI Agentic Factory in action with a personalized walkthrough.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Book Your Demo</CardTitle>
            <CardDescription>
              Fill out the form and we&apos;ll schedule a time that works for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.form && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                  {errors.form}
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Work Email <span className="text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Company name"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                />
              </div>

              <div>
                <label htmlFor="useCase" className="block text-sm font-medium text-slate-700 mb-1">
                  Primary Use Case <span className="text-red-500">*</span>
                </label>
                <Select
                  id="useCase"
                  options={useCaseOptions}
                  value={formData.useCase}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      useCase: e.target.value as DemoData["useCase"],
                    })
                  }
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                  Anything else? (optional)
                </label>
                <Input
                  id="message"
                  type="text"
                  placeholder="Tell us about your needs"
                  value={formData.message || ""}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={status === "loading"}>
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Request Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
