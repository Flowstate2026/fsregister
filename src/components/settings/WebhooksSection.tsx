import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Webhook, Trash2 } from "lucide-react";

interface Props {
  schoolId: string;
}

export default function WebhooksSection({ schoolId }: Props) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("school_webhooks")
      .select("*")
      .eq("school_id", schoolId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setWebhookUrl(data.webhook_url);
          setEnabled(data.enabled);
          setExistingId(data.id);
        }
        setLoading(false);
      });
  }, [schoolId]);

  const handleSave = async () => {
    if (!webhookUrl.trim()) return;
    setSaving(true);

    if (existingId) {
      const { error } = await supabase
        .from("school_webhooks")
        .update({ webhook_url: webhookUrl.trim(), enabled, updated_at: new Date().toISOString() })
        .eq("id", existingId);
      if (error) toast.error("Failed to update webhook");
      else toast.success("Webhook updated");
    } else {
      const { data, error } = await supabase
        .from("school_webhooks")
        .insert({ school_id: schoolId, webhook_url: webhookUrl.trim(), enabled })
        .select()
        .single();
      if (error) toast.error("Failed to save webhook");
      else {
        setExistingId(data.id);
        toast.success("Webhook saved");
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!existingId) return;
    const { error } = await supabase.from("school_webhooks").delete().eq("id", existingId);
    if (error) toast.error("Failed to remove webhook");
    else {
      setWebhookUrl("");
      setEnabled(true);
      setExistingId(null);
      toast.success("Webhook removed");
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-2 text-foreground">
          <Webhook className="w-4 h-4" />
          <h2 className="text-sm font-medium uppercase tracking-[0.15em]">Webhooks</h2>
        </div>

        <p className="text-xs text-muted-foreground">
          Paste a webhook URL to receive outbound notifications when attendance is recorded or students are added.
        </p>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block">
            Webhook URL
          </label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.example.com/..."
          />
        </div>

        {existingId && (
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Enabled</label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving || !webhookUrl.trim()} className="flex-1">
            {saving ? "Saving…" : existingId ? "Update" : "Save"}
          </Button>
          {existingId && (
            <Button variant="outline" size="icon" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
