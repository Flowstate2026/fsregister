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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { note_id } = await req.json();
    if (!note_id) {
      return new Response(JSON.stringify({ error: "note_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch note with student, school, and author details
    const { data: note, error: noteError } = await admin
      .from("student_notes")
      .select("*")
      .eq("id", note_id)
      .single();

    if (noteError || !note) {
      return new Response(JSON.stringify({ error: "Note not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: student } = await admin
      .from("students")
      .select("*")
      .eq("id", note.student_id)
      .single();

    if (!student || !student.parent_email) {
      return new Response(
        JSON.stringify({ error: "No parent email on file", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: school } = await admin
      .from("schools")
      .select("name, logo_url, email")
      .eq("id", student.school_id)
      .single();

    const { data: authorProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", note.author_id)
      .single();

    // Get the student's class name (first enrolled class)
    const { data: enrollment } = await admin
      .from("class_enrollments")
      .select("classes(name)")
      .eq("student_id", student.id)
      .limit(1)
      .single();

    const className = (enrollment?.classes as any)?.name || "their class";
    const teacherName = authorProfile?.full_name || "Their teacher";
    const schoolName = school?.name || "School";

    // Create a token for parent access
    const { data: tokenRow, error: tokenError } = await admin
      .from("note_tokens")
      .insert({ note_id })
      .select("token")
      .single();

    if (tokenError) {
      return new Response(JSON.stringify({ error: "Failed to create token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the parent note URL
    const appUrl = "https://fsregister.lovable.app";
    const parentUrl = `${appUrl}/parent-note?token=${tokenRow.token}`;

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: true, token: tokenRow.token, email_sent: false, reason: "No Resend API key configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const noteDate = new Date(note.created_at).toLocaleDateString("en-GB", {
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
          <h1 style="margin:0 0 8px;font-size:20px;color:#3d2e1f;font-weight:500;">A note about ${student.first_name}</h1>
          <p style="margin:0 0 24px;font-size:13px;color:#8a7b6b;">${className} · ${noteDate}</p>
        </td></tr>
        <tr><td style="padding:0 40px;">
          <p style="margin:0 0 8px;font-size:12px;color:#8a7b6b;text-transform:uppercase;letter-spacing:0.1em;">From ${teacherName}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#3d2e1f;line-height:1.6;">${note.note_text}</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <a href="${parentUrl}" style="display:inline-block;padding:12px 28px;background:#C4704B;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">View Note & Reply</a>
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #f0ebe4;">
          <p style="margin:0;font-size:11px;color:#b0a494;">This link expires in 30 days. Sent from ${schoolName}.</p>
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
        to: [student.parent_email],
        subject: `A note about ${student.first_name} from ${schoolName}`,
        html: emailHtml,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend error:", emailData);
      return new Response(
        JSON.stringify({ success: true, token: tokenRow.token, email_sent: false, error: emailData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, token: tokenRow.token, email_sent: true, parent_url: parentUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
