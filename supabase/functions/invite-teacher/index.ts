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
      // Create the user and generate the invite link, then send the email ourselves so the
      // sender name is always the school name (never anyone's personal email address).
      const { data: linkData, error: createError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: {
            full_name: full_name,
            school_id: schoolId,
            role: role,
            password_set: false,
          },
          redirectTo: `${APP_URL}/reset-password`,
        },
      });

      if (createError || !linkData?.user) {
        return new Response(
          JSON.stringify({ error: `Failed to invite user: ${createError?.message ?? "unknown error"}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      teacherUserId = linkData.user.id;

      const inviteLink = linkData.properties.action_link;
      const resendApiKey = Deno.env.get("RESEND_API_KEY");

      if (resendApiKey) {
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
        }
      }
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
