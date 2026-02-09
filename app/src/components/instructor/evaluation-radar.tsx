"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface EvaluationRadarProps {
  data: { dimension: string; score: number }[];
}

export function EvaluationRadar({ data }: EvaluationRadarProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="dimension" className="text-xs" />
          <PolarRadiusAxis domain={[0, 100]} tick={false} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#1D4F91"
            fill="#B9D9EB"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
