import { Star, AlertTriangle, PenLine } from "lucide-react";
import { isNewStudent, needsNote as checkNeedsNote, isAtRisk as checkIsAtRisk } from "@/lib/student-utils";
import type { StudentWithDetails } from "@/hooks/useStudentWithDetails";

interface StudentIndicatorsProps {
  student: StudentWithDetails;
  attendancePercent: number;
}

const StudentIndicators = ({ student, attendancePercent }: StudentIndicatorsProps) => {
  const isNew = isNewStudent(student.join_date) && !(student as any).bulk_imported;
  const noteNeeded = checkNeedsNote(student.notes);
  const atRisk = checkIsAtRisk(attendancePercent);

  return (
    <div className="flex items-center gap-2">
      {isNew && (
        <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-label="New student" />
      )}
      {noteNeeded && (
        <PenLine className="h-3.5 w-3.5 text-gold" aria-label="Needs note" />
      )}
      {atRisk && (
        <AlertTriangle className="h-3.5 w-3.5 text-risk" aria-label="Low attendance" />
      )}
      <span
        className={`text-[11px] font-light tabular-nums tracking-wide ${
          atRisk ? "text-risk" : "text-muted-foreground"
        }`}
      >
        {attendancePercent}%
      </span>
    </div>
  );
};

export default StudentIndicators;
