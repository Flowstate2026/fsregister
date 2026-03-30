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
        <Star className="h-3.5 w-3.5 fill-star text-star" aria-label="New student" />
      )}
      {needsNote && (
        <PenLine className="h-3.5 w-3.5 text-accent" aria-label="Needs note" />
      )}
      {isAtRisk && (
        <AlertTriangle className="h-3.5 w-3.5 text-risk" aria-label="At risk" />
      )}
      <span
        className={`text-[11px] font-normal tabular-nums ${
          isAtRisk ? "text-risk" : "text-muted-foreground"
        }`}
      >
        {attendancePercent}%
      </span>
    </div>
  );
};

export default StudentIndicators;
