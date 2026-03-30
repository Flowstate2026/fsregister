import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  isNewStudent,
  needsNote,
  calculateAttendancePercentage,
  isAtRisk,
  getDayName,
  formatTime,
} from "@/lib/student-utils";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["student-enrollments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("*, classes(*)")
        .eq("student_id", studentId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, classes(name)")
        .eq("student_id", studentId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: notes } = useQuery({
    queryKey: ["student-notes", studentId],
    queryFn: async () => {
      const { data: noteRows, error: notesError } = await supabase
        .from("student_notes")
        .select("*")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;
      if (!noteRows?.length) return [];

      const authorIds = [...new Set(noteRows.map((note) => note.author_id))];
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);

      if (profilesError) throw profilesError;

      const namesByAuthor = new Map(
        (profileRows || []).map((author) => [author.user_id, author.full_name])
      );

      return noteRows.map((note) => ({
        ...note,
        author_name: namesByAuthor.get(note.author_id) || null,
      }));
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const trimmedNote = noteText.trim();
      if (!trimmedNote || !user || !studentId) {
        throw new Error("Missing note text or user");
      }

      const { data, error } = await supabase
        .from("student_notes")
        .insert({
          student_id: studentId,
          author_id: user.id,
          note_text: trimmedNote,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newNote) => {
      setNoteText("");
      setShowNoteForm(false);

      queryClient.setQueryData(["student-notes", studentId], (current: any[] | undefined) => {
        const next = [
          {
            ...newNote,
            author_name: profile?.full_name || "You",
          },
          ...(current || []),
        ];

        return next.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      queryClient.invalidateQueries({ queryKey: ["student-notes", studentId] });
      toast.success("Note added");
    },
    onError: (err) => {
      toast.error("Failed to add note: " + (err as Error).message);
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted/40" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </AppLayout>
    );
  }

  if (!student) return null;

  const percent = calculateAttendancePercentage(attendance || []);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* Student header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {student.first_name} {student.last_name}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground tracking-wide">
              Joined {format(parseISO(student.join_date), "d MMM yyyy")}
            </p>
            {student.parent_email && (
              <p className="text-xs text-muted-foreground">
                Parent: {student.parent_email}
              </p>
            )}
          </div>
          <StudentIndicators
            isNew={isNewStudent(student.join_date)}
            needsNote={needsNote(notes || [])}
            isAtRisk={isAtRisk(percent)}
            attendancePercent={percent}
          />
        </div>

        {/* Enrolled classes */}
        <section className="mb-10">
          <h3 className="mb-4 font-display text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Enrolled Classes
          </h3>
          <div className="space-y-2.5">
            {enrollments?.map((e) => (
              <div key={e.id} className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-sm shadow-[var(--shadow-card)]">
                <span className="font-medium text-foreground">{(e.classes as any)?.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {getDayName((e.classes as any)?.day_of_week)} · {formatTime((e.classes as any)?.time_of_day)}
                </span>
              </div>
            ))}
            {!enrollments?.length && (
              <p className="text-xs text-muted-foreground">No class enrollments</p>
            )}
          </div>
        </section>

        {/* Attendance history */}
        <section className="mb-10">
          <h3 className="mb-4 font-display text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Attendance History
          </h3>
          <div className="space-y-2">
            {attendance?.slice(0, 20).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-5 py-3.5 text-sm shadow-[var(--shadow-card)]"
              >
                <div>
                  <span className="text-foreground text-sm">
                    {format(parseISO(record.date), "d MMM yyyy")}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {(record.classes as any)?.name}
                  </span>
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    record.present ? "text-foreground" : "text-risk"
                  }`}
                >
                  {record.present ? (
                    <><Check className="h-3 w-3" /> Present</>
                  ) : (
                    <><X className="h-3 w-3" /> Absent</>
                  )}
                </span>
              </div>
            ))}
            {!attendance?.length && (
              <p className="text-xs text-muted-foreground">No attendance records</p>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Notes
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNoteForm(true)}
              className="text-foreground text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
            </Button>
          </div>

          {showNoteForm && (
            <div className="mb-5 rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
              <Textarea
                placeholder="Write a note about this student…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="mb-3 border-border/60"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                >
                  {addNoteMutation.isPending ? "Saving…" : "Save Note"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowNoteForm(false); setNoteText(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {notes?.map((note) => (
              <div key={note.id} className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-[var(--shadow-card)]">
                <p className="text-sm text-foreground">{note.note_text}</p>
                <p className="mt-2.5 text-[11px] text-muted-foreground">
                  {(note as any).author_name ?? "Unknown teacher"} · {format(new Date(note.created_at), "d MMM yyyy")}
                </p>
              </div>
            ))}
            {!notes?.length && !showNoteForm && (
              <p className="text-xs text-muted-foreground">No notes yet</p>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default StudentProfile;
