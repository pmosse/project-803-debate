import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, memos, pairings, assignments, classMemberships, classes } from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ImpersonateButton } from "@/components/instructor/impersonate-button";

export default async function InstructorStudentsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Get professor's class memberships
  const profMemberships = await db
    .select({ classId: classMemberships.classId })
    .from(classMemberships)
    .where(eq(classMemberships.userId, session.user.id));
  const profClassIds = profMemberships.map((m) => m.classId);

  // Build class name map
  const classRows = profClassIds.length > 0
    ? await db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(inArray(classes.id, profClassIds))
    : [];
  const classNameMap = Object.fromEntries(classRows.map((c) => [c.id, c.name]));

  // Get student members from those classes
  let students: (typeof users.$inferSelect)[] = [];
  let studentClassMap: Record<string, string[]> = {};

  if (profClassIds.length > 0) {
    const memberRows = await db
      .select({ userId: classMemberships.userId, classId: classMemberships.classId })
      .from(classMemberships)
      .where(inArray(classMemberships.classId, profClassIds));

    const studentIds = [...new Set(memberRows.map((m) => m.userId))];
    // Build map of studentId -> class names
    for (const m of memberRows) {
      if (!studentClassMap[m.userId]) studentClassMap[m.userId] = [];
      const name = classNameMap[m.classId];
      if (name && !studentClassMap[m.userId].includes(name)) {
        studentClassMap[m.userId].push(name);
      }
    }

    students = studentIds.length > 0
      ? await db
          .select()
          .from(users)
          .where(and(inArray(users.id, studentIds), eq(users.role, "student")))
      : [];
  } else {
    // Fallback: use courseCode
    const courseCode = (session.user as any).courseCode;
    if (courseCode) {
      students = await db
        .select()
        .from(users)
        .where(and(eq(users.courseCode, courseCode), eq(users.role, "student")));
    }
  }

  const allMemos = await db
    .select()
    .from(memos);

  const allPairings = await db
    .select()
    .from(pairings);

  const courseAssignments = profClassIds.length > 0
    ? await db
        .select()
        .from(assignments)
        .where(inArray(assignments.classId, profClassIds))
    : await db
        .select()
        .from(assignments)
        .where(eq(assignments.createdBy, session.user.id));

  // Build student data
  const studentData = students.map((student) => {
    const studentMemos = allMemos.filter((m) => m.studentId === student.id);
    const studentPairings = allPairings.filter(
      (p) => p.studentAId === student.id || p.studentBId === student.id
    );
    const analyzedMemos = studentMemos.filter((m) => m.status === "analyzed");
    const completedDebates = studentPairings.filter((p) => p.status === "completed");

    return {
      student,
      memoCount: studentMemos.length,
      analyzedCount: analyzedMemos.length,
      pairingCount: studentPairings.length,
      completedCount: completedDebates.length,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <p className="mt-1 text-sm text-gray-500">
          {students.length} students across{" "}
          {classRows.length > 0
            ? classRows.map((c) => c.name).join(", ")
            : "your courses"}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Class</th>
                <th className="p-4 font-medium">Memos</th>
                <th className="p-4 font-medium">Debates</th>
                <th className="p-4 font-medium w-[1%]"></th>
              </tr>
            </thead>
            <tbody>
              {studentData.map(({ student, analyzedCount, memoCount, completedCount, pairingCount }) => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1D4F91]/10 text-sm font-medium text-[#1D4F91]">
                        {student.name.charAt(0)}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{student.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {student.email || "—"}
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {studentClassMap[student.id]?.join(", ") || "—"}
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {analyzedCount}/{memoCount > 0 ? memoCount : courseAssignments.length} analyzed
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {completedCount}/{pairingCount} completed
                  </td>
                  <td className="p-4">
                    <ImpersonateButton studentId={student.id} studentName={student.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
