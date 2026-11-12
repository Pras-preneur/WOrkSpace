// Lightweight SVG charts powered by d3-scale / d3-shape (Recharts-style API, swap-in ready).
import { useState } from "react";
import { arc as d3arc, pie as d3pie, area as d3area, line as d3line, curveMonotoneX } from "d3-shape";
import { scaleLinear, scalePoint } from "d3-scale";

export function Donut({ data, size = 190, thickness = 24, center }: {
  data: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: { value: string | number; label: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2;
  const arcs = d3pie<any>().value((d) => d.value).sort(null).padAngle(total > 0 ? 0.03 : 0)(data);
  const gen = d3arc<any>().innerRadius(r - thickness).outerRadius(r - 2).cornerRadius(5);
  const hov = d3arc<any>().innerRadius(r - thickness - 2).outerRadius(r + 1).cornerRadius(5);
  return (
    <svg className="chart" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
      <g transform={`translate(${r},${r})`}>
        {total === 0 && <circle r={r - thickness / 2} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />}
        {arcs.map((a, i) => a.data.value > 0 && (
          <path key={i} d={(hover === i ? hov : gen)(a) as string} fill={a.data.color} style={{ transition: "all .15s", opacity: hover === null || hover === i ? 1 : 0.45 }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}><title>{`${a.data.label}: ${a.data.value}`}</title></path>
        ))}
        <text textAnchor="middle" y={hover !== null ? -2 : 4} style={{ fontSize: 28, fontWeight: 800, fill: "var(--text)", letterSpacing: "-.04em" }}>
          {hover !== null ? data[hover].value : center?.value ?? total}
        </text>
        <text textAnchor="middle" y={hover !== null ? 17 : 22} style={{ fontSize: 11.5 }}>{hover !== null ? data[hover].label : center?.label ?? "Total"}</text>
      </g>
    </svg>
  );
}

export function TrendChart({ data, height = 250 }: { data: { label: string; a: number; b: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, m = { t: 14, r: 14, b: 28, l: 30 };
  const max = Math.max(4, ...data.flatMap((d) => [d.a, d.b]));
  const niceMax = Math.ceil(max / 2) * 2;
  const x = scalePoint<number>().domain(data.map((_, i) => i)).range([m.l, W - m.r]).padding(0.15);
  const y = scaleLinear().domain([0, niceMax]).range([H - m.b, m.t]);
  const mk = (k: "a" | "b") => ({
    line: d3line<any>().x((_, i) => x(i)!).y((d) => y(d[k])).curve(curveMonotoneX)(data) as string,
    area: d3area<any>().x((_, i) => x(i)!).y0(y(0)).y1((d) => y(d[k])).curve(curveMonotoneX)(data) as string,
  });
  const A = mk("a"), B = mk("b");
  return (
    <div style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tasks completed versus created per week"
           onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d5efc" stopOpacity=".35" /><stop offset="1" stopColor="#6d5efc" stopOpacity="0" /></linearGradient>
          <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22b8cf" stopOpacity=".22" /><stop offset="1" stopColor="#22b8cf" stopOpacity="0" /></linearGradient>
        </defs>
        {y.ticks(4).map((t) => (<g key={t}><line className="grid-line" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 8} y={y(t) + 4} textAnchor="end">{t}</text></g>))}
        <path d={B.area} fill="url(#gB)" /><path d={B.line} fill="none" stroke="#22b8cf" strokeWidth={2.2} strokeDasharray="5 4" />
        <path d={A.area} fill="url(#gA)" /><path d={A.line} fill="none" stroke="#6d5efc" strokeWidth={3} strokeLinecap="round" />
        {data.map((d, i) => (<g key={i}>
          <text x={x(i)!} y={H - 8} textAnchor="middle">{d.label}</text>
          <rect x={x(i)! - 30} y={m.t} width={60} height={H - m.t - m.b} fill="transparent" onMouseEnter={() => setHover(i)} />
          {hover === i && <line x1={x(i)} x2={x(i)} y1={m.t} y2={H - m.b} stroke="var(--border-strong)" />}
          <circle cx={x(i)} cy={y(d.a)} r={hover === i ? 5.5 : 3.5} fill="var(--surface)" stroke="#6d5efc" strokeWidth={2.5} style={{ transition: "r .1s" }} />
        </g>))}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover)! / W) * 100}%`, top: `${(y(Math.max(data[hover].a, data[hover].b)) / H) * 100}%` }}>
          <b>Week of {data[hover].label}</b><br />Completed: {data[hover].a} · Created: {data[hover].b}
        </div>
      )}
    </div>
  );
}

export function HBars({ rows }: { rows: { label: string; segments: { value: number; color: string; name?: string }[]; right?: string; avatar?: any }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
  return (
    <div>
      {rows.map((r, i) => (
        <div className="hbar" key={i}>
          <div className="row gap-8" style={{ minWidth: 0 }}>{r.avatar}<span className="truncate bold small">{r.label}</span></div>
          <div className="track" role="img" aria-label={r.segments.map((s) => `${s.name}: ${s.value}`).join(", ")}>
            {r.segments.map((s, j) => <i key={j} style={{ width: `${(s.value / max) * 100}%`, background: s.color }} title={`${s.name}: ${s.value}`} />)}
          </div>
          <div className="small muted mono" style={{ textAlign: "right" }}>{r.right}</div>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <div className="legend">{items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}</div>;
}
