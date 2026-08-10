import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { secret, school_id, student_id, email } = body ?? {};

    const expectedSecret = Deno.env.get("ZAPIER_WEBHOOK_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (!school_id || (!student_id && !email)) {
      return json(
        { error: "Missing required fields: school_id and either student_id or email" },
        400
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("students")
      .select("id, archived")
      .eq("school_id", school_id)
      .limit(2);

    query = student_id
      ? query.eq("id", student_id)
      : query.ilike("parent_email", String(email).trim());

    const { data: matches, error: lookupErr } = await query;
    if (lookupErr) throw lookupErr;

    if (!matches || matches.length === 0) {
      return json({ error: "Student not found" }, 404);
    }
    if (matches.length > 1) {
      return json(
        { error: "Multiple students matched that email — pass student_id instead" },
        409
      );
    }

    const target = matches[0];

    const { error: updateErr } = await supabase
      .from("students")
      .update({ archived: true })
      .eq("id", target.id)
      .eq("school_id", school_id);

    if (updateErr) throw updateErr;

    return json({ success: true, student_id: target.id });
  } catch (err) {
    console.error("zapier-delete-student error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
