"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Member {
  id: string;
  membershipId: string;
  name: string;
  email: string | null;
  role: string;
  joinedAt: string;
}

interface ClassDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  members: Member[];
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchClass() {
    const res = await fetch(`/api/admin/classes/${id}/members`);
    if (res.ok) {
      setClassData(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchClass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data: SearchResult[] = await res.json();
      // Filter out existing members
      const memberIds = new Set(classData?.members.map((m) => m.id) || []);
      setSuggestions(data.filter((u) => !memberIds.has(u.id)));
      setShowSuggestions(true);
    }
  }, [classData]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedUser(null);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(value), 300);
  }

  function handleSelectUser(user: SearchResult) {
    setSelectedUser(user);
    setQuery(`${user.name} (${user.email})`);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      setError("Please select a user from the suggestions");
      return;
    }
    setAdding(true);
    setError("");
    const res = await fetch(`/api/admin/classes/${id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser.id }),
    });
    if (res.ok) {
      setQuery("");
      setSelectedUser(null);
      fetchClass();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to add member");
    }
    setAdding(false);
  }

  async function handleRemove(membershipId: string) {
    await fetch(`/api/admin/classes/${id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId }),
    });
    fetchClass();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!classData) {
    return <p className="text-gray-500">Class not found.</p>;
  }

  return (
    <div>
      <Link
        href="/admin/classes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to classes
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">{classData.name}</h1>
      <p className="text-sm text-gray-400">Code: {classData.code}</p>
      {classData.description && (
        <p className="mt-1 text-sm text-gray-500">{classData.description}</p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Add Member</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddMember} className="flex items-end gap-3">
            <div className="relative flex-1 space-y-1" ref={dropdownRef}>
              <Label htmlFor="search">Search User</Label>
              <Input
                id="search"
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Type a name or email..."
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => handleSelectUser(user)}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                      <Badge variant={user.role === "professor" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && query.length >= 2 && suggestions.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400 shadow-lg">
                  No users found
                </div>
              )}
            </div>
            <Button type="submit" disabled={adding || !selectedUser}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Members ({classData.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {classData.members.length === 0 ? (
            <p className="text-sm text-gray-400">No members yet.</p>
          ) : (
            <div className="divide-y">
              {classData.members.map((m) => (
                <div key={m.membershipId} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.role === "professor" ? "default" : "secondary"}>
                      {m.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-600"
                      onClick={() => handleRemove(m.membershipId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
