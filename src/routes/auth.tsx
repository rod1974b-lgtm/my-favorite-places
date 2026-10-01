import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — My Weather Pal" },
      { name: "description", content: "Sign in to sync your saved places across devices." },
      { property: "og:title", content: "Sign in — My Weather Pal" },
      { property: "og:description", content: "Sign in to sync your saved places across devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) return setMsg(error.message);
      setMsg("Check your email to confirm your account, then sign in.");
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return setMsg(String(result.error.message ?? result.error));
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="sky sky-default min-h-screen text-foreground">
      <main className="mx-auto max-w-sm px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← Back</Link>
        <h1 className="mt-4 text-2xl font-bold">{mode === "in" ? "Sign in" : "Create account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Keep your saved places in sync on all your devices.</p>
        <button
          onClick={google}
          className="mt-6 w-full rounded-lg border border-input bg-card px-4 py-2 font-medium text-card-foreground hover:bg-accent"
        >
          Continue with Google
        </button>
        <div className="my-4 text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-card-foreground outline-none focus:ring-2 focus:ring-ring" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-card-foreground outline-none focus:ring-2 focus:ring-ring" />
          <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60">
            {mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
        <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 text-sm underline-offset-4 hover:underline">
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </main>
    </div>
  );
}
