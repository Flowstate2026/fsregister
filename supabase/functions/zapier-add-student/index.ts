import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      secret,
      school_id,
      first_name,
      last_name,
      date_of_birth,
      parent_name,
      parent_email,
      parent_phone,
      class_name,
      medical_notes,
    } = body ?? {};

    const expectedSecret = Deno.env.get("ZAPIER_WEBHOOK_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!school_id || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: school_id, first_name, last_name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify school exists
    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("id")
      .eq("id", school_id)
      .maybeSingle();

    if (schoolErr) throw schoolErr;
    if (!school) {
      return new Response(JSON.stringify({ error: "School not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert student
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .insert({
        school_id,
        first_name: String(first_name).trim(),
        last_name: String(last_name).trim(),
        date_of_birth: date_of_birth || null,
        parent_name: parent_name || null,
        parent_email: parent_email || null,
        parent_phone: parent_phone || null,
        medical_notes: medical_notes || null,
      })
      .select("id")
      .single();

    if (studentErr) throw studentErr;

    let enrolled_class_id: string | null = null;

    // Optional class enrollment
    if (class_name && String(class_name).trim()) {
      const { data: matchedClass, error: classErr } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", school_id)
        .ilike("name", String(class_name).trim())
        .maybeSingle();

      if (classErr) {
        console.error("Class lookup error:", classErr);
      } else if (matchedClass) {
        const { error: enrollErr } = await supabase
          .from("class_enrollments")
          .insert({ student_id: student.id, class_id: matchedClass.id });
        if (enrollErr) {
          console.error("Enrollment error:", enrollErr);
        } else {
          enrolled_class_id = matchedClass.id;
        }
      } else {
        console.warn(`No class found matching "${class_name}" for school ${school_id}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, student_id: student.id, enrolled_class_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("zapier-add-student error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
