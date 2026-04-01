import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { ArrowLeft, Check, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";

type AbsenceType = "absent" | "authorised";

const ClassRegister = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  // Maps student_id -> absence type
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

  const { data: students, isLoading } = useQuery({
    queryKey: ["register-students", classId],
    queryFn: async () => {
      const { data: enrollments, error } = await supabase.from("class_enrollments").select("student_id, students(*)").eq("class_id", classId!);
      if (error) throw error;
      const studentList = enrollments?.map((e) => e.students).filter((s): s is NonNullable<typeof s> => s !== null && !s.archived).sort((a, b) => a.last_name.localeCompare(b.last_name));
      if (!studentList?.length) return [];
      const studentIds = studentList.map((s) => s.id);
      const { data: attendance } = await supabase.from("attendance_records").select("*").in("student_id", studentIds);
      const { data: notes } = await supabase.from("student_notes").select("*").in("student_id", studentIds);
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
      const { data, error } = await supabase.from("attendance_records").select("*").eq("class_id", classId!).eq("date", today);
      if (error) throw error;
      return data;
    },
  });

  const alreadySubmitted = (existingAttendance?.length ?? 0) > 0;

  useEffect(() => {
    if (existingAttendance?.length) {
      const saved = new Map<string, AbsenceType>();
      existingAttendance.forEach((r) => {
        if (!r.present) {
          saved.set(r.student_id, r.authorised ? "authorised" : "absent");
        }
      });
      setAbsences(saved);
    }
  }, [existingAttendance]);

  const isLocked = (submitted || alreadySubmitted) && !editing;

  // Cycle: present → absent → authorised → present
  const cycleAbsence = (studentId: string) => {
    if (isLocked) return;
    setAbsences((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId);
      if (!current) {
        next.set(studentId, "absent");
      } else if (current === "absent") {
        next.set(studentId, "authorised");
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  const absentCount = absences.size;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!students?.length || !classId) return;
      const records = students.map((s) => ({
        student_id: s.id,
        class_id: classId,
        date: today,
        present: !absences.has(s.id),
        authorised: absences.get(s.id) === "authorised",
      }));
      const { error } = await supabase.from("attendance_records").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true); setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, today] });
      queryClient.invalidateQueries({ queryKey: ["register-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance-status"] });
      toast.success("Register saved");
      // Only fire webhook for unauthorised absences
      const unauthorisedIds = Array.from(absences.entries())
        .filter(([, type]) => type === "absent")
        .map(([id]) => id);
      if (unauthorisedIds.length > 0 && profile?.school_id) {
        supabase.functions.invoke("check-attendance-webhooks", {
          body: { student_ids: unauthorisedIds, school_id: profile.school_id },
        }).catch(() => {});
      }
      navigate("/");
    },
    onError: () => { toast.error("Failed to save register"); },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingAttendance?.length || !classId) return;
      const updates = existingAttendance.map((record) =>
        supabase.from("attendance_records").update({
          present: !absences.has(record.student_id),
          authorised: absences.get(record.student_id) === "authorised",
        }).eq("id", record.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, today] });
      queryClient.invalidateQueries({ queryKey: ["register-students", classId] });
      const unauthorisedIds = Array.from(absences.entries())
        .filter(([, type]) => type === "absent")
        .map(([id]) => id);
      if (unauthorisedIds.length > 0 && profile?.school_id) {
        supabase.functions.invoke("check-attendance-webhooks", {
          body: { student_ids: unauthorisedIds, school_id: profile.school_id },
        }).catch(() => {});
      }
      toast.success("Register updated");
    },
    onError: () => { toast.error("Failed to update register"); },
  });

  const handleEditRegister = () => setEditing(true);
  const handleCancelEdit = () => {
    if (existingAttendance?.length) {
      const saved = new Map<string, AbsenceType>();
      existingAttendance.forEach((r) => {
        if (!r.present) {
          saved.set(r.student_id, r.authorised ? "authorised" : "absent");
        }
      });
      setAbsences(saved);
    }
    setEditing(false);
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12">
          <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h2 className="font-display text-3xl text-foreground">{classInfo?.name || "Class Register"}</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            {classInfo && formatTime(classInfo.time_of_day)} · {format(new Date(), "d MMM yyyy")}
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

        {/* Legend */}
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
                const isAbsent = !!absenceType;
                const isAuthorised = absenceType === "authorised";
                return (
                  <div key={student.id} className={`flex w-full items-center justify-between px-5 py-4 text-left transition-all ${isAbsent ? (isAuthorised ? "bg-accent/[0.04]" : "bg-risk/[0.04]") : "bg-card"} ${isLocked ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-4">
                      <button onClick={() => cycleAbsence(student.id)} disabled={isLocked}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-light transition-colors ${
                          isAuthorised
                            ? "bg-accent/15 text-accent"
                            : isAbsent
                              ? "bg-risk/10 text-risk"
                              : "bg-foreground/5 text-foreground"
                        } ${!isLocked ? "hover:opacity-80 active:scale-95" : ""}`}
                        aria-label={isAuthorised ? "Mark present" : isAbsent ? "Mark parent notified" : "Mark absent"}>
                        {isAuthorised ? <Mail className="h-3.5 w-3.5" /> : isAbsent ? "A" : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <span role="link" tabIndex={0} onClick={() => navigate(`/student/${student.id}`)} onKeyDown={(e) => { if (e.key === "Enter") navigate(`/student/${student.id}`); }}
                        className="cursor-pointer text-sm font-light text-foreground hover:text-accent transition-colors">
                        {student.first_name} {student.last_name}
                      </span>
                      {isAuthorised && (
                        <span className="text-[9px] uppercase tracking-[0.2em] text-accent font-medium">Notified</span>
                      )}
                    </div>
                    <StudentIndicators isNew={isNewStudent(student.join_date)} needsNote={needsNote(student.notes)} isAtRisk={isAtRisk(percent)} attendancePercent={percent} />
                  </div>
                );
              })}
            </div>

            {!alreadySubmitted && !submitted && (
              <div className="mt-10">
                <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="w-full" size="lg">
                  {submitMutation.isPending ? "Saving…" : `Save Register · ${absentCount} absent`}
                </Button>
              </div>
            )}

            {editing && (
              <div className="mt-10 flex gap-3">
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="flex-1" size="lg">
                  {updateMutation.isPending ? "Saving…" : `Save Changes · ${absentCount} absent`}
                </Button>
                <Button variant="outline" size="lg" onClick={handleCancelEdit} disabled={updateMutation.isPending}>Cancel</Button>
              </div>
            )}

            {(submitted || alreadySubmitted) && !editing && (
              <div className="mt-10">
                <div className="flex items-center justify-center gap-2 border-l-2 border-accent bg-accent/5 p-5 text-[11px] font-light uppercase tracking-[0.2em] text-foreground">
                  <Check className="h-3.5 w-3.5" /> Register saved
                </div>
                {submitted && (
                  <button onClick={handleEditRegister} className="mt-4 flex w-full items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
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
