const DataProcessingAgreement = () => (
  <div className="min-h-screen bg-background">
    <div className="container max-w-3xl py-16 px-6">
      <button onClick={() => window.history.back()} className="mb-10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
        ← Back
      </button>

      <h1 className="font-display text-3xl mb-2 text-foreground">Data Processing Agreement</h1>
      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground mb-12">Last updated: 31 March 2026</p>

      <div className="space-y-10 text-sm font-light leading-relaxed text-foreground/80">
        <section>
          <h2 className="font-display text-lg text-foreground mb-3">1. Parties</h2>
          <p>This Data Processing Agreement ("DPA") is entered into between the <strong className="font-medium text-foreground">School</strong> (the "Data Controller") and <strong className="font-medium text-foreground">FS Register</strong> (the "Data Processor").</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">2. Subject Matter</h2>
          <p>The Processor shall process personal data on behalf of the Controller for the purpose of providing class management, attendance tracking, and school communication services as described in the FS Register Privacy Policy.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">3. Categories of Data Subjects</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Students enrolled at the school</li>
            <li>Parents and guardians of students</li>
            <li>Teachers and staff employed or engaged by the school</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">4. Types of Personal Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Names, email addresses, dates of birth</li>
            <li>Attendance records and class enrolment data</li>
            <li>Teacher notes and observations</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">5. Processor Obligations</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Process personal data only on documented instructions from the Controller.</li>
            <li>Ensure that persons authorised to process data are under obligations of confidentiality.</li>
            <li>Implement appropriate technical and organisational measures to ensure security of processing.</li>
            <li>Not engage sub-processors without prior written consent of the Controller.</li>
            <li>Assist the Controller in responding to data subject access requests.</li>
            <li>Delete or return all personal data upon termination of the service, at the Controller's choice.</li>
            <li>Make available all information necessary to demonstrate compliance with this DPA.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">6. Security Measures</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Encryption of data at rest and in transit (TLS 1.2+)</li>
            <li>Row-level security ensuring strict data isolation between schools</li>
            <li>Role-based access control (owner/teacher permissions)</li>
            <li>Audit logging of GDPR consent records</li>
            <li>Regular security reviews and updates</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">7. Data Breach Notification</h2>
          <p>The Processor shall notify the Controller without undue delay (and in any event within 72 hours) upon becoming aware of a personal data breach. The notification shall include the nature of the breach, categories and approximate number of data subjects affected, and measures taken or proposed to address the breach.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">8. Sub-processors</h2>
          <p>The Processor currently uses the following sub-processors:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong className="font-medium text-foreground">Lovable Cloud</strong> — Database hosting, authentication, and backend functions</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">9. International Transfers</h2>
          <p>Data is stored and processed within secured infrastructure. Where transfers outside the UK/EEA occur, appropriate safeguards (such as Standard Contractual Clauses) are in place.</p>
        </section>

        <section>
          <h2 className="font-display text-lg text-foreground mb-3">10. Duration and Termination</h2>
          <p>This DPA remains in effect for the duration of the service agreement. Upon termination, the Processor shall delete all personal data within 30 days unless retention is required by law. The Controller may request a full data export before termination.</p>
        </section>
      </div>
    </div>
  </div>
);

export default DataProcessingAgreement;
