import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, memos, pairings, assignments } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ImpersonateButton } from "@/components/instructor/impersonate-button";

export default async function InstructorStudentsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const courseCode = (session.user as any).courseCode;
  if (!courseCode) redirect("/instructor/dashboard");

  const students = await db
    .select()
    .from(users)
    .where(and(eq(users.courseCode, courseCode), eq(users.role, "student")));

  const allMemos = await db
    .select()
    .from(memos);

  const allPairings = await db
    .select()
    .from(pairings);

  const courseAssignments = await db
    .select()
    .from(assignments)
    .where(eq(assignments.courseCode, courseCode));

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
          {students.length} students enrolled in <Badge>{courseCode}</Badge>
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
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
