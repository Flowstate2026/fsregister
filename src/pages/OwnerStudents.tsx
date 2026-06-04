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
import { Search, Plus, X, CalendarIcon, Archive, Upload, Download } from "lucide-react";
import { parseCsvDate } from "@/lib/csv-date";
import { parseCsvLine } from "@/lib/csv-parse";
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
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStudents, setCsvStudents] = useState<Array<{
    first_name: string;
    last_name: string;
    date_of_birth?: string;
    join_date?: string;
    class_name?: string;
    parent_email?: string;
  }>>([]);

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

  const resetImport = () => {
    setShowImport(false);
    setCsvFile(null);
    setCsvStudents([]);
  };

  const downloadTemplate = () => {
    const csv = "first_name,last_name,date_of_birth,join_date,class_name,parent_email\nEmma,Smith,12/03/2015,10/01/2025,Junior Ballet,parent@example.com\nLily,Jones,28/09/2012,10/01/2025,\"Jazz Technique, Acro 3, Performance Team\",parent2@example.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "student_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) { setCsvStudents([]); return; }
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const students = lines.slice(1).map((line) => {
        const parts = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = parts[i] || ""; });
        return {
          first_name: row["first_name"] || "",
          last_name: row["last_name"] || "",
          date_of_birth: parseCsvDate(row["date_of_birth"]),
          join_date: parseCsvDate(row["join_date"]),
          class_name: row["class_name"] || undefined,
          parent_email: row["parent_email"] || undefined,
        };
      }).filter((s) => s.first_name);
      setCsvStudents(students);
    };
    reader.readAsText(file);
  };

  const importCsvMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");
      if (csvStudents.length === 0) throw new Error("No students to import");

      const studentClasses: string[][] = csvStudents.map((s) =>
        (s.class_name || "").split(",").map((c) => c.trim()).filter(Boolean)
      );
      const classNames = [...new Set(studentClasses.flat())];
      const classMap: Record<string, string> = {};

      if (classNames.length > 0) {
        const { data: existing } = await supabase
          .from("classes").select("id, name").eq("school_id", schoolId);
        const existingMap: Record<string, string> = {};
        (existing || []).forEach((c) => { existingMap[c.name.toLowerCase()] = c.id; });
        for (const cn of classNames) {
          const key = cn.toLowerCase();
          if (existingMap[key]) {
            classMap[key] = existingMap[key];
          } else {
            const { data: newClass, error } = await supabase
              .from("classes")
              .insert({ school_id: schoolId, name: cn, day_of_week: 1, time_of_day: "10:00" })
              .select("id").single();
            if (error) throw error;
            classMap[key] = newClass.id;
            existingMap[key] = newClass.id;
          }
        }
      }

      const rows = csvStudents.map((s) => ({
        school_id: schoolId,
        first_name: s.first_name,
        last_name: s.last_name,
        bulk_imported: true,
        ...(s.date_of_birth ? { date_of_birth: s.date_of_birth } : {}),
        ...(s.join_date ? { join_date: s.join_date } : {}),
        ...(s.parent_email ? { parent_email: s.parent_email } : {}),
      }));
      const { data: inserted, error } = await supabase
        .from("students").insert(rows).select("id");
      if (error) throw error;

      if (inserted) {
        const enrollments: { student_id: string; class_id: string }[] = [];
        studentClasses.forEach((classes, i) => {
          if (!inserted[i]) return;
          classes.forEach((cn) => {
            const classId = classMap[cn.toLowerCase()];
            if (classId) enrollments.push({ student_id: inserted[i].id, class_id: classId });
          });
        });
        // Chunk + upsert so a single duplicate or batch limit can't silently drop rows
        const CHUNK = 500;
        for (let i = 0; i < enrollments.length; i += CHUNK) {
          const chunk = enrollments.slice(i, i + CHUNK);
          const { error: enrollErr } = await supabase
            .from("class_enrollments")
            .upsert(chunk, { onConflict: "student_id,class_id", ignoreDuplicates: true });
          if (enrollErr) throw enrollErr;
        }
      }

      return csvStudents.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} students imported`);
      resetImport();
      queryClient.invalidateQueries({ queryKey: ["owner-students"] });
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  // Re-sync enrolments from the CSV without re-importing students.
  // Matches existing students by first_name + last_name (case-insensitive) within
  // this school and upserts any missing rows into class_enrollments.
  const syncEnrollmentsMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");
      if (csvStudents.length === 0) throw new Error("No rows to process");

      const studentClasses: string[][] = csvStudents.map((s) =>
        (s.class_name || "").split(",").map((c) => c.trim()).filter(Boolean)
      );
      const classNames = [...new Set(studentClasses.flat())];
      const classMap: Record<string, string> = {};

      if (classNames.length > 0) {
        const { data: existing, error: classErr } = await supabase
          .from("classes").select("id, name").eq("school_id", schoolId);
        if (classErr) throw classErr;
        const existingMap: Record<string, string> = {};
        (existing || []).forEach((c) => { existingMap[c.name.toLowerCase()] = c.id; });
        for (const cn of classNames) {
          const key = cn.toLowerCase();
          if (existingMap[key]) {
            classMap[key] = existingMap[key];
          } else {
            const { data: newClass, error } = await supabase
              .from("classes")
              .insert({ school_id: schoolId, name: cn, day_of_week: 1, time_of_day: "10:00" })
              .select("id").single();
            if (error) throw error;
            classMap[key] = newClass.id;
          }
        }
      }

      // Page through all students in school
      const allStudents: { id: string; first_name: string; last_name: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("students").select("id, first_name, last_name")
          .eq("school_id", schoolId).range(from, from + 999);
        if (error) throw error;
        if (!data?.length) break;
        allStudents.push(...data);
        if (data.length < 1000) break;
      }
      const idByName = new Map<string, string>();
      allStudents.forEach((s) =>
        idByName.set(`${s.first_name.toLowerCase().trim()}|${s.last_name.toLowerCase().trim()}`, s.id)
      );

      const enrollments: { student_id: string; class_id: string }[] = [];
      let missing = 0;
      csvStudents.forEach((s, i) => {
        const key = `${s.first_name.toLowerCase().trim()}|${s.last_name.toLowerCase().trim()}`;
        const sid = idByName.get(key);
        if (!sid) { missing++; return; }
        studentClasses[i].forEach((cn) => {
          const classId = classMap[cn.toLowerCase()];
          if (classId) enrollments.push({ student_id: sid, class_id: classId });
        });
      });

      let created = 0;
      const CHUNK = 500;
      for (let i = 0; i < enrollments.length; i += CHUNK) {
        const chunk = enrollments.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("class_enrollments")
          .upsert(chunk, { onConflict: "student_id,class_id", ignoreDuplicates: true })
          .select("id");
        if (error) throw error;
        created += data?.length ?? 0;
      }

      return { processed: enrollments.length, created, missing };
    },
    onSuccess: (r) => {
      toast.success(
        `Synced ${r.processed} enrolments — ${r.created} new${r.missing ? `, ${r.missing} students not matched` : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["owner-students"] });
      queryClient.invalidateQueries({ queryKey: ["class-students"] });
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImport(true)}
              className="text-[10px] uppercase tracking-[0.15em]"
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
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

        {/* Import CSV Panel */}
        {showImport && (
          <div className="mb-8 bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
                Import Students from CSV
              </h3>
              <button onClick={resetImport}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-light text-muted-foreground">
                Columns: first_name, last_name, date_of_birth, join_date, class_name, parent_email.
                Dates use DD/MM/YYYY. Classes will be created if they don't exist. To enrol in multiple classes, wrap them in quotes and separate with commas, e.g. "Jazz, Acro 3, Performance Team".
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-accent hover:underline"
              >
                <Download className="h-3 w-3" /> Download template
              </button>
              <label className="block">
                <div className="flex items-center justify-center border border-dashed border-foreground/20 px-4 py-6 cursor-pointer hover:border-accent transition-colors">
                  <span className="text-sm font-light text-muted-foreground">
                    {csvFile ? csvFile.name : "Choose CSV file"}
                  </span>
                </div>
                <input type="file" accept=".csv" className="hidden" onChange={handleCsvSelect} />
              </label>
              {csvStudents.length > 0 && (
                <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  {csvStudents.length} student{csvStudents.length !== 1 ? "s" : ""} found
                  {csvStudents.some(s => s.class_name) &&
                    ` · ${[...new Set(csvStudents.map(s => s.class_name).filter(Boolean))].length} class(es)`}
                </p>
              )}
              <Button
                onClick={() => importCsvMutation.mutate()}
                disabled={csvStudents.length === 0 || importCsvMutation.isPending || syncEnrollmentsMutation.isPending}
                className="w-full"
              >
                {importCsvMutation.isPending ? "Importing…" : csvStudents.length > 0 ? `Import ${csvStudents.length} Students` : "Import"}
              </Button>
              <Button
                variant="outline"
                onClick={() => syncEnrollmentsMutation.mutate()}
                disabled={csvStudents.length === 0 || importCsvMutation.isPending || syncEnrollmentsMutation.isPending}
                className="w-full"
              >
                {syncEnrollmentsMutation.isPending ? "Syncing…" : "Sync Enrolments Only (skip creating students)"}
              </Button>
              <p className="text-[11px] font-light text-muted-foreground">
                Use "Sync Enrolments Only" to repair missing class enrolments for students that already exist. Matches by first &amp; last name within this school.
              </p>
            </div>
          </div>
        )}

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
