import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for VAF - AI Agentic Factory",
};

export default function PrivacyPage() {
  return (
    <div className="pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
        <p className="text-slate-500 mb-8">Last updated: January 2024</p>

        <div className="prose prose-slate max-w-none">
          <h2>1. Introduction</h2>
          <p>
            AI Agentic Factory (&quot;VAF,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects your privacy
            and is committed to protecting your personal data. This privacy policy explains
            how we collect, use, and safeguard your information when you use our service.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>2.1 Information You Provide</h3>
          <ul>
            <li>Email address when you sign up for our waitlist or create an account</li>
            <li>Company name and role when you request a demo</li>
            <li>Prompts and requirements you submit for project generation</li>
            <li>Feedback and communications you send us</li>
          </ul>

          <h3>2.2 Information We Collect Automatically</h3>
          <ul>
            <li>Usage data (pages visited, features used, time spent)</li>
            <li>Device information (browser type, operating system)</li>
            <li>IP address and approximate location</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and improve our services</li>
            <li>Process your project generation requests</li>
            <li>Communicate with you about your account and our services</li>
            <li>Send you updates and marketing communications (with your consent)</li>
            <li>Analyze usage patterns to improve user experience</li>
          </ul>

          <h2>4. Data Retention</h2>
          <p>
            We retain your personal data only for as long as necessary to fulfill the purposes
            for which it was collected. Generated code and project files are retained for 90 days
            unless you request earlier deletion.
          </p>

          <h2>5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to processing of your data</li>
            <li>Request data portability</li>
          </ul>

          <h2>6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your
            personal data against unauthorized access, alteration, disclosure, or destruction.
          </p>

          <h2>7. Third-Party Services</h2>
          <p>
            We may use third-party services for analytics, payment processing, and
            infrastructure. These services have their own privacy policies governing their
            use of your information.
          </p>

          <h2>8. Cookies</h2>
          <p>
            We use essential cookies to operate our service and optional analytics cookies
            to understand usage patterns. You can control cookie preferences through your
            browser settings.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of any
            material changes by posting the new policy on this page and updating the
            &quot;Last updated&quot; date.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or our data practices,
            please contact us at privacy@vaf.ai.
          </p>
        </div>
      </div>
    </div>
  );
}
