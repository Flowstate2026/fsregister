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
  const { user } = useAuth();
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
      const { data, error } = await supabase
        .from("student_notes")
        .select("*, profiles:author_id(full_name)")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!noteText.trim() || !user) throw new Error("Missing note text or user");
      const { error } = await supabase.from("student_notes").insert({
        student_id: studentId!,
        author_id: user.id,
        note_text: noteText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText("");
      setShowNoteForm(false);
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
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
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
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Student header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {student.first_name} {student.last_name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Joined {format(parseISO(student.join_date), "d MMM yyyy")}
            </p>
            {student.parent_email && (
              <p className="text-sm text-muted-foreground">
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
        <section className="mb-6">
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Enrolled Classes
          </h3>
          <div className="space-y-2">
            {enrollments?.map((e) => (
              <div key={e.id} className="rounded-lg border bg-card p-3 text-sm">
                <span className="font-medium text-foreground">{(e.classes as any)?.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {getDayName((e.classes as any)?.day_of_week)} · {formatTime((e.classes as any)?.time_of_day)}
                </span>
              </div>
            ))}
            {!enrollments?.length && (
              <p className="text-sm text-muted-foreground">No class enrollments</p>
            )}
          </div>
        </section>

        {/* Attendance history */}
        <section className="mb-6">
          <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance History
          </h3>
          <div className="space-y-1">
            {attendance?.slice(0, 20).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-foreground">
                    {format(parseISO(record.date), "d MMM yyyy")}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {(record.classes as any)?.name}
                  </span>
                </div>
                <span
                  className={`flex items-center gap-1 font-medium ${
                    record.present ? "text-primary" : "text-risk"
                  }`}
                >
                  {record.present ? (
                    <><Check className="h-3.5 w-3.5" /> Present</>
                  ) : (
                    <><X className="h-3.5 w-3.5" /> Absent</>
                  )}
                </span>
              </div>
            ))}
            {!attendance?.length && (
              <p className="text-sm text-muted-foreground">No attendance records</p>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNoteForm(true)}
              className="text-primary"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Note
            </Button>
          </div>

          {showNoteForm && (
            <div className="mb-4 rounded-lg border bg-card p-4">
              <Textarea
                placeholder="Write a note about this student…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="mb-3"
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

          <div className="space-y-2">
            {notes?.map((note) => (
              <div key={note.id} className="rounded-lg border bg-card p-3">
                <p className="text-sm text-foreground">{note.note_text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(note.profiles as any)?.full_name} · {format(new Date(note.created_at), "d MMM yyyy")}
                </p>
              </div>
            ))}
            {!notes?.length && !showNoteForm && (
              <p className="text-sm text-muted-foreground">No notes yet</p>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default StudentProfile;
