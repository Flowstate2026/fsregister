import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin_password, school_id } = await req.json();
    if (admin_password !== Deno.env.get("ADMIN_SETUP_PASSWORD")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!school_id) {
      return new Response(JSON.stringify({ error: "Missing school_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch students for this school
    const { data: students } = await admin
      .from("students")
      .select("id")
      .eq("school_id", school_id);
    const studentIds = (students ?? []).map((s) => s.id);

    // Fetch student_notes for note_tokens / parent_replies cleanup
    let noteIds: string[] = [];
    if (studentIds.length > 0) {
      const { data: notes } = await admin
        .from("student_notes")
        .select("id")
        .in("student_id", studentIds);
      noteIds = (notes ?? []).map((n) => n.id);
    }

    if (noteIds.length > 0) {
      await admin.from("parent_replies").delete().in("note_id", noteIds);
      await admin.from("note_tokens").delete().in("note_id", noteIds);
    }

    if (studentIds.length > 0) {
      await admin.from("attendance_records").delete().in("student_id", studentIds);
      await admin.from("student_notes").delete().in("student_id", studentIds);
      await admin.from("class_enrollments").delete().in("student_id", studentIds);
    }

    await admin.from("students").delete().eq("school_id", school_id);
    await admin.from("cancelled_dates").delete().eq("school_id", school_id);
    await admin.from("classes").delete().eq("school_id", school_id);
    await admin.from("school_webhooks").delete().eq("school_id", school_id);
    await admin.from("teacher_invites").delete().eq("school_id", school_id);
    await admin.from("gdpr_consent_records").delete().eq("school_id", school_id);

    // Remove user_roles + profiles for this school (auth users intentionally kept)
    await admin.from("user_roles").delete().eq("school_id", school_id);
    await admin.from("profiles").delete().eq("school_id", school_id);

    const { error: schoolErr } = await admin.from("schools").delete().eq("id", school_id);
    if (schoolErr) throw schoolErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
