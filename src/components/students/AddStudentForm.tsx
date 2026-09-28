import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AddStudentFormProps {
  schoolId: string;
  classes: { id: string; name: string }[];
  onClose: () => void;
}

const AddStudentForm = ({ schoolId, classes, onClose }: AddStudentFormProps) => {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [joinDate, setJoinDate] = useState<Date>(new Date());
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const addStudentMutation = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim()) throw new Error("Name required");
      if (!parentEmail.trim()) throw new Error("Parent email is required");

      const { data: student, error } = await supabase
        .from("students")
        .insert({
          school_id: schoolId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dobYear && dobMonth && dobDay ? `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}` : null,
          join_date: format(joinDate, "yyyy-MM-dd"),
          parent_name: parentName.trim() || null,
          parent_email: parentEmail.trim(),
          parent_phone: parentPhone.trim() || null,
          medical_notes: medicalNotes.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (selectedClassIds.length > 0) {
        const enrollments = selectedClassIds.map((classId) => ({
          student_id: student.id,
          class_id: classId,
        }));
        const { error: enrollError } = await supabase
          .from("class_enrollments")
          .insert(enrollments);
        if (enrollError) throw enrollError;
      }

      return student;
    },
    onSuccess: () => {
      toast.success("Student added");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["owner-students"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  return (
    <div className="mb-8 bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
          New Student
        </h3>
        <button onClick={onClose}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
              First Name *
            </label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
              Last Name *
            </label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
              Date of Birth
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <Select
                value={dobDay}
                onValueChange={setDobDay}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={dobMonth}
                onValueChange={setDobMonth}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={dobYear}
                onValueChange={setDobYear}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
              Join Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(joinDate, "d MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={joinDate}
                  onSelect={(d) => d && setJoinDate(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
            Parent / Guardian Name
          </label>
          <Input
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Full name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
              Parent Email *
            </label>
            <Input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@email.com"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
              Parent Phone
            </label>
            <Input
              type="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="+44…"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-1.5">
            Medical Notes / Additional Needs
          </label>
          <textarea
            value={medicalNotes}
            onChange={(e) => setMedicalNotes(e.target.value)}
            rows={3}
            className="flex w-full border-0 border-b border-foreground/20 bg-transparent px-0 py-2 text-base font-light placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-accent transition-colors md:text-sm resize-none"
            placeholder="Allergies, conditions, or other relevant info"
          />
        </div>

        {classes.length > 0 && (
          <div>
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
              Enrol in Classes
            </label>
            <div className="space-y-2">
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className="flex items-center gap-2.5 cursor-pointer py-1"
                >
                  <Checkbox
                    checked={selectedClassIds.includes(cls.id)}
                    onCheckedChange={() => toggleClass(cls.id)}
                  />
                  <span className="text-sm font-light text-foreground">
                    {cls.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={() => addStudentMutation.mutate()}
          disabled={!firstName.trim() || !lastName.trim() || !parentEmail.trim() || addStudentMutation.isPending}
          className="w-full"
        >
          {addStudentMutation.isPending ? "Adding…" : "Add Student"}
        </Button>
      </div>
    </div>
  );
};

export default AddStudentForm;
