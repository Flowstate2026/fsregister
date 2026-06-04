import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Student = Tables<"students">;
type ClassEnrollment = Tables<"class_enrollments">;
type AttendanceRecord = Tables<"attendance_records">;
type StudentNote = Tables<"student_notes">;
type Profile = Tables<"profiles">;
type ParentReply = Tables<"parent_replies">;

const SUPABASE_BATCH_SIZE = 1000;

async function fetchAllClassEnrollmentStudents(classId: string) {
  const students: Student[] = [];

  for (let from = 0; ; from += SUPABASE_BATCH_SIZE) {
    const to = from + SUPABASE_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("class_enrollments")
      .select("students(*)")
      .eq("class_id", classId)
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    students.push(
      ...data
        .map((enrollment) => enrollment.students as Student | null)
        .filter((student): student is Student => Boolean(student))
    );

    if (data.length < SUPABASE_BATCH_SIZE) break;
  }

  return Array.from(new Map(students.map((student) => [student.id, student])).values());
}

export interface ParentReplyWithNote extends ParentReply {
  note_text?: string | null;
}

export interface StudentWithDetails extends Student {
  attendance: AttendanceRecord[];
  notes: (StudentNote & { author_name?: string | null })[];
  parentReplies?: ParentReplyWithNote[];
  enrollments?: (ClassEnrollment & { classes: { name: string; day_of_week: number; time_of_day: string } | null })[];
  class_enrollments?: (ClassEnrollment & { classes: { name: string } | null })[];
  className?: string;
}

interface UseStudentWithDetailsOptions {
  includeEnrollments?: boolean;
  includeNoteAuthors?: boolean;
}

/**
 * Fetch a single student with their attendance records and notes
 */
export function useStudent(
  studentId: string | undefined,
  options: UseStudentWithDetailsOptions = {}
) {
  const { includeEnrollments = false, includeNoteAuthors = true } = options;

  return useQuery({
    queryKey: ["student", studentId, { includeEnrollments, includeNoteAuthors }],
    queryFn: async () => {
      if (!studentId) throw new Error("No student ID provided");

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (studentError) throw studentError;
      if (!student) throw new Error("Student not found");

      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false });

      const { data: noteRows } = await supabase
        .from("student_notes")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      let notes: (StudentNote & { author_name: string | null })[] = [];

      if (noteRows && noteRows.length > 0 && includeNoteAuthors) {
        const authorIds = [...new Set(noteRows.map((note) => note.author_id))];
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", authorIds);

        const namesByAuthor = new Map(
          (profileRows || []).map((a) => [a.user_id, a.full_name])
        );
        notes = noteRows.map((note) => ({
          ...note,
          author_name: namesByAuthor.get(note.author_id) || null,
        }));
      } else {
        notes = (noteRows || []).map((note) => ({
          ...note,
          author_name: null,
        }));
      }

      let enrollments: (ClassEnrollment & { classes: { name: string } | null })[] = [];
      if (includeEnrollments) {
        const { data: enrollmentData } = await supabase
          .from("class_enrollments")
          .select("*, classes(name, day_of_week, time_of_day)")
          .eq("student_id", studentId);
        enrollments = (enrollmentData || []) as typeof enrollments;
      }

      // Fetch parent replies for any of this student's notes
      const noteIds = (noteRows || []).map((n) => n.id);
      let parentReplies: ParentReplyWithNote[] = [];
      if (noteIds.length > 0) {
        const { data: replyRows } = await supabase
          .from("parent_replies")
          .select("*")
          .in("note_id", noteIds)
          .order("created_at", { ascending: false });
        const noteTextById = new Map(
          (noteRows || []).map((n) => [n.id, n.note_text])
        );
        parentReplies = (replyRows || []).map((r) => ({
          ...r,
          note_text: noteTextById.get(r.note_id) || null,
        }));
      }

      return {
        ...student,
        attendance: attendance || [],
        notes,
        enrollments,
        parentReplies,
      } as StudentWithDetails;
    },
    enabled: !!studentId,
  });
}

/**
 * Fetch multiple students with their details (e.g., for a class register)
 */
export function useStudentsWithDetails(
  studentIds: string[] | undefined,
  options: UseStudentWithDetailsOptions = {}
) {
  const { includeEnrollments = false, includeNoteAuthors = true } = options;

  return useQuery({
    queryKey: ["students", studentIds, { includeEnrollments, includeNoteAuthors }],
    queryFn: async () => {
      if (!studentIds || studentIds.length === 0) return [];

      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", studentIds);

      const { data: noteRows } = await supabase
        .from("student_notes")
        .select("*")
        .in("student_id", studentIds);

      let profileMap = new Map<string, string>();
      if (noteRows && noteRows.length > 0 && includeNoteAuthors) {
        const authorIds = [...new Set(noteRows.map((note) => note.author_id))];
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", authorIds);
        profileMap = new Map(
          (profileRows || []).map((a) => [a.user_id, a.full_name])
        );
      }

      const notesByStudentId = new Map<string, (StudentNote & { author_name: string | null })[]>();
      (noteRows || []).forEach((note) => {
        const key = note.student_id;
        if (!notesByStudentId.has(key)) {
          notesByStudentId.set(key, []);
        }
        notesByStudentId.get(key)!.push({
          ...note,
          author_name: includeNoteAuthors ? profileMap.get(note.author_id) || null : null,
        });
      });

      const attendanceByStudentId = new Map<string, AttendanceRecord[]>();
      (attendance || []).forEach((record) => {
        const key = record.student_id;
        if (!attendanceByStudentId.has(key)) {
          attendanceByStudentId.set(key, []);
        }
        attendanceByStudentId.get(key)!.push(record);
      });

      return studentIds.map((id) => ({
        id,
        attendance: attendanceByStudentId.get(id) || [],
        notes: notesByStudentId.get(id) || [],
      }));
    },
    enabled: !!studentIds && studentIds.length > 0,
  });
}

/**
 * Fetch all students in a class (for ClassRegister)
 */
export function useClassStudents(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-students", classId],
    queryFn: async () => {
      if (!classId) throw new Error("No class ID provided");

      const students = (await fetchAllClassEnrollmentStudents(classId))
        .filter((student) => !student.archived)
        .sort(
        (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
      );

      if (!students.length) return [];

      const studentIds = students.map((s) => s.id);
      const [attendanceResult, notesResult] = await Promise.all([
        supabase.from("attendance_records").select("*").in("student_id", studentIds),
        supabase.from("student_notes").select("*").in("student_id", studentIds),
      ]);

      if (attendanceResult.error) throw attendanceResult.error;
      if (notesResult.error) throw notesResult.error;

      const attendance = attendanceResult.data || [];
      const notes = notesResult.data || [];

      return students.map((student) => ({
        ...student,
        attendance: attendance.filter((a) => a.student_id === student.id),
        notes: notes.filter((n) => n.student_id === student.id),
      })) as StudentWithDetails[];
    },
    enabled: !!classId,
  });
}

/**
 * Fetch all active students (for retention dashboard)
 */
export function useAllStudentsWithDetails() {
  return useQuery({
    queryKey: ["all-students-with-details"],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("students")
        .select("*, class_enrollments(*, classes(name))")
        .eq("archived", false);

      if (error) throw error;

      const studentIds = students?.map((s) => s.id) || [];
      if (!studentIds.length) return [];

      const { data: attendance } = await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", studentIds);

      const { data: notes } = await supabase
        .from("student_notes")
        .select("*")
        .in("student_id", studentIds);

      return students!.map((s) => ({
        ...s,
        attendance: attendance?.filter((a) => a.student_id === s.id) || [],
        notes: (notes?.filter((n) => n.student_id === s.id) || []).map(n => ({ ...n, author_name: null })),
      })) as StudentWithDetails[];
    },
  });
}
