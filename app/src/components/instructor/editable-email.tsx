"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

export function EditableEmail({
  studentId,
  initialEmail,
}: {
  studentId: string;
  initialEmail: string;
}) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [draft, setDraft] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Invalid email");
      return;
    }
    if (trimmed === email) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }
      setEmail(data.user.email);
      setDraft(data.user.email);
      setEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span className="group inline-flex items-center gap-1.5 text-sm text-gray-500">
        {email || "No email"}
        <button
          onClick={() => {
            setDraft(email);
            setError(null);
            setEditing(true);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#1D4F91]"
          title="Edit email"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="email"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={saving}
        autoFocus
        className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 focus:border-[#1D4F91] focus:outline-none focus:ring-1 focus:ring-[#1D4F91] w-56"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="text-green-600 hover:text-green-700 disabled:opacity-50"
        title="Save"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-gray-400 hover:text-gray-600"
        title="Cancel"
      >
        <X className="h-4 w-4" />
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
