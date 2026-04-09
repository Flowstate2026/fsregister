import type { Tables } from "@/integrations/supabase/types";

type AttendanceRecord = Tables<"attendance_records">;

export type AbsenceType = "absent" | "authorised";

/**
 * Cycle through absence states: present → absent → authorised → present
 */
export function cycleAbsenceType(current: AbsenceType | undefined): AbsenceType | undefined {
  if (!current) {
    return "absent";
  } else if (current === "absent") {
    return "authorised";
  } else {
    return undefined;
  }
}

/**
 * Build attendance records from absence state map
 */
export function buildAttendanceRecords(
  studentIds: string[],
  classId: string,
  registerDate: string,
  absences: Map<string, AbsenceType>
): Omit<AttendanceRecord, "id" | "created_at" | "updated_at">[] {
  return studentIds.map((studentId) => ({
    student_id: studentId,
    class_id: classId,
    date: registerDate,
    present: !absences.has(studentId),
    authorised: absences.get(studentId) === "authorised",
  }));
}

/**
 * Parse existing attendance records into absence state map
 */
export function parseAttendanceToAbsences(
  records: AttendanceRecord[]
): Map<string, AbsenceType> {
  const absences = new Map<string, AbsenceType>();
  records.forEach((record) => {
    if (!record.present) {
      absences.set(record.student_id, record.authorised ? "authorised" : "absent");
    }
  });
  return absences;
}

/**
 * Get unauthorized absence IDs (for webhook notifications)
 */
export function getUnauthorisedAbsenceIds(absences: Map<string, AbsenceType>): string[] {
  return Array.from(absences.entries())
    .filter(([, type]) => type === "absent")
    .map(([id]) => id);
}

/**
 * Check if register is locked (already submitted or being edited)
 */
export function isRegisterLocked(submitted: boolean, alreadySubmitted: boolean, editing: boolean): boolean {
  return (submitted || alreadySubmitted) && !editing;
}

/**
 * Build update payloads for batch attendance updates
 */
export function buildAttendanceUpdates(
  existingRecords: AttendanceRecord[],
  absences: Map<string, AbsenceType>
): Array<{ id: string; updates: { present: boolean; authorised: boolean } }> {
  return existingRecords.map((record) => ({
    id: record.id,
    updates: {
      present: !absences.has(record.student_id),
      authorised: absences.get(record.student_id) === "authorised",
    },
  }));
}

/**
 * Get readable label for absence type
 */
export function getAbsenceLabel(absenceType: AbsenceType | undefined): string {
  switch (absenceType) {
    case "absent":
      return "Absent";
    case "authorised":
      return "Parent Notified";
    default:
      return "Present";
  }
}

/**
 * Get CSS class for absence state styling
 */
export function getAbsenceStyleClass(absenceType: AbsenceType | undefined): string {
  switch (absenceType) {
    case "authorised":
      return "bg-accent/15 text-accent";
    case "absent":
      return "bg-risk/10 text-risk";
    default:
      return "bg-foreground/5 text-foreground";
  }
}

/**
 * Get background color for absence state in list
 */
export function getAbsenceRowBgClass(absenceType: AbsenceType | undefined): string {
  if (!absenceType) return "bg-card";
  return absenceType === "authorised" ? "bg-accent/[0.04]" : "bg-risk/[0.04]";
}
