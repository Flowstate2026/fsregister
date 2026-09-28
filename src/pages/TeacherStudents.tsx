import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Input } from "@/components/ui/input";
import {
  isNewStudent,
  needsNote,
  calculateAttendancePercentage,
  isAtRisk,
} from "@/lib/student-utils";
import { Search } from "lucide-react";

const TeacherStudents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: students, isLoading } = useQuery({
    queryKey: ["teacher-students", user?.id],
    queryFn: async () => {
      // Every active student in the school (RLS scopes by school_id).
      // Paginate and avoid huge `.in()` id lists, which overflow URL limits.
      const fetchAll = async <T,>(
        build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
      ) => {
        const rows: T[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await build(from, from + 999);
          if (error) throw error;
          if (!data?.length) break;
          rows.push(...data);
          if (data.length < 1000) break;
        }
        return rows;
      };

      const studentList = await fetchAll((f, t) =>
        supabase.from("students").select("*").eq("archived", false).order("last_name").order("id").range(f, t)
      );
      if (!studentList.length) return [];

      const [attendance, notes] = await Promise.all([
        fetchAll((f, t) => supabase.from("attendance_records").select("*").order("id").range(f, t)),
        fetchAll((f, t) => supabase.from("student_notes").select("*").order("id").range(f, t)),
      ]);

      const byStudent = <R extends { student_id: string }>(list: R[]) => {
        const m = new Map<string, R[]>();
        for (const r of list) (m.get(r.student_id) ?? m.set(r.student_id, []).get(r.student_id)!).push(r);
        return m;
      };
      const attBy = byStudent(attendance);
      const notesBy = byStudent(notes);

      return studentList.map((student) => ({
        ...student,
        attendance: attBy.get(student.id) || [],
        notes: notesBy.get(student.id) || [],
      }));
    },
    enabled: !!user,
  });

  const filtered = (students || []).filter((s) =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-8">
          <h2 className="font-display text-3xl text-foreground">Students</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            {students?.length ?? 0} enrolled
          </p>
        </div>

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
              {search ? "No matching students" : "No students found"}
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
                  <span className="flex items-center gap-2 text-sm font-light text-foreground">
                    {student.first_name} {student.last_name}
                    <StudentIndicators
                      student={student}
                      attendancePercent={percent}
                    />
                  </span>
                  <StudentIndicators
                    student={student}
                    attendancePercent={percent}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TeacherStudents;
