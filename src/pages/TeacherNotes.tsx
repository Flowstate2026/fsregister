import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { formatDistanceToNow } from "date-fns";
import { StickyNote } from "lucide-react";

const TeacherNotes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: notes, isLoading } = useQuery({
    queryKey: ["teacher-notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_notes")
        .select("*, students(id, first_name, last_name)")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h2 className="font-display text-3xl text-foreground">Notes</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            Your notes · {notes?.length ?? 0} total
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : !notes?.length ? (
          <div className="bg-card p-14 text-center shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <StickyNote className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-light text-muted-foreground">
              No notes yet — add one from a student's profile.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => note.students && navigate(`/student/${note.students.id}`)}
                className="w-full bg-card px-6 py-5 text-left shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                      {note.students?.first_name} {note.students?.last_name}
                    </p>
                    <p className="mt-1.5 text-sm font-light leading-relaxed text-foreground line-clamp-2">
                      {note.note_text}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] tracking-wide text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
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

export default TeacherNotes;
