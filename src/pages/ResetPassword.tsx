import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check URL hash for invite or recovery type
    const hash = window.location.hash;
    if (hash.includes("type=invite") || hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-xs text-center animate-fade-in">
          <h1 className="font-display text-2xl text-foreground mb-4">Verifying…</h1>
          <p className="text-xs text-muted-foreground">
            If this page doesn't update, the reset link may have expired.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-6 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="mb-16 text-center">
          <h1 className="font-display text-4xl text-foreground">New Password</h1>
          <p className="mt-4 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        {success ? (
          <div className="text-center">
            <p className="text-sm text-foreground">Password updated — redirecting…</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-xs text-risk">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating…" : "Set new password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
