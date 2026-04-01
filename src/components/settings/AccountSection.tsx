import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, KeyRound, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  schoolId: string;
  schoolName: string;
}

export default function AccountSection({ schoolId, schoolName }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!user?.email) return;
    setChangingPassword(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setChangingPassword(false);
    if (error) toast.error("Failed to send reset email");
    else toast.success("Password reset email sent — check your inbox");
  };

  const handleDeleteSchool = async () => {
    if (confirmText !== schoolName) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-school", {
        body: { school_id: schoolId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("School account deleted");
      await signOut();
      navigate("/login");
    } catch (err) {
      toast.error((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account info */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-foreground">
            <User className="w-4 h-4" />
            <h2 className="text-sm font-medium uppercase tracking-[0.15em]">Account</h2>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-medium block">Email</label>
            <p className="text-sm text-foreground">{user?.email}</p>
          </div>

          <Button variant="outline" onClick={handleChangePassword} disabled={changingPassword} className="w-full gap-2">
            <KeyRound className="w-4 h-4" />
            {changingPassword ? "Sending…" : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-sm font-medium uppercase tracking-[0.15em]">Danger Zone</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Deleting your school will permanently remove all data including students, classes, attendance records, and teacher accounts. This cannot be undone.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">Delete School Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete School Account</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete everything. Type <strong>{schoolName}</strong> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`Type "${schoolName}" to confirm`}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDeleteSchool}
                  disabled={confirmText !== schoolName || deleting}
                >
                  {deleting ? "Deleting…" : "Delete Permanently"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
