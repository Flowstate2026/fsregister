import { useState } from "react";
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
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, marginBottom: 16 }}
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

      {/* Create School */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Create School Account</h2>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>School Name</label>
          <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, marginBottom: 16 }} />

          <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Owner Email</label>
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, marginBottom: 16 }} />

          <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Owner Password</label>
          <input type="password" value={adminUserPassword} onChange={(e) => setAdminUserPassword(e.target.value)} required minLength={6}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, marginBottom: 24 }} />

          <button type="submit" disabled={loading}
            style={{ padding: "8px 24px", background: "#1A1A18", color: "#fff", border: "none", borderRadius: 2, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Creating…" : "Create School"}
          </button>
        </form>
      </section>

      {/* Webhooks */}
      <AdminWebhooks adminPassword={adminPassword} />
    </div>
  );
};

export default Admin;
