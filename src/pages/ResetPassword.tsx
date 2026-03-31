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

  const getAuthCallbackParams = () => {
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    const queryParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || queryParams.get("type");

    return {
      type,
      code: queryParams.get("code"),
      tokenHash: queryParams.get("token_hash"),
      accessToken: hashParams.get("access_token"),
      refreshToken: hashParams.get("refresh_token"),
      hasCallbackParams:
        type === "invite" ||
        type === "recovery" ||
        hashParams.has("access_token") ||
        hashParams.has("refresh_token") ||
        queryParams.has("code") ||
        queryParams.has("token") ||
        queryParams.has("token_hash"),
    };
  };

  const establishRecoverySession = async () => {
    const callback = getAuthCallbackParams();

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession) {
      if (callback.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (error) throw error;
      } else {
        const otpType =
          callback.type === "invite" || callback.type === "recovery" ? callback.type : null;

        if (callback.tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: callback.tokenHash,
          });
          if (error) throw error;
        } else if (callback.accessToken && callback.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });
          if (error) throw error;
        }
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      hasSession: Boolean(session),
      hasCallbackParams: callback.hasCallbackParams,
    };
  };

  useEffect(() => {
    let mounted = true;
    const { hasCallbackParams } = getAuthCallbackParams();

    if (hasCallbackParams) setIsRecovery(true);

    const bootstrap = async () => {
      try {
        const { hasSession } = await establishRecoverySession();

        if (!mounted) return;

        setIsRecovery(hasSession || hasCallbackParams);
      } catch {
        if (!mounted) return;
        setIsRecovery(hasCallbackParams);
      } finally {
        if (mounted) setCheckingLink(false);
      }
    };

    const fallbackTimeout = window.setTimeout(() => {
      if (!mounted) return;

      if (hasCallbackParams) setIsRecovery(true);
      setCheckingLink(false);
    }, 2500);

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
      if (mounted) {
        setIsRecovery(hasCallbackParams);
        setCheckingLink(false);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
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
    try {
      const { hasSession } = await establishRecoverySession();
      if (!hasSession) {
        setError("This invite or reset link has expired. Please request a new one.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

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
