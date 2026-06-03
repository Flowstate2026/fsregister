import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, School, Users, GraduationCap, CheckCircle2, ArrowRight, ArrowLeft, SkipForward, ShieldCheck } from "lucide-react";
import { parseCsvDate } from "@/lib/csv-date";

const STEPS = [
  { label: "GDPR", icon: ShieldCheck },
  { label: "School Details", icon: School },
  { label: "First Class", icon: GraduationCap },
  { label: "Invite Teacher", icon: Users },
  { label: "Add Students", icon: Upload },
  { label: "All Set", icon: CheckCircle2 },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // GDPR state
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [lawfulBasisConfirmed, setLawfulBasisConfirmed] = useState(false);

  // Step 1 state
  const [schoolName, setSchoolName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 2 state
  const [className, setClassName] = useState("");
  const [classDay, setClassDay] = useState(1);
  const [classTime, setClassTime] = useState("10:00");

  // Step 3 state
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");

  // Step 4 state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvStudents, setCsvStudents] = useState<{
    first_name: string; last_name: string; date_of_birth?: string;
    join_date?: string; class_name?: string; parent_email?: string;
  }[]>([]);

  const schoolId = profile?.school_id;
  const progress = ((step + 1) / STEPS.length) * 100;

  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleGdprAccept = async () => {
    if (!privacyAccepted || !lawfulBasisConfirmed) {
      toast.error("Please accept both checkboxes to continue");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("gdpr_consent_records" as any).insert({
        user_id: user.id,
        user_email: user.email || "",
        school_id: schoolId || null,
        privacy_policy_accepted: true,
        lawful_basis_confirmed: true,
      });
      if (error) throw error;
      setStep(1);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep1 = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${schoolId}/logo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("school-logos")
          .upload(path, logoFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: publicData } = supabase.storage
          .from("school-logos")
          .getPublicUrl(path);
        logoUrl = publicData.publicUrl;
      }

      const updates: { name?: string; logo_url?: string } = {};
      if (schoolName.trim()) updates.name = schoolName.trim();
      if (logoUrl) updates.logo_url = logoUrl;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("schools")
          .update(updates)
          .eq("id", schoolId);
        if (error) throw error;
      }

      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!schoolId || !className.trim()) {
      toast.error("Please enter a class name");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("classes").insert({
        school_id: schoolId,
        name: className.trim(),
        day_of_week: classDay,
        time_of_day: classTime,
      });
      if (error) throw error;
      toast.success("Class created");
      setStep(3);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    if (!schoolId || !user) {
      setStep(4);
      return;
    }
    if (!teacherEmail.trim() || !teacherName.trim()) {
      toast.error("Please enter teacher name and email");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-teacher", {
        body: {
          email: teacherEmail.trim(),
          full_name: teacherName.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Teacher invited");
      setStep(4);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = useCallback(() => {
    const csv = "first_name,last_name,date_of_birth,join_date,class_name,parent_email\nEmma,Smith,12/03/2015,10/01/2025,Junior Ballet,parent@example.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "student_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) { setCsvStudents([]); return; }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const students = lines.slice(1).map((line) => {
        const parts = line.split(",").map((s) => s.trim().replace(/"/g, ""));
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

  const handleStep4 = async () => {
    if (!schoolId) return;
    if (csvStudents.length === 0) { setStep(5); return; }
    setLoading(true);
    try {
      // Parse comma-separated class names per student
      const studentClasses: string[][] = csvStudents.map((s) =>
        (s.class_name || "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      );

      // Collect unique class names and ensure they exist
      const classNames = [...new Set(studentClasses.flat())];
      const classMap: Record<string, string> = {};

      if (classNames.length > 0) {
        const { data: existing } = await supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", schoolId);

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
              .select("id")
              .single();
            if (error) throw error;
            classMap[key] = newClass.id;
            existingMap[key] = newClass.id;
          }
        }
      }

      // Insert students
      const rows = csvStudents.map((s) => ({
        school_id: schoolId,
        first_name: s.first_name,
        last_name: s.last_name,
        ...(s.date_of_birth ? { date_of_birth: s.date_of_birth } : {}),
        ...(s.join_date ? { join_date: s.join_date } : {}),
        ...(s.parent_email ? { parent_email: s.parent_email } : {}),
      }));
      const { data: inserted, error } = await supabase.from("students").insert(rows).select("id, first_name, last_name");
      if (error) throw error;

      // Create class enrollments (one per student/class pair)
      if (inserted) {
        const enrollments: { student_id: string; class_id: string }[] = [];
        studentClasses.forEach((classes, i) => {
          if (!inserted[i]) return;
          classes.forEach((cn) => {
            const classId = classMap[cn.toLowerCase()];
            if (classId) {
              enrollments.push({ student_id: inserted[i].id, class_id: classId });
            }
          });
        });
        if (enrollments.length > 0) {
          const { error: enrollErr } = await supabase.from("class_enrollments").insert(enrollments);
          if (enrollErr) console.error("Enrollment error:", enrollErr);
        }
      }


      toast.success(`${csvStudents.length} students added`);
      setStep(5);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress header */}
      <div className="w-full max-w-2xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
                  i <= step
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <s.icon className="w-4 h-4" />
              </div>
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1 bg-secondary" />
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-6 pt-6 pb-16">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 sm:p-10">
            {/* STEP 0: GDPR Consent */}
            {step === 0 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl mb-2 font-semibold tracking-tight">Privacy & Data Protection</h1>
                  <p className="text-sm text-muted-foreground font-light">
                    Before we get started, please review and accept our data protection terms.
                  </p>
                </div>

                <div className="rounded-sm bg-secondary/30 p-5 space-y-4 text-sm text-foreground/80 font-light leading-relaxed max-h-64 overflow-y-auto">
                  <p className="font-medium text-foreground">FS Register Privacy Policy & Data Processing Agreement — Summary</p>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>FS Register processes student names, dates of birth, attendance records, parent contact details, and teacher information on behalf of your school.</li>
                    <li>Your school remains the Data Controller. FS Register acts as a Data Processor under the terms of our Data Processing Agreement.</li>
                    <li>All data is stored securely with encryption at rest and in transit. Data is hosted within the EU/UK region.</li>
                    <li>Student and parent data is used solely for the purpose of class management, attendance tracking, and school communications.</li>
                    <li>Data is retained for the duration of the school's active account. Schools may request data export or deletion at any time.</li>
                    <li>FS Register does not sell, share, or use personal data for marketing or any purpose beyond the agreed service.</li>
                    <li>Parents and students have the right to access, rectify, and request deletion of their personal data through the school.</li>
                  </ul>

                  <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                    <p className="font-medium text-foreground">Important notices</p>
                    <div className="space-y-2">
                      <p className="text-xs"><span className="font-medium text-foreground">Children's data:</span> FS Register processes personal data of children. Under UK GDPR / GDPR Article 8, you must ensure you have appropriate parental consent or a lawful basis (such as legitimate interest) documented before sharing children's data with FS Register.</p>
                      <p className="text-xs"><span className="font-medium text-foreground">Sub-processors:</span> FS Register uses Lovable Cloud (hosted infrastructure) and Supabase (database and authentication) as sub-processors. Both are GDPR-compliant and process data within the EU/UK region.</p>
                      <p className="text-xs"><span className="font-medium text-foreground">Data location:</span> All data is stored and processed within the European Union and United Kingdom.</p>
                      <p className="text-xs"><span className="font-medium text-foreground">Breach notification:</span> In the event of a personal data breach, FS Register will notify affected schools within 72 hours as required by GDPR Article 33.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
                  >
                    Read the full Privacy Policy →
                  </a>
                  <a
                    href="/dpa"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent underline underline-offset-2 hover:text-accent/80 transition-colors ml-4"
                  >
                    Data Processing Agreement →
                  </a>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="privacy-accept"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="privacy-accept" className="text-sm font-light leading-snug cursor-pointer">
                      I confirm I have read and agree to the FS Register Privacy Policy and Data Processing Agreement
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="lawful-basis"
                      checked={lawfulBasisConfirmed}
                      onCheckedChange={(checked) => setLawfulBasisConfirmed(checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="lawful-basis" className="text-sm font-light leading-snug cursor-pointer">
                      I confirm I have a lawful basis for sharing student and parent data with FS Register and have provided appropriate privacy notices to parents
                    </label>
                  </div>
                </div>

                <Button
                  onClick={handleGdprAccept}
                  disabled={loading || !privacyAccepted || !lawfulBasisConfirmed}
                  className="w-full"
                >
                  {loading ? "Saving…" : "Accept & Continue"} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* STEP 1: School Details */}
            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl mb-2">School Details</h1>
                  <p className="text-sm text-muted-foreground font-light">
                    Confirm your school name and upload a logo.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                      School Name
                    </label>
                    <Input
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder={profile?.school_id ? "Your school name" : ""}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                      Logo
                    </label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-16 h-16 object-contain rounded" />
                      ) : (
                        <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <span className="text-xs text-accent underline underline-offset-2">Choose file</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                      </label>
                    </div>
                  </div>
                </div>

                <Button onClick={handleStep1} disabled={loading} className="w-full">
                  {loading ? "Saving…" : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* STEP 1: First Class */}
            {step === 2 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl mb-2">Add Your First Class</h1>
                  <p className="text-sm text-muted-foreground font-light">
                    Set up one class to get started. You can add more later.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                      Class Name
                    </label>
                    <Input
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      placeholder="e.g. Junior Ballet"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                        Day
                      </label>
                      <select
                        value={classDay}
                        onChange={(e) => setClassDay(Number(e.target.value))}
                        className="w-full h-11 border-0 border-b border-foreground/20 bg-transparent px-0 py-2 text-sm font-light focus:outline-none focus:border-accent"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <option key={d} value={d}>{dayNames[d]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                        Time
                      </label>
                      <Input
                        type="time"
                        value={classTime}
                        onChange={(e) => setClassTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleStep2} disabled={loading} className="flex-1">
                    {loading ? "Creating…" : "Create Class"} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Invite Teacher */}
            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl mb-2">Invite Your First Teacher</h1>
                  <p className="text-sm text-muted-foreground font-light">
                    Add a teacher to help manage your classes, or skip for now.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                      Teacher Name
                    </label>
                    <Input
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      placeholder="teacher@example.com"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleStep3} disabled={loading} className="flex-1">
                    {loading ? "Saving…" : teacherName ? "Send Invite" : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <button
                  onClick={() => setStep(4)}
                  className="w-full text-xs text-muted-foreground hover:text-accent flex items-center justify-center gap-1 transition-colors"
                >
                  <SkipForward className="w-3 h-3" /> Skip for now
                </button>
              </div>
            )}

            {/* STEP 3: Add Students */}
            {step === 4 && (
              <div className="space-y-8">
                <div>
                  <h1 className="text-2xl mb-2">Add Students</h1>
                  <p className="text-sm text-muted-foreground font-light">
                    Upload a CSV with your student list, or skip and add them later.
                  </p>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={downloadTemplate}
                    className="w-full flex items-center justify-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors py-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Download CSV template
                  </button>

                  <div className="rounded-sm bg-secondary/50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-1">Required columns</p>
                    <p className="text-xs text-foreground/70 font-light">first_name, last_name</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-1 mt-3">Optional columns</p>
                    <p className="text-xs text-foreground/70 font-light">date_of_birth, join_date, class_name, parent_email</p>
                  </div>

                  <label className="block cursor-pointer">
                    <div className="border border-dashed border-foreground/20 rounded-sm p-8 text-center hover:border-accent transition-colors">
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {csvFile ? csvFile.name : "Choose CSV file"}
                      </span>
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={handleCsvSelect} />
                  </label>

                  {csvStudents.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {csvStudents.length} student{csvStudents.length !== 1 ? "s" : ""} found
                      {csvStudents.some(s => s.class_name) && ` · ${[...new Set(csvStudents.map(s => s.class_name).filter(Boolean))].length} class(es)`}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleStep4} disabled={loading} className="flex-1">
                    {loading ? "Adding…" : csvStudents.length > 0 ? `Add ${csvStudents.length} Students` : "Continue"}{" "}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <button
                  onClick={() => setStep(5)}
                  className="w-full text-xs text-muted-foreground hover:text-accent flex items-center justify-center gap-1 transition-colors"
                >
                  <SkipForward className="w-3 h-3" /> Skip for now
                </button>
              </div>
            )}

            {/* STEP 4: Complete */}
            {step === 5 && (
              <div className="space-y-8 text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-accent" />
                </div>
                <div>
                  <h1 className="text-2xl mb-3">You're All Set</h1>
                  <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto">
                    Your school is ready. You can manage classes, take registers, and track attendance from your dashboard.
                  </p>
                </div>
                <Button onClick={() => navigate("/")} className="w-full">
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
