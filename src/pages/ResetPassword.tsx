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
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    let mounted = true;

    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    const queryParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || queryParams.get("type");

    const hasCallbackParams =
      type === "invite" ||
      type === "recovery" ||
      hashParams.has("access_token") ||
      hashParams.has("refresh_token") ||
      queryParams.has("code") ||
      queryParams.has("token") ||
      queryParams.has("token_hash");

    const bootstrap = async () => {
      if (hasCallbackParams && mounted) {
        setIsRecovery(true);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        setIsRecovery(true);
      } else if (!hasCallbackParams) {
        setIsRecovery(false);
      }

      setCheckingLink(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        if (session || event === "PASSWORD_RECOVERY") {
          setIsRecovery(true);
        }
        setCheckingLink(false);
      }
    });

    bootstrap().catch(() => {
      if (mounted) setCheckingLink(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (checkingLink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-xs text-center animate-fade-in">
          <h1 className="font-display text-2xl text-foreground mb-4">Verifying…</h1>
          <p className="text-xs text-muted-foreground">
            Checking your invite/reset link…
          </p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-xs text-center animate-fade-in">
          <h1 className="font-display text-2xl text-foreground mb-4">Link expired</h1>
          <p className="text-xs text-muted-foreground">
            This invite or reset link is no longer valid. Please request a new one.
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
