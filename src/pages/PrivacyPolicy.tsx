const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <div className="container max-w-3xl py-16 px-6">
      <button onClick={() => window.history.back()} className="mb-10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
        ← Back
      </button>

      <h1 className="font-display text-3xl mb-2 text-foreground">Privacy Policy</h1>
      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-12">Last updated: 31 March 2026</p>

      <div className="space-y-10 text-sm font-light leading-relaxed text-foreground/80">
        <section>
          <h2 className="font-display text-lg text-foreground mb-3">1. Who We Are</h2>
          <p>FS Register is a class management platform designed for children's performing arts schools. We act as a <strong className="font-medium text-foreground">Data Processor</strong> on behalf of schools (the Data Controllers) who use our platform to manage student attendance, class schedules, and communications.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">2. Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="font-medium text-foreground">School account data:</strong> School name, logo, administrator name and email address.</li>
            <li><strong className="font-medium text-foreground">Teacher data:</strong> Name and email address of invited teachers.</li>
            <li><strong className="font-medium text-foreground">Student data:</strong> First name, last name, date of birth, join date, parent/guardian email address.</li>
            <li><strong className="font-medium text-foreground">Attendance records:</strong> Date, class, and present/absent status.</li>
            <li><strong className="font-medium text-foreground">Teacher notes:</strong> Free-text notes recorded by teachers about students.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">3. How We Use Data</h2>
          <p>Data is processed solely for the purpose of providing class management and attendance tracking services to schools. We do not use personal data for marketing, profiling, or any purpose beyond the agreed service.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">4. Legal Basis for Processing</h2>
          <p>We process data under <strong className="font-medium text-foreground">legitimate interest</strong> (the school's operational need to manage classes and safeguard children) and <strong className="font-medium text-foreground">contractual necessity</strong> (to provide the service agreed with the school).</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">5. Data Sharing</h2>
          <p>We do not sell, share, or transfer personal data to third parties for marketing or any unrelated purpose. Data may be shared with our infrastructure providers (hosting, database) solely for the purpose of operating the service.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">6. Data Security</h2>
          <p>All data is encrypted at rest and in transit. Access is restricted by role-based permissions and row-level security policies. Each school's data is isolated and inaccessible to other schools.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">7. Data Retention</h2>
          <p>Data is retained for the duration of the school's active account. Schools may request a full data export or deletion at any time. GDPR consent records are retained permanently as a legal audit trail.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">8. Your Rights</h2>
          <p>Parents and students have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access their personal data (via the school)</li>
            <li>Request rectification of inaccurate data</li>
            <li>Request erasure of their data ("right to be forgotten")</li>
            <li>Request a portable copy of their data</li>
            <li>Object to processing</li>
          </ul>
          <p className="mt-3">These rights should be exercised through the school, who will action them using the tools provided in FS Register.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">9. Contact</h2>
          <p>For data protection enquiries, contact the school directly or email <strong className="font-medium text-foreground">privacy@fsregister.com</strong>.</p>
        </section>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
