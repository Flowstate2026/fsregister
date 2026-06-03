import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import StudentIndicators from "@/components/StudentIndicators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDayName, formatTime, calculateAttendancePercentage } from "@/lib/student-utils";
import { toast } from "sonner";
import { ArrowLeft, Clock, CalendarDays, Pencil, Save, X, User } from "lucide-react";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface ClassData {
  id: string;
  name: string;
  day_of_week: number;
  time_of_day: string;
  school_id: string;
}

interface EnrolledStudent {
  id: string;
  first_name: string;
  last_name: string;
  join_date: string;
  bulk_imported: boolean;
  attendance: any[];
  notes: any[];
}

const OwnerClassDetail = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { profile, isOwner, loading: authLoading } = useAuth();
  const schoolId = profile?.school_id;

  const [cls, setCls] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editDay, setEditDay] = useState(1);
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);

  const formatT = (t: string) => (t ? t.slice(0, 5) : "");

  const fetchData = async () => {
    if (!classId || !schoolId) return;
    setLoading(true);
    const [{ data: classData }, { data: enrollments }] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, day_of_week, time_of_day, school_id")
        .eq("id", classId)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase
        .from("class_enrollments")
        .select("students(id, first_name, last_name, archived, join_date, bulk_imported)")
        .eq("class_id", classId),
    ]);

    if (classData) {
      setCls(classData);
      setEditDay(classData.day_of_week);
      setEditTime(formatT(classData.time_of_day));
    }
    const list = ((enrollments || [])
      .map((e: any) => e.students)
      .filter((s: any) => s && !s.archived) as EnrolledStudent[])
      .sort((a, b) => a.first_name.localeCompare(b.first_name));

    if (list.length > 0) {
      const studentIds = list.map((s) => s.id);
      const [{ data: attendance }, { data: notes }] = await Promise.all([
        supabase.from("attendance_records").select("*").in("student_id", studentIds),
        supabase.from("student_notes").select("*").in("student_id", studentIds),
      ]);
      const enriched = list.map((s) => ({
        ...s,
        attendance: attendance?.filter((a) => a.student_id === s.id) || [],
        notes: (notes?.filter((n) => n.student_id === s.id) || []).map((n) => ({ ...n, author_name: null })),
      }));
      setStudents(enriched);
    } else {
      setStudents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [classId, schoolId]);

  const handleSave = async () => {
    if (!cls || !editTime.trim()) {
      toast.error("Please enter a time");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("classes")
      .update({ day_of_week: editDay, time_of_day: editTime.trim() })
      .eq("id", cls.id)
      .eq("school_id", schoolId!);
    setSaving(false);
    if (error) {
      toast.error("Failed to update class");
      return;
    }
    toast.success("Class updated");
    setEditing(false);
    fetchData();
  };

  if (!authLoading && !isOwner) return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-2xl mx-auto">
        <button
          onClick={() => navigate("/owner-classes")}
          className="mb-6 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Classes
        </button>

        {loading ? (
          <div className="h-40 animate-pulse bg-muted/40" />
        ) : !cls ? (
          <p className="text-sm text-muted-foreground">Class not found</p>
        ) : (
          <>
            <div className="mb-10">
              <h1 className="font-display text-3xl text-foreground">{cls.name}</h1>

              {editing ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Select value={String(editDay)} onValueChange={(v) => setEditDay(Number(v))}>
                    <SelectTrigger className="h-10 w-40 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-10 w-32 text-sm"
                  />
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditDay(cls.day_of_week); setEditTime(formatT(cls.time_of_day)); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> {getDayName(cls.day_of_week)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {formatTime(cls.time_of_day)}
                  </span>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-4 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
                Enrolled Students ({students.length})
              </h3>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students enrolled</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {students.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/student/${s.id}`)}
                      className="flex w-full items-center gap-3 bg-card px-6 py-4 text-left transition-all hover:bg-secondary/30"
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-sm text-foreground">
                        {s.first_name} {s.last_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default OwnerClassDetail;
