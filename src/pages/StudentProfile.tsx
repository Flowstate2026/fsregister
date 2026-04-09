import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudent } from "@/hooks/useStudentWithDetails";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { calculateAttendancePercentage, getDayName, formatTime } from "@/lib/student-utils";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Plus, Check, X, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const StudentProfile = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, profile, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);

  // Fetch student with all related data
  const { data: studentData, isLoading } = useStudent(studentId, {
    includeEnrollments: true,
    includeNoteAuthors: true,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const trimmedNote = noteText.trim();
      if (!trimmedNote || !user || !studentId)
        throw new Error("Missing note text or user");
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
    onSuccess: () => {
      setNoteText("");
      setShowNoteForm(false);
      queryClient.invalidateQueries({
        queryKey: ["student", studentId, { includeEnrollments: true }],
      });
      toast.success("Note added");
    },
    onError: (err) => {
      toast.error("Failed to add note: " + (err as Error).message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("No student");
      const newArchived = !studentData?.archived;
      const { error } = await supabase
        .from("students")
        .update({ archived: newArchived })
        .eq("id", studentId);
      if (error) throw error;
      return newArchived;
    },
    onSuccess: (archived) => {
      queryClient.invalidateQueries({
        queryKey: ["student", studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["owner-students"] });
      toast.success(archived ? "Student archived" : "Student reinstated");
      if (archived) navigate(-1);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  if (isLoading)
    return (
      <AppLayout>
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse bg-muted/40" />
          <div className="h-40 animate-pulse bg-muted/40" />
        </div>
      </AppLayout>
    );

  if (!studentData) return null;

  const percent = calculateAttendancePercentage(studentData.attendance);

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div className="mb-12 flex items-start justify-between">
          <div>
            <h2 className="font-display text-3xl text-foreground">
              {studentData.first_name} {studentData.last_name}
            </h2>
            <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
              Joined {format(parseISO(studentData.join_date), "d MMM yyyy")}
            </p>
            {studentData.parent_email && (
              <p className="mt-1 text-[11px] font-light text-muted-foreground">
                Parent: {studentData.parent_email}
              </p>
            )}
            {isOwner && (
              <button
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-risk transition-colors"
              >
                {studentData.archived ? (
                  <>
                    <RotateCcw className="h-3 w-3" />{" "}
                    {archiveMutation.isPending
                      ? "Reinstating…"
                      : "Reinstate Student"}
                  </>
                ) : (
                  <>
                    <Archive className="h-3 w-3" />{" "}
                    {archiveMutation.isPending ? "Archiving…" : "Archive Student"}
                  </>
                )}
              </button>
            )}
          </div>
          <StudentIndicators
            student={studentData}
            attendancePercent={percent}
          />
        </div>

        {/* Enrolled classes */}
        <section className="mb-12">
          <h3
            className="mb-5 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground"
            style={{
              fontFamily: "Jost, system-ui, sans-serif",
              fontStyle: "normal",
            }}
          >
            Enrolled Classes
          </h3>
          <div className="divide-y divide-border/40">
            {studentData.enrollments?.map((e) => (
              <div key={e.id} className="bg-card px-5 py-4 text-sm font-light">
                <span className="text-foreground">
                  {e.classes?.name || "Unknown Class"}
                </span>
                {e.classes && (
                  <span className="ml-3 text-[11px] text-muted-foreground">
                    {getDayName(e.classes.day_of_week)} ·{" "}
                    {formatTime(e.classes.time_of_day)}
                  </span>
                )}
              </div>
            ))}
            {!studentData.enrollments?.length && (
              <p className="text-[11px] font-light text-muted-foreground py-4">
                No class enrollments
              </p>
            )}
          </div>
        </section>

        {/* Attendance history */}
        <section className="mb-12">
          <h3
            className="mb-5 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground"
            style={{
              fontFamily: "Jost, system-ui, sans-serif",
              fontStyle: "normal",
            }}
          >
            Attendance History
          </h3>
          <div className="divide-y divide-border/40">
            {studentData.attendance?.slice(0, 20).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between bg-card px-5 py-3.5 text-sm font-light"
              >
                <div>
                  <span className="text-foreground">
                    {format(parseISO(record.date), "d MMM yyyy")}
                  </span>
                  <span className="ml-3 text-[11px] text-muted-foreground">
                    {record.class_id ? `Class ${record.class_id}` : "Unknown"}
                  </span>
                </div>
                <span
                  className={`flex items-center gap-1.5 text-[11px] ${
                    record.present ? "text-foreground" : "text-risk"
                  }`}
                >
                  {record.present ? (
                    <>
                      <Check className="h-3 w-3" /> Present
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3" /> Absent
                    </>
                  )}
                </span>
              </div>
            ))}
            {!studentData.attendance?.length && (
              <p className="text-[11px] font-light text-muted-foreground py-4">
                No attendance records
              </p>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="mb-12">
          <div className="mb-5 flex items-center justify-between">
            <h3
              className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground"
              style={{
                fontFamily: "Jost, system-ui, sans-serif",
                fontStyle: "normal",
              }}
            >
              Notes
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNoteForm(true)}
              className="text-foreground text-[10px] uppercase tracking-[0.15em]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
            </Button>
          </div>

          {showNoteForm && (
            <div className="mb-6 bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="relative mb-4">
                {!noteText && (
                  <p className="pointer-events-none absolute inset-0 px-3 py-2 text-sm italic font-light text-muted-foreground/60 leading-relaxed">
                    Start with something positive — what went well today? Then
                    add something to work on for next time…
                  </p>
                )}
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="relative border-0 border-b border-foreground/20 bg-transparent rounded-none focus-visible:ring-0 font-light"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
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
                  onClick={() => {
                    setShowNoteForm(false);
                    setNoteText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border/40">
            {studentData.notes?.map((note) => (
              <div key={note.id} className="bg-card px-5 py-5">
                <p className="text-sm font-light text-foreground leading-relaxed">
                  {note.note_text}
                </p>
                <p className="mt-3 text-[10px] tracking-wide text-muted-foreground">
                  {note.author_name ?? "Unknown teacher"} ·{" "}
                  {format(new Date(note.created_at), "d MMM yyyy")}
                </p>
              </div>
            ))}
            {!studentData.notes?.length && !showNoteForm && (
              <p className="text-[11px] font-light text-muted-foreground py-4">
                No notes yet
              </p>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default StudentProfile;
