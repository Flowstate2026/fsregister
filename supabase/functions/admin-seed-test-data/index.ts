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

    // ---- Also seed a dedicated "Test Student" with <70% attendance ----
    // Find or create the Test Student in this school
    let testStudentId: string;
    const { data: existingTest } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", school_id)
      .eq("first_name", "Test")
      .eq("last_name", "Student")
      .limit(1);

    if (existingTest?.length) {
      testStudentId = existingTest[0].id;
      // Ensure not archived
      await supabaseAdmin
        .from("students")
        .update({ archived: false })
        .eq("id", testStudentId);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin
        .from("students")
        .insert({
          school_id,
          first_name: "Test",
          last_name: "Student",
          archived: false,
        })
        .select("id")
        .single();
      if (createErr) throw createErr;
      testStudentId = created.id;
    }

    // Ensure Test Student is enrolled in the class
    const { data: testEnrollment } = await supabaseAdmin
      .from("class_enrollments")
      .select("id")
      .eq("student_id", testStudentId)
      .eq("class_id", classId)
      .limit(1);

    if (!testEnrollment?.length) {
      const { error: enrollErr } = await supabaseAdmin
        .from("class_enrollments")
        .insert({ student_id: testStudentId, class_id: classId });
      if (enrollErr) throw enrollErr;
    }

    // Build 10 separate dates within the last 8 weeks (every ~5 days)
    const testDates: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (i * 5 + 2)); // 2, 7, 12, ... 47 days ago — all within 8 weeks (56 days)
      testDates.push(d.toISOString().split("T")[0]);
    }

    // Clear any existing records on those dates
    await supabaseAdmin
      .from("attendance_records")
      .delete()
      .eq("student_id", testStudentId)
      .in("date", testDates);

    // 7 absent, 3 present => 30% attendance
    const testRecords = testDates.map((date, i) => ({
      student_id: testStudentId,
      class_id: classId,
      date,
      present: i >= 7,
      authorised: false,
    }));

    const { error: testInsertErr } = await supabaseAdmin
      .from("attendance_records")
      .insert(testRecords);
    if (testInsertErr) throw testInsertErr;

    return new Response(
      JSON.stringify({
        ok: true,
        student: `${student.first_name} ${student.last_name}`,
        student_id: student.id,
        absence_dates: [date1Str, date2Str],
        total_records_seeded: 2 + additionalDates.length,
        test_student: {
          id: testStudentId,
          name: "Test Student",
          records_seeded: testRecords.length,
          present_count: 3,
          absent_count: 7,
          attendance_pct: 30,
          dates: testDates,
        },
        message: `Seeded ${student.first_name} ${student.last_name} with 2 unauthorised absences and seeded Test Student with 10 attendance records (7 absent / 3 present) over the last 8 weeks.`,
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
