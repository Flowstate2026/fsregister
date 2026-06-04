import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { formatDistanceToNow } from "date-fns";
import { StickyNote, UserPlus, UserMinus } from "lucide-react";

type FeedItem =
  | {
      kind: "note";
      id: string;
      createdAt: string;
      teacherName: string;
      studentId: string;
      studentName: string;
      noteText: string;
    }
  | {
      kind: "activity";
      id: string;
      createdAt: string;
      teacherName: string;
      studentId: string;
      studentName: string;
      className: string;
      action: "enrolled" | "unenrolled";
    };

const OwnerActivity = () => {
  const { profile, isOwner, loading } = useAuth();
  const navigate = useNavigate();

  const { data: items, isLoading } = useQuery({
    queryKey: ["owner-activity", profile?.school_id],
    enabled: !!profile?.school_id && isOwner,
    queryFn: async (): Promise<FeedItem[]> => {
      // Notes for the school's students
      const { data: students, error: stuErr } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("school_id", profile!.school_id!);
      if (stuErr) throw stuErr;
      const studentMap = new Map(
        (students ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()])
      );
      const studentIds = students?.map((s) => s.id) ?? [];

      const [notesRes, activityRes, classesRes] = await Promise.all([
        studentIds.length
          ? supabase
              .from("student_notes")
              .select("id, note_text, created_at, author_id, student_id")
              .in("student_id", studentIds)
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("activity_log")
          .select("id, created_at, teacher_id, student_id, class_id, action")
          .eq("school_id", profile!.school_id!)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", profile!.school_id!),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (activityRes.error) throw activityRes.error;
      if (classesRes.error) throw classesRes.error;

      const classMap = new Map(
        (classesRes.data ?? []).map((c: any) => [c.id, c.name as string])
      );

      const teacherIds = Array.from(
        new Set([
          ...(notesRes.data ?? []).map((n: any) => n.author_id),
          ...(activityRes.data ?? []).map((a: any) => a.teacher_id),
        ])
      );

      let nameMap = new Map<string, string>();
      if (teacherIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", teacherIds);
        nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
      }

      const noteItems: FeedItem[] = (notesRes.data ?? []).map((n: any) => ({
        kind: "note",
        id: `note-${n.id}`,
        createdAt: n.created_at,
        teacherName: nameMap.get(n.author_id) ?? "Unknown",
        studentId: n.student_id,
        studentName: studentMap.get(n.student_id) ?? "Unknown student",
        noteText: n.note_text,
      }));

      const activityItems: FeedItem[] = (activityRes.data ?? []).map((a: any) => ({
        kind: "activity",
        id: `act-${a.id}`,
        createdAt: a.created_at,
        teacherName: nameMap.get(a.teacher_id) ?? "Unknown",
        studentId: a.student_id,
        studentName: studentMap.get(a.student_id) ?? "Unknown student",
        className: classMap.get(a.class_id) ?? "Unknown class",
        action: a.action,
      }));

      return [...noteItems, ...activityItems].sort((x, y) =>
        y.createdAt.localeCompare(x.createdAt)
      );
    },
  });

  if (!loading && !isOwner) return <Navigate to="/notes" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h2 className="font-display text-3xl text-foreground">Activity</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            Notes & register changes · {items?.length ?? 0}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : !items?.length ? (
          <div className="bg-card p-14 text-center shadow-[var(--shadow-card)]">
            <p className="text-sm font-light text-muted-foreground">
              No activity yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/student/${item.studentId}`)}
                className="w-full bg-card px-6 py-5 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] ${
                          item.kind === "note"
                            ? "bg-accent/10 text-accent"
                            : item.kind === "activity" && item.action === "enrolled"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-risk/10 text-risk"
                        }`}
                      >
                        {item.kind === "note" ? (
                          <>
                            <StickyNote className="h-2.5 w-2.5" /> Note
                          </>
                        ) : item.action === "enrolled" ? (
                          <>
                            <UserPlus className="h-2.5 w-2.5" /> Added
                          </>
                        ) : (
                          <>
                            <UserMinus className="h-2.5 w-2.5" /> Removed
                          </>
                        )}
                      </span>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {item.teacherName}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-light text-foreground">
                      {item.kind === "note" ? (
                        <>
                          <span className="text-accent">{item.studentName}</span>
                          <span className="ml-2 text-muted-foreground line-clamp-2">
                            {item.noteText}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-accent">{item.studentName}</span>
                          <span className="ml-1 text-muted-foreground">
                            {item.action === "enrolled" ? "added to" : "removed from"}
                          </span>{" "}
                          <span>{item.className}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OwnerActivity;
