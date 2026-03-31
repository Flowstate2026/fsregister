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
    const { admin_password, school_name, admin_email, admin_user_password } =
      await req.json();

    // Validate admin password
    const expectedPassword = Deno.env.get("ADMIN_SETUP_PASSWORD");
    if (!expectedPassword || admin_password !== expectedPassword) {
      return new Response(
        JSON.stringify({ error: "Invalid admin password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (!school_name || !admin_email || !admin_user_password) {
      return new Response(
        JSON.stringify({ error: "school_name, admin_email, and admin_user_password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (admin_user_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create slug from school name
    const slug = school_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create school
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({ name: school_name, slug })
      .select()
      .single();

    if (schoolError) {
      return new Response(
        JSON.stringify({ error: `Failed to create school: ${schoolError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user with school_id in metadata (trigger creates profile + role)
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: admin_email,
        password: admin_user_password,
        email_confirm: true,
        user_metadata: {
          full_name: admin_email,
          school_id: school.id,
          role: "owner",
        },
      });

    if (authError) {
      // Cleanup: delete the school we just created
      await supabaseAdmin.from("schools").delete().eq("id", school.id);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        school: { id: school.id, name: school.name, slug: school.slug },
        user: { id: authData.user.id, email: authData.user.email },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
