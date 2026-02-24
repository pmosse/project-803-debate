"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, Mail, KeyRound } from "lucide-react";
import Image from "next/image";

type LoginMode = "code-email" | "code-verify" | "password";

function getRedirectForRole(role: string | undefined): string {
  if (role === "super_admin") return "/admin/dashboard";
  if (role === "professor") return "/professor/dashboard";
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LoginMode>("code-email");
  const [codeEmail, setCodeEmail] = useState("");

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const result = await signIn("unified-login", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      router.push(getRedirectForRole(session?.user?.role));
    }
  }

  async function handleRequestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;

    try {
      const res = await fetch("/api/auth/login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to send code");
      }

      setCodeEmail(email);
      setMode("code-verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const code = form.get("code") as string;

    const result = await signIn("email-code", {
      email: codeEmail,
      code,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid or expired code. Please try again.");
    } else {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      router.push(getRedirectForRole(session?.user?.role));
    }
  }

  async function quickLogin(email: string, password: string, redirectTo: string) {
    setLoading(true);
    const result = await signIn("unified-login", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (!result?.error) {
      router.push(redirectTo);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1D4F91] via-[#2A6CB8] to-[#4F7CAC] p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/icon.svg" alt="" width={36} height={36} className="rounded-lg" />
            <span className="text-xl font-semibold text-white">Project 803</span>
          </div>
        </div>
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold leading-tight text-white">
            AI-Moderated<br />Academic Debates
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/70">
            Upload your memo, get paired with a peer, and defend your position in a structured, AI-moderated oral debate.
          </p>
          <div className="mt-8 flex gap-6 text-sm text-white/50">
            <div>
              <div className="text-2xl font-bold text-white/90">~15 min</div>
              <div>per debate</div>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white/90">Real-time</div>
              <div>AI moderation</div>
            </div>
            <div className="h-12 w-px bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white/90">Evidence</div>
              <div>based scoring</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-white/30">
          Columbia University
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/icon.svg" alt="" width={36} height={36} className="rounded-lg" />
            <span className="text-xl font-semibold text-gray-900">Project 803</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to your account to continue
          </p>

          {/* Email code: enter email */}
          {mode === "code-email" && (
            <form onSubmit={handleRequestCode} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@columbia.edu"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Login Code
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setMode("password"); setError(""); }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                <span className="inline-flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  Sign in with password instead
                </span>
              </button>
            </form>
          )}

          {/* Email code: enter code */}
          {mode === "code-verify" && (
            <form onSubmit={handleVerifyCode} className="mt-8 space-y-4">
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to <strong>{codeEmail}</strong>
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.3em]"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setMode("code-email"); setError(""); }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Back
              </button>
            </form>
          )}

          {/* Password login */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@columbia.edu"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setMode("code-email"); setError(""); }}
                className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Sign in with email code instead
                </span>
              </button>
            </form>
          )}

          {/* Quick login for testing */}
          <div className="mt-6 border-t pt-4 space-y-2">
            <button
              onClick={() => quickLogin("smith@columbia.edu", "instructor123", "/professor/dashboard")}
              disabled={loading}
              className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
            >
              Quick Login as Professor (testing)
            </button>
            <button
              onClick={() => quickLogin("admin@columbia.edu", "admin123", "/admin/dashboard")}
              disabled={loading}
              className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
            >
              Quick Login as Admin (testing)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
