export default function TermsPage() {
  return (
    <div className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-8">Terms of Service</h1>

        <div className="space-y-8 text-[var(--color-text-secondary)]">
          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using VAF Code, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">2. Use of Services</h2>
            <p className="mb-4">You agree to use VAF Code only for lawful purposes. You may not:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use the service to distribute malware or harmful code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">3. Your Content</h2>
            <p>
              You retain ownership of any content you create using VAF Code. By using our service,
              you grant us a license to host, store, and display your content as necessary to
              provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">4. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access
              to our services. We may modify or discontinue features at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">5. Limitation of Liability</h2>
            <p>
              VAF Code is provided &quot;as is&quot; without warranties of any kind. We are not liable
              for any indirect, incidental, or consequential damages arising from your use
              of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">6. Contact</h2>
            <p>
              For questions about these Terms, please contact us at legal@vafcode.com.
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
