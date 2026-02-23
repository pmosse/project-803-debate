"use client";

import { useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle } from "lucide-react";

type Step = "form" | "verify" | "availability" | "success";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

const BLOCKS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
] as const;

export default function SignupPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = use(params);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");

  // Verification
  const [code, setCode] = useState("");

  // Availability
  const [studentId, setStudentId] = useState("");
  const [availability, setAvailability] = useState<Record<string, string[]>>(
    {}
  );

  function toggleSlot(day: string, block: string) {
    setAvailability((prev) => {
      const daySlots = prev[day] || [];
      const has = daySlots.includes(block);
      const updated = has
        ? daySlots.filter((b) => b !== block)
        : [...daySlots, block];
      if (updated.length === 0) {
        const { [day]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [day]: updated };
    });
  }

  function isSelected(day: string, block: string) {
    return (availability[day] || []).includes(block);
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/signup/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          assignmentId,
          accessCode: accessCode || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to send code");
      }

      setStep("verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          assignmentId,
          firstName,
          lastName,
          password,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Verification failed");
      }

      const data = await res.json();
      setStudentId(data.studentId);
      setStep("availability");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAvailability() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/assignments/${assignmentId}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, availability }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to save availability");
      }

      setStep("success");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Image
            src="/icon.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-md"
          />
          <span className="text-xl font-semibold text-[#0F2B4C]">
            Project 803
          </span>
        </div>

        {step === "form" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-base">
                Sign Up for Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="accessCode">
                    Access Code{" "}
                    <span className="text-gray-400">(if required)</span>
                  </Label>
                  <Input
                    id="accessCode"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    "Send Verification Code"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "verify" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-base">
                Enter Verification Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-center text-sm text-gray-500">
                We sent a 6-digit code to{" "}
                <strong>{email}</strong>
              </p>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="text-center text-2xl tracking-[0.3em]"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Create Account"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setError("");
                  }}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
                >
                  Back
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "availability" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-base">
                When are you free to debate?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-center text-sm text-gray-500">
                Select your available time slots so we can find the best time
                for you and your partner.
              </p>

              <div className="mb-6 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="p-1" />
                      {DAYS.map((d) => (
                        <th
                          key={d.key}
                          className="p-1 text-center font-medium text-gray-600"
                        >
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BLOCKS.map((block) => (
                      <tr key={block.key}>
                        <td className="whitespace-nowrap pr-2 text-right text-xs text-gray-500">
                          {block.label}
                        </td>
                        {DAYS.map((day) => (
                          <td key={day.key} className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSlot(day.key, block.key)}
                              className={`h-9 w-full rounded-md border transition-colors ${
                                isSelected(day.key, block.key)
                                  ? "border-[#1D4F91] bg-[#1D4F91] text-white"
                                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                              }`}
                              aria-label={`${day.label} ${block.label}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <p className="mb-3 text-sm text-red-600">{error}</p>
              )}

              <Button
                onClick={handleSaveAvailability}
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>

              <button
                type="button"
                onClick={() => setStep("success")}
                className="mt-2 w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now
              </button>
            </CardContent>
          </Card>
        )}

        {step === "success" && (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Account Created!
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                You&apos;re enrolled in the assignment. You can now log in to
                upload your memo and participate in debates.
              </p>
              <Link
                href="/login"
                className="inline-block rounded-md bg-[#1D4F91] px-6 py-2 text-sm font-medium text-white hover:bg-[#163d73] transition-colors"
              >
                Go to Login
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
