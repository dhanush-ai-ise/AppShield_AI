"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function RiskContributorsChart({
  data,
}: {
  data: { label: string; impact_percent: number }[];
}) {
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e"];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" domain={[0, "dataMax + 5"]} tick={{ fill: "#475569", fontSize: 11 }} unit="%" />
        <YAxis type="category" dataKey="label" width={140} tick={{ fill: "#334155", fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#0f172a" }}
          formatter={(v: number) => [`${v}%`, "Impact"]}
        />
        <Bar dataKey="impact_percent" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
