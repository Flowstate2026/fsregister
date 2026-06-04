import { useState } from "react";
import { parseCsvDate } from "@/lib/csv-date";
import { parseCsvText } from "@/lib/csv-parse";

export interface OnboardingState {
  // GDPR step
  privacyAccepted: boolean;
  lawfulBasisConfirmed: boolean;

  // School details step
  schoolName: string;
  logoFile: File | null;
  logoPreview: string | null;

  // First class step
  className: string;
  classDay: number;
  classTime: string;

  // Invite teacher step
  teacherName: string;
  teacherEmail: string;

  // Add students step
  csvFile: File | null;
  csvStudents: StudentCSVRow[];
}

export interface StudentCSVRow {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  join_date?: string;
  class_name?: string;
  parent_email?: string;
}

export function useOnboardingState() {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [lawfulBasisConfirmed, setLawfulBasisConfirmed] = useState(false);

  const [schoolName, setSchoolName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [className, setClassName] = useState("");
  const [classDay, setClassDay] = useState(1);
  const [classTime, setClassTime] = useState("10:00");

  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStudents, setCsvStudents] = useState<StudentCSVRow[]>([]);

  const handleLogoSelect = (file: File | null) => {
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleCsvSelect = (file: File | null) => {
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsvText(text);
      if (rows.length < 2) {
        setCsvStudents([]);
        return;
      }

      const headers = rows[0].map((h) => h.toLowerCase());

      const students = rows
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

      setCsvStudents(students);
    };
    reader.readAsText(file);
  };

  return {
    // GDPR
    privacyAccepted,
    setPrivacyAccepted,
    lawfulBasisConfirmed,
    setLawfulBasisConfirmed,

    // School
    schoolName,
    setSchoolName,
    logoFile,
    logoPreview,
    handleLogoSelect,

    // Class
    className,
    setClassName,
    classDay,
    setClassDay,
    classTime,
    setClassTime,

    // Teacher
    teacherName,
    setTeacherName,
    teacherEmail,
    setTeacherEmail,

    // Students
    csvFile,
    csvStudents,
    handleCsvSelect,
  };
}
