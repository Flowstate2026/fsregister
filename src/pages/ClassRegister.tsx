import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClassStudents } from "@/hooks/useStudentWithDetails";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ArrowLeft, Check, Pencil, Mail, Plus, X } from "lucide-react";
import { toast } from "sonner";

const ClassRegister = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  const registerDate = format(new Date(), "yyyy-MM-dd");

  const [absences, setAbsences] = useState<Map<string, AbsenceType>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: classInfo } = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("id", classId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: students, isLoading } = useClassStudents(classId);

  const { data: existingAttendance } = useQuery({
    queryKey: ["existing-attendance", classId, registerDate],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("*").eq("class_id", classId!).eq("date", registerDate);
      if (error) throw error;
      return data;
    },
  });

  // School students for "Add Student" picker (loaded when dialog opens)
  const { data: schoolStudents, isLoading: loadingSchool } = useQuery({
    queryKey: ["school-students-picker", profile?.school_id],
    enabled: addOpen && !!profile?.school_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("school_id", profile!.school_id!)
        .eq("archived", false)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const alreadySubmitted = (existingAttendance?.length ?? 0) > 0;
  const isLocked = isRegisterLocked(submitted, alreadySubmitted, editing);
  const absentCount = absences.size;

  useEffect(() => {
    if (existingAttendance?.length) {
      setAbsences(parseAttendanceToAbsences(existingAttendance));
    }
  }, [existingAttendance]);

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

  const logActivity = async (studentId: string, action: "enrolled" | "unenrolled") => {
    if (!user || !profile?.school_id || !classId) return;
    await supabase.from("activity_log").insert({
      school_id: profile.school_id,
      teacher_id: user.id,
      student_id: studentId,
      class_id: classId,
      action,
    });
  };

  const addStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!classId) throw new Error("Missing class");
      const { error: enrollErr } = await supabase
        .from("class_enrollments")
        .upsert(
          { student_id: studentId, class_id: classId },
          { onConflict: "student_id,class_id", ignoreDuplicates: true }
        );
      if (enrollErr) throw enrollErr;

      // If register is already submitted today, insert a "present" record
      if (alreadySubmitted) {
        const { error: attErr } = await supabase
          .from("attendance_records")
          .upsert(
            {
              student_id: studentId,
              class_id: classId,
              date: registerDate,
              present: true,
              authorised: false,
            },
            { onConflict: "student_id,class_id,date", ignoreDuplicates: true }
          );
        if (attErr) throw attErr;
      }

      await logActivity(studentId, "enrolled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, registerDate] });
      queryClient.invalidateQueries({ queryKey: ["owner-activity"] });
      toast.success("Student added to register");
      setAddSearch("");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to add student");
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      if (!classId) throw new Error("Missing class");
      const { error: delEnroll } = await supabase
        .from("class_enrollments")
        .delete()
        .eq("class_id", classId)
        .eq("student_id", studentId);
      if (delEnroll) throw delEnroll;

      const { error: delAtt } = await supabase
        .from("attendance_records")
        .delete()
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .eq("date", registerDate);
      if (delAtt) throw delAtt;

      await logActivity(studentId, "unenrolled");
    },
    onSuccess: (_d, studentId) => {
      setAbsences((prev) => {
        const next = new Map(prev);
        next.delete(studentId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["class-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, registerDate] });
      queryClient.invalidateQueries({ queryKey: ["owner-activity"] });
      toast.success("Student removed from register");
      setRemoveTarget(null);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to remove student");
      setRemoveTarget(null);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!students?.length || !classId) return;
      const records = buildAttendanceRecords(
        students.map((s) => s.id),
        classId,
        registerDate,
        absences
      );
      const { error } = await supabase.from("attendance_records").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, registerDate] });
      queryClient.invalidateQueries({ queryKey: ["class-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["today-attendance-status"] });
      toast.success("Register saved");

      const unauthorisedIds = getUnauthorisedAbsenceIds(absences);
      if (unauthorisedIds.length > 0 && profile?.school_id) {
        supabase.functions
          .invoke("check-attendance-webhooks", {
            body: { student_ids: unauthorisedIds, school_id: profile.school_id },
          })
          .catch(() => {});
      }
      navigate("/");
    },
    onError: () => {
      toast.error("Failed to save register");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingAttendance?.length || !classId) return;
      const updates = buildAttendanceUpdates(existingAttendance, absences);
      const results = await Promise.all(
        updates.map((u) =>
          supabase.from("attendance_records").update(u.updates).eq("id", u.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, registerDate] });
      queryClient.invalidateQueries({ queryKey: ["class-students", classId] });
      const unauthorisedIds = getUnauthorisedAbsenceIds(absences);
      if (unauthorisedIds.length > 0 && profile?.school_id) {
        supabase.functions
          .invoke("check-attendance-webhooks", {
            body: { student_ids: unauthorisedIds, school_id: profile.school_id },
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

  const enrolledIds = new Set((students ?? []).map((s) => s.id));
  const search = addSearch.trim().toLowerCase();
  const availableStudents = (schoolStudents ?? [])
    .filter((s) => !enrolledIds.has(s.id))
    .filter((s) =>
      !search
        ? true
        : `${s.first_name} ${s.last_name}`.toLowerCase().includes(search)
    )
    .slice(0, 100);

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

        {!isLoading && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {!isLocked ? (
              <div className="flex items-center gap-5 text-[10px] text-muted-foreground tracking-wide">
                <span className="flex items-center gap-1.5"><Check className="h-3 w-3" /> Present</span>
                <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center bg-risk/10 text-risk text-[9px]">A</span> Absent</span>
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-accent" /> Parent notified</span>
              </div>
            ) : <span />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="text-[10px] uppercase tracking-[0.2em]"
            >
              <Plus className="h-3 w-3 mr-1" /> Add Student
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-16 animate-pulse bg-muted/40" />))}
          </div>
        ) : !students?.length ? (
          <div className="bg-card p-12 text-center shadow-[var(--shadow-card)]"><p className="text-sm font-light text-muted-foreground">No students enrolled — tap "Add Student" to add one.</p></div>
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
                          !isLocked ? "hover:opacity-80 active:scale-95" : ""
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
                          if (e.key === "Enter") navigate(`/student/${student.id}`);
                        }}
                        className="cursor-pointer text-sm font-light text-foreground hover:text-accent transition-colors"
                      >
                        {student.first_name} {student.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <StudentIndicators student={student} attendancePercent={percent} />
                      <button
                        onClick={() =>
                          setRemoveTarget({
                            id: student.id,
                            name: `${student.first_name} ${student.last_name}`,
                          })
                        }
                        className="text-muted-foreground/60 hover:text-risk transition-colors p-1"
                        aria-label={`Remove ${student.first_name} ${student.last_name}`}
                        title="Remove from class"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex gap-3">
              {alreadySubmitted && editing ? (
                <>
                  <Button variant="outline" onClick={handleCancelEdit} className="flex-1">Cancel</Button>
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </>
              ) : !alreadySubmitted ? (
                <>
                  <Button variant="outline" onClick={() => navigate("/")} className="flex-1">Cancel</Button>
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
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Add student dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student to Register</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Search students…"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {loadingSchool ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : availableStudents.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {search ? "No matching students" : "All school students are already enrolled."}
              </div>
            ) : (
              availableStudents.map((s) => (
                <button
                  key={s.id}
                  disabled={addStudentMutation.isPending}
                  onClick={() => addStudentMutation.mutate(s.id)}
                  className="w-full flex items-center justify-between px-3 py-3 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span>{s.first_name} {s.last_name}</span>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove student confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from class?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} will be unenrolled from this class and removed from today's register.
              You can re-add them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && removeStudentMutation.mutate(removeTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ClassRegister;
