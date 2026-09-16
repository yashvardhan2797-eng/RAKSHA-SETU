// ============================================================================
// RAKSHA SETU — mission-control data-viz primitives (pure SVG, zero deps)
// ----------------------------------------------------------------------------
// Small, typed, dependency-free chart primitives used across the dashboard:
// Sparkline, AreaChart, MiniBars, Donut, GaugeRing. Deterministic — charts
// render purely from the numbers passed in (same data → same pixels).
// ============================================================================

import type { ReactNode } from 'react';

export type Series = { label: string; values: number[]; color: string; area?: boolean; dashed?: boolean };

function extent(values: number[], pad = 0.08) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1e-6, max - min);
  return { min: min - span * pad, max: max + span * pad };
}

function toPoints(values: number[], width: number, height: number, padY: number, domain?: { min: number; max: number }) {
  const { min, max } = domain ?? extent(values);
  const span = Math.max(1e-6, max - min);
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - padY - ((value - min) / span) * (height - padY * 2),
  }));
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C ${cx.toFixed(1)} ${prev.y.toFixed(1)}, ${cx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

/** Panel wrapper — the mission-control "instrument card". */
export function Panel({ eyebrow, title, action, onAction, children, className, testId }: {
  eyebrow?: string; title: string; action?: string; onAction?: () => void;
  children: ReactNode; className?: string; testId?: string;
}) {
  return (
    <section data-testid={testId} className={`relative overflow-hidden rounded-xl border border-slate-200 bg-card shadow-[0_1px_0_rgba(124,229,249,.05)_inset] ${className ?? ''}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <div className="p-5">
        {(eyebrow || action) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              {eyebrow && <p className="font-mono text-[9px] uppercase tracking-[.16em] text-cyan-700">{eyebrow}</p>}
              <h3 className="mt-0.5 text-sm font-extrabold text-slate-800">{title}</h3>
            </div>
            {action && <button onClick={onAction} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100">{action}</button>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** Compact inline trend line for KPI cards. */
export function Sparkline({ values, color = '#53dcf7', height = 34, width = 120, fill = true }: {
  values: number[]; color?: string; height?: number; width?: number; fill?: boolean;
}) {
  const points = toPoints(values, width, height, 5);
  const line = smoothPath(points);
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}-${values.length}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="overflow-visible" style={{ width, height }} preserveAspectRatio="none">
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.6" fill={color} />
    </svg>
  );
}

/** Full area/line chart with gridlines, hover dots and optional second series. */
export function AreaChart({ series, height = 200, labels, valueSuffix = '', yTicks = 4, domain }: {
  series: Series[]; height?: number; labels?: string[]; valueSuffix?: string; yTicks?: number;
  domain?: { min: number; max: number };
}) {
  const width = 640;
  const padY = 18;
  const all = series.flatMap((s) => s.values);
  const dom = domain ?? extent(all);
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => dom.min + ((dom.max - dom.min) * i) / yTicks);
  return (
    <div>
      <div className="relative">
        <div className="grid-noise pointer-events-none absolute inset-0 opacity-40" />
        <svg viewBox={`0 0 ${width} ${height}`} className="relative h-52 w-full" preserveAspectRatio="none">
          {ticks.map((tick, i) => {
            const y = height - padY - ((tick - dom.min) / Math.max(1e-6, dom.max - dom.min)) * (height - padY * 2);
            return <line key={i} x1="0" y1={y} x2={width} y2={y} stroke="#223148" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '3 6'} />;
          })}
          {series.map((s) => {
            const pts = toPoints(s.values, width, height, padY, dom);
            const d = smoothPath(pts);
            const gid = `area-${s.label.replace(/\W/g, '')}`;
            return (
              <g key={s.label}>
                {s.area !== false && (
                  <>
                    <defs>
                      <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gid})`} />
                  </>
                )}
                <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined} />
                {pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="6" fill="transparent" className="cursor-pointer">
                    <title>{`${s.label}: ${s.values[i]}${valueSuffix}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute right-1 top-0 flex flex-col justify-between font-mono text-[8px] text-slate-500" style={{ height: height - padY * 2 }}>
          {[...ticks].reverse().map((tick, i) => <span key={i}>{Math.round(tick).toLocaleString('en-IN')}</span>)}
        </div>
      </div>
      {labels && <div className="mt-1 flex justify-between px-1 font-mono text-[9px] text-slate-500">{labels.map((l) => <span key={l}>{l}</span>)}</div>}
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {series.map((s) => <span key={s.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><i className="h-1.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>)}
        </div>
      )}
    </div>
  );
}

/** Rounded bar strip with hover values. */
export function MiniBars({ values, labels, color = '#ffc657', height = 160, valueSuffix = '%' }: {
  values: number[]; labels: string[]; color?: string; height?: number; valueSuffix?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="relative">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative flex items-end gap-2 pt-4" style={{ height: height + 18 }}>
        {values.map((value, index) => (
          <div key={labels[index] ?? index} className="group flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="font-mono text-[9px] font-bold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">{value}{valueSuffix}</span>
            <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(3, (value / max) * (height - 14))}px`, background: `linear-gradient(180deg, ${color}, ${color}44)` }} />
            <span className="font-mono text-[9px] text-slate-500">{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal ranked bars (severity mix, type breakdown) — length is share of total. */
export function RankedBars({ items, valueSuffix = '' }: { items: { label: string; value: number; color: string }[]; valueSuffix?: string }) {
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-600">{item.label}</span>
            <span className="font-mono text-[10px] text-slate-500">{item.value}{valueSuffix} · {Math.round((item.value / total) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(item.value / total) * 100}%`, background: `linear-gradient(90deg, ${item.color}, ${item.color}77)` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stroke-based donut with center readout. */
export function Donut({ items, size = 148, thickness = 14, centerLabel, centerSub }: {
  items: { label: string; value: number; color: string }[]; size?: number; thickness?: number; centerLabel?: string; centerSub?: string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a2536" strokeWidth={thickness} />
          {items.map((item) => {
            const len = (item.value / total) * c;
            const el = (
              <circle key={item.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={item.color} strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt">
                <title>{`${item.label}: ${item.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-lg font-bold text-slate-800">{centerLabel ?? total}</span>
          {centerSub && <small className="font-sans text-[9px] font-medium text-slate-500">{centerSub}</small>}
        </div>
      </div>
      <div className="min-w-[130px] space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[11px] text-slate-600">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="font-semibold">{item.label}</span>
            <span className="ml-auto font-mono font-bold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Radial gauge — normalized 0–100 readouts (risk, readiness, capacity). */
export function GaugeRing({ value, size = 120, thickness = 10, color = '#53dcf7', label, sub }: {
  value: number; size?: number; thickness?: number; color?: string; label: string; sub?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = Math.PI * r; // half circle
  const len = (clamped / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 14 }}>
        <svg width={size} height={size / 2 + 14}>
          <path d={`M ${thickness / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - thickness / 2} ${size / 2}`} fill="none" stroke="#1a2536" strokeWidth={thickness} strokeLinecap="round" />
          <path d={`M ${thickness / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - thickness / 2} ${size / 2}`} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
            strokeDasharray={`${len} ${c}`} />
          <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="fill-slate-800 font-mono text-[15px] font-bold">{label}</text>
        </svg>
      </div>
      {sub && <span className="mt-0.5 text-center font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">{sub}</span>}
    </div>
  );
}
