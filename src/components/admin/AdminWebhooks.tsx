import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EVENT_TYPES = [
  { key: "absent_twice", label: "Student absent twice in a row" },
  { key: "below_70", label: "Attendance drops below 70%" },
  { key: "note_added", label: "Note added to student profile" },
] as const;

interface Props {
  adminPassword: string;
}

interface WebhookRow {
  id: string;
  school_id: string;
  event_type: string;
  webhook_url: string;
  enabled: boolean;
}

export default function AdminWebhooks({ adminPassword }: Props) {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fetch schools list via edge function (service role)
  useEffect(() => {
    supabase.functions
      .invoke("admin-list-schools", { body: { admin_password: adminPassword } })
      .then(({ data, error }) => {
        if (!error && data?.schools) setSchools(data.schools);
      });
  }, [adminPassword]);

  // Fetch webhooks for selected school
  useEffect(() => {
    if (!selectedSchool) { setWebhooks([]); return; }
    supabase.functions
      .invoke("admin-get-webhooks", { body: { admin_password: adminPassword, school_id: selectedSchool } })
      .then(({ data, error }) => {
        if (!error && data?.webhooks) {
          setWebhooks(data.webhooks);
          const u: Record<string, string> = {};
          data.webhooks.forEach((w: WebhookRow) => { u[w.event_type] = w.webhook_url; });
          setUrls(u);
        }
      });
  }, [selectedSchool, adminPassword]);

  const handleSave = async () => {
    if (!selectedSchool) return;
    setSaving(true);
    const { error } = await supabase.functions.invoke("admin-save-webhooks", {
      body: { admin_password: adminPassword, school_id: selectedSchool, webhooks: urls },
    });
    if (error) toast.error("Failed to save webhooks");
    else toast.success("Webhooks saved");
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 13,
  };

  return (
    <section>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Webhooks</h2>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Configure outbound webhook URLs per school for specific events.
      </p>

      <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>School</label>
      <select
        value={selectedSchool}
        onChange={(e) => setSelectedSchool(e.target.value)}
        style={{ ...inputStyle, marginBottom: 20 }}
      >
        <option value="">Select a school…</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {selectedSchool && (
        <>
          {EVENT_TYPES.map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "#555" }}>{label}</label>
              <input
                type="url"
                placeholder="https://hooks.example.com/..."
                value={urls[key] || ""}
                onChange={(e) => setUrls((prev) => ({ ...prev, [key]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "8px 24px", background: "#1A1A18", color: "#fff", border: "none", borderRadius: 2, cursor: saving ? "wait" : "pointer" }}
          >
            {saving ? "Saving…" : "Save Webhooks"}
          </button>
        </>
      )}
    </section>
  );
}
