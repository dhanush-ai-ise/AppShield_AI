"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function ScanHistoryChart({ data }: { data: { date: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -10, right: 20, top: 10 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: "#475569", fontSize: 11 }} />
        <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#0f172a" }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 4, fill: "#ef4444" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
