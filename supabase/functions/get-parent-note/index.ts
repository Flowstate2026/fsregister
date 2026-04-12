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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the token and get all related data
    const { data: tokenRow, error } = await admin
      .from("note_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Invalid link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the note
    const { data: note } = await admin
      .from("student_notes")
      .select("*")
      .eq("id", tokenRow.note_id)
      .single();

    if (!note) {
      return new Response(
        JSON.stringify({ error: "Note not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get student + school
    const { data: student } = await admin
      .from("students")
      .select("first_name, last_name, school_id")
      .eq("id", note.student_id)
      .single();

    const { data: school } = await admin
      .from("schools")
      .select("name, logo_url")
      .eq("id", student?.school_id || "")
      .single();

    // Get teacher name
    const { data: author } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", note.author_id)
      .single();

    // Get class name
    const { data: enrollment } = await admin
      .from("class_enrollments")
      .select("classes(name)")
      .eq("student_id", note.student_id)
      .limit(1)
      .single();

    // Get existing replies
    const { data: replies } = await admin
      .from("parent_replies")
      .select("*")
      .eq("note_id", note.id)
      .order("created_at", { ascending: true });

    return new Response(
      JSON.stringify({
        note: {
          id: note.id,
          text: note.note_text,
          date: note.created_at,
        },
        student: {
          firstName: student?.first_name || "",
          lastName: student?.last_name || "",
        },
        school: {
          name: school?.name || "",
          logoUrl: school?.logo_url || null,
        },
        teacher: {
          name: author?.full_name || "Teacher",
        },
        className: (enrollment?.classes as any)?.name || "",
        replies: replies || [],
        expired: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
