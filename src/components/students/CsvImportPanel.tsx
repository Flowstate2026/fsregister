import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { parseCsvDate } from "@/lib/csv-date";
import { parseCsvText, splitClassNames } from "@/lib/csv-parse";
import { Download, X } from "lucide-react";
import { toast } from "sonner";

interface CsvStudent {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  join_date?: string;
  class_name?: string;
  parent_email?: string;
}

interface CsvImportPanelProps {
  schoolId: string;
  onClose: () => void;
}

const CsvImportPanel = ({ schoolId, onClose }: CsvImportPanelProps) => {
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStudents, setCsvStudents] = useState<CsvStudent[]>([]);
  const [csvDebugPreview, setCsvDebugPreview] = useState<Array<{
    name: string;
    rawClassName: string;
    parsedClasses: string[];
  }>>([]);

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
      const rows = parseCsvText(text);
      if (rows.length < 2) {
        setCsvStudents([]);
        setCsvDebugPreview([]);
        return;
      }
      const headers = rows[0].map((h) => h.toLowerCase());
      const students = rows.slice(1).map((parts) => {
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

      setCsvDebugPreview(
        students
          .filter((student) => student.class_name)
          .slice(0, 5)
          .map((student) => ({
            name: `${student.first_name} ${student.last_name}`.trim(),
            rawClassName: student.class_name || "",
            parsedClasses: splitClassNames(student.class_name),
          }))
      );
    };
    reader.readAsText(file);
  };

  // Resolve class names to IDs, creating any classes that don't exist yet.
  const resolveClassMap = async (classNames: string[]) => {
    const classMap: Record<string, string> = {};
    if (classNames.length === 0) return classMap;

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
        existingMap[key] = newClass.id;
      }
    }
    return classMap;
  };

  const upsertEnrollments = async (enrollments: { student_id: string; class_id: string }[]) => {
    // Chunk + upsert so a single duplicate or batch limit can't silently drop rows
    const CHUNK = 500;
    let created = 0;
    for (let i = 0; i < enrollments.length; i += CHUNK) {
      const chunk = enrollments.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("class_enrollments")
        .upsert(chunk, { onConflict: "student_id,class_id", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      created += data?.length ?? 0;
    }
    return created;
  };

  const importCsvMutation = useMutation({
    mutationFn: async () => {
      if (csvStudents.length === 0) throw new Error("No students to import");

      const studentClasses: string[][] = csvStudents.map((s) => splitClassNames(s.class_name));
      const classNames = [...new Set(studentClasses.flat())];
      const classMap = await resolveClassMap(classNames);

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
        await upsertEnrollments(enrollments);
      }

      return csvStudents.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} students imported`);
      onClose();
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
      if (csvStudents.length === 0) throw new Error("No rows to process");

      const studentClasses: string[][] = csvStudents.map((s) => splitClassNames(s.class_name));
      const classNames = [...new Set(studentClasses.flat())];
      const classMap = await resolveClassMap(classNames);

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

      const created = await upsertEnrollments(enrollments);
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

  return (
    <div className="mb-8 bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
          Import Students from CSV
        </h3>
        <button onClick={onClose}>
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
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
              {csvStudents.length} student{csvStudents.length !== 1 ? "s" : ""} found
              {csvStudents.some(s => s.class_name) &&
                ` · ${[...new Set(csvStudents.flatMap((s) => splitClassNames(s.class_name)))].length} class(es)`}
            </p>
            {csvDebugPreview.length > 0 && (
              <div className="space-y-1 text-[11px] font-light text-muted-foreground">
                <p className="text-[10px] uppercase tracking-[0.2em]">Parsed class_name preview</p>
                {csvDebugPreview.map((entry) => (
                  <div key={`${entry.name}-${entry.rawClassName}`} className="space-y-0.5 border-l border-border pl-3">
                    <p className="text-foreground">{entry.name}</p>
                    <p>Raw: {entry.rawClassName}</p>
                    <p>Split: {entry.parsedClasses.join(" • ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  );
};

export default CsvImportPanel;
