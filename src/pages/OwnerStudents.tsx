import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import CsvImportPanel from "@/components/students/CsvImportPanel";
import AddStudentForm from "@/components/students/AddStudentForm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateAttendancePercentage } from "@/lib/student-utils";
import { Search, Plus, Archive, Upload } from "lucide-react";

const OwnerStudents = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const schoolId = profile?.school_id;
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

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

        {showImport && schoolId && (
          <CsvImportPanel schoolId={schoolId} onClose={() => setShowImport(false)} />
        )}

        {showForm && schoolId && (
          <AddStudentForm
            schoolId={schoolId}
            classes={classes || []}
            onClose={() => setShowForm(false)}
          />
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
