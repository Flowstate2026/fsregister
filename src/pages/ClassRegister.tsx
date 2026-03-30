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

  // Fetch class info
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

  // Fetch enrolled students with their attendance and notes
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

  // Check if register already submitted today
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

  // When existing attendance loads, populate absentIds from saved data
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

  // First-time save
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
      toast.success("Register saved!");
    },
    onError: () => {
      toast.error("Failed to save register");
    },
  });

  // Update existing records
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingAttendance?.length || !classId) return;
      // Update each record's present status
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
      toast.success("Register updated!");
    },
    onError: () => {
      toast.error("Failed to update register");
    },
  });

  const handleEditRegister = () => {
    setEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset to saved state
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
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h2 className="font-display text-3xl font-extrabold text-foreground">
            {classInfo?.name || "Class Register"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {classInfo && formatTime(classInfo.time_of_day)} · {format(new Date(), "d MMM yyyy")}
          </p>
        </div>

        {alreadySubmitted && !editing && !submitted && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
            <span>Register already submitted for today.</span>
            <Button variant="ghost" size="sm" onClick={handleEditRegister} className="text-primary">
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          </div>
        )}

        {editing && (
          <div className="mb-4 rounded-lg bg-accent/20 border border-accent/40 p-3 text-sm text-foreground">
            Editing register — tap students to change attendance, then save.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : !students?.length ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No students enrolled</p>
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
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                      absent
                        ? "border-risk/30 bg-risk/5"
                        : "border-border bg-card"
                    } ${isLocked ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Attendance toggle circle */}
                      <button
                        onClick={() => toggleAbsent(student.id)}
                        disabled={isLocked}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                          absent
                            ? "bg-risk/10 text-risk"
                            : "bg-primary/10 text-primary"
                        } ${!isLocked ? "hover:opacity-80 active:scale-95" : ""}`}
                        aria-label={absent ? "Mark present" : "Mark absent"}
                      >
                        {absent ? "A" : <Check className="h-4 w-4" />}
                      </button>
                      {/* Student name — always tappable */}
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/student/${student.id}`)}
                        onKeyDown={(e) => { if (e.key === "Enter") navigate(`/student/${student.id}`); }}
                        className="cursor-pointer font-medium text-foreground hover:underline"
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

            {/* First-time save */}
            {!alreadySubmitted && !submitted && (
              <div className="mt-6">
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

            {/* Editing: save / cancel */}
            {editing && (
              <div className="mt-6 flex gap-3">
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

            {/* Saved confirmation */}
            {(submitted || alreadySubmitted) && !editing && (
              <div className="mt-6">
                <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/5 p-4 text-sm font-medium text-primary">
                  <Check className="h-4 w-4" /> Register saved
                </div>
                {submitted && (
                  <button
                    onClick={handleEditRegister}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Made a mistake? Edit register
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
