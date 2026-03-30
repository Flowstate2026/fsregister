import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import {
  isNewStudent,
  needsNote as checkNeedsNote,
  calculateAttendancePercentage,
  isAtRisk,
} from "@/lib/student-utils";
import { Star, AlertTriangle, PenLine } from "lucide-react";

const RetentionDashboard = () => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["retention-dashboard"],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("students")
        .select("*, class_enrollments(*, classes(name))")
        .eq("archived", false);
      if (error) throw error;

      const studentIds = students?.map((s) => s.id) || [];
      if (!studentIds.length) return { newFamilies: [], atRisk: [], needsAttention: [] };

      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", studentIds);

      const { data: notes } = await supabase
        .from("student_notes")
        .select("*")
        .in("student_id", studentIds);

      const enriched = students?.map((s) => {
        const sAttendance = attendance?.filter((a) => a.student_id === s.id) || [];
        const sNotes = notes?.filter((n) => n.student_id === s.id) || [];
        const percent = calculateAttendancePercentage(sAttendance);
        const className = (s.class_enrollments as any)?.[0]?.classes?.name || "—";

        return {
          ...s,
          percent,
          isNew: isNewStudent(s.join_date),
          needsNote: checkNeedsNote(sNotes),
          atRisk: isAtRisk(percent),
          className,
        };
      }) || [];

      return {
        newFamilies: enriched.filter((s) => s.isNew),
        atRisk: enriched.filter((s) => s.atRisk),
        needsAttention: enriched.filter((s) => s.needsNote),
      };
    },
  });

  const sections = [
    {
      title: "New Families",
      icon: Star,
      iconClass: "text-star",
      items: data?.newFamilies || [],
      metric: (s: any) => `Joined ${s.join_date}`,
    },
    {
      title: "At Risk",
      icon: AlertTriangle,
      iconClass: "text-risk",
      items: data?.atRisk || [],
      metric: (s: any) => `${s.percent}% attendance`,
    },
    {
      title: "Needs Attention",
      icon: PenLine,
      iconClass: "text-accent",
      items: data?.needsAttention || [],
      metric: () => "No note in 90+ days",
    },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-10">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Retention Dashboard
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground tracking-wide">Overview across all classes</p>
        </div>

        {isLoading ? (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="space-y-12">
            {sections.map((section) => (
              <section key={section.title}>
                <div className="mb-4 flex items-center gap-2.5">
                  <section.icon className={`h-4 w-4 ${section.iconClass}`} />
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {section.items.length}
                  </span>
                </div>

                {section.items.length === 0 ? (
                  <p className="rounded-2xl border border-border/60 bg-card px-5 py-5 text-xs text-muted-foreground shadow-[var(--shadow-card)]">
                    No students in this category
                  </p>
                ) : (
                  <div className="space-y-2">
                    {section.items.map((student: any) => (
                      <button
                        key={student.id}
                        onClick={() => navigate(`/student/${student.id}`)}
                        className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card px-5 py-4 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]"
                      >
                        <div>
                          <span className="text-sm font-medium text-foreground">
                            {student.first_name} {student.last_name}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {student.className}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {section.metric(student)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RetentionDashboard;
