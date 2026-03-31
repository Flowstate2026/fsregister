import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_SCHOOL_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const Login = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          school_id: DEMO_SCHOOL_ID,
          role: "owner",
        },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-xs animate-fade-in">
        <div className="mb-16 text-center">
          <h1 className="font-display text-4xl text-foreground">FS Register</h1>
          <p className="mt-4 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : mode === "signup" ? "Create your demo account" : "Reset your password"}
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
        <form onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleForgotPassword} className="space-y-8">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-[10px] font-light uppercase tracking-[0.35em] text-muted-foreground">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

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

          {mode !== "forgot" && (
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          )}

          {error && <p className="text-xs text-risk">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? mode === "login" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending…"
              : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>
        )}

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "login"
              ? "Need a demo account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>

        {mode === "signup" && (
          <p className="mt-6 text-center text-[10px] tracking-wide text-muted-foreground">
            You'll be added as an owner of Starlight Performing Arts (demo school)
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
