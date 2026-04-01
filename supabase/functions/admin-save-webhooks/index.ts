import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { admin_password, school_id, webhooks } = await req.json();
  if (admin_password !== Deno.env.get("ADMIN_SETUP_PASSWORD")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // webhooks is Record<event_type, url>
  for (const [event_type, url] of Object.entries(webhooks as Record<string, string>)) {
    if (!url.trim()) {
      // Delete if empty
      await supabase.from("school_webhooks").delete().eq("school_id", school_id).eq("event_type", event_type);
    } else {
      // Upsert
      await supabase.from("school_webhooks").upsert(
        { school_id, event_type, webhook_url: url.trim(), enabled: true, updated_at: new Date().toISOString() },
        { onConflict: "school_id,event_type" }
      );
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
