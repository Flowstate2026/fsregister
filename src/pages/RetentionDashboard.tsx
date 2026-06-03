import { useNavigate } from "react-router-dom";
import { useAllStudentsWithDetails } from "@/hooks/useStudentWithDetails";
import { useRecentNotes } from "@/hooks/useRecentNotes";
import AppLayout from "@/components/AppLayout";
import {
  isNewStudent,
  needsNote as checkNeedsNote,
  calculateAttendancePercentage,
  isAtRisk,
} from "@/lib/student-utils";
import { Star, AlertTriangle, PenLine, StickyNote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";


const RetentionDashboard = () => {
  const navigate = useNavigate();
  const { data: students = [], isLoading } = useAllStudentsWithDetails();
  const { data: recentNotes = [], isLoading: notesLoading } = useRecentNotes(10);

  // Enrich student data with computed metrics
  const enrichedStudents = students.map((s) => {
    const percent = calculateAttendancePercentage(s.attendance);
    const classEnrollments = s.class_enrollments as any;
    const className = classEnrollments?.[0]?.classes?.name || "—";

    return {
      ...s,
      percent,
      isNew: isNewStudent(s.join_date) && !(s as any).bulk_imported,
      needsNote: checkNeedsNote(s.notes),
      atRisk: isAtRisk(percent),
      className,
    };
  });

  // Organize into sections
  const newFamilies = enrichedStudents.filter((s) => s.isNew);
  const atRiskStudents = enrichedStudents.filter((s) => s.atRisk);
  const needsAttention = enrichedStudents.filter((s) => s.needsNote);

  const sections = [
    {
      title: "New Families",
      icon: Star,
      iconClass: "text-gold",
      items: newFamilies,
      metric: (s: any) => `Joined ${s.join_date}`,
    },
    {
      title: "Low Attendance",
      icon: AlertTriangle,
      iconClass: "text-risk",
      items: atRiskStudents,
      metric: (s: any) => `${s.percent}% attendance`,
    },
    {
      title: "Note Needed",
      icon: PenLine,
      iconClass: "text-gold",
      items: needsAttention,
      metric: () => "No note in 90+ days",
    },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12">
          <h2 className="font-display text-3xl text-foreground">Retention Dashboard</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Overview across all classes</p>
        </div>

        {isLoading ? (
          <div className="space-y-8">{[1, 2, 3].map((i) => (<div key={i} className="h-32 animate-pulse bg-muted/40" />))}</div>
        ) : (
          <div className="space-y-14">
            {sections.map((section) => (
              <section key={section.title}>
                <div className="mb-5 flex items-center gap-3">
                  <section.icon className={`h-4 w-4 ${section.iconClass}`} />
                  <h3 className="font-display text-lg text-foreground">{section.title}</h3>
                  <span className="bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-light uppercase tracking-[0.15em]">{section.items.length}</span>
                </div>

                {section.items.length === 0 ? (
                  <p className="bg-card px-6 py-6 text-[11px] font-light text-muted-foreground shadow-[var(--shadow-card)]">No students in this category</p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {section.items.map((student: any) => (
                      <button key={student.id} onClick={() => navigate(`/student/${student.id}`)}
                        className="flex w-full items-center justify-between bg-card px-6 py-5 text-left transition-all hover:bg-secondary/30 active:scale-[0.995]">
                        <div>
                          <span className="text-sm font-light text-foreground">{student.first_name} {student.last_name}</span>
                          <span className="ml-3 text-[11px] text-muted-foreground">{student.className}</span>
                        </div>
                        <span className="text-[10px] tracking-wide text-muted-foreground">{section.metric(student)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}

            {/* Recent Notes */}
            <section>
              <div className="mb-5 flex items-center gap-3">
                <StickyNote className="h-4 w-4 text-gold" />
                <h3 className="font-display text-lg text-foreground">Recent Notes</h3>
                <span className="bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-light uppercase tracking-[0.15em]">{recentNotes.length}</span>
              </div>

              {notesLoading ? (
                <div className="h-32 animate-pulse bg-muted/40" />
              ) : recentNotes.length === 0 ? (
                <p className="bg-card px-6 py-6 text-[11px] font-light text-muted-foreground shadow-[var(--shadow-card)]">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {recentNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => navigate(`/student/${note.studentId}`)}
                      className="w-full bg-card px-6 py-5 text-left shadow-[var(--shadow-card)] transition-all hover:bg-secondary/30 active:scale-[0.995]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-light text-foreground truncate">{note.noteText}</p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>{note.studentName}</span>
                            <span className="text-border">•</span>
                            <span>{note.authorName}</span>
                            <span className="text-border">•</span>
                            <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RetentionDashboard;
