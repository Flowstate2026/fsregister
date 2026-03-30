import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Button } from "@/components/ui/button";
import {
  isNewStudent,
  needsNote,
  calculateAttendancePercentage,
  isAtRisk,
  formatTime,
} from "@/lib/student-utils";
import { format } from "date-fns";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { toast } from "sonner";

const ClassRegister = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: classInfo } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ["register-students", classId],
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from("class_enrollments")
        .select("student_id, students(*)")
        .eq("class_id", classId!);
      if (error) throw error;

      const studentList = enrollments
        ?.map((e) => e.students)
        .filter((s): s is NonNullable<typeof s> => s !== null && !s.archived)
        .sort((a, b) => a.last_name.localeCompare(b.last_name));

      if (!studentList?.length) return [];

      const studentIds = studentList.map((s) => s.id);
      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", studentIds);

      const { data: notes } = await supabase
        .from("student_notes")
        .select("*")
        .in("student_id", studentIds);

      return studentList.map((student) => ({
        ...student,
        attendance: attendance?.filter((a) => a.student_id === student.id) || [],
        notes: notes?.filter((n) => n.student_id === student.id) || [],
      }));
    },
  });

  const { data: existingAttendance } = useQuery({
    queryKey: ["existing-attendance", classId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("class_id", classId!)
        .eq("date", today);
      if (error) throw error;
      return data;
    },
  });

  const alreadySubmitted = (existingAttendance?.length ?? 0) > 0;

  useEffect(() => {
    if (existingAttendance?.length) {
      const savedAbsent = new Set(
        existingAttendance.filter((r) => !r.present).map((r) => r.student_id)
      );
      setAbsentIds(savedAbsent);
    }
  }, [existingAttendance]);

  const isLocked = (submitted || alreadySubmitted) && !editing;

  const toggleAbsent = (studentId: string) => {
    if (isLocked) return;
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!students?.length || !classId) return;
      const records = students.map((s) => ({
        student_id: s.id,
        class_id: classId,
        date: today,
        present: !absentIds.has(s.id),
      }));
      const { error } = await supabase.from("attendance_records").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, today] });
      queryClient.invalidateQueries({ queryKey: ["register-students", classId] });
      toast.success("Register saved");
    },
    onError: () => {
      toast.error("Failed to save register");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingAttendance?.length || !classId) return;
      const updates = existingAttendance.map((record) => {
        const shouldBePresent = !absentIds.has(record.student_id);
        return supabase
          .from("attendance_records")
          .update({ present: shouldBePresent })
          .eq("id", record.id);
      });
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, today] });
      queryClient.invalidateQueries({ queryKey: ["register-students", classId] });
      toast.success("Register updated");
    },
    onError: () => {
      toast.error("Failed to update register");
    },
  });

  const handleEditRegister = () => setEditing(true);

  const handleCancelEdit = () => {
    if (existingAttendance?.length) {
      const savedAbsent = new Set(
        existingAttendance.filter((r) => !r.present).map((r) => r.student_id)
      );
      setAbsentIds(savedAbsent);
    }
    setEditing(false);
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-10">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {classInfo?.name || "Class Register"}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground tracking-wide">
            {classInfo && formatTime(classInfo.time_of_day)} · {format(new Date(), "d MMM yyyy")}
          </p>
        </div>

        {alreadySubmitted && !editing && !submitted && (
          <div className="mb-5 flex items-center justify-between rounded-2xl bg-secondary/50 border border-border/40 px-5 py-3.5 text-xs text-muted-foreground">
            <span>Register already submitted for today.</span>
            <Button variant="ghost" size="sm" onClick={handleEditRegister} className="text-foreground text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
        )}

        {editing && (
          <div className="mb-5 rounded-2xl bg-accent/15 border border-accent/30 px-5 py-3.5 text-xs text-foreground">
            Editing register — tap students to change attendance, then save.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/40" />
            ))}
          </div>
        ) : !students?.length ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No students enrolled</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {students.map((student) => {
                const percent = calculateAttendancePercentage(student.attendance);
                const absent = absentIds.has(student.id);

                return (
                  <div
                    key={student.id}
                    className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
                      absent
                        ? "border-risk/20 bg-risk/[0.03]"
                        : "border-border/60 bg-card"
                    } ${isLocked ? "opacity-60" : ""} shadow-[var(--shadow-card)]`}
                  >
                    <div className="flex items-center gap-3.5">
                      <button
                        onClick={() => toggleAbsent(student.id)}
                        disabled={isLocked}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors ${
                          absent
                            ? "bg-risk/10 text-risk"
                            : "bg-accent/30 text-foreground"
                        } ${!isLocked ? "hover:opacity-80 active:scale-95" : ""}`}
                        aria-label={absent ? "Mark present" : "Mark absent"}
                      >
                        {absent ? "A" : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/student/${student.id}`)}
                        onKeyDown={(e) => { if (e.key === "Enter") navigate(`/student/${student.id}`); }}
                        className="cursor-pointer text-sm font-normal text-foreground hover:underline decoration-accent underline-offset-4"
                      >
                        {student.first_name} {student.last_name}
                      </span>
                    </div>
                    <StudentIndicators
                      isNew={isNewStudent(student.join_date)}
                      needsNote={needsNote(student.notes)}
                      isAtRisk={isAtRisk(percent)}
                      attendancePercent={percent}
                    />
                  </div>
                );
              })}
            </div>

            {!alreadySubmitted && !submitted && (
              <div className="mt-8">
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {submitMutation.isPending ? "Saving…" : `Save Register · ${absentIds.size} absent`}
                </Button>
              </div>
            )}

            {editing && (
              <div className="mt-8 flex gap-3">
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                  size="lg"
                >
                  {updateMutation.isPending ? "Saving…" : `Save Changes · ${absentIds.size} absent`}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            )}

            {(submitted || alreadySubmitted) && !editing && (
              <div className="mt-8">
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-accent/15 p-4 text-xs font-medium text-foreground">
                  <Check className="h-3.5 w-3.5" /> Register saved
                </div>
                {submitted && (
                  <button
                    onClick={handleEditRegister}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Made a mistake? Edit register
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default ClassRegister;
