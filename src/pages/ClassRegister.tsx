import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClassStudents } from "@/hooks/useStudentWithDetails";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Button } from "@/components/ui/button";
import {
  calculateAttendancePercentage,
  formatTime,
} from "@/lib/student-utils";
import {
  cycleAbsenceType,
  parseAttendanceToAbsences,
  buildAttendanceRecords,
  buildAttendanceUpdates,
  getAbsenceRowBgClass,
  getAbsenceStyleClass,
  getAbsenceLabel,
  isRegisterLocked,
  getUnauthorisedAbsenceIds,
  type AbsenceType,
} from "@/lib/attendance-utils";
import { format } from "date-fns";
import { ArrowLeft, Check, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";

const ClassRegister = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const registerDate = format(new Date(), "yyyy-MM-dd");

  const [absences, setAbsences] = useState<Map<string, AbsenceType>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: classInfo } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId!).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch students with attendance/notes using new hook
  const { data: students, isLoading } = useClassStudents(classId);

  const { data: existingAttendance } = useQuery({
    queryKey: ["existing-attendance", classId, registerDate],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("*").eq("class_id", classId!).eq("date", registerDate);
      if (error) throw error;
      return data;
    },
  });

  const alreadySubmitted = (existingAttendance?.length ?? 0) > 0;
  const isLocked = isRegisterLocked(submitted, alreadySubmitted, editing);
  const absentCount = absences.size;

  // Load existing attendance into state
  useEffect(() => {
    if (existingAttendance?.length) {
      setAbsences(parseAttendanceToAbsences(existingAttendance));
    }
  }, [existingAttendance]);

  // Handle absence cycling
  const cycleAbsence = (studentId: string) => {
    if (isLocked) return;
    setAbsences((prev) => {
      const next = new Map(prev);
      const newType = cycleAbsenceType(next.get(studentId));
      if (newType) {
        next.set(studentId, newType);
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  // Submit new register
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!students?.length || !classId) return;
      const records = buildAttendanceRecords(
        students.map((s) => s.id),
        classId,
        registerDate,
        absences
      );
      const { error } = await supabase
        .from("attendance_records")
        .insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      setEditing(false);
      queryClient.invalidateQueries({
        queryKey: ["existing-attendance", classId, registerDate],
      });
      queryClient.invalidateQueries({ queryKey: ["register-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance-status"] });
      toast.success("Register saved");

      const unauthorisedIds = getUnauthorisedAbsenceIds(absences);
      if (unauthorisedIds.length > 0 && profile?.school_id) {
        supabase.functions
          .invoke("check-attendance-webhooks", {
            body: {
              student_ids: unauthorisedIds,
              school_id: profile.school_id,
            },
          })
          .catch(() => {});
      }
      navigate("/");
    },
    onError: () => {
      toast.error("Failed to save register");
    },
  });

  // Update existing register
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingAttendance?.length || !classId) return;
      const updates = buildAttendanceUpdates(existingAttendance, absences);
      const results = await Promise.all(
        updates.map((u) =>
          supabase
            .from("attendance_records")
            .update(u.updates)
            .eq("id", u.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({
        queryKey: ["existing-attendance", classId, registerDate],
      });
      queryClient.invalidateQueries({ queryKey: ["register-students", classId] });
      const unauthorisedIds = getUnauthorisedAbsenceIds(absences);
      if (unauthorisedIds.length > 0 && profile?.school_id) {
        supabase.functions
          .invoke("check-attendance-webhooks", {
            body: {
              student_ids: unauthorisedIds,
              school_id: profile.school_id,
            },
          })
          .catch(() => {});
      }
      toast.success("Register updated");
    },
    onError: () => {
      toast.error("Failed to update register");
    },
  });

  const handleEditRegister = () => setEditing(true);
  const handleCancelEdit = () => {
    if (existingAttendance?.length) {
      setAbsences(parseAttendanceToAbsences(existingAttendance));
    }
    setEditing(false);
  };

  const displayDate = format(new Date(), "d MMM yyyy");

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12">
          <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h2 className="font-display text-3xl text-foreground">{classInfo?.name || "Class Register"}</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            {classInfo && formatTime(classInfo.time_of_day)} · {displayDate}
          </p>
        </div>

        {alreadySubmitted && !editing && !submitted && (
          <div className="mb-6 flex items-center justify-between bg-secondary/50 px-6 py-4 text-[11px] tracking-wide text-muted-foreground">
            <span>Register already submitted for today.</span>
            <Button variant="ghost" size="sm" onClick={handleEditRegister} className="text-foreground text-[10px] uppercase tracking-[0.2em]">
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
        )}

        {editing && (
          <div className="mb-6 border-l-2 border-accent bg-accent/5 px-6 py-4 text-[11px] tracking-wide text-foreground">
            Editing register — tap to cycle: present → absent → parent notified → present.
          </div>
        )}

        {!isLocked && (
          <div className="mb-4 flex items-center gap-5 text-[10px] text-muted-foreground tracking-wide">
            <span className="flex items-center gap-1.5"><Check className="h-3 w-3" /> Present</span>
            <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center bg-risk/10 text-risk text-[9px]">A</span> Absent</span>
            <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-accent" /> Parent notified</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-16 animate-pulse bg-muted/40" />))}
          </div>
        ) : !students?.length ? (
          <div className="bg-card p-12 text-center shadow-[var(--shadow-card)]"><p className="text-sm font-light text-muted-foreground">No students enrolled</p></div>
        ) : (
          <>
            <div className="divide-y divide-border/40">
              {students.map((student) => {
                const percent = calculateAttendancePercentage(student.attendance);
                const absenceType = absences.get(student.id);
                const rowBgClass = getAbsenceRowBgClass(absenceType);
                const buttonStyleClass = getAbsenceStyleClass(absenceType);
                const label = getAbsenceLabel(absenceType);

                return (
                  <div
                    key={student.id}
                    className={`flex w-full items-center justify-between px-5 py-4 text-left transition-all ${rowBgClass} ${
                      isLocked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => cycleAbsence(student.id)}
                        disabled={isLocked}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-light transition-colors ${buttonStyleClass} ${
                          !isLocked
                            ? "hover:opacity-80 active:scale-95"
                            : ""
                        }`}
                        aria-label={label}
                        title={label}
                      >
                        {absenceType === "authorised" ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : absenceType ? (
                          "A"
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/student/${student.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            navigate(`/student/${student.id}`);
                        }}
                        className="cursor-pointer text-sm font-light text-foreground hover:text-accent transition-colors"
                      >
                        {student.first_name} {student.last_name}
                      </span>
                    </div>
                    <StudentIndicators
                      student={student}
                      attendancePercent={percent}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex gap-3">
              {alreadySubmitted && editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                    className="flex-1"
                  >
                    {submitMutation.isPending
                      ? "Saving…"
                      : `Save Register${absentCount > 0 ? ` (${absentCount})` : ""}`}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default ClassRegister;
