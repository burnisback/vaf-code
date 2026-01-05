export default function PrivacyPage() {
  return (
    <div className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-8">Privacy Policy</h1>

        <div className="space-y-8 text-[var(--color-text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Information We Collect</h2>
            <p className="mb-4">
              We collect information you provide directly to us, such as when you create an account,
              use our services, or contact us for support.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Account information (email, name)</li>
              <li>Project data and code you create</li>
              <li>Usage data and analytics</li>
              <li>Communications with our support team</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information.
              However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at privacy@vafcode.com.
            </p>
          </section>

          <p className="text-sm text-[var(--color-text-tertiary)]">
            Last updated: January 2026
          </p>
        </div>
      </div>
    </div>
  );
}
