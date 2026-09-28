import { supabase } from "@/integrations/supabase/client";
import { parseCsvDate } from "@/lib/csv-date";
import { parseCsvText, splitClassNames } from "@/lib/csv-parse";

export interface CsvStudentRow {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  join_date?: string;
  class_name?: string;
  parent_email?: string;
}

const TEMPLATE_CSV =
  "first_name,last_name,date_of_birth,join_date,class_name,parent_email\n" +
  "Emma,Smith,12/03/2015,10/01/2025,Junior Ballet,parent@example.com\n" +
  'Lily,Jones,28/09/2012,10/01/2025,"Jazz Technique, Acro 3, Performance Team",parent2@example.com\n';

export const downloadStudentTemplate = () => {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
};

export const parseStudentsCsv = (text: string): CsvStudentRow[] => {
  const rows = parseCsvText(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.toLowerCase());
  return rows
    .slice(1)
    .map((parts) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = parts[i] || "";
      });
      return {
        first_name: row["first_name"] || "",
        last_name: row["last_name"] || "",
        date_of_birth: parseCsvDate(row["date_of_birth"]),
        join_date: parseCsvDate(row["join_date"]),
        class_name: row["class_name"] || undefined,
        parent_email: row["parent_email"] || undefined,
      };
    })
    .filter((s) => s.first_name);
};

export const readStudentsCsvFile = (file: File): Promise<CsvStudentRow[]> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      resolve(parseStudentsCsv((ev.target?.result as string) || ""));
    };
    reader.readAsText(file);
  });

/** Parse the comma-separated class list for each student row. */
export const parseStudentClasses = (students: CsvStudentRow[]): string[][] =>
  students.map((s) => splitClassNames(s.class_name));

/**
 * Resolve class names to IDs for a school, creating any classes that don't
 * exist yet. Keys are lowercased class names.
 */
export const resolveClassMap = async (
  schoolId: string,
  classNames: string[]
): Promise<Record<string, string>> => {
  const classMap: Record<string, string> = {};
  if (classNames.length === 0) return classMap;

  const { data: existing, error: classErr } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId);
  if (classErr) throw classErr;

  const existingMap: Record<string, string> = {};
  (existing || []).forEach((c) => {
    existingMap[c.name.toLowerCase()] = c.id;
  });

  for (const cn of classNames) {
    const key = cn.toLowerCase();
    if (existingMap[key]) {
      classMap[key] = existingMap[key];
    } else {
      const { data: newClass, error } = await supabase
        .from("classes")
        .insert({ school_id: schoolId, name: cn, day_of_week: 1, time_of_day: "10:00" })
        .select("id")
        .single();
      if (error) throw error;
      classMap[key] = newClass.id;
      existingMap[key] = newClass.id;
    }
  }
  return classMap;
};

/** Build the students-table insert rows for a bulk CSV import. */
export const buildStudentInsertRows = (schoolId: string, students: CsvStudentRow[]) =>
  students.map((s) => ({
    school_id: schoolId,
    first_name: s.first_name,
    last_name: s.last_name,
    bulk_imported: true,
    ...(s.date_of_birth ? { date_of_birth: s.date_of_birth } : {}),
    ...(s.join_date ? { join_date: s.join_date } : {}),
    ...(s.parent_email ? { parent_email: s.parent_email } : {}),
  }));

/**
 * Upsert enrollments in chunks so a single duplicate or batch limit can't
 * silently drop rows. Returns the number of rows written.
 */
export const upsertEnrollments = async (
  enrollments: { student_id: string; class_id: string }[]
): Promise<number> => {
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
