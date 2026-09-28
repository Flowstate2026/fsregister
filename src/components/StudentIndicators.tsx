import { PenLine } from "lucide-react";
import { isNewStudent, needsNote as checkNeedsNote } from "@/lib/student-utils";
import type { StudentWithDetails } from "@/hooks/useStudentWithDetails";

interface StudentIndicatorsProps {
  student: StudentWithDetails;
  attendancePercent: number;
}

const badgeBase =
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider leading-none";

const attendanceBadge = (percent: number) => {
  if (percent >= 70) {
    return { label: "GREEN", className: "bg-green-600 text-white" };
  }
  if (percent >= 50) {
    return { label: "AMBER", className: "bg-amber-500 text-white" };
  }
  return { label: "RED", className: "bg-red-600 text-white" };
};

const StudentIndicators = ({ student, attendancePercent }: StudentIndicatorsProps) => {
  const isNew = isNewStudent(student.join_date) && !(student as any).bulk_imported;
  const noteNeeded = checkNeedsNote(student.notes);
  const attendance = attendanceBadge(attendancePercent);

  return (
    <div className="flex items-center gap-1.5">
      {isNew && (
        <span className={`${badgeBase} bg-gold text-white`} aria-label="New student">
          NURTURE
        </span>
      )}
      <span
        className={`${badgeBase} ${attendance.className}`}
        aria-label={`Attendance ${attendancePercent}%`}
      >
        {attendance.label}
      </span>
      {noteNeeded && (
        <PenLine className="h-3.5 w-3.5 text-gold" aria-label="Needs note" />
      )}
    </div>
  );
};

export default StudentIndicators;
