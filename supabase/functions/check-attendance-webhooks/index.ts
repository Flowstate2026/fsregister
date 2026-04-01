import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the calling user
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

    const { student_ids, school_id } = await req.json();
    if (!student_ids?.length || !school_id) {
      return new Response(JSON.stringify({ ok: true, message: "No students to check" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the absent_twice webhook for this school
    const { data: webhookRows } = await supabaseAdmin
      .from("school_webhooks")
      .select("*")
      .eq("school_id", school_id)
      .eq("event_type", "absent_twice")
      .eq("enabled", true);

    if (!webhookRows?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No webhook configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = webhookRows[0].webhook_url;

    // For each student, check date-based absence logic:
    // A "fully absent date" = a calendar date where the student had attendance records
    // but NONE were present=true.
    // If 2 separate fully-absent dates exist (looking at recent history), fire webhook.
    const triggeredStudents: { id: string; first_name: string; last_name: string; absent_dates: string[] }[] = [];

    for (const studentId of student_ids) {
      // Get student info
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id, first_name, last_name")
        .eq("id", studentId)
        .single();

      if (!student) continue;

      // Get all attendance records for this student, ordered by date desc
      // We look at the last 30 days for efficiency
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

      const { data: records } = await supabaseAdmin
        .from("attendance_records")
        .select("date, present")
        .eq("student_id", studentId)
        .gte("date", cutoff)
        .order("date", { ascending: false });

      if (!records?.length) continue;

      // Group by date
      const byDate: Record<string, boolean[]> = {};
      for (const r of records) {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r.present);
      }

      // Find fully absent dates (dates where student had records but none present)
      const fullyAbsentDates = Object.entries(byDate)
        .filter(([_, presents]) => presents.every((p) => !p))
        .map(([date]) => date)
        .sort()
        .reverse(); // most recent first

      // If 2+ fully absent dates exist consecutively (the two most recent scheduled dates)
      // We check if the two most recent fully-absent dates exist
      if (fullyAbsentDates.length >= 2) {
        // Get all dates the student had any attendance (sorted desc)
        const allDates = Object.keys(byDate).sort().reverse();
        
        // Check if the two most recent attendance dates are both fully absent
        const mostRecentTwoAbsent = allDates.slice(0, 2).every((d) => fullyAbsentDates.includes(d));
        
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

    // Fire webhook for each triggered student
    for (const s of triggeredStudents) {
      try {
        await fetch(webhookUrl, {
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
      } catch (err) {
        console.error(`Failed to fire webhook for student ${s.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, triggered: triggeredStudents.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-attendance-webhooks error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
