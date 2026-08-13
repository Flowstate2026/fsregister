import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_URL = "https://fsregister.lovable.app";
// Single source of truth for how long an invite link stays valid.
const INVITE_TTL_DAYS = 7;

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

    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

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
        .select("name, logo_url")
        .eq("id", schoolId)
        .maybeSingle();
      const schoolName = school?.name || "your school";
      const roleLabel = role === "owner" ? "co-owner" : "teacher";
      const firstName = full_name.split(" ")[0] || "there";
      const expiryDate = new Date(expiresAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        ${school?.logo_url ? `<tr><td style="padding:32px 40px 0;text-align:center;"><img src="${school.logo_url}" alt="${schoolName}" style="max-height:60px;max-width:200px;" /></td></tr>` : ""}
        <tr><td style="padding:32px 40px 0;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#3d2e1f;font-weight:500;">You've been invited to ${schoolName}</h1>
          <p style="margin:0 0 24px;font-size:13px;color:#8a7b6b;">Join as a ${roleLabel} on FS Register</p>
        </td></tr>
        <tr><td style="padding:0 40px;">
          <p style="margin:0 0 16px;font-size:15px;color:#3d2e1f;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#3d2e1f;line-height:1.6;">
            Welcome aboard! You've been invited to join <strong>${schoolName}</strong> as a ${roleLabel} on FS Register — where you'll take registers, track attendance and keep notes on your students. Tap the button below to set your password and get started.
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <a href="${acceptUrl}" style="display:inline-block;padding:12px 28px;background:#C4704B;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #f0ebe4;">
          <p style="margin:0 0 8px;font-size:11px;color:#b0a494;">This invitation expires in ${INVITE_TTL_DAYS} days (on ${expiryDate}). If you didn't expect this email, you can safely ignore it.</p>
          <p style="margin:0;font-size:11px;color:#b0a494;word-break:break-all;">Or paste this link into your browser: ${acceptUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "FS Register <onboarding@resend.dev>",
          to: [email],
          subject: `You've been invited to join ${schoolName} on FS Register`,
          html: emailHtml,
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
