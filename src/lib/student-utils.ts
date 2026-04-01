import { differenceInWeeks, differenceInDays, subWeeks, format, parseISO } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Student = Tables<"students">;
type AttendanceRecord = Tables<"attendance_records">;
type StudentNote = Tables<"student_notes">;

export function isNewStudent(joinDate: string): boolean {
  const weeks = differenceInWeeks(new Date(), parseISO(joinDate));
  return weeks < 6;
}

export function needsNote(notes: StudentNote[]): boolean {
  if (notes.length === 0) return true;
  const latest = notes.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  );
  const daysSince = differenceInDays(new Date(), new Date(latest.created_at));
  return daysSince > 90;
}

export function calculateAttendancePercentage(
  records: AttendanceRecord[],
  cancelledDates?: { start_date: string; end_date: string; class_id: string | null }[]
): number {
  const eightWeeksAgo = subWeeks(new Date(), 8);
  let recent = records.filter((r) => new Date(r.date) >= eightWeeksAgo);

  if (cancelledDates?.length) {
    recent = recent.filter((r) => {
      return !cancelledDates.some((cd) => {
        const matchesClass = cd.class_id === null || cd.class_id === r.class_id;
        return matchesClass && r.date >= cd.start_date && r.date <= cd.end_date;
      });
    });
  }

  if (recent.length < 2) return 100;
  const present = recent.filter((r) => r.present).length;
  return Math.round((present / recent.length) * 100);
}

export function isAtRisk(percentage: number): boolean {
  return percentage < 70;
}

export function getDayName(day: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[day] || "";
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function getTodayDayOfWeek(): number {
  return new Date().getDay();
}
