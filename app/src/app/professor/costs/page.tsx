import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { aiUsage, assignments } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isPrivilegedRole } from "@/lib/auth/roles";

export default async function CostsDashboard() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!isPrivilegedRole((session.user as any).role)) redirect("/dashboard");

  // Get all usage rows
  const usageRows = await db
    .select({
      assignmentId: aiUsage.assignmentId,
      service: aiUsage.service,
      callType: aiUsage.callType,
      model: aiUsage.model,
      totalCost: sql<string>`sum(${aiUsage.estimatedCost})`,
      totalInput: sql<number>`sum(${aiUsage.inputTokens})`,
      totalOutput: sql<number>`sum(${aiUsage.outputTokens})`,
      totalDuration: sql<string>`sum(${aiUsage.durationSeconds})`,
      count: sql<number>`count(*)`,
    })
    .from(aiUsage)
    .groupBy(aiUsage.assignmentId, aiUsage.service, aiUsage.callType, aiUsage.model);

  // Get assignment titles
  const assignmentIds = [
    ...new Set(usageRows.map((r) => r.assignmentId).filter(Boolean)),
  ] as string[];

  const assignmentMap = new Map<string, string>();
  if (assignmentIds.length > 0) {
    const assignmentRows = await db
      .select({ id: assignments.id, title: assignments.title })
      .from(assignments);
    for (const a of assignmentRows) {
      assignmentMap.set(a.id, a.title);
    }
  }

  // Aggregate
  let grandTotal = 0;
  let claudeTotal = 0;
  let deepgramTotal = 0;

  const byAssignment = new Map<
    string,
    { title: string; total: number; rows: typeof usageRows }
  >();

  for (const row of usageRows) {
    const cost = Number(row.totalCost) || 0;
    grandTotal += cost;
    if (row.service === "claude") claudeTotal += cost;
    if (row.service === "deepgram") deepgramTotal += cost;

    const aId = row.assignmentId || "unassigned";
    if (!byAssignment.has(aId)) {
      byAssignment.set(aId, {
        title: assignmentMap.get(aId) || "Unassigned",
        total: 0,
        rows: [],
      });
    }
    const entry = byAssignment.get(aId)!;
    entry.total += cost;
    entry.rows.push(row);
  }

  const sortedAssignments = [...byAssignment.entries()].sort(
    (a, b) => b[1].total - a[1].total
  );

  function fmt(n: number) {
    return n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">AI Costs</h1>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1D4F91]">
              {fmt(grandTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claude</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1D4F91]">
              {fmt(claudeTotal)}
            </p>
            <p className="text-xs text-gray-500">
              {usageRows
                .filter((r) => r.service === "claude")
                .reduce((s, r) => s + (r.count || 0), 0)}{" "}
              API calls
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deepgram</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1D4F91]">
              {fmt(deepgramTotal)}
            </p>
            <p className="text-xs text-gray-500">
              {Math.round(
                usageRows
                  .filter((r) => r.service === "deepgram")
                  .reduce((s, r) => s + (Number(r.totalDuration) || 0), 0) / 60
              )}{" "}
              min transcribed
            </p>
          </CardContent>
        </Card>
      </div>

      {sortedAssignments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No AI usage recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAssignments.map(([aId, data]) => (
            <Card key={aId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {data.title}
                  <span className="text-sm font-normal text-gray-500">
                    {fmt(data.total)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 font-medium">Call Type</th>
                      <th className="pb-2 font-medium">Service</th>
                      <th className="pb-2 font-medium text-right">Calls</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows
                      .sort(
                        (a, b) =>
                          (Number(b.totalCost) || 0) -
                          (Number(a.totalCost) || 0)
                      )
                      .map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{row.callType}</td>
                          <td className="py-2">
                            <Badge
                              variant={
                                row.service === "claude"
                                  ? "secondary"
                                  : "success"
                              }
                            >
                              {row.service}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">{row.count}</td>
                          <td className="py-2 text-right">
                            {fmt(Number(row.totalCost) || 0)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
