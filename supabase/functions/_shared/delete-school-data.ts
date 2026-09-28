import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Delete every row belonging to a school, in FK-safe order.
 * Auth users are intentionally NOT deleted here — callers decide that
 * (owner self-service deletion removes them; admin deletion keeps them).
 */
export async function deleteSchoolData(
  admin: SupabaseClient,
  schoolId: string,
): Promise<void> {
  // Fetch students for this school
  const { data: students } = await admin
    .from("students")
    .select("id")
    .eq("school_id", schoolId);
  const studentIds = (students ?? []).map((s) => s.id);

  // Fetch student_notes for note_tokens / parent_replies cleanup
  let noteIds: string[] = [];
  if (studentIds.length > 0) {
    const { data: notes } = await admin
      .from("student_notes")
      .select("id")
      .in("student_id", studentIds);
    noteIds = (notes ?? []).map((n) => n.id);
  }

  if (noteIds.length > 0) {
    await admin.from("parent_replies").delete().in("note_id", noteIds);
    await admin.from("note_tokens").delete().in("note_id", noteIds);
  }

  if (studentIds.length > 0) {
    await admin.from("attendance_records").delete().in("student_id", studentIds);
    await admin.from("student_notes").delete().in("student_id", studentIds);
    await admin.from("class_enrollments").delete().in("student_id", studentIds);
  }

  await admin.from("activity_log").delete().eq("school_id", schoolId);
  await admin.from("students").delete().eq("school_id", schoolId);
  await admin.from("cancelled_dates").delete().eq("school_id", schoolId);
  await admin.from("classes").delete().eq("school_id", schoolId);
  await admin.from("school_webhooks").delete().eq("school_id", schoolId);
  await admin.from("teacher_invites").delete().eq("school_id", schoolId);
  await admin.from("gdpr_consent_records").delete().eq("school_id", schoolId);

  // Remove user_roles + profiles for this school
  await admin.from("user_roles").delete().eq("school_id", schoolId);
  await admin.from("profiles").delete().eq("school_id", schoolId);

  const { error: schoolErr } = await admin.from("schools").delete().eq("id", schoolId);
  if (schoolErr) throw schoolErr;
}

/** List the auth user IDs belonging to a school (call before deleteSchoolData). */
export async function listSchoolUserIds(
  admin: SupabaseClient,
  schoolId: string,
): Promise<string[]> {
  const { data: schoolProfiles } = await admin
    .from("profiles")
    .select("user_id")
    .eq("school_id", schoolId);
  return (schoolProfiles ?? []).map((p) => p.user_id);
}
