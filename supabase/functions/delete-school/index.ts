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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is owner
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Only owners can delete a school" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { school_id } = await req.json();
    if (!school_id || school_id !== roleData.school_id) {
      return new Response(
        JSON.stringify({ error: "Invalid school" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all users in this school
    const { data: schoolProfiles } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("school_id", school_id);

    const userIds = (schoolProfiles || []).map((p) => p.user_id);

    // Delete all school data (order matters for FK constraints)
    // 1. attendance_records (via students)
    const { data: students } = await adminClient
      .from("students")
      .select("id")
      .eq("school_id", school_id);
    const studentIds = (students || []).map((s) => s.id);

    if (studentIds.length > 0) {
      await adminClient.from("attendance_records").delete().in("student_id", studentIds);
      await adminClient.from("student_notes").delete().in("student_id", studentIds);
      await adminClient.from("class_enrollments").delete().in("student_id", studentIds);
    }

    // 2. students, classes
    await adminClient.from("students").delete().eq("school_id", school_id);
    await adminClient.from("classes").delete().eq("school_id", school_id);

    // 3. teacher_invites, user_roles, profiles
    await adminClient.from("teacher_invites").delete().eq("school_id", school_id);
    await adminClient.from("gdpr_consent_records").delete().eq("school_id", school_id);

    for (const uid of userIds) {
      await adminClient.from("user_roles").delete().eq("user_id", uid);
      await adminClient.from("profiles").delete().eq("user_id", uid);
    }

    // 4. Delete the school
    await adminClient.from("schools").delete().eq("id", school_id);

    // 5. Delete all auth users
    for (const uid of userIds) {
      await adminClient.auth.admin.deleteUser(uid);
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
