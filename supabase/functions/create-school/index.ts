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
    const body = await req.json();
    const { admin_password, school_name, admin_email, admin_user_password } = body;

    console.log("create-school invoked", {
      has_password: !!admin_password,
      school_name,
      admin_email,
      has_user_password: !!admin_user_password,
    });

    // Validate admin password
    const expectedPassword = Deno.env.get("ADMIN_SETUP_PASSWORD");
    if (!expectedPassword) {
      console.error("ADMIN_SETUP_PASSWORD secret is not set");
      return new Response(
        JSON.stringify({ error: "Server misconfigured: ADMIN_SETUP_PASSWORD not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (admin_password !== expectedPassword) {
      return new Response(
        JSON.stringify({ error: "Invalid admin password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Build a unique slug (handle collisions)
    const baseSlug = school_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "school";

    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const { data: existing, error: slugErr } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (slugErr) {
        console.error("Slug lookup failed", slugErr);
        return new Response(
          JSON.stringify({ error: `Slug check failed: ${slugErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!existing) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Create school
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({ name: school_name, slug })
      .select()
      .single();

    if (schoolError || !school) {
      console.error("Failed to create school", schoolError);
      return new Response(
        JSON.stringify({ error: `Failed to create school: ${schoolError?.message ?? "unknown error"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: admin_email,
        password: admin_user_password,
        email_confirm: true,
        user_metadata: {
          full_name: admin_email,
          school_id: school.id,
          role: "owner",
          password_set: true,
        },
      });

    if (authError || !authData?.user) {
      console.error("Failed to create user", authError);
      // Cleanup the school we just created
      await supabaseAdmin.from("schools").delete().eq("id", school.id);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${authError?.message ?? "unknown error"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // Ensure profile exists (the handle_new_user trigger may not be attached).
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          full_name: admin_email,
          email: admin_email,
          school_id: school.id,
        },
        { onConflict: "user_id" }
      );
    if (profileError) {
      console.error("Failed to upsert profile", profileError);
    }

    // Ensure owner role exists.
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "owner", school_id: school.id });
      if (roleError) {
        console.error("Failed to insert owner role", roleError);
      }
    }

    console.log("create-school success", { school_id: school.id, user_id: userId });

    return new Response(
      JSON.stringify({
        success: true,
        school: { id: school.id, name: school.name, slug: school.slug },
        user: { id: userId, email: authData.user.email },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-school unhandled error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
