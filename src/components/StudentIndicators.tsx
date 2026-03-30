import { Star, AlertTriangle, PenLine } from "lucide-react";

interface StudentIndicatorsProps {
  isNew: boolean;
  needsNote: boolean;
  isAtRisk: boolean;
  attendancePercent: number;
}

const StudentIndicators = ({ isNew, needsNote, isAtRisk, attendancePercent }: StudentIndicatorsProps) => {
  return (
    <div className="flex items-center gap-1.5">
      {isNew && (
        <Star className="h-4 w-4 fill-star text-star" aria-label="New student" />
      )}
      {needsNote && (
        <PenLine className="h-4 w-4 text-warning" aria-label="Needs note" />
      )}
      {isAtRisk && (
        <AlertTriangle className="h-4 w-4 text-risk" aria-label="At risk" />
      )}
      <span
        className={`text-xs font-medium tabular-nums ${
          isAtRisk ? "text-risk" : "text-muted-foreground"
        }`}
      >
        {attendancePercent}%
      </span>
    </div>
  );
};

export default StudentIndicators;
