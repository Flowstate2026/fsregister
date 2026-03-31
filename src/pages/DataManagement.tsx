import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Trash2, Search, AlertTriangle } from "lucide-react";

export default function DataManagement() {
  const { isOwner, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [erasureTarget, setErasureTarget] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["all-students-data"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("archived", false).order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const handleExportAll = async () => {
    setExporting(true);
    try {
      // Fetch all data
      const [studentsRes, attendanceRes, notesRes, enrollmentsRes, classesRes] = await Promise.all([
        supabase.from("students").select("*"),
        supabase.from("attendance_records").select("*"),
        supabase.from("student_notes").select("*"),
        supabase.from("class_enrollments").select("*"),
        supabase.from("classes").select("*"),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        school_id: profile?.school_id,
        students: studentsRes.data || [],
        attendance_records: attendanceRes.data || [],
        student_notes: notesRes.data || [],
        class_enrollments: enrollmentsRes.data || [],
        classes: classesRes.data || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fs-register-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (err) {
      toast.error("Export failed: " + (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.from("students").select("*").eq("archived", false);
      if (error) throw error;

      const headers = ["first_name", "last_name", "date_of_birth", "join_date", "parent_email"];
      const rows = (data || []).map(s => headers.map(h => (s as any)[h] ?? "").join(","));
      const csv = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Student CSV exported");
    } catch (err) {
      toast.error("Export failed: " + (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleErasure = async (studentId: string, studentName: string) => {
    if (confirmName.toLowerCase() !== studentName.toLowerCase()) {
      toast.error("Name does not match. Please type the student's full name to confirm.");
      return;
    }
    try {
      const { error } = await supabase.rpc("anonymise_student", { _student_id: studentId });
      if (error) throw error;
      toast.success("Student data has been anonymised");
      setErasureTarget(null);
      setConfirmName("");
      // Refetch
      window.location.reload();
    } catch (err) {
      toast.error("Erasure failed: " + (err as Error).message);
    }
  };

  if (!isOwner) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-light">Only school owners can access data management.</p>
        </div>
      </AppLayout>
    );
  }

  const filtered = students?.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-12">
          <h2 className="font-display text-3xl text-foreground">Data Management</h2>
          <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">GDPR · Export · Right to Erasure</p>
        </div>

        {/* Data Export */}
        <section className="mb-14">
          <h3 className="mb-5 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">Data Export (Portability)</h3>
          <div className="bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
            <p className="text-sm font-light text-foreground/80">
              Download a complete copy of all your school's data. This includes students, attendance records, notes, classes, and enrolments.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleExportAll} disabled={exporting} variant="outline" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export All (JSON)"}
              </Button>
              <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                {exporting ? "Exporting…" : "Export Students (CSV)"}
              </Button>
            </div>
          </div>
        </section>

        {/* Right to Erasure */}
        <section className="mb-14">
          <h3 className="mb-5 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">Right to Erasure</h3>
          <div className="bg-card p-6 shadow-[var(--shadow-card)] space-y-5">
            <div className="flex items-start gap-3 text-sm font-light text-foreground/80 bg-secondary/30 p-4 rounded-sm">
              <AlertTriangle className="h-4 w-4 text-risk mt-0.5 shrink-0" />
              <p>Anonymising a student permanently removes their personal data (name, date of birth, parent email) and deletes all notes and class enrolments. Attendance records are preserved with anonymised identifiers for aggregate reporting. <strong className="font-medium text-foreground">This action cannot be undone.</strong></p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search students…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {searchTerm && (
              <div className="divide-y divide-border/40">
                {filtered.map((s) => {
                  const fullName = `${s.first_name} ${s.last_name}`;
                  const isTarget = erasureTarget === s.id;
                  return (
                    <div key={s.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-foreground">{fullName}</span>
                          {s.parent_email && <span className="ml-3 text-[11px] text-muted-foreground">{s.parent_email}</span>}
                        </div>
                        {!isTarget && (
                          <Button variant="ghost" size="sm" className="text-risk text-[10px] uppercase tracking-[0.15em]" onClick={() => setErasureTarget(s.id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Erase
                          </Button>
                        )}
                      </div>
                      {isTarget && (
                        <div className="mt-4 space-y-3 bg-secondary/20 p-4 rounded-sm">
                          <p className="text-xs font-light text-foreground/80">
                            Type <strong className="font-medium text-foreground">{fullName}</strong> to confirm erasure:
                          </p>
                          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={fullName} />
                          <div className="flex gap-3">
                            <Button size="sm" variant="destructive" onClick={() => handleErasure(s.id, fullName)} disabled={confirmName.toLowerCase() !== fullName.toLowerCase()}>
                              Confirm Erasure
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setErasureTarget(null); setConfirmName(""); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!filtered.length && <p className="py-4 text-[11px] text-muted-foreground font-light">No students found</p>}
              </div>
            )}
          </div>
        </section>

        {/* Links */}
        <section>
          <h3 className="mb-5 text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">Legal Documents</h3>
          <div className="bg-card p-6 shadow-[var(--shadow-card)] space-y-3">
            <a href="/privacy-policy" className="block text-sm text-accent underline underline-offset-2 hover:text-accent/80 transition-colors">Privacy Policy →</a>
            <a href="/dpa" className="block text-sm text-accent underline underline-offset-2 hover:text-accent/80 transition-colors">Data Processing Agreement →</a>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
