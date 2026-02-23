import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
};

function estimateCost(
  service: string,
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
  durationSeconds: number | null
): number {
  if (service === "deepgram" && durationSeconds) {
    return durationSeconds * 0.0043;
  }
  if (model && PRICING[model]) {
    const p = PRICING[model];
    let cost = 0;
    if (inputTokens) cost += (inputTokens / 1_000_000) * p.input;
    if (outputTokens) cost += (outputTokens / 1_000_000) * p.output;
    return cost;
  }
  return 0;
}

export function logUsage({
  service,
  model,
  callType,
  inputTokens,
  outputTokens,
  durationSeconds,
  assignmentId,
  pairingId,
  memoId,
}: {
  service: "claude" | "deepgram";
  model?: string | null;
  callType: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationSeconds?: number | null;
  assignmentId?: string | null;
  pairingId?: string | null;
  memoId?: string | null;
}) {
  const cost = estimateCost(
    service,
    model ?? null,
    inputTokens ?? null,
    outputTokens ?? null,
    durationSeconds ?? null
  );

  // Fire-and-forget
  db.insert(aiUsage)
    .values({
      service,
      model: model ?? undefined,
      callType,
      inputTokens: inputTokens ?? undefined,
      outputTokens: outputTokens ?? undefined,
      durationSeconds: durationSeconds?.toString() ?? undefined,
      estimatedCost: cost.toString(),
      assignmentId: assignmentId ?? undefined,
      pairingId: pairingId ?? undefined,
      memoId: memoId ?? undefined,
    })
    .catch((e) => console.error("[usage-logger] Error:", e));
}
