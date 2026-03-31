import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Mail, CheckCircle2, Clock, Users, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Invite {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  accepted_at: string | null;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
}

export default function Settings() {
  const { user, profile } = useAuth();
  const schoolId = profile?.school_id;

  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const fetchData = async () => {
    if (!schoolId) return;

    const [{ data: inviteData }, { data: profileData }] = await Promise.all([
      supabase
        .from("teacher_invites")
        .select("id, full_name, email, created_at, accepted_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("school_id", schoolId),
    ]);

    setInvites(inviteData || []);

    // Filter out the current user (owner) from the teacher list
    const otherProfiles = (profileData || []).filter(
      (p) => p.id !== profile?.id
    );
    setTeachers(otherProfiles);
  };

  useEffect(() => {
    fetchData();
  }, [schoolId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId || !user) return;
    if (!teacherName.trim() || !teacherEmail.trim()) {
      toast.error("Please enter name and email");
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
      toast.success("Teacher invited — they'll receive a password reset email");
      setTeacherName("");
      setTeacherEmail("");
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-teacher", {
        body: { profile_id: teacher.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${teacher.full_name} has been removed`);
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvite = async (invite: Invite) => {
    try {
      const { error } = await supabase
        .from("teacher_invites")
        .delete()
        .eq("id", invite.id);
      if (error) throw error;
      toast.success(`Invite for ${invite.full_name} removed`);
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-10">
        <div>
          <h1 className="font-display text-2xl text-foreground">Settings</h1>
          <p className="mt-1 text-xs text-muted-foreground tracking-wide">
            Manage your school and team
          </p>
        </div>

        {/* Invite Teacher */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2 text-foreground">
              <UserPlus className="w-4 h-4" />
              <h2 className="text-sm font-medium uppercase tracking-[0.15em]">
                Invite a Teacher
              </h2>
            </div>

            <form onSubmit={handleInvite} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block mb-2">
                  Full Name
                </label>
                <Input
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Ella Fowkes"
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
                  placeholder="teacher@school.com"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending…" : "Send Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Current Teachers */}
        {teachers.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-foreground">
                <Users className="w-4 h-4" />
                <h2 className="text-sm font-medium uppercase tracking-[0.15em]">
                  Teachers
                </h2>
              </div>
              <div className="space-y-3">
                {teachers.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-accent">
                        {t.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {t.full_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {t.email}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 text-muted-foreground hover:text-risk transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {t.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete their account and remove them from all classes. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTeacher(t)}
                            className="bg-risk text-risk-foreground hover:bg-risk/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Invites */}
        {invites.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="w-4 h-4" />
                <h2 className="text-sm font-medium uppercase tracking-[0.15em]">
                  Invites
                </h2>
              </div>
              <div className="space-y-3">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {inv.full_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {inv.email}
                      </p>
                    </div>
                    {inv.accepted_at ? (
                      <span className="flex items-center gap-1 text-[10px] text-accent">
                        <CheckCircle2 className="w-3 h-3" /> Accepted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 text-muted-foreground hover:text-risk transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove invite for {inv.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the pending invite. If the teacher has already created an account, their account will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteInvite(inv)}
                            className="bg-risk text-risk-foreground hover:bg-risk/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
