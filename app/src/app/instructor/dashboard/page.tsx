import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assignments, assignmentEnrollments, memos, classMemberships, classes } from "@/lib/db/schema";
import { eq, sql, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, FileText } from "lucide-react";

export default async function InstructorDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  // Get professor's class IDs
  const profMemberships = await db
    .select({ classId: classMemberships.classId })
    .from(classMemberships)
    .where(eq(classMemberships.userId, session.user.id));
  const profClassIds = profMemberships.map((m) => m.classId);

  // Build a map of classId -> class name
  const classRows = profClassIds.length > 0
    ? await db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(inArray(classes.id, profClassIds))
    : [];
  const classNameMap = Object.fromEntries(classRows.map((c) => [c.id, c.name]));

  const assignmentRows = await db
    .select()
    .from(assignments)
    .where(
      profClassIds.length > 0
        ? or(
            eq(assignments.createdBy, session.user.id),
            inArray(assignments.classId, profClassIds)
          )
        : eq(assignments.createdBy, session.user.id)
    );

  const assignmentIds = assignmentRows.map((a) => a.id);

  const enrollmentCounts = assignmentIds.length > 0
    ? await db
        .select({
          assignmentId: assignmentEnrollments.assignmentId,
          count: sql<number>`count(distinct ${assignmentEnrollments.studentId})`,
        })
        .from(assignmentEnrollments)
        .where(inArray(assignmentEnrollments.assignmentId, assignmentIds))
        .groupBy(assignmentEnrollments.assignmentId)
    : [];

  const memoCounts = assignmentIds.length > 0
    ? await db
        .select({
          assignmentId: memos.assignmentId,
          count: sql<number>`count(*)`,
        })
        .from(memos)
        .where(inArray(memos.assignmentId, assignmentIds))
        .groupBy(memos.assignmentId)
    : [];

  const enrollmentMap = Object.fromEntries(enrollmentCounts.map((e) => [e.assignmentId, Number(e.count)]));
  const memoMap = Object.fromEntries(memoCounts.map((m) => [m.assignmentId, Number(m.count)]));

  const allAssignments = assignmentRows.map((a) => ({
    assignment: a,
    studentCount: enrollmentMap[a.id] || 0,
    memoCount: memoMap[a.id] || 0,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
        <Link
          href="/instructor/assignments/new"
          className="inline-flex items-center gap-2 rounded-md bg-[#1D4F91] px-4 py-2 text-sm font-medium text-white hover:bg-[#163d70]"
        >
          <FileText className="h-4 w-4" />
          New Assignment
        </Link>
      </div>

      {allAssignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">
              No assignments created yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {allAssignments.map(({ assignment: a, studentCount, memoCount }) => (
            <Link key={a.id} href={`/instructor/assignment/${a.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle>{a.title}</CardTitle>
                    <Badge>{a.classId ? classNameMap[a.classId] || a.courseCode : a.courseCode}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {studentCount} students
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {memoCount} memos
                    </span>
                    {a.memoDeadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Memo due: {new Date(a.memoDeadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
