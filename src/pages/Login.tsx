import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Login = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs animate-fade-in">
        <div className="mb-16 text-center">
          <h1 className="font-display text-4xl text-foreground">FS Register</h1>
          <p className="mt-4 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Reset your password"}
          </p>
        </div>

        {mode === "forgot" && resetSent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-foreground">Check your email for a password reset link.</p>
            <button
              type="button"
              onClick={() => { setMode("login"); setResetSent(false); setError(""); }}
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
        <form onSubmit={mode === "login" ? handleLogin : handleForgotPassword} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@school.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {mode === "login" && (
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>
          )}

          {error && <p className="text-xs text-risk">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? mode === "login" ? "Signing in…" : "Sending…"
              : mode === "login" ? "Sign in" : "Send reset link"}
          </Button>
        </form>
        )}

        <div className="mt-8 text-center">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); }}
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot your password?
            </button>
          ) : !resetSent && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
