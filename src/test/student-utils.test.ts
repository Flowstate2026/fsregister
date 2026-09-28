import { describe, it, expect } from "vitest";
import { subWeeks, subDays, format } from "date-fns";
import {
  isNewStudent,
  needsNote,
  calculateAttendancePercentage,
  isAtRisk,
  getDayName,
  formatTime,
} from "@/lib/student-utils";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceRecord = Tables<"attendance_records">;
type StudentNote = Tables<"student_notes">;

const iso = (d: Date) => format(d, "yyyy-MM-dd");

const record = (date: Date, present: boolean): AttendanceRecord =>
  ({
    id: crypto.randomUUID(),
    student_id: "s1",
    class_id: "c1",
    date: iso(date),
    present,
    authorised: false,
    created_at: date.toISOString(),
  }) as AttendanceRecord;

describe("isNewStudent", () => {
  it("is true for a join date under 6 weeks ago", () => {
    expect(isNewStudent(iso(subWeeks(new Date(), 2)))).toBe(true);
  });

  it("is false for a join date over 6 weeks ago", () => {
    expect(isNewStudent(iso(subWeeks(new Date(), 8)))).toBe(false);
  });
});

describe("needsNote", () => {
  it("is true when there are no notes", () => {
    expect(needsNote([])).toBe(true);
  });

  it("is true when the latest note is over 90 days old", () => {
    const note = { created_at: subDays(new Date(), 100).toISOString() } as StudentNote;
    expect(needsNote([note])).toBe(true);
  });

  it("is false when a recent note exists", () => {
    const old = { created_at: subDays(new Date(), 200).toISOString() } as StudentNote;
    const recent = { created_at: subDays(new Date(), 10).toISOString() } as StudentNote;
    expect(needsNote([old, recent])).toBe(false);
  });
});

describe("calculateAttendancePercentage", () => {
  it("returns 100 when there are fewer than 2 recent records", () => {
    expect(calculateAttendancePercentage([])).toBe(100);
    expect(calculateAttendancePercentage([record(subDays(new Date(), 3), false)])).toBe(100);
  });

  it("computes the percentage over the last 8 weeks", () => {
    const records = [
      record(subDays(new Date(), 7), true),
      record(subDays(new Date(), 14), true),
      record(subDays(new Date(), 21), false),
      record(subDays(new Date(), 28), false),
    ];
    expect(calculateAttendancePercentage(records)).toBe(50);
  });

  it("ignores records older than 8 weeks", () => {
    const records = [
      record(subDays(new Date(), 7), true),
      record(subDays(new Date(), 14), true),
      record(subWeeks(new Date(), 12), false),
    ];
    expect(calculateAttendancePercentage(records)).toBe(100);
  });

  it("excludes records inside cancelled date ranges", () => {
    const records = [
      record(subDays(new Date(), 7), false),
      record(subDays(new Date(), 14), false),
      record(subDays(new Date(), 21), true),
    ];
    const cancelled = [
      {
        start_date: iso(subDays(new Date(), 16)),
        end_date: iso(subDays(new Date(), 5)),
        class_id: null,
      },
    ];
    // The two absences fall inside the cancelled range, leaving 1 present record
    expect(calculateAttendancePercentage(records, cancelled)).toBe(100);
  });

  it("only applies class-specific cancellations to matching classes", () => {
    const records = [
      record(subDays(new Date(), 7), false),
      record(subDays(new Date(), 14), true),
    ];
    const cancelled = [
      {
        start_date: iso(subDays(new Date(), 30)),
        end_date: iso(new Date()),
        class_id: "other-class",
      },
    ];
    expect(calculateAttendancePercentage(records, cancelled)).toBe(50);
  });
});

describe("isAtRisk", () => {
  it("flags percentages below 70", () => {
    expect(isAtRisk(69)).toBe(true);
    expect(isAtRisk(70)).toBe(false);
    expect(isAtRisk(100)).toBe(false);
  });
});

describe("getDayName", () => {
  it("maps 0-6 to day names", () => {
    expect(getDayName(0)).toBe("Sunday");
    expect(getDayName(6)).toBe("Saturday");
    expect(getDayName(9)).toBe("");
  });
});

describe("formatTime", () => {
  it("formats 24h time as 12h", () => {
    expect(formatTime("10:00")).toBe("10:00 AM");
    expect(formatTime("13:30")).toBe("1:30 PM");
    expect(formatTime("00:15")).toBe("12:15 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });
});
