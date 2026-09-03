import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFrom } from "../_shared/sender.ts";

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

    const { data: school } = await adminClient
      .from("schools")
      .select("name, logo_url")
      .eq("id", schoolId)
      .maybeSingle();
    const schoolName = school?.name || "your school";

    // If the user already exists we still send a fresh invite link. The accept-invite
    // function updates their password and re-links their profile/role, so this doubles
    // as a safe "resend invitation" for existing staff.
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );


    // Remove any prior pending invite for the same email/school
    await adminClient
      .from("teacher_invites")
      .delete()
      .eq("school_id", schoolId)
      .eq("email", email)
      .is("accepted_at", null);

    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const inviteLink = `${APP_URL}/accept-invite?token=${encodeURIComponent(inviteToken)}`;

    // Store the same custom token that is sent in the email. Unlike an auth action link,
    // this token remains valid for the full seven-day period recorded in the database.
    const { data: savedInvite, error: saveInviteError } = await adminClient
      .from("teacher_invites")
      .insert({
        school_id: schoolId,
        email,
        full_name,
        invited_by: caller.id,
        role,
        invite_token: inviteToken,
        expires_at: expiresAt,
        accepted_at: null,
      })
      .select("id")
      .single();

    if (saveInviteError || !savedInvite) {
      return new Response(
        JSON.stringify({ error: `Failed to create invite: ${saveInviteError?.message ?? "unknown error"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      await adminClient.from("teacher_invites").delete().eq("id", savedInvite.id);
      return new Response(JSON.stringify({ error: "Email service is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        ${school?.logo_url ? `<tr><td style="padding:32px 40px 0;text-align:center;"><img src="${school.logo_url}" alt="${schoolName}" style="max-height:60px;max-width:200px;" /></td></tr>` : ""}
        <tr><td style="padding:32px 40px 0;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#3d2e1f;font-weight:500;">Welcome to ${schoolName}</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#3d2e1f;line-height:1.6;">Hi ${full_name}, you've been invited to join ${schoolName} on FS Register. Set your password to get started with class registers, notes and attendance.</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <a href="${inviteLink}" style="display:inline-block;padding:12px 28px;background:#C4704B;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #f0ebe4;">
          <p style="margin:0;font-size:11px;color:#b0a494;">This invitation expires in 7 days. Sent from ${schoolName}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: buildFrom(school?.name),
        to: [email],
        subject: `You've been invited to join ${schoolName} on FS Register`,
        html: inviteHtml,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error(`Invite email failed [${emailRes.status}]: ${errBody}`);
      await adminClient.from("teacher_invites").delete().eq("id", savedInvite.id);
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email", details: errBody }),
        { status: emailRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, teacher_user_id: existingUser?.id ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
