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
    const resendKey = Deno.env.get("RESEND_API_KEY");

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

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inviteRow, error: inviteError } = await adminClient
      .from("teacher_invites")
      .insert({
        school_id: schoolId,
        email,
        full_name,
        invited_by: caller.id,
        role,
        expires_at: expiresAt,
      })
      .select("invite_token")
      .single();

    if (inviteError || !inviteRow) {
      return new Response(
        JSON.stringify({ error: `Failed to create invite: ${inviteError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const acceptUrl = `${APP_URL}/accept-invite?token=${inviteRow.invite_token}`;

    // Send via Resend
    let emailSent = false;
    if (resendKey) {
      const { data: school } = await adminClient
        .from("schools")
        .select("name")
        .eq("id", schoolId)
        .maybeSingle();
      const schoolName = school?.name || "your school";
      const roleLabel = role === "owner" ? "co-owner" : "teacher";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FS Register <onboarding@resend.dev>",
          to: [email],
          subject: `You're invited to ${schoolName} on FS Register`,
          html: `
            <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#2d2d2d;">
              <h1 style="font-size:22px;margin:0 0 16px;">You've been invited</h1>
              <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
                Hi ${full_name.split(" ")[0] || ""},
              </p>
              <p style="font-size:15px;line-height:1.5;margin:0 0 24px;">
                You've been invited to join <strong>${schoolName}</strong> as a ${roleLabel} on FS Register. Click below to set your password and get started.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${acceptUrl}" style="display:inline-block;background:#C4704B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;">Accept invitation</a>
              </p>
              <p style="font-size:12px;color:#7d7d7d;line-height:1.5;margin:24px 0 0;">
                This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
              </p>
              <p style="font-size:11px;color:#a0a0a0;word-break:break-all;margin:16px 0 0;">
                Or paste this link into your browser: ${acceptUrl}
              </p>
            </div>
          `,
        }),
      });
      if (res.ok) {
        emailSent = true;
      } else {
        console.error("Resend error:", await res.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent, accept_url: acceptUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
