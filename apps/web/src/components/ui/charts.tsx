"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* Categorical palette, validated for light + dark surfaces (blue, teal, amber, violet, rose, slate). */
export const PALETTE = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#e11d48", "#64748b"];
const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }, cursor: { fill: "var(--surface-2)" } };
type Row = Record<string, string | number>;

export function AreaTrend({ data, x, series, height = 240, money }: { data: Row[]; x: string; series: string[]; height?: number; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={x} {...axis} /><YAxis {...axis} tickFormatter={(v) => (money ? `$${v}` : String(v))} />
        <Tooltip {...tip} formatter={(v) => (money ? `$${Number(v).toLocaleString()}` : String(v))} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => <Area key={s} dataKey={s} stroke={PALETTE[i]} fill={PALETTE[i]} fillOpacity={0.12} strokeWidth={2} type="monotone" />)}
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function LineTrend({ data, x, series, height = 240 }: { data: Row[]; x: string; series: string[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey={x} {...axis} /><YAxis {...axis} /><Tooltip {...tip} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => <Line key={s} dataKey={s} stroke={PALETTE[i]} strokeWidth={2} dot={false} type="monotone" />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
export function Bars({ data, x, series, height = 240, stacked }: { data: Row[]; x: string; series: string[]; height?: number; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey={x} {...axis} /><YAxis {...axis} /><Tooltip {...tip} />
        {series.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => <Bar key={s} dataKey={s} fill={PALETTE[i]} radius={[4, 4, 0, 0]} stackId={stacked ? "a" : undefined} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Donut({ data, height = 220 }: { data: Array<{ name: string; value: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
