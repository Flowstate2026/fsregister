import { describe, it, expect } from "vitest";
import {
  cycleAbsenceType,
  buildAttendanceRecords,
  parseAttendanceToAbsences,
  getUnauthorisedAbsenceIds,
  isRegisterLocked,
  buildAttendanceUpdates,
  getAbsenceLabel,
  type AbsenceType,
} from "@/lib/attendance-utils";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceRecord = Tables<"attendance_records">;

const record = (
  studentId: string,
  present: boolean,
  authorised = false
): AttendanceRecord =>
  ({
    id: `id-${studentId}`,
    student_id: studentId,
    class_id: "c1",
    date: "2026-01-01",
    present,
    authorised,
    created_at: "2026-01-01T00:00:00Z",
  }) as AttendanceRecord;

describe("cycleAbsenceType", () => {
  it("cycles present → absent → authorised → present", () => {
    expect(cycleAbsenceType(undefined)).toBe("absent");
    expect(cycleAbsenceType("absent")).toBe("authorised");
    expect(cycleAbsenceType("authorised")).toBeUndefined();
  });
});

describe("buildAttendanceRecords", () => {
  it("marks students not in the absence map as present", () => {
    const absences = new Map<string, AbsenceType>([["s2", "absent"]]);
    const records = buildAttendanceRecords(["s1", "s2"], "c1", "2026-01-01", absences);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ student_id: "s1", present: true, authorised: false });
    expect(records[1]).toMatchObject({ student_id: "s2", present: false, authorised: false });
  });

  it("marks authorised absences", () => {
    const absences = new Map<string, AbsenceType>([["s1", "authorised"]]);
    const [r] = buildAttendanceRecords(["s1"], "c1", "2026-01-01", absences);
    expect(r).toMatchObject({ present: false, authorised: true });
  });
});

describe("parseAttendanceToAbsences", () => {
  it("only includes absent records", () => {
    const absences = parseAttendanceToAbsences([
      record("s1", true),
      record("s2", false),
      record("s3", false, true),
    ]);
    expect(absences.get("s1")).toBeUndefined();
    expect(absences.get("s2")).toBe("absent");
    expect(absences.get("s3")).toBe("authorised");
  });
});

describe("getUnauthorisedAbsenceIds", () => {
  it("returns only plain absences", () => {
    const absences = new Map<string, AbsenceType>([
      ["s1", "absent"],
      ["s2", "authorised"],
    ]);
    expect(getUnauthorisedAbsenceIds(absences)).toEqual(["s1"]);
  });
});

describe("isRegisterLocked", () => {
  it("locks when submitted and not editing", () => {
    expect(isRegisterLocked(true, false, false)).toBe(true);
    expect(isRegisterLocked(false, true, false)).toBe(true);
    expect(isRegisterLocked(true, true, true)).toBe(false);
    expect(isRegisterLocked(false, false, false)).toBe(false);
  });
});

describe("buildAttendanceUpdates", () => {
  it("builds update payloads per record", () => {
    const absences = new Map<string, AbsenceType>([["s2", "authorised"]]);
    const updates = buildAttendanceUpdates(
      [record("s1", false), record("s2", true)],
      absences
    );
    expect(updates).toEqual([
      { id: "id-s1", updates: { present: true, authorised: false } },
      { id: "id-s2", updates: { present: false, authorised: true } },
    ]);
  });
});

describe("getAbsenceLabel", () => {
  it("labels each state", () => {
    expect(getAbsenceLabel(undefined)).toBe("Present");
    expect(getAbsenceLabel("absent")).toBe("Absent");
    expect(getAbsenceLabel("authorised")).toBe("Parent Notified");
  });
});
