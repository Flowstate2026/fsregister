import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://fsregister.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only owners can invite teachers" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("school_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Caller profile not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const full_name = String(body.full_name || "").trim();
    const role = body.role === "owner" ? "owner" : "teacher";

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "email and full_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolId = callerProfile.school_id;

    // If user already exists, check if they're already in this school
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingUser) {
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

    // Remove any prior pending invite for the same email/school
    await adminClient
      .from("teacher_invites")
      .delete()
      .eq("school_id", schoolId)
      .eq("email", email)
      .is("accepted_at", null);

    let teacherUserId: string;

    if (existingUser) {
      teacherUserId = existingUser.id;
      // Add profile and role for existing user to this school
      await adminClient.from("profiles").insert({
        user_id: teacherUserId,
        full_name: full_name,
        email: email,
        school_id: schoolId,
      });
      await adminClient.from("user_roles").insert({
        user_id: teacherUserId,
        role: role,
        school_id: schoolId,
      });
      // Keep metadata in sync so the app recognises their school/role
      await adminClient.auth.admin.updateUserById(teacherUserId, {
        user_metadata: {
          full_name: full_name,
          school_id: schoolId,
          role: role,
          password_set: true,
        },
      });
    } else {
      // Send the invitation through Lovable's built-in auth email system.
      // This creates the user and delivers a branded invite email via the default auth sender.
      const { data: newUser, error: createError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: full_name,
            school_id: schoolId,
            role: role,
            password_set: false,
          },
          redirectTo: `${APP_URL}/reset-password`,
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

    // Save a record of the invite for the Manage Teachers list
    await adminClient.from("teacher_invites").insert({
      school_id: schoolId,
      email: email,
      full_name: full_name,
      invited_by: caller.id,
      role: role,
      accepted_at: existingUser ? new Date().toISOString() : null,
    });

    return new Response(
      JSON.stringify({ success: true, teacher_user_id: teacherUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
