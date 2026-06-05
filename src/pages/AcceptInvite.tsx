import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<{
    email: string;
    full_name: string;
    role: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This invite link is invalid.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("accept-invite", {
          body: { token, preview: true },
        });
        if (fnErr) throw fnErr;
        if ((data as any)?.error) throw new Error((data as any).error);
        setInvite(data as any);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("accept-invite", {
        body: { token, password },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);

      const email = (data as any)?.email || invite?.email;
      if (email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
      }
      toast.success("Welcome! Your account is ready.");
      navigate("/");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-xs text-muted-foreground">Checking invite…</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-xs text-center">
          <h1 className="font-display text-2xl text-foreground mb-3">Invite unavailable</h1>
          <p className="text-xs text-muted-foreground">
            {error || "This invite is no longer valid. Please ask your school owner to send a new one."}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs animate-fade-in">
        <div className="mb-10 text-center">
          <h1 className="font-display text-3xl text-foreground">Accept invite</h1>
          <p className="mt-3 text-xs text-muted-foreground">
            Welcome, {invite.full_name}. Set a password to join as a{" "}
            {invite.role === "owner" ? "co-owner" : "teacher"}.
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {invite.email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">
              Confirm password
            </Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Setting up…" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
