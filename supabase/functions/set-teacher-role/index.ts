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
    } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Only owners can change roles" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { profile_id, role } = await req.json();
    if (!profile_id || (role !== "owner" && role !== "teacher")) {
      return new Response(JSON.stringify({ error: "profile_id and valid role required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("user_id, school_id")
      .eq("id", profile_id)
      .maybeSingle();
    if (!targetProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("school_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile || callerProfile.school_id !== targetProfile.school_id) {
      return new Response(JSON.stringify({ error: "User not in your school" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile.user_id === caller.id) {
      return new Response(JSON.stringify({ error: "You cannot change your own role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolId = targetProfile.school_id;
    const otherRole = role === "owner" ? "teacher" : "owner";

    // Add desired role
    await admin
      .from("user_roles")
      .upsert(
        { user_id: targetProfile.user_id, role, school_id: schoolId },
        { onConflict: "user_id,role,school_id", ignoreDuplicates: true }
      );

    // Remove the other role for this school
    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", targetProfile.user_id)
      .eq("school_id", schoolId)
      .eq("role", otherRole);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
