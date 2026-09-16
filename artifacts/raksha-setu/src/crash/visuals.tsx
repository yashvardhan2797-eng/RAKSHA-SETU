/**
 * RAKSHA SETU — crash lab visuals.
 *
 * VehicleStage: a clean 2D engineering-style visualization (road, vehicle,
 * impact zone, movement, impact state). Positioned from the ACTUAL playback
 * sample of the simulation engine — never from independent fake animation.
 *
 * TelemetryCharts: Recharts curves built directly from the deterministic
 * series produced by src/engine/simulation.ts.
 */

import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { SimulationRun, TelemetrySample } from '../engine/simulation';
import { seriesDuration } from '../engine/simulation';
import { SEVERITY_COLORS, cn } from './ui';
import type { SeverityLevel } from '../engine/severity';

/* ---------------------------------- Vehicle stage ---------------------------------- */

const APPROACH_SECONDS = 1.5;

/** Vehicle x-position (percent of road) derived from the live sample's phase + time. */
function vehiclePosition(sample: TelemetrySample, duration: number): number {
  const t = sample.time;
  if (sample.phase === 'approach') return 6 + (t / APPROACH_SECONDS) * 66; // 6% → 72%
  if (sample.phase === 'impact') return 72; // at the barrier during the pulse
  return 72 + Math.min(14, duration > 0 ? ((t - APPROACH_SECONDS - 0.001) / Math.max(0.001, duration - APPROACH_SECONDS)) * 14 : 0); // run-out drift
}

export function VehicleStage({ sample, run }: { sample: TelemetrySample | null; run: SimulationRun | null }) {
  const duration = run ? seriesDuration(run.samples) : 0;
  const x = sample ? vehiclePosition(sample, duration) : 6;
  const impacting = sample?.phase === 'impact';
  const postImpact = sample?.phase === 'post-impact';
  const done = run !== null && duration > 0 && sample !== null && sample.time >= duration - 1e-6;

  // Deterministic micro-shake during the impact pulse (amplitude scales with deceleration).
  const shake = impacting && run ? Math.min(5, run.physics.gForce * 1.2) * Math.sin(sample!.time * 160) : 0;

  return <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-[#eef3f4]" style={{ height: 230 }}>
    {/* grid backdrop */}
    <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#cfdde1 1px, transparent 1px), linear-gradient(90deg, #cfdde1 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
    {/* road */}
    <div className="absolute inset-x-0 bottom-0 h-[86px] border-t border-slate-300 bg-[#dfe6e9]">
      <div className="absolute top-1/2 h-0.5 w-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #9fb3ba 0 18px, transparent 18px 34px)' }} />
      <span className="absolute bottom-1 left-2 font-mono text-[8px] uppercase tracking-widest text-slate-400">test lane · surface: {run?.input.roadSurface ?? '—'}</span>
    </div>
    {/* barrier / impact zone */}
    <div className={cn('absolute bottom-[86px] h-[120px] w-[10px] transition-colors', impacting ? 'bg-red-500' : 'bg-slate-400')} style={{ left: '74.5%' }}>
      <span className="absolute inset-y-0 -left-1.5 w-1.5 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b 0 6px, #111827 6px 12px)' }} />
    </div>
    <span className="absolute bottom-[210px] left-[72%] font-mono text-[8px] uppercase tracking-widest text-slate-500">impact zone</span>
    {/* impact flash */}
    {impacting && <div className="absolute bottom-[80px] h-[140px] w-16 -translate-x-1/2 bg-red-500/25" style={{ left: '74.5%' }} />}
    {/* vehicle */}
    <div className="absolute bottom-[96px] -translate-x-1/2" style={{ left: `${x}%`, transform: `translateX(-50%) translateY(${shake}px)` }}>
      <svg width="84" height="40" viewBox="0 0 84 40">
        <path d="M6 30 L10 16 Q12 10 20 9 L52 9 Q60 10 66 17 L74 22 Q78 24 78 28 L78 30 Q78 32 74 32 L10 32 Q6 32 6 30 Z" fill="#0e7d8b" stroke="#0a5560" strokeWidth="1.5" />
        <path d="M22 13 L48 13 Q54 13.5 58 18 L60 20 L20 20 Z" fill="#cdeef2" opacity="0.9" />
        <circle cx="24" cy="32" r="5.5" fill="#334155" stroke="#0f172a" />
        <circle cx="62" cy="32" r="5.5" fill="#334155" stroke="#0f172a" />
        <circle cx="24" cy="32" r="2" fill="#94a3b8" />
        <circle cx="62" cy="32" r="2" fill="#94a3b8" />
      </svg>
    </div>
    {/* status overlay */}
    <div className="absolute left-3 top-3 flex items-center gap-2">
      <span className={cn('h-2 w-2 rounded-full', sample ? 'animate-pulse-dot bg-cyan-600' : 'bg-slate-300')} />
      <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">{run ? `playback ${sample?.time.toFixed(2)}s / ${duration.toFixed(2)}s` : 'bench idle'}</span>
    </div>
    {impacting && <div data-testid="badge-impact-detected" className="absolute left-1/2 top-8 -translate-x-1/2 rounded-md bg-red-600 px-3 py-1.5 font-mono text-[11px] font-extrabold tracking-[.18em] text-white shadow-lg">IMPACT DETECTED</div>}
    {postImpact && !done && <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-md bg-slate-700 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[.18em] text-white">POST-IMPACT RUN-OUT</div>}
    {done && <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-md bg-emerald-600 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[.18em] text-white">SIMULATION COMPLETE</div>}
    {!run && <div className="absolute inset-0 flex items-center justify-center bg-white/45"><p className="rounded-lg border border-dashed border-slate-300 bg-white/90 px-4 py-2 text-xs font-bold text-slate-500">Run a simulation to see the vehicle move</p></div>}
  </div>;
}

/* ---------------------------------- Charts ---------------------------------- */

const AXIS_STYLE = { fontSize: 9, fontFamily: 'ui-monospace, monospace', fill: '#94a3b8' } as const;

function ChartFrame({ children, height = 200 }: { children: React.ReactElement; height?: number }) {
  return <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

function phaseColor(sample: TelemetrySample): string {
  return sample.phase === 'impact' ? '#dc2626' : sample.phase === 'approach' ? '#0e7d8b' : '#64748b';
}

/** Speed-vs-time curve with impact phase highlighted. */
export function SpeedChart({ samples, height = 200 }: { samples: TelemetrySample[]; height?: number }) {
  const data = useMemo(() => samples.map((s) => ({ time: s.time, speed: s.speed, phase: s.phase })), [samples]);
  const max = Math.max(10, ...data.map((d) => d.speed)) * 1.12;
  return <ChartFrame height={height}>
    <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
      <CartesianGrid stroke="#eef2f5" />
      <XAxis dataKey="time" tick={AXIS_STYLE} tickFormatter={(t: number) => `${t.toFixed(1)}s`} />
      <YAxis tick={AXIS_STYLE} domain={[0, max]} tickFormatter={(v: number) => `${Math.round(v)}`} />
      <Tooltip
        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
        formatter={(value: number | string, name: string) => [name === 'speed' ? `${Number(value).toFixed(1)} km/h` : value, name === 'speed' ? 'Speed' : name]}
        labelFormatter={(t) => `t = ${Number(t).toFixed(2)} s`}
      />
      <ReferenceLine x={APPROACH_SECONDS} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'impact', position: 'insideTopRight', fontSize: 9, fill: '#d97706' }} />
      <Line type="monotone" dataKey="speed" stroke="#0e7d8b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
    </LineChart>
  </ChartFrame>;
}

/** Acceleration-vs-time curve (negative during the deceleration pulse). */
export function AccelerationChart({ samples, height = 200 }: { samples: TelemetrySample[]; height?: number }) {
  const data = useMemo(() => samples.map((s) => ({ time: s.time, acceleration: s.acceleration })), [samples]);
  const bound = Math.max(10, ...data.map((d) => Math.abs(d.acceleration))) * 1.15;
  return <ChartFrame height={height}>
    <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
      <CartesianGrid stroke="#eef2f5" />
      <XAxis dataKey="time" tick={AXIS_STYLE} tickFormatter={(t: number) => `${t.toFixed(1)}s`} />
      <YAxis tick={AXIS_STYLE} domain={[-bound, 4]} tickFormatter={(v: number) => `${Math.round(v)}`} />
      <Tooltip
        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
        formatter={(value: number | string) => [`${Number(value).toFixed(1)} m/s²`, 'Acceleration']}
        labelFormatter={(t) => `t = ${Number(t).toFixed(2)} s`}
      />
      <ReferenceLine y={0} stroke="#94a3b8" />
      <Area type="monotone" dataKey="acceleration" stroke="#c92f35" strokeWidth={2} fill="#c92f3522" isAnimationActive={false} />
    </AreaChart>
  </ChartFrame>;
}

/** Kinetic-energy curve computed from the series speed and vehicle mass. */
export function EnergyChart({ samples, massKg, height = 200 }: { samples: TelemetrySample[]; massKg: number; height?: number }) {
  const data = useMemo(() => samples.map((s) => ({
    time: s.time,
    ke: 0.5 * massKg * Math.pow(s.speed / 3.6, 2) / 1000, // kJ
  })), [samples, massKg]);
  const max = Math.max(1, ...data.map((d) => d.ke)) * 1.12;
  return <ChartFrame height={height}>
    <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
      <CartesianGrid stroke="#eef2f5" />
      <XAxis dataKey="time" tick={AXIS_STYLE} tickFormatter={(t: number) => `${t.toFixed(1)}s`} />
      <YAxis tick={AXIS_STYLE} domain={[0, max]} tickFormatter={(v: number) => `${Math.round(v)}`} />
      <Tooltip
        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
        formatter={(value: number | string) => [`${Number(value).toFixed(1)} kJ`, 'Kinetic energy']}
        labelFormatter={(t) => `t = ${Number(t).toFixed(2)} s`}
      />
      <Area type="monotone" dataKey="ke" stroke="#7c3aed" strokeWidth={2} fill="#7c3aed18" isAnimationActive={false} />
    </AreaChart>
  </ChartFrame>;
}

/** Severity score decomposition for the analysis view. */
export function SeverityFactorChart({ factors }: { factors: { label: string; contribution: number }[] }) {
  const data = factors.filter((f) => f.contribution > 0);
  return <ChartFrame height={190}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 30 }}>
      <CartesianGrid stroke="#eef2f5" horizontal={false} />
      <XAxis type="number" domain={[0, 100]} tick={AXIS_STYLE} />
      <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10, fill: '#475569' }} />
      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(value: number | string) => [`${Number(value).toFixed(1)} points`, 'Contribution']} />
      <Bar dataKey="contribution" barSize={16} radius={[0, 4, 4, 0]}>
        {data.map((entry) => <Cell key={entry.label} fill={entry.contribution >= 26 ? '#dc2626' : entry.contribution >= 13 ? '#ea580c' : '#0e7d8b'} />)}
      </Bar>
    </BarChart>
  </ChartFrame>;
}

/** Severity distribution across stored records (analytics). */
export function SeverityDistributionChart({ counts }: { counts: { level: SeverityLevel; count: number }[] }) {
  const data = counts.map((c) => ({ name: c.level, count: c.count }));
  return <ChartFrame height={210}>
    <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
      <CartesianGrid stroke="#eef2f5" />
      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
      <YAxis tick={AXIS_STYLE} allowDecimals={false} />
      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(value: number | string) => [`${value}`, 'Simulations']} />
      <Bar dataKey="count" barSize={38} radius={[4, 4, 0, 0]}>
        {data.map((entry) => <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name as SeverityLevel]} />)}
      </Bar>
    </BarChart>
  </ChartFrame>;
}

/** ΔV vs estimated impact force scatter across stored records (analytics). */
export function DeltaVForceScatter({ points }: { points: { dv: number; force: number; level: SeverityLevel; id: string }[] }) {
  const maxDv = Math.max(5, ...points.map((p) => p.dv)) * 1.15;
  const maxF = Math.max(50, ...points.map((p) => p.force)) * 1.15;
  return <ChartFrame height={230}>
    <LineChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
      <CartesianGrid stroke="#eef2f5" />
      <XAxis type="number" dataKey="dv" tick={AXIS_STYLE} domain={[0, maxDv]} tickFormatter={(v: number) => `${v}`} />
      <YAxis type="number" dataKey="force" tick={AXIS_STYLE} domain={[0, maxF]} />
      <Tooltip
        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
        formatter={(value: number | string, name: string) => [name === 'force' ? `${Number(value).toFixed(0)} kN` : `${Number(value).toFixed(2)} km/h`, name === 'force' ? 'Est. force' : 'ΔV']}
      />
      <Line type="monotone" data={points} dataKey="force" stroke="transparent" dot={(props: { cx?: number; cy?: number; payload?: { dv: number; force: number; level: SeverityLevel; id: string } }) => {
        const point = props.payload;
        if (!point || props.cx === undefined || props.cy === undefined) return <g key="empty" />;
        return <circle key={point.id} cx={props.cx} cy={props.cy} r={5} fill={SEVERITY_COLORS[point.level]} fillOpacity={0.85} />;
      }} isAnimationActive={false} />
    </LineChart>
  </ChartFrame>;
}
