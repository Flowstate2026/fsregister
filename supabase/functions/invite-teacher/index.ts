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
    // Verify the caller is authenticated and is an owner
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

    // Verify caller with anon client
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
        JSON.stringify({ error: "Only owners can invite teachers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller's school_id
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("school_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile) {
      return new Response(
        JSON.stringify({ error: "Caller profile not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, full_name } = await req.json();
    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "email and full_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const schoolId = callerProfile.school_id;

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Check if they already have a profile in this school
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "This user is already part of your school" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let teacherUserId: string;

    if (existingUser) {
      teacherUserId = existingUser.id;
      // Add profile and role for existing user to this school
      await adminClient.from("profiles").insert({
        user_id: teacherUserId,
        full_name: full_name.trim(),
        email: email.trim(),
        school_id: schoolId,
      });
      await adminClient.from("user_roles").insert({
        user_id: teacherUserId,
        role: "teacher",
        school_id: schoolId,
      });
    } else {
      // Use inviteUserByEmail — this creates the user AND sends them
      // an email with a link to set their password
      const { data: newUser, error: createError } = await adminClient.auth.admin.inviteUserByEmail(
        email.trim(),
        {
          data: {
            full_name: full_name.trim(),
            school_id: schoolId,
            role: "teacher",
            password_set: false,
          },
          redirectTo: `https://fsregister.lovable.app/reset-password`,
        }
      );

      if (createError) {
        return new Response(
          JSON.stringify({ error: `Failed to invite user: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      teacherUserId = newUser.user.id;
    }

    // Save to teacher_invites
    await adminClient.from("teacher_invites").insert({
      school_id: schoolId,
      email: email.trim(),
      full_name: full_name.trim(),
      invited_by: caller.id,
      accepted_at: null,
    });

    return new Response(
      JSON.stringify({ success: true, teacher_user_id: teacherUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
