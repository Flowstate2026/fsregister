import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { admin_password, school_id } = await req.json();

    if (admin_password !== Deno.env.get("ADMIN_SETUP_PASSWORD")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get first non-archived student in the school
    const { data: students, error: studentsErr } = await supabaseAdmin
      .from("students")
      .select("id, first_name, last_name")
      .eq("school_id", school_id)
      .eq("archived", false)
      .order("created_at")
      .limit(1);

    if (studentsErr) throw studentsErr;
    if (!students?.length) {
      return new Response(JSON.stringify({ error: "No students found in this school" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const student = students[0];

    // Get a class the student is enrolled in
    const { data: enrollments } = await supabaseAdmin
      .from("class_enrollments")
      .select("class_id")
      .eq("student_id", student.id)
      .limit(1);

    if (!enrollments?.length) {
      return new Response(JSON.stringify({ error: "Student is not enrolled in any class" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classId = enrollments[0].class_id;

    // Create two absence dates (7 days ago and 14 days ago)
    const date1 = new Date();
    date1.setDate(date1.getDate() - 7);
    const date1Str = date1.toISOString().split("T")[0];

    const date2 = new Date();
    date2.setDate(date2.getDate() - 14);
    const date2Str = date2.toISOString().split("T")[0];

    // Delete any existing records for these dates first
    await supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("student_id", student.id)
      .in("date", [date1Str, date2Str]);

    // Insert unauthorised absences on both dates
    const absenceRecords = [
      { student_id: student.id, class_id: classId, date: date1Str, present: false, authorised: false },
      { student_id: student.id, class_id: classId, date: date2Str, present: false, authorised: false },
    ];

    const { error: insertErr } = await supabaseAdmin
      .from("attendance_records")
      .insert(absenceRecords);

    if (insertErr) throw insertErr;

    // Now ensure attendance is below 70% by adding more absence records
    // We need at least 10 records with 7+ absences to get below 70%
    const additionalDates: string[] = [];
    for (let i = 3; i <= 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      additionalDates.push(d.toISOString().split("T")[0]);
    }

    // Delete existing for these dates
    await supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("student_id", student.id)
      .in("date", additionalDates);

    // Insert: first 5 as absences, last 3 as present (gives ~7 absent out of 10 = 30% attendance)
    const moreRecords = additionalDates.map((date, i) => ({
      student_id: student.id,
      class_id: classId,
      date,
      present: i >= 5,
      authorised: false,
    }));

    const { error: moreErr } = await supabaseAdmin
      .from("attendance_records")
      .insert(moreRecords);

    if (moreErr) throw moreErr;

    return new Response(
      JSON.stringify({
        ok: true,
        student: `${student.first_name} ${student.last_name}`,
        student_id: student.id,
        absence_dates: [date1Str, date2Str],
        total_records_seeded: 2 + additionalDates.length,
        message: `Seeded ${student.first_name} ${student.last_name} with 2 unauthorised absences (${date1Str}, ${date2Str}) and additional records to bring attendance below 70%.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
