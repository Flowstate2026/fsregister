import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, reply_text, parent_name } = await req.json();

    if (!token || !reply_text?.trim()) {
      return new Response(
        JSON.stringify({ error: "token and reply_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token and check expiry
    const { data: tokenRow, error: tokenError } = await admin
      .from("note_tokens")
      .select("*, student_notes(*, students(*, schools(name, email)))")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save the reply
    const { error: replyError } = await admin
      .from("parent_replies")
      .insert({
        note_id: tokenRow.note_id,
        reply_text: reply_text.trim(),
        parent_name: parent_name?.trim() || null,
      });

    if (replyError) {
      return new Response(
        JSON.stringify({ error: "Failed to save reply" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the note author to notify them
    const note = tokenRow.student_notes as any;
    const student = note?.students;
    const authorId = note?.author_id;

    if (authorId) {
      const { data: authorProfile } = await admin
        .from("profiles")
        .select("email")
        .eq("user_id", authorId)
        .single();

      if (authorProfile?.email) {
        console.log("Teacher notification email would be sent to:", authorProfile.email);
        console.log("Parent reply:", reply_text.trim());
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
