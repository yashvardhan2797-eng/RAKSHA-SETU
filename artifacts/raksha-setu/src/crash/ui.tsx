/**
 * RAKSHA SETU — crash lab shared UI primitives.
 *
 * Presentational helpers used by the Simulator, Live Telemetry, Analysis,
 * Reports and Methodology views. No business logic lives here — all numbers
 * come from src/engine.
 */

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { ImpactType, SimulationInput } from '../engine/physics';
import type { SeverityLevel } from '../engine/severity';
import type { TelemetrySample } from '../engine/simulation';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  LOW: '#059669',
  MODERATE: '#d97706',
  HIGH: '#ea580c',
  CRITICAL: '#dc2626',
};

export function severityTextClass(level: SeverityLevel): string {
  return { LOW: 'text-emerald-600', MODERATE: 'text-amber-600', HIGH: 'text-orange-600', CRITICAL: 'text-red-600' }[level];
}

export function severityBarClass(level: SeverityLevel): string {
  return { LOW: 'bg-emerald-500', MODERATE: 'bg-amber-500', HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500' }[level];
}

/** Compact mono label used across the lab. */
export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em]" style={color ? { color, borderColor: `${color}55`, backgroundColor: `${color}0f` } : undefined}>{children}</span>;
}

export function LabCard({ eyebrow, title, action, children }: { eyebrow?: string; title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(22,38,58,.03)]">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-cyan-700">{eyebrow}</p><h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-800">{title}</h2></div>
      {action}
    </div>
    {children}
  </section>;
}

/** The simulation disclaimer, shown on every lab surface. */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return <p className={cn('flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-[#fff8e3] text-amber-900', compact ? 'px-3 py-2 text-[10px] leading-4' : 'px-3.5 py-2.5 text-[11px] leading-5')}>
    <Info size={13} className="mt-0.5 shrink-0" />
    <span>Simulation only — results are based on a simplified physics model and are not a certified crash reconstruction or automotive safety assessment.</span>
  </p>;
}

export type ValidationError = string | null;

/** Validates one simulation input; returns a human-readable error or null. */
export function validateInput(input: SimulationInput): ValidationError {
  if (!Number.isFinite(input.vehicleMassKg) || input.vehicleMassKg < 500 || input.vehicleMassKg > 5000) return 'Vehicle mass must be between 500 and 5000 kg.';
  if (!Number.isFinite(input.initialSpeedKmh) || input.initialSpeedKmh < 0 || input.initialSpeedKmh > 200) return 'Initial speed must be between 0 and 200 km/h.';
  if (!Number.isFinite(input.impactSpeedKmh) || input.impactSpeedKmh < 0 || input.impactSpeedKmh > 200) return 'Impact speed must be between 0 and 200 km/h.';
  if (input.impactSpeedKmh > input.initialSpeedKmh) return 'For a normal impact scenario the impact speed cannot exceed the initial speed.';
  if (!Number.isFinite(input.impactDurationS) || input.impactDurationS < 0.01 || input.impactDurationS > 2) return 'Impact duration must be between 0.01 and 2.00 seconds.';
  return null;
}

export const IMPACT_TYPES: ImpactType[] = ['Frontal', 'Rear', 'Side', 'Oblique', 'Static Object'];

/** Slider + numeric input that stay synchronized, with min/max hints. */
export function NumberField({ label, unit, value, min, max, step, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return <div>
    <div className="flex items-baseline justify-between">
      <label className="text-xs font-bold text-slate-600">{label}</label>
      <span className="font-mono text-[9px] text-slate-400">{min}–{max} {unit}</span>
    </div>
    <div className="mt-1.5 flex items-center gap-2">
      <input
        aria-label={`${label} slider`}
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-700"
      />
      <div className="flex w-24 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 px-2 focus-within:border-cyan-500">
        <input
          aria-label={`${label} value`}
          type="number" min={min} max={max} step={step} value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          data-testid={`input-sim-${label.toLowerCase().replace(/\s/g, '-')}`}
          className="w-full bg-transparent py-2 text-right font-mono text-xs font-bold text-slate-700 outline-none"
        />
        <span className="pl-1 font-mono text-[9px] text-slate-400">{unit}</span>
      </div>
    </div>
  </div>;
}

export function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <label className="block text-xs font-bold text-slate-600">{label}
    <select value={value} onChange={(event) => onChange(event.target.value as T)} data-testid={`select-sim-${label.toLowerCase().replace(/\s/g, '-')}`} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-cyan-500">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

export type ScenarioPreset = { label: string; detail: string; input: SimulationInput };

/** Ready-made engineering scenarios — all values flow through the physics engine. */
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { label: 'Validation case', detail: '1500 kg · 80→60 km/h · 0.15 s', input: { vehicleMassKg: 1500, initialSpeedKmh: 80, impactSpeedKmh: 60, impactDurationS: 0.15, impactType: 'Frontal', roadSurface: 'Dry', vehicleCondition: 'Normal' } },
  { label: 'City rear-end', detail: '1200 kg · 40→25 km/h · 0.20 s', input: { vehicleMassKg: 1200, initialSpeedKmh: 40, impactSpeedKmh: 25, impactDurationS: 0.2, impactType: 'Rear', roadSurface: 'Wet', vehicleCondition: 'Normal' } },
  { label: 'Highway barrier', detail: '1600 kg · 110→0 km/h · 0.12 s', input: { vehicleMassKg: 1600, initialSpeedKmh: 110, impactSpeedKmh: 0, impactDurationS: 0.12, impactType: 'Static Object', roadSurface: 'Dry', vehicleCondition: 'Normal' } },
  { label: 'Intersection side', detail: '1800 kg · 65→30 km/h · 0.18 s', input: { vehicleMassKg: 1800, initialSpeedKmh: 65, impactSpeedKmh: 30, impactDurationS: 0.18, impactType: 'Side', roadSurface: 'Dry', vehicleCondition: 'Heavy' } },
];

/** Formats a telemetry sample for compact display. */
export function sampleSpeedKmh(sample: TelemetrySample): number {
  return sample.speed;
}
