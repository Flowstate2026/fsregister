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

  // Test mode
  const [testMode, setTestMode] = useState(() => localStorage.getItem("fs_test_mode") === "true");

  useEffect(() => {
    localStorage.setItem("fs_test_mode", testMode ? "true" : "false");
  }, [testMode]);

  // Webhook check
  const [webhookSchoolId, setWebhookSchoolId] = useState("");
  const [webhookStudentIds, setWebhookStudentIds] = useState("");
  const [webhookRunning, setWebhookRunning] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

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
      // If student IDs provided, use them; otherwise fetch all students for school
      let studentIds: string[] = [];
      if (webhookStudentIds.trim()) {
        studentIds = webhookStudentIds.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        // Fetch all student IDs for the school via admin
        const { data } = await supabase.functions.invoke("admin-list-schools", {
          body: { admin_password: adminPassword },
        });
        // We need to get students - let's use the edge function with all students
        // The edge function will handle fetching
        toast.info("Fetching all students for school...");
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

  if (!authenticated) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 20, marginBottom: 24 }}>Admin Access</h1>
        <form onSubmit={(e) => { e.preventDefault(); setAuthenticated(true); }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Admin Password</label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 16 }}
          />
          <button type="submit" style={{ padding: "8px 20px", background: "#1A1A18", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer" }}>
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: "80px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Admin Panel</h1>

      {/* Test Mode Toggle */}
      <section style={{ marginBottom: 48, padding: 16, border: "1px solid #e0c8a0", background: testMode ? "#fdf6e3" : "#fafafa", borderRadius: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>🧪 Test Mode</h2>
            <p style={{ fontSize: 12, color: "#666" }}>
              When enabled, the Today view shows all classes with a date picker so you can submit registers for any date.
            </p>
          </div>
          <button
            onClick={() => setTestMode(!testMode)}
            style={{
              padding: "6px 16px",
              background: testMode ? "#C4704B" : "#ddd",
              color: testMode ? "#fff" : "#333",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {testMode ? "ON" : "OFF"}
          </button>
        </div>
      </section>

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

        <button
          onClick={handleRunWebhookCheck}
          disabled={webhookRunning}
          style={{ padding: "8px 24px", background: "#C4704B", color: "#fff", border: "none", borderRadius: 2, cursor: webhookRunning ? "wait" : "pointer" }}
        >
          {webhookRunning ? "Running…" : "Run Webhook Check"}
        </button>

        {webhookResult && (
          <pre style={{ marginTop: 12, padding: 12, background: "#f5f5f5", fontSize: 11, overflow: "auto", maxHeight: 300, borderRadius: 4 }}>
            {webhookResult}
          </pre>
        )}
      </section>
    </div>
  );
};

export default Admin;
