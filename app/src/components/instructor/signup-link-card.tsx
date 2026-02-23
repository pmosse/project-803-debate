"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function SignupLinkCard({
  assignmentId,
  emailDomain,
  accessCode,
}: {
  assignmentId: string;
  emailDomain?: string | null;
  accessCode?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const signupUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup/${assignmentId}`
      : `/signup/${assignmentId}`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(signupUrl)}`;

  function copyToClipboard() {
    navigator.clipboard.writeText(signupUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Student Signup Link</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-gray-100 px-3 py-2 text-xs break-all">
                {signupUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              {emailDomain && (
                <p>
                  Restricted to <strong>@{emailDomain}</strong> emails
                </p>
              )}
              {accessCode && (
                <p>
                  Access code: <strong>{accessCode}</strong>
                </p>
              )}
              {!emailDomain && !accessCode && (
                <p>Open signup (no restrictions)</p>
              )}
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="QR code for signup link"
            width={120}
            height={120}
            className="rounded border"
          />
        </div>
      </CardContent>
    </Card>
  );
}
