"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CriterionScore {
  criterion: string;
  score: number;
  maxPoints: number;
  reasoning: string;
}

export function CriteriaScoresDisplay({
  criteriaScores,
}: {
  criteriaScores: CriterionScore[];
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const chartData = criteriaScores.map((c) => ({
    name: c.criterion.length > 15 ? c.criterion.slice(0, 15) + "..." : c.criterion,
    fullName: c.criterion,
    score: c.score,
    maxPoints: c.maxPoints,
    pct: Math.round((c.score / c.maxPoints) * 100),
  }));

  const totalScore = criteriaScores.reduce((s, c) => s + c.score, 0);
  const totalMax = criteriaScores.reduce((s, c) => s + c.maxPoints, 0);

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">
        Total: <span className="font-bold text-gray-900">{totalScore}/{totalMax}</span>
      </div>

      <ResponsiveContainer width="100%" height={criteriaScores.length * 40 + 20}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 10]} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, _: any, entry: any) =>
              [`${value}/${entry.payload.maxPoints}`, entry.payload.fullName]
            }
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.pct >= 70 ? "#1D4F91" : entry.pct >= 40 ? "#B9D9EB" : "#ef4444"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-1">
        {criteriaScores.map((c, i) => (
          <div key={i} className="rounded border border-gray-100">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
            >
              {expanded === i ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              )}
              <span className="font-medium flex-1">{c.criterion}</span>
              <span className="text-gray-500">
                {c.score}/{c.maxPoints}
              </span>
            </button>
            {expanded === i && (
              <p className="px-3 pb-2 pl-9 text-sm text-gray-600">
                {c.reasoning}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
