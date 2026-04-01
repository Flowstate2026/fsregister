import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { school_id, admin_password } = body;
    let { student_ids } = body;

    // Auth: either via JWT or admin password
    const isAdminCall = admin_password === Deno.env.get("ADMIN_SETUP_PASSWORD");
    if (!isAdminCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!school_id) {
      return new Response(JSON.stringify({ ok: true, message: "No school_id provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If no student_ids provided, fetch all non-archived students for the school
    if (!student_ids?.length) {
      const { data: allStudents } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("school_id", school_id)
        .eq("archived", false);
      student_ids = allStudents?.map((s: any) => s.id) || [];
      if (!student_ids.length) {
        return new Response(JSON.stringify({ ok: true, message: "No students in school", triggered: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch cancelled dates for this school
    const { data: cancelledDates } = await supabaseAdmin
      .from("cancelled_dates")
      .select("class_id, start_date, end_date")
      .eq("school_id", school_id);

    const { data: webhookRows } = await supabaseAdmin
      .from("school_webhooks")
      .select("*")
      .eq("school_id", school_id)
      .eq("event_type", "absent_twice")
      .eq("enabled", true);

    if (!webhookRows?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No webhook configured for absent_twice", triggered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = webhookRows[0].webhook_url;
    console.log(`Checking ${student_ids.length} students for school ${school_id}, webhook: ${webhookUrl}`);

    const triggeredStudents: { id: string; first_name: string; last_name: string; absent_dates: string[] }[] = [];

    for (const studentId of student_ids) {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id, first_name, last_name")
        .eq("id", studentId)
        .single();

      if (!student) continue;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

      const { data: records } = await supabaseAdmin
        .from("attendance_records")
        .select("date, present, authorised, class_id")
        .eq("student_id", studentId)
        .gte("date", cutoff)
        .order("date", { ascending: false });

      if (!records?.length) {
        console.log(`Student ${student.first_name} ${student.last_name}: no records in last 30 days`);
        continue;
      }

      // Filter out cancelled dates
      const filteredRecords = records.filter((r) => {
        if (!cancelledDates?.length) return true;
        return !cancelledDates.some((cd) => {
          const matchesClass = cd.class_id === null || cd.class_id === r.class_id;
          return matchesClass && r.date >= cd.start_date && r.date <= cd.end_date;
        });
      });

      if (!filteredRecords.length) continue;

      // Group by date — only count UNAUTHORISED absences
      const byDate: Record<string, { hasPresent: boolean; hasUnauthorisedAbsence: boolean }> = {};
      for (const r of filteredRecords) {
        if (!byDate[r.date]) byDate[r.date] = { hasPresent: false, hasUnauthorisedAbsence: false };
        if (r.present) {
          byDate[r.date].hasPresent = true;
        } else if (!r.authorised) {
          byDate[r.date].hasUnauthorisedAbsence = true;
        }
      }

      // A "fully unauthorised absent date" = no present marks AND at least one unauthorised absence
      const fullyAbsentDates = Object.entries(byDate)
        .filter(([_, info]) => !info.hasPresent && info.hasUnauthorisedAbsence)
        .map(([date]) => date)
        .sort()
        .reverse();

      console.log(`Student ${student.first_name} ${student.last_name}: ${Object.keys(byDate).length} dates, ${fullyAbsentDates.length} fully absent dates: ${fullyAbsentDates.join(", ")}`);

      if (fullyAbsentDates.length >= 2) {
        // Check if the two most recent dates overall are both fully absent
        const allDates = Object.keys(byDate).sort().reverse();
        const mostRecentTwoAbsent = allDates.slice(0, 2).every((d) => fullyAbsentDates.includes(d));

        console.log(`  Most recent 2 dates: ${allDates.slice(0, 2).join(", ")} — both absent: ${mostRecentTwoAbsent}`);

        if (mostRecentTwoAbsent) {
          triggeredStudents.push({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            absent_dates: fullyAbsentDates.slice(0, 2),
          });
        }
      }
    }

    console.log(`Triggering webhook for ${triggeredStudents.length} students`);

    for (const s of triggeredStudents) {
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "absent_twice",
            student_id: s.id,
            student_name: `${s.first_name} ${s.last_name}`,
            absent_dates: s.absent_dates,
            school_id,
            timestamp: new Date().toISOString(),
          }),
        });
        console.log(`Webhook fired for ${s.first_name} ${s.last_name}: ${resp.status}`);
      } catch (err) {
        console.error(`Failed to fire webhook for student ${s.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        triggered: triggeredStudents.length,
        students: triggeredStudents.map((s) => ({
          name: `${s.first_name} ${s.last_name}`,
          absent_dates: s.absent_dates,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-attendance-webhooks error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
