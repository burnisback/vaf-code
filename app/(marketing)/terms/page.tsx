import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for VAF - AI Agentic Factory",
};

export default function TermsPage() {
  return (
    <div className="pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        <p className="text-slate-500 mb-8">Last updated: January 2024</p>

        <div className="prose prose-slate max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the AI Agentic Factory (&quot;VAF&quot;) service, you agree to be
            bound by these Terms of Service. If you do not agree to these terms, please do
            not use our service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            VAF is an AI-powered code generation platform that transforms natural language
            prompts into production-ready React+TypeScript websites through a multi-agent
            pipeline with quality gates and approval processes.
          </p>

          <h2>3. User Accounts</h2>
          <ul>
            <li>You must provide accurate information when creating an account</li>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must notify us immediately of any unauthorized access</li>
            <li>One person may not maintain multiple free accounts</li>
          </ul>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to use VAF to:</p>
          <ul>
            <li>Generate malicious code or malware</li>
            <li>Create content that infringes on intellectual property rights</li>
            <li>Produce illegal, harmful, or offensive content</li>
            <li>Attempt to circumvent usage limits or security measures</li>
            <li>Resell or redistribute the service without authorization</li>
          </ul>

          <h2>5. Intellectual Property</h2>
          <h3>5.1 Your Content</h3>
          <p>
            You retain ownership of the prompts you submit and the code generated for you.
            We do not claim ownership of your generated projects.
          </p>

          <h3>5.2 Our Service</h3>
          <p>
            The VAF platform, including its agents, algorithms, and interface, remains our
            intellectual property. This license does not grant you rights to our underlying
            technology.
          </p>

          <h2>6. Payment and Billing</h2>
          <ul>
            <li>Paid plans are billed monthly or annually as selected</li>
            <li>Prices are subject to change with 30 days notice</li>
            <li>Refunds are provided per our refund policy</li>
            <li>Unused generations do not roll over between billing periods</li>
          </ul>

          <h2>7. Service Availability</h2>
          <p>
            We strive for high availability but do not guarantee uninterrupted service.
            We may perform maintenance that temporarily affects availability. Enterprise
            customers may have specific SLA terms.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            VAF is provided &quot;as is&quot; without warranties of any kind. We are not liable for
            any indirect, incidental, or consequential damages arising from your use of
            the service. Our total liability is limited to the amount you paid us in the
            preceding 12 months.
          </p>

          <h2>9. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless VAF and its team from any claims,
            damages, or expenses arising from your use of the service or violation of
            these terms.
          </p>

          <h2>10. Termination</h2>
          <p>
            We may suspend or terminate your account for violation of these terms. You may
            cancel your account at any time. Upon termination, your right to use the
            service ends immediately.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may modify these terms at any time. We will notify you of material changes
            via email or through the service. Continued use after changes constitutes
            acceptance of the new terms.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Delaware, USA, without
            regard to conflict of law principles.
          </p>

          <h2>13. Contact</h2>
          <p>
            For questions about these terms, please contact us at legal@vaf.ai.
          </p>
        </div>
      </div>
    </div>
  );
}
