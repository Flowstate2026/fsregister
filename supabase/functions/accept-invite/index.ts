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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite, error: inviteErr } = await admin
      .from("teacher_invites")
      .select("id, school_id, email, full_name, role, expires_at, accepted_at")
      .eq("invite_token", token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.accepted_at) {
      return new Response(JSON.stringify({ error: "This invite has already been used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "This invite has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preview mode: just return invite details
    if (body.preview) {
      return new Response(
        JSON.stringify({
          email: invite.email,
          full_name: invite.full_name,
          role: invite.role,
          school_id: invite.school_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up existing auth user by email
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let userId: string | null =
      existingUsers?.users?.find((u) => u.email?.toLowerCase() === invite.email.toLowerCase())?.id ?? null;

    if (userId) {
      // Update existing user's password
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          full_name: invite.full_name,
          school_id: invite.school_id,
          role: invite.role,
          password_set: true,
        },
      });
      if (error) {
        return new Response(JSON.stringify({ error: `Failed to update user: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: invite.full_name,
          school_id: invite.school_id,
          role: invite.role,
          password_set: true,
        },
      });
      if (error || !created.user) {
        return new Response(JSON.stringify({ error: `Failed to create user: ${error?.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // Upsert profile
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("school_id", invite.school_id)
      .maybeSingle();

    if (!existingProfile) {
      await admin.from("profiles").insert({
        user_id: userId,
        full_name: invite.full_name,
        email: invite.email,
        school_id: invite.school_id,
      });
    }

    // Ensure role exists
    await admin.from("user_roles").upsert(
      {
        user_id: userId,
        role: invite.role,
        school_id: invite.school_id,
      },
      { onConflict: "user_id,role,school_id", ignoreDuplicates: true }
    );

    // Mark invite accepted
    await admin
      .from("teacher_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, email: invite.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
