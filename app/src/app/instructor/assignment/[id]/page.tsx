import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  assignments,
  memos,
  users,
  pairings,
  debateSessions,
  evaluations,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignmentTabs } from "@/components/instructor/assignment-tabs";
import { PairingControls } from "@/components/instructor/pairing-controls";
import { ResetCaseButton } from "@/components/instructor/reset-case-button";
import { ResetDebateButton } from "@/components/instructor/reset-debate-button";
import { ImpersonateButton } from "@/components/instructor/impersonate-button";
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

  // Fetch debate sessions for completed pairings (for Results tab)
  const pairingIds = allPairings.map((p) => p.id);
  const allDebateSessions = pairingIds.length > 0
    ? await db
        .select()
        .from(debateSessions)
        .where(inArray(debateSessions.pairingId, pairingIds))
    : [];

  const sessionIds = allDebateSessions.map((s) => s.id);
  const allEvaluations = sessionIds.length > 0
    ? await db
        .select()
        .from(evaluations)
        .where(inArray(evaluations.debateSessionId, sessionIds))
    : [];

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

      <AssignmentTabs>
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

          <Card className="mt-4 border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-700">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reset Case</p>
                  <p className="text-xs text-gray-500">
                    Delete all pairings, debates, and evaluations. Reset memos to analyzed state.
                  </p>
                </div>
                <ResetCaseButton assignmentId={id} />
              </div>
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
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/instructor/student/${student.id}?assignment=${id}`}
                            className="text-sm text-[#1D4F91] hover:underline"
                          >
                            View Details
                          </Link>
                          <ImpersonateButton studentId={student.id} studentName={student.name} />
                        </div>
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
          {completedCount === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No debates completed yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                {completedCount} debate{completedCount !== 1 ? "s" : ""} completed.
              </p>
              {allPairings
                .filter((p) => p.status === "completed")
                .map((p) => {
                  const studentA = students.find((s) => s.id === p.studentAId);
                  const studentB = students.find((s) => s.id === p.studentBId);
                  const session = allDebateSessions.find((s) => s.pairingId === p.id);
                  const pairEvals = session
                    ? allEvaluations.filter((e) => e.debateSessionId === session.id)
                    : [];

                  return (
                    <Card key={p.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {studentA?.name || "Unknown"} vs {studentB?.name || "Unknown"}
                              </span>
                              <StatusBadge status={p.status} />
                            </div>
                            {session && (
                              <p className="text-xs text-gray-500">
                                Duration: {session.durationSeconds ? `${Math.round(session.durationSeconds / 60)}min` : "N/A"}
                                {pairEvals.length > 0 && ` · ${pairEvals.length} evaluation${pairEvals.length !== 1 ? "s" : ""}`}
                              </p>
                            )}
                            {pairEvals.map((ev) => {
                              const evStudent = students.find((s) => s.id === ev.studentId);
                              return (
                                <div key={ev.id} className="mt-1 text-xs text-gray-600">
                                  <span className="font-medium">{evStudent?.name}:</span>{" "}
                                  {ev.passFail && <Badge variant={ev.passFail === "pass" ? "success" : ev.passFail === "fail" ? "error" : "secondary"}>{ev.passFail}</Badge>}
                                  {ev.score && <span className="ml-2">Score: {ev.score}</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <Link
                              href={`/instructor/debate/${p.id}`}
                              className="rounded-md bg-[#1D4F91] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#163d73] transition-colors"
                            >
                              View Debate
                            </Link>
                            <ResetDebateButton pairingId={p.id} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </AssignmentTabs>
    </div>
  );
}
