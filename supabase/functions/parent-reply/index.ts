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
    const { token, reply_text, parent_name } = await req.json();

    if (!token || !reply_text?.trim()) {
      return new Response(
        JSON.stringify({ error: "token and reply_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token and check expiry
    const { data: tokenRow, error: tokenError } = await admin
      .from("note_tokens")
      .select("*, student_notes(*, students(*, schools(name, email)))")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedReply = reply_text.trim();
    const trimmedName = parent_name?.trim() || null;

    // Save the reply
    const { error: replyError } = await admin
      .from("parent_replies")
      .insert({
        note_id: tokenRow.note_id,
        reply_text: trimmedReply,
        parent_name: trimmedName,
      });

    if (replyError) {
      return new Response(
        JSON.stringify({ error: "Failed to save reply" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify the note author via email
    const note = tokenRow.student_notes as any;
    const student = note?.students;
    const school = student?.schools;
    const authorId = note?.author_id;

    let emailSent = false;

    if (authorId && student) {
      const { data: authorProfile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", authorId)
        .single();

      const resendApiKey = Deno.env.get("RESEND_API_KEY");

      if (authorProfile?.email && resendApiKey) {
        const studentName = `${student.first_name} ${student.last_name}`;
        const schoolName = school?.name || "your school";
        const fromName = trimmedName || "A parent";

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 40px 0;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#3d2e1f;font-weight:500;">Parent reply about ${studentName}</h1>
          <p style="margin:0 0 24px;font-size:13px;color:#8a7b6b;">${fromName} has replied to your note.</p>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
          <p style="margin:0 0 8px;font-size:12px;color:#8a7b6b;text-transform:uppercase;letter-spacing:0.1em;">Reply</p>
          <p style="margin:0;font-size:15px;color:#3d2e1f;line-height:1.6;white-space:pre-wrap;">${trimmedReply.replace(/</g, "&lt;")}</p>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #f0ebe4;">
          <p style="margin:0;font-size:11px;color:#b0a494;">Sign in to FS Register to view this reply on ${student.first_name}'s profile. Sent from ${schoolName}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "FS Register <onboarding@resend.dev>",
            to: [authorProfile.email],
            subject: `Parent reply about ${studentName}`,
            html: emailHtml,
          }),
        });

        if (emailRes.ok) {
          emailSent = true;
        } else {
          const errData = await emailRes.json().catch(() => null);
          console.error("Resend error notifying teacher:", errData);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
