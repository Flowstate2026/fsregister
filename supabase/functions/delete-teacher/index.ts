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

    // Verify caller
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

    // Check caller is an owner
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Only owners can delete teachers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { profile_id } = await req.json();
    if (!profile_id) {
      return new Response(
        JSON.stringify({ error: "profile_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the teacher's user_id and school_id from profiles
    const { data: teacherProfile } = await adminClient
      .from("profiles")
      .select("user_id, school_id")
      .eq("id", profile_id)
      .single();

    if (!teacherProfile) {
      return new Response(
        JSON.stringify({ error: "Teacher not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify teacher belongs to caller's school
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("school_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile || callerProfile.school_id !== teacherProfile.school_id) {
      return new Response(
        JSON.stringify({ error: "Teacher not in your school" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent deleting yourself
    if (teacherProfile.user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "You cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const teacherUserId = teacherProfile.user_id;

    // Delete user_roles, profile, and auth user
    await adminClient.from("user_roles").delete().eq("user_id", teacherUserId);
    await adminClient.from("profiles").delete().eq("id", profile_id);
    
    // Unassign from any classes
    await adminClient.from("classes").update({ teacher_id: null }).eq("teacher_id", teacherUserId);

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(teacherUserId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
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
