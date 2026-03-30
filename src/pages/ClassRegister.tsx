import { useState } from "react";
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
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

const ClassRegister = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

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

      // Fetch attendance records for all students
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

  const toggleAbsent = (studentId: string) => {
    if (submitted || alreadySubmitted) return;
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
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, today] });
      toast.success("Register saved!");
    },
    onError: () => {
      toast.error("Failed to save register");
    },
  });

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h2 className="font-display text-2xl font-bold text-foreground">
            {classInfo?.name || "Class Register"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {classInfo && formatTime(classInfo.time_of_day)} · {format(new Date(), "d MMM yyyy")}
          </p>
        </div>

        {alreadySubmitted && !submitted && (
          <div className="mb-4 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
            Register already submitted for today.
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
            <div className="space-y-1">
              {students.map((student) => {
                const percent = calculateAttendancePercentage(student.attendance);
                const absent = absentIds.has(student.id);
                const disabled = submitted || alreadySubmitted;

                return (
                  <button
                    key={student.id}
                    onClick={() => toggleAbsent(student.id)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                      absent
                        ? "border-risk/30 bg-risk/5"
                        : "border-border bg-card hover:bg-accent/30"
                    } ${disabled ? "opacity-70" : "active:scale-[0.99]"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                          absent
                            ? "bg-risk/10 text-risk"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {absent ? "A" : <Check className="h-4 w-4" />}
                      </div>
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          navigate(`/student/${student.id}`);
                        }}
                        className="text-left hover:underline cursor-pointer font-medium text-foreground"
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
                  </button>
                );
              })}
            </div>

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

            {(submitted || alreadySubmitted) && (
              <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-primary/5 p-4 text-sm font-medium text-primary">
                <Check className="h-4 w-4" /> Register saved
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default ClassRegister;
