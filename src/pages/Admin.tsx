import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AdminWebhooks from "@/components/admin/AdminWebhooks";

const Admin = () => {
  const navigate = useNavigate();
  const [adminPassword, setAdminPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUserPassword, setAdminUserPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Webhook check
  const [webhookSchoolId, setWebhookSchoolId] = useState("");
  const [webhookStudentIds, setWebhookStudentIds] = useState("");
  const [webhookRunning, setWebhookRunning] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  // Seed test data
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  useEffect(() => {
    if (authenticated) {
      supabase.functions
        .invoke("admin-list-schools", { body: { admin_password: adminPassword } })
        .then(({ data }) => {
          if (data?.schools) setSchools(data.schools);
        });
    }
  }, [authenticated, adminPassword]);

  const handleRunWebhookCheck = async () => {
    if (!webhookSchoolId) { toast.error("Select a school"); return; }
    setWebhookRunning(true);
    setWebhookResult(null);
    try {
      let studentIds: string[] = [];
      if (webhookStudentIds.trim()) {
        studentIds = webhookStudentIds.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const { data, error } = await supabase.functions.invoke("check-attendance-webhooks", {
        body: { student_ids: studentIds, school_id: webhookSchoolId, admin_password: adminPassword },
      });

      if (error) {
        setWebhookResult(`Error: ${error.message}`);
        toast.error("Webhook check failed");
      } else {
        setWebhookResult(JSON.stringify(data, null, 2));
        toast.success(`Webhook check complete: ${data?.triggered ?? 0} triggered`);
      }
    } catch (err) {
      setWebhookResult(`Error: ${(err as Error).message}`);
    } finally {
      setWebhookRunning(false);
    }
  };

  const handleSeedTestData = async () => {
    if (!webhookSchoolId) { toast.error("Select a school first"); return; }
    setSeedRunning(true);
    setSeedResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-seed-test-data", {
        body: { admin_password: adminPassword, school_id: webhookSchoolId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSeedResult(JSON.stringify(data, null, 2));
      toast.success("Test data seeded successfully");
    } catch (err) {
      setSeedResult(`Error: ${(err as Error).message}`);
      toast.error("Failed to seed test data");
    } finally {
      setSeedRunning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-school", {
        body: {
          admin_password: adminPassword,
          school_name: schoolName,
          admin_email: adminEmail,
          admin_user_password: adminUserPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminUserPassword,
      });
      if (signInError) throw signInError;

      toast.success("School created — redirecting to onboarding");
      navigate("/onboarding");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 13,
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Verify the entered password against the stored ADMIN_SETUP_PASSWORD
      // by calling an admin endpoint that checks it. Does NOT modify the secret.
      const { data, error } = await supabase.functions.invoke("admin-list-schools", {
        body: { admin_password: adminPassword },
      });
      if (error || (data as any)?.error) {
        toast.error("Incorrect admin password");
        return;
      }
      setAuthenticated(true);
    } catch {
      toast.error("Could not verify password");
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 20, marginBottom: 24 }}>Admin Access</h1>
        <form onSubmit={handleLogin}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Admin Password</label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 16 }}
          />
          <button type="submit" disabled={loading} style={{ padding: "8px 20px", background: "#1A1A18", color: "#fff", border: "none", borderRadius: 2, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Admin Panel</h1>

      {/* Create School */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Create School Account</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>School Name</label>
          <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required
            style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Owner Email</label>
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
            style={{ ...inputStyle, marginBottom: 16 }} />

          <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Owner Password</label>
          <input type="password" value={adminUserPassword} onChange={(e) => setAdminUserPassword(e.target.value)} required minLength={6}
            style={{ ...inputStyle, marginBottom: 24 }} />

          <button type="submit" disabled={loading}
            style={{ padding: "8px 24px", background: "#1A1A18", color: "#fff", border: "none", borderRadius: 2, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Creating…" : "Create School"}
          </button>
        </form>
      </section>

      {/* Webhooks */}
      <AdminWebhooks adminPassword={adminPassword} />

      {/* Manual Webhook Check */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Run Webhook Check</h2>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          Manually trigger the absence webhook check for a school. Leave student IDs empty to check all students.
        </p>

        <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>School</label>
        <select value={webhookSchoolId} onChange={(e) => setWebhookSchoolId(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          <option value="">Select a school…</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Student IDs (comma-separated, optional)</label>
        <input
          type="text"
          value={webhookStudentIds}
          onChange={(e) => setWebhookStudentIds(e.target.value)}
          placeholder="Leave empty to check all students"
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRunWebhookCheck}
            disabled={webhookRunning}
            style={{ padding: "8px 24px", background: "#C4704B", color: "#fff", border: "none", borderRadius: 2, cursor: webhookRunning ? "wait" : "pointer" }}
          >
            {webhookRunning ? "Running…" : "Run Webhook Check"}
          </button>

          <button
            onClick={handleSeedTestData}
            disabled={seedRunning || !webhookSchoolId}
            style={{ padding: "8px 24px", background: "#4B7BC4", color: "#fff", border: "none", borderRadius: 2, cursor: seedRunning ? "wait" : "pointer" }}
          >
            {seedRunning ? "Seeding…" : "Seed Test Data"}
          </button>
        </div>

        {webhookResult && (
          <pre style={{ marginTop: 12, padding: 12, background: "#f5f5f5", fontSize: 11, overflow: "auto", maxHeight: 300, borderRadius: 4 }}>
            {webhookResult}
          </pre>
        )}

        {seedResult && (
          <pre style={{ marginTop: 12, padding: 12, background: "#eef4ff", fontSize: 11, overflow: "auto", maxHeight: 300, borderRadius: 4 }}>
            {seedResult}
          </pre>
        )}
      </section>

      {/* Update Admin Password */}
      <section style={{ marginTop: 48, padding: 16, border: "1px solid #e5e5e5", borderRadius: 4, background: "#fafafa" }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Update Admin Password</h2>
        <p style={{ fontSize: 12, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
          The admin password is stored as the <code>ADMIN_SETUP_PASSWORD</code> secret. For security, it can only be changed from
          Project Settings → Secrets. The login field above only <em>checks</em> the password — it never writes to the secret.
        </p>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
          To rotate: open Lovable Cloud settings, find <code>ADMIN_SETUP_PASSWORD</code>, and update its value there.
        </p>
      </section>
    </div>
  );
};

export default Admin;
