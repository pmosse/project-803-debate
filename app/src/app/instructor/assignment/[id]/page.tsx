import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assignments,
  memos,
  users,
  pairings,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PairingControls } from "@/components/instructor/pairing-controls";
import { Users as UsersIcon, FileText } from "lucide-react";

export default async function InstructorAssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, id))
    .limit(1);

  if (!assignment) redirect("/instructor/dashboard");

  const students = await db
    .select()
    .from(users)
    .where(
      and(eq(users.courseCode, assignment.courseCode), eq(users.role, "student"))
    );

  const allMemos = await db
    .select()
    .from(memos)
    .where(eq(memos.assignmentId, id));

  const allPairings = await db
    .select()
    .from(pairings)
    .where(eq(pairings.assignmentId, id));

  const studentData = students.map((student) => {
    const memo = allMemos.find((m) => m.studentId === student.id);
    const pairing = allPairings.find(
      (p) => p.studentAId === student.id || p.studentBId === student.id
    );
    return { student, memo, pairing };
  });

  const analyzedCount = allMemos.filter((m) => m.status === "analyzed").length;
  const pairedCount = allPairings.length * 2;
  const completedCount = allPairings.filter(
    (p) => p.status === "completed"
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
          <Badge>{assignment.courseCode}</Badge>
          <span className="flex items-center gap-1">
            <UsersIcon className="h-3.5 w-3.5" />
            {students.length} students
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {analyzedCount} memos analyzed
          </span>
        </div>
      </div>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="pairings">Pairings</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Memo Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#1D4F91]">
                  {analyzedCount}/{students.length}
                </p>
                <p className="text-sm text-gray-500">memos analyzed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Paired Students</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#1D4F91]">
                  {pairedCount}/{students.length}
                </p>
                <p className="text-sm text-gray-500">students paired</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completed Debates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-[#1D4F91]">
                  {completedCount}/{allPairings.length}
                </p>
                <p className="text-sm text-gray-500">debates completed</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Assignment Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {assignment.promptText}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="p-4 font-medium">Student</th>
                    <th className="p-4 font-medium">Memo Status</th>
                    <th className="p-4 font-medium">Position</th>
                    <th className="p-4 font-medium">Confirmed</th>
                    <th className="p-4 font-medium">Debate Status</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {studentData.map(({ student, memo, pairing }) => (
                    <tr key={student.id} className="border-b last:border-0">
                      <td className="p-4 text-sm font-medium">
                        {student.name}
                      </td>
                      <td className="p-4">
                        <StatusBadge
                          status={memo?.status || "not_started"}
                        />
                      </td>
                      <td className="p-4 text-sm">
                        {memo?.positionBinary === "net_positive" && (
                          <Badge variant="success">Net Positive</Badge>
                        )}
                        {memo?.positionBinary === "net_negative" && (
                          <Badge variant="error">Net Negative</Badge>
                        )}
                        {memo?.positionBinary === "unclassified" && (
                          <Badge variant="secondary">Unclassified</Badge>
                        )}
                        {!memo && <span className="text-gray-400">-</span>}
                      </td>
                      <td className="p-4 text-sm">
                        {memo?.studentConfirmed === 1
                          ? "Yes"
                          : memo?.studentConfirmed === -1
                            ? "Flagged"
                            : "-"}
                      </td>
                      <td className="p-4">
                        {pairing ? (
                          <StatusBadge status={pairing.status} />
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/instructor/student/${student.id}?assignment=${id}`}
                          className="text-sm text-[#1D4F91] hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pairings">
          <PairingControls
            assignmentId={id}
            analyzedCount={analyzedCount}
            existingPairings={allPairings}
            students={students}
          />
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              {completedCount === 0
                ? "No debates completed yet."
                : `${completedCount} debates completed. View individual student pages for detailed results.`}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
