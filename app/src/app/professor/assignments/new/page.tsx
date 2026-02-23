"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { RubricBuilder } from "@/components/instructor/rubric-builder";

const rubricCriterionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  maxPoints: z.number().min(1, "Min 1").max(10, "Max 10"),
});

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  promptText: z.string().min(1, "Prompt is required"),
  rubricText: z.string().optional(),
  rubricCriteria: z
    .array(rubricCriterionSchema)
    .max(10, "Maximum 10 criteria")
    .optional()
    .transform((criteria) => criteria?.filter((c) => c.name.trim()))
    .refine(
      (criteria) => {
        if (!criteria || criteria.length === 0) return true;
        const total = criteria.reduce((s, c) => s + c.maxPoints, 0);
        return total <= 100;
      },
      { message: "Total points cannot exceed 100" }
    ),
  courseCode: z.string().optional(),
  emailDomain: z.string().optional(),
  accessCode: z.string().optional(),
  memoDeadline: z.string().optional(),
  debateDeadline: z.string().optional(),
  readingLinks: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      })
    )
    .optional()
    .transform((links) =>
      links?.filter((l) => l.title.trim() || l.url.trim())
    ),
});

type FormData = z.infer<typeof schema>;

export default function NewAssignment() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      readingLinks: [],
      rubricCriteria: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "readingLinks",
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create assignment");
      }
      const assignment = await res.json();
      router.push(`/professor/assignment/${assignment.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Create Assignment
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="e.g., Walmart Case"
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="promptText">Assignment Prompt</Label>
              <textarea
                id="promptText"
                {...register("promptText")}
                rows={6}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B9D9EB] focus:border-[#1D4F91]"
                placeholder="Enter the assignment prompt..."
              />
              {errors.promptText && (
                <p className="text-sm text-red-600">
                  {errors.promptText.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rubric</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RubricBuilder
              control={control}
              register={register}
              errors={errors}
            />

            <div className="space-y-2">
              <Label htmlFor="rubricText">
                Additional Rubric Notes (optional)
              </Label>
              <textarea
                id="rubricText"
                {...register("rubricText")}
                rows={3}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B9D9EB] focus:border-[#1D4F91]"
                placeholder="Any additional rubric guidance..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailDomain">Email Domain (optional)</Label>
              <Input
                id="emailDomain"
                {...register("emailDomain")}
                placeholder="e.g., columbia.edu"
              />
              <p className="text-xs text-gray-500">
                Restrict student signup to emails ending with this domain
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessCode">Access Code (optional)</Label>
              <Input
                id="accessCode"
                {...register("accessCode")}
                placeholder="e.g., ECON803"
              />
              <p className="text-xs text-gray-500">
                Students must enter this code to sign up
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="memoDeadline">Memo Deadline</Label>
              <Input
                id="memoDeadline"
                type="datetime-local"
                {...register("memoDeadline")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debateDeadline">Debate Deadline</Label>
              <Input
                id="debateDeadline"
                type="datetime-local"
                {...register("debateDeadline")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Readings (optional)
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ title: "", url: "" })}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add Reading
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 && (
              <p className="text-sm text-gray-400">No readings added yet.</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  {...register(`readingLinks.${index}.title`)}
                  placeholder="Reading title"
                  className="flex-1"
                />
                <Input
                  {...register(`readingLinks.${index}.url`)}
                  placeholder="URL"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Assignment"
          )}
        </Button>
      </form>
    </div>
  );
}
