"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, ArrowRight, Loader2 } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  memberCount: number;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  async function fetchClasses() {
    const res = await fetch("/api/admin/classes");
    if (res.ok) {
      setClasses(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchClasses();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, description: description || undefined }),
    });
    if (res.ok) {
      setName("");
      setCode("");
      setDescription("");
      fetchClasses();
    }
    setCreating(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
      <p className="mt-1 text-sm text-gray-500">Manage classes and their members</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Create New Class</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ECON 803"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Code (unique)</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ECON803"
                required
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="desc">Description</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : classes.length === 0 ? (
          <p className="col-span-full text-sm text-gray-400 py-12 text-center">No classes yet.</p>
        ) : (
          classes.map((c) => (
            <Link key={c.id} href={`/admin/classes/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.code}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                  </div>
                  {c.description && (
                    <p className="mt-1 text-xs text-gray-500">{c.description}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-400">{c.memberCount} members</div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
