import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  isNewStudent,
  needsNote,
  calculateAttendancePercentage,
  isAtRisk,
} from "@/lib/student-utils";
import { Search, Plus, X, CalendarIcon, Archive } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OwnerStudents = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const schoolId = profile?.school_id;
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
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

  const { data: classes } = useQuery({
    queryKey: ["school-classes", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId!)
        .order("name");
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ["owner-students", schoolId, showArchived],
    queryFn: async () => {
      const { data: studentList } = await supabase
        .from("students")
        .select("*")
        .eq("school_id", schoolId!)
        .eq("archived", showArchived)
        .order("last_name");
      if (!studentList?.length) return [];

      const studentIds = studentList.map((s) => s.id);
      const [{ data: attendance }, { data: notes }] = await Promise.all([
        supabase.from("attendance_records").select("*").in("student_id", studentIds),
        supabase.from("student_notes").select("*").in("student_id", studentIds),
      ]);

      return studentList.map((student) => ({
        ...student,
        attendance: attendance?.filter((a) => a.student_id === student.id) || [],
        notes: notes?.filter((n) => n.student_id === student.id) || [],
      }));
    },
    enabled: !!schoolId,
  });

  const addStudentMutation = useMutation({
    mutationFn: async () => {
      if (!firstName.trim() || !lastName.trim() || !schoolId) throw new Error("Name required");
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
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["owner-students"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const resetForm = () => {
    setShowForm(false);
    setFirstName("");
    setLastName("");
    setDobDay("");
    setDobMonth("");
    setDobYear("");
    setJoinDate(new Date());
    setParentName("");
    setParentEmail("");
    setParentPhone("");
    setMedicalNotes("");
    setSelectedClassIds([]);
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const filtered = (students || []).filter((s) =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="font-display text-3xl text-foreground">
              {showArchived ? "Archived Students" : "Students"}
            </h2>
            <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
              {students?.length ?? 0} {showArchived ? "archived" : "enrolled"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="text-[10px] uppercase tracking-[0.15em]"
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              {showArchived ? "Active" : "Archived"}
            </Button>
            {!showArchived && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(true)}
                className="text-[10px] uppercase tracking-[0.15em]"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </div>
        </div>

        {/* Add Student Form */}
        {showForm && (
          <div className="mb-8 bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
                New Student
              </h3>
              <button onClick={resetForm}>
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
                        className={cn(
                          "w-full justify-start text-left font-normal"
                        )}
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

              {classes && classes.length > 0 && (
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
        )}

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="bg-card p-14 text-center shadow-[var(--shadow-card)]">
            <p className="text-sm font-light text-muted-foreground">
              {search
                ? "No matching students"
                : showArchived
                ? "No archived students"
                : "No students yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((student) => {
              const percent = calculateAttendancePercentage(student.attendance);
              return (
                <button
                  key={student.id}
                  onClick={() => navigate(`/student/${student.id}`)}
                  className="flex w-full items-center justify-between bg-card px-5 py-4 text-left transition-all hover:bg-secondary/30 active:scale-[0.995]"
                >
                  <span className="text-sm font-light text-foreground">
                    {student.first_name} {student.last_name}
                  </span>
                  {!showArchived && (
                    <StudentIndicators
                      student={student}
                      attendancePercent={percent}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default OwnerStudents;
