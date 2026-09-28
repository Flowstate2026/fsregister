import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";

export interface RemoveTarget {
  id: string;
  name: string;
}

interface RegisterStudentDialogsProps {
  classId: string | undefined;
  registerDate: string;
  alreadySubmitted: boolean;
  enrolledIds: Set<string>;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  removeTarget: RemoveTarget | null;
  onRemoveTargetChange: (target: RemoveTarget | null) => void;
  onRemoved: (studentId: string) => void;
}

const RegisterStudentDialogs = ({
  classId,
  registerDate,
  alreadySubmitted,
  enrolledIds,
  addOpen,
  onAddOpenChange,
  removeTarget,
  onRemoveTargetChange,
  onRemoved,
}: RegisterStudentDialogsProps) => {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const [addSearch, setAddSearch] = useState("");

  // School students for the "Add Student" picker (loaded when dialog opens)
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
    onError: (e: Error) => {
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
      onRemoved(studentId);
      queryClient.invalidateQueries({ queryKey: ["class-students", classId] });
      queryClient.invalidateQueries({ queryKey: ["existing-attendance", classId, registerDate] });
      queryClient.invalidateQueries({ queryKey: ["owner-activity"] });
      toast.success("Student removed from register");
      onRemoveTargetChange(null);
    },
    onError: (e: Error) => {
      toast.error(e?.message || "Failed to remove student");
      onRemoveTargetChange(null);
    },
  });

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
    <>
      {/* Add student dialog */}
      <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
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
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && onRemoveTargetChange(null)}>
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
    </>
  );
};

export default RegisterStudentDialogs;
