/**
 * RAKSHA SETU — crash lab pages.
 *
 * Simulator, Live Telemetry, Crash Analysis, Crash Reports (+ detail),
 * and About/Methodology. Every number on these pages is produced by the
 * engines in src/engine — nothing is hard-coded, nothing random.
 */

import { useMemo, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import {
  Activity, AlertTriangle, BarChart3, CarFront, ChevronLeft, ChevronRight, Download, FileText, FlaskConical,
  Gauge, Info, Play, RotateCcw, Save, Trash2, Zap,
} from 'lucide-react';
import type { SimulationInput } from '../engine/physics';
import { computePhysics, PHYSICS_FORMULAS } from '../engine/physics';
import type { SeverityLevel } from '../engine/severity';
import { IMPACT_TYPE_FACTORS, SEVERITY_ENVELOPES, SEVERITY_THRESHOLDS, SEVERITY_WEIGHTS } from '../engine/severity';
import { seriesDuration } from '../engine/simulation';
import type { SimulationRecord } from '../engine/records';
import { useSimulationStore } from '../engine/SimulationStore';
import {
  cn, Disclaimer, IMPACT_TYPES, LabCard, NumberField, Pill, SCENARIO_PRESETS, SEVERITY_COLORS,
  SelectField, severityBarClass, severityTextClass, validateInput,
} from './ui';
import {
  AccelerationChart, DeltaVForceScatter, EnergyChart, SeverityDistributionChart, SeverityFactorChart,
  SpeedChart, VehicleStage,
} from './visuals';

type PageProps = { pushToast?: (message: string, tone?: 'success' | 'warning' | 'info') => void };

const EMPTY_INPUT: SimulationInput = {
  vehicleMassKg: 1500,
  initialSpeedKmh: 80,
  impactSpeedKmh: 60,
  impactDurationS: 0.15,
  impactType: 'Frontal',
  roadSurface: 'Dry',
  vehicleCondition: 'Normal',
};

function severityPill(level: SeverityLevel) {
  return <Pill color={SEVERITY_COLORS[level]}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[level] }} />{level}</Pill>;
}

function Metric({ label, value, unit, hint, icon: IconComponent }: { label: string; value: string; unit?: string; hint?: string; icon?: typeof Gauge }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{IconComponent && <IconComponent size={12} />}{label}</p>
    <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-slate-800">{value}{unit && <span className="ml-1 text-[11px] font-medium text-slate-500">{unit}</span>}</p>
    {hint && <p className="mt-0.5 font-mono text-[9px] text-slate-400">{hint}</p>}
  </div>;
}

/* ================================ CRASH SIMULATOR ================================ */

export function SimulatorPage({ pushToast }: PageProps) {
  const { startRun, recordRun, playback, play, pause, reset, live } = useSimulationStore();
  const [input, setInput] = useState<SimulationInput>(EMPTY_INPUT);
  const [savedId, setSavedId] = useState<string | null>(null);
  const error = validateInput(input);
  const run = playback.run;
  const finished = playback.finished;
  const duration = run ? seriesDuration(run.samples) : 0;

  const setField = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) => setInput((current) => ({ ...current, [key]: value }));

  const start = () => {
    if (error) { pushToast?.(error, 'warning'); return; }
    const next = startRun(input);
    recordRun(next);
    setSavedId(next.id);
    pushToast?.(`Simulation ${next.id} started — severity ${next.severity.level}`, 'success');
  };

  const impactSeconds = 1.5; // approach phase length in the generated series

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">Set the crash parameters, run the deterministic physics pass, watch the vehicle and telemetry live.</p>
      <div className="flex gap-2">
        <Link href="/telemetry"><span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Activity size={14} />Live Telemetry</span></Link>
        {run && <Link href="/analysis"><span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800"><BarChart3 size={14} />Open analysis</span></Link>}
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      {/* ---------------- inputs ---------------- */}
      <LabCard eyebrow="Inputs" title="Vehicle & impact parameters">
        <div className="space-y-4">
          <NumberField label="Vehicle mass" unit="kg" value={input.vehicleMassKg} min={500} max={5000} step={10} onChange={(value) => setField('vehicleMassKg', Math.round(value))} />
          <NumberField label="Initial speed" unit="km/h" value={input.initialSpeedKmh} min={0} max={200} step={1} onChange={(value) => setField('initialSpeedKmh', Math.round(value))} />
          <NumberField label="Impact speed" unit="km/h" value={input.impactSpeedKmh} min={0} max={200} step={1} onChange={(value) => setField('impactSpeedKmh', Math.round(value))} />
          <NumberField label="Impact duration" unit="s" value={input.impactDurationS} min={0.01} max={2} step={0.01} onChange={(value) => setField('impactDurationS', Math.round(value * 100) / 100)} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Impact type" value={input.impactType} options={IMPACT_TYPES} onChange={(value) => setField('impactType', value)} />
            <SelectField label="Road surface" value={input.roadSurface} options={['Dry', 'Wet', 'Unknown'] as const} onChange={(value) => setField('roadSurface', value)} />
          </div>
          <SelectField label="Vehicle condition" value={input.vehicleCondition} options={['Normal', 'Heavy', 'Unknown'] as const} onChange={(value) => setField('vehicleCondition', value)} />

          {error && <p data-testid="text-sim-validation" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button data-testid="button-run-simulation" disabled={Boolean(error)} onClick={start} className={cn('col-span-2 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-bold text-white transition-colors', error ? 'cursor-not-allowed bg-slate-300' : 'bg-red-600 hover:bg-red-700')}>
              <Zap size={15} />Run simulation
            </button>
            <button data-testid="button-replay-simulation" disabled={!run} onClick={() => { reset(); play(); }} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><RotateCcw size={14} />Replay</button>
            <button data-testid="button-reset-inputs" onClick={() => { setInput(EMPTY_INPUT); setSavedId(null); reset(); }} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"><Trash2 size={14} />Reset bench</button>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Scenario presets</p>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIO_PRESETS.map((preset) => <button key={preset.label} data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s/g, '-')}`} onClick={() => { setInput(preset.input); setSavedId(null); }} className="rounded-lg border border-slate-200 p-2.5 text-left hover:border-cyan-300 hover:bg-cyan-50/40">
                <p className="text-[11px] font-extrabold text-slate-700">{preset.label}</p>
                <p className="mt-0.5 font-mono text-[9px] text-slate-500">{preset.detail}</p>
              </button>)}
            </div>
          </div>
          <Disclaimer compact />
        </div>
      </LabCard>

      {/* ---------------- stage + results ---------------- */}
      <div className="space-y-5">
        <LabCard eyebrow="2D simulation view" title="Vehicle dynamics stage" action={run && <span className="font-mono text-[10px] text-slate-400">{run.id}</span>}>
          <VehicleStage sample={live} run={run} />
          {run && <div className="mt-3 flex items-center justify-center gap-2">
            <button data-testid="button-playback-toggle" onClick={() => (playback.playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50">{playback.playing ? <Play size={13} className="rotate-180" /> : <Play size={13} />}{playback.playing ? 'Pause' : 'Play'}</button>
            <input aria-label="Playback position" type="range" min={0} max={duration} step={0.01} value={playback.elapsed} onChange={() => { /* scrubbing optional; deterministic series drives the view */ }} className="h-1.5 w-64 cursor-pointer appearance-none rounded-full bg-slate-200 accent-cyan-700" />
            <span className="font-mono text-[10px] text-slate-500">{playback.elapsed.toFixed(2)} / {duration.toFixed(2)} s</span>
          </div>}
        </LabCard>

        {run && live && <>
          <LabCard eyebrow="Live telemetry" title="Values streamed from the simulation engine">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Current speed" value={live.speed.toFixed(1)} unit="km/h" hint={`phase: ${live.phase}`} />
              <Metric label="Current accel" value={live.acceleration.toFixed(1)} unit="m/s²" hint="negative = decel" />
              <Metric label="Elapsed" value={live.time.toFixed(2)} unit="s" hint={`impact @ ${impactSeconds.toFixed(2)} s`} />
              <Metric label="Impact status" value={live.phase === 'impact' ? 'DETECTED' : live.phase === 'post-impact' ? 'PASSED' : 'STANDBY'} hint={live.phase === 'impact' ? 'deceleration pulse' : undefined} />
            </div>
          </LabCard>

          <LabCard eyebrow="Headline results" title={finished ? `Simulation complete — ${run.id}` : `Computing — ${run.id}`} action={savedId === run.id && <Pill color="#059669"><Save size={11} />Saved to history</Pill>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Metric label="ΔV" value={run.physics.deltaVMps.toFixed(2)} unit="m/s" hint={`${run.physics.deltaVKmh.toFixed(1)} km/h`} />
              <Metric label="Deceleration" value={run.physics.decelerationMps2.toFixed(1)} unit="m/s²" hint={`${run.physics.gForce.toFixed(2)} g`} />
              <Metric label="Est. avg impact force" value={run.physics.estimatedForceKN.toFixed(1)} unit="kN" hint={`${Math.round(run.physics.estimatedForceN)} N`} />
              <Metric label="KE at initial speed" value={(run.physics.initialKineticEnergyJ / 1000).toFixed(0)} unit="kJ" />
              <Metric label="Energy dissipated" value={(run.physics.energyDissipatedJ / 1000).toFixed(0)} unit="kJ" hint="KE initial − KE impact" />
              <Metric label="Severity score" value={run.severity.score.toFixed(1)} unit="/100" hint={run.severity.level} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              {severityPill(run.severity.level)}
              <div className="h-2 flex-1 min-w-32 overflow-hidden rounded-full bg-slate-200"><div className={cn('h-full rounded-full', severityBarClass(run.severity.level))} style={{ width: `${run.severity.score}%` }} /></div>
              <p className="text-[11px] font-semibold text-slate-600">{run.severity.reason}</p>
            </div>
            <div className="mt-3"><Disclaimer compact /></div>
          </LabCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <LabCard eyebrow="Chart · speed vs time" title="Velocity profile"><SpeedChart samples={run.samples} /></LabCard>
            <LabCard eyebrow="Chart · acceleration vs time" title="Deceleration pulse"><AccelerationChart samples={run.samples} /></LabCard>
          </div>
        </>}

        {!run && <LabCard eyebrow="Bench" title="No simulation yet">
          <p className="text-xs text-slate-500">Configure the inputs on the left and press <b>Run simulation</b>. The physics pass, severity classification and telemetry series are all derived from your inputs — the validation case (1500 kg · 80→60 km/h · 0.15 s) is available as a preset.</p>
        </LabCard>}
      </div>
    </div>
  </div>;
}

/* ================================ LIVE TELEMETRY ================================ */

export function TelemetryPage() {
  const { playback, play, pause, reset, live } = useSimulationStore();
  const run = playback.run;
  if (!run || !live) return <div className="mx-auto max-w-[1100px]">
    <LabCard eyebrow="Live telemetry" title="No active simulation">
      <p className="text-xs text-slate-500">Start a run in the Crash Simulator — this view then streams speed, acceleration and phase from the same deterministic series, so telemetry can never drift from the simulation.</p>
      <Link href="/simulator"><span className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-800"><FlaskConical size={14} />Open Crash Simulator</span></Link>
    </LabCard>
  </div>;

  const duration = seriesDuration(run.samples);
  const impactLive = live.phase === 'impact';
  const vehicleStatus = live.phase === 'approach' ? 'CRUISING' : live.phase === 'impact' ? 'IMPACT PULSE' : 'RUN-OUT';

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">Streamed from simulation <b className="font-mono">{run.id}</b> · {run.input.vehicleMassKg} kg · {run.input.initialSpeedKmh}→{run.input.impactSpeedKmh} km/h · {run.input.impactType}</p>
      <div className="flex gap-2">
        <button data-testid="button-telemetry-toggle" onClick={() => (playback.playing ? pause() : play())} className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800"><Play size={13} />{playback.playing ? 'Pause' : playback.finished ? 'Replay' : 'Play'}</button>
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><RotateCcw size={13} />Reset</button>
      </div>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <LabCard eyebrow="2D view" title="Impact stage"><VehicleStage sample={live} run={run} /></LabCard>
      <LabCard eyebrow="Live values" title="Telemetry at playback position">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Current speed" value={live.speed.toFixed(1)} unit="km/h" />
          <Metric label="Current acceleration" value={live.acceleration.toFixed(1)} unit="m/s²" />
          <Metric label="Elapsed time" value={live.time.toFixed(2)} unit="s" hint={`of ${duration.toFixed(2)} s`} />
          <Metric label="ΔV (engine)" value={run.physics.deltaVMps.toFixed(2)} unit="m/s" />
          <Metric label="Estimated force" value={run.physics.estimatedForceKN.toFixed(1)} unit="kN" />
          <Metric label="G-force" value={run.physics.gForce.toFixed(2)} unit="g" />
          <Metric label="Vehicle status" value={vehicleStatus} />
          <Metric label="Impact status" value={impactLive ? 'IMPACT DETECTED' : live.phase === 'post-impact' ? 'POST-IMPACT' : 'STANDBY'} />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          {severityPill(run.severity.level)}
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={cn('h-full rounded-full', severityBarClass(run.severity.level))} style={{ width: `${run.severity.score}%` }} /></div>
          <span className="font-mono text-[10px] text-slate-500">{run.severity.score.toFixed(1)}/100</span>
        </div>
      </LabCard>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <LabCard eyebrow="Chart" title="Speed vs time"><SpeedChart samples={run.samples} /></LabCard>
      <LabCard eyebrow="Chart" title="Acceleration vs time"><AccelerationChart samples={run.samples} /></LabCard>
    </div>
    <Disclaimer />
  </div>;
}

/* ================================ CRASH ANALYSIS ================================ */

export function AnalysisPage() {
  const { playback } = useSimulationStore();
  const run = playback.run;
  if (!run) return <div className="mx-auto max-w-[1100px]">
    <LabCard eyebrow="Crash analysis" title="Nothing to analyse yet">
      <p className="text-xs text-slate-500">Run a simulation first — analysis breaks down the physics result, the severity score and the energy budget of the most recent run.</p>
      <Link href="/simulator"><span className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-800"><FlaskConical size={14} />Open Crash Simulator</span></Link>
    </LabCard>
  </div>;

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">Deterministic breakdown of <b className="font-mono">{run.id}</b> — identical inputs always reproduce this exact analysis.</p>
      <Link href="/reports"><span className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><FileText size={14} />Saved reports</span></Link>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="ΔV" value={run.physics.deltaVMps.toFixed(2)} unit="m/s" hint={`${run.physics.deltaVKmh.toFixed(1)} km/h change`} icon={Gauge} />
      <Metric label="Average deceleration" value={run.physics.decelerationMps2.toFixed(1)} unit="m/s²" hint={`${run.physics.gForce.toFixed(2)} g`} icon={Activity} />
      <Metric label="Estimated avg impact force" value={run.physics.estimatedForceKN.toFixed(1)} unit="kN" hint={`${Math.round(run.physics.estimatedForceN)} N · F = m·a`} icon={Zap} />
      <Metric label="Energy dissipated" value={(run.physics.energyDissipatedJ / 1000).toFixed(0)} unit="kJ" hint={`of ${(run.physics.initialKineticEnergyJ / 1000).toFixed(0)} kJ initial`} icon={CarFront} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <LabCard eyebrow="Severity model" title={`Why ${run.severity.level} — score ${run.severity.score.toFixed(1)}/100`}>
        <p className="text-xs leading-5 text-slate-600">{run.severity.reason}</p>
        <div className="mt-4"><SeverityFactorChart factors={run.severity.factors} /></div>
        <div className="mt-3 space-y-2">{run.severity.factors.map((factor) => <div key={factor.label} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <div><p className="text-[11px] font-extrabold text-slate-700">{factor.label}</p><p className="font-mono text-[9px] text-slate-500">{factor.detail}</p></div>
          <span className="font-mono text-xs font-bold text-slate-700">{factor.contribution > 0 ? `+${factor.contribution.toFixed(1)}` : '×'}</span>
        </div>)}</div>
      </LabCard>
      <div className="space-y-5">
        <LabCard eyebrow="Chart" title="Speed vs time"><SpeedChart samples={run.samples} height={190} /></LabCard>
        <LabCard eyebrow="Chart" title="Kinetic energy vs time"><EnergyChart samples={run.samples} massKg={run.input.vehicleMassKg} height={190} /></LabCard>
      </div>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <LabCard eyebrow="Chart" title="Acceleration vs time"><AccelerationChart samples={run.samples} /></LabCard>
      <LabCard eyebrow="Methodology" title="How these numbers were produced">
        <div className="space-y-2 font-mono text-[11px] text-slate-600">
          <p>{PHYSICS_FORMULAS.velocityConversion} → {run.physics.initialVelocityMps.toFixed(2)} m/s → {run.physics.impactVelocityMps.toFixed(2)} m/s</p>
          <p>{PHYSICS_FORMULAS.deltaV} → {run.physics.deltaVMps.toFixed(2)} m/s</p>
          <p>{PHYSICS_FORMULAS.deceleration} → {run.physics.decelerationMps2.toFixed(1)} m/s²</p>
          <p>{PHYSICS_FORMULAS.gForce} → {run.physics.gForce.toFixed(2)} g</p>
          <p>{PHYSICS_FORMULAS.force} → {run.physics.estimatedForceKN.toFixed(1)} kN</p>
          <p>{PHYSICS_FORMULAS.kineticEnergy} → {(run.physics.initialKineticEnergyJ / 1000).toFixed(0)} kJ → {(run.physics.impactKineticEnergyJ / 1000).toFixed(0)} kJ</p>
        </div>
        <div className="mt-3"><Disclaimer compact /></div>
      </LabCard>
    </div>
  </div>;
}

/* ================================ CRASH REPORTS ================================ */

export function ReportsPage({ pushToast }: PageProps) {
  const { records, deleteRecord, clearAll, loadRecord } = useSimulationStore();
  const [, setLocation] = useLocation();
  const [confirmClear, setConfirmClear] = useState(false);

  const openReport = (id: string) => setLocation(`/reports/${encodeURIComponent(id)}`);
  const replay = (record: SimulationRecord) => { loadRecord(record); setLocation('/telemetry'); pushToast?.(`${record.id} loaded into live telemetry`, 'info'); };
  const remove = (record: SimulationRecord) => { deleteRecord(record.id); pushToast?.(`${record.id} deleted from history`, 'info'); };

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">{records.length} stored simulation record{records.length === 1 ? '' : 's'} · every dashboard statistic derives from these.</p>
      {records.length > 0 && (confirmClear
        ? <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-red-700">Delete all records?</span>
          <button data-testid="button-confirm-clear-history" onClick={() => { clearAll(); setConfirmClear(false); pushToast?.('Simulation history cleared', 'info'); }} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Yes, clear all</button>
          <button onClick={() => setConfirmClear(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">Keep</button></div>
        : <button data-testid="button-clear-history" onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Trash2 size={14} />Clear history</button>)}
    </div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left">
        <thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Simulation ID', 'Recorded', 'Mass', 'Speeds', 'ΔV', 'Deceleration', 'Est. force', 'Severity', 'Type', ''].map((heading) => <th key={heading} className="px-4 py-3 font-mono text-[9px] font-medium uppercase tracking-[.12em] text-slate-400">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => <tr key={record.id} data-testid={`row-report-${record.id}`} className="hover:bg-cyan-50/30">
            <td className="px-4 py-3"><button onClick={() => openReport(record.id)} className="font-mono text-[11px] font-bold text-cyan-700 hover:underline">{record.id}</button></td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{record.recordedAt}</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.input.vehicleMassKg} kg</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.input.initialSpeedKmh}→{record.input.impactSpeedKmh} km/h</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.physics.deltaVKmh.toFixed(1)} km/h</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.physics.decelerationMps2.toFixed(1)} m/s²</td>
            <td className="px-4 py-3 font-mono text-[10px] text-slate-600">{record.physics.estimatedForceKN.toFixed(1)} kN</td>
            <td className="px-4 py-3">{severityPill(record.severity.level)}</td>
            <td className="px-4 py-3 text-xs text-slate-600">{record.input.impactType}</td>
            <td className="px-4 py-3"><div className="flex items-center gap-1">
              <button title="Open detailed report" data-testid={`button-open-report-${record.id}`} onClick={() => openReport(record.id)} className="rounded-md p-1.5 text-cyan-700 hover:bg-cyan-50"><ChevronRight size={15} /></button>
              <button title="Replay in telemetry" onClick={() => replay(record)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><Play size={14} /></button>
              <button title="Delete record" onClick={() => remove(record)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
            </div></td>
          </tr>)}
        </tbody>
      </table></div>
      {records.length === 0 && <div className="p-6"><p className="text-sm font-bold text-slate-700">No simulation records yet</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">Run a crash simulation to create the first report — dashboard stats, analytics and this table all fill from stored records.</p><Link href="/simulator"><span className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white"><FlaskConical size={14} />Open Crash Simulator</span></Link></div>}
    </section>
  </div>;
}

export function ReportDetailPage({ pushToast }: PageProps) {
  const [match, params] = useRoute('/reports/:id');
  const { records } = useSimulationStore();
  const [, setLocation] = useLocation();
  const record = useMemo(() => (match && params?.id ? records.find((entry) => entry.id === decodeURIComponent(params.id)) : undefined), [match, params, records]);

  if (!record) return <div className="mx-auto max-w-[900px]">
    <LabCard eyebrow="Crash report" title="Report not found">
      <p className="text-xs text-slate-500">This simulation ID is not in the stored history (it may have been cleared or run in another browser).</p>
      <Link href="/reports"><span className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white"><ChevronLeft size={14} />Back to reports</span></Link>
    </LabCard>
  </div>;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${record.id}.json`; anchor.click();
    URL.revokeObjectURL(url);
    pushToast?.(`${record.id} exported as JSON`, 'success');
  };

  const [i, p, s] = [record.input, record.physics, record.severity];

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link href="/reports"><span className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-cyan-700 hover:underline"><ChevronLeft size={13} />All reports</span></Link>
        <h2 className="mt-1 font-mono text-lg font-extrabold tracking-tight text-slate-800">{record.id}</h2>
        <p className="text-xs text-slate-500">Recorded {record.recordedAt} · {i.impactType} impact · {i.roadSurface} road · {i.vehicleCondition} vehicle</p>
      </div>
      <div className="flex gap-2">
        <button data-testid="button-export-report" onClick={exportJson} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Download size={14} />Export JSON</button>
        {severityPill(s.level)}
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Metric label="Mass" value={`${i.vehicleMassKg}`} unit="kg" />
      <Metric label="Initial → impact speed" value={`${i.initialSpeedKmh}→${i.impactSpeedKmh}`} unit="km/h" />
      <Metric label="Impact duration" value={i.impactDurationS.toFixed(2)} unit="s" />
      <Metric label="ΔV" value={p.deltaVMps.toFixed(2)} unit="m/s" hint={`${p.deltaVKmh.toFixed(1)} km/h`} />
      <Metric label="Deceleration" value={p.decelerationMps2.toFixed(1)} unit="m/s²" hint={`${p.gForce.toFixed(2)} g`} />
      <Metric label="Est. avg impact force" value={p.estimatedForceKN.toFixed(1)} unit="kN" hint={`${Math.round(p.estimatedForceN)} N`} />
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Severity — {s.score.toFixed(1)}/100</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className={cn('h-full rounded-full', severityBarClass(s.level))} style={{ width: `${s.score}%` }} /></div>
        <span className={cn('font-mono text-sm font-extrabold', severityTextClass(s.level))}>{s.level}</span>
      </div>
      <p className="mt-2 text-xs text-slate-600">{s.reason}</p>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <LabCard eyebrow="Chart" title="Speed vs time"><SpeedChart samples={record.samples} /></LabCard>
      <LabCard eyebrow="Chart" title="Acceleration vs time"><AccelerationChart samples={record.samples} /></LabCard>
      <LabCard eyebrow="Chart" title="Kinetic energy vs time"><EnergyChart samples={record.samples} massKg={i.vehicleMassKg} /></LabCard>
      <LabCard eyebrow="Severity decomposition" title="Factor contributions"><SeverityFactorChart factors={s.factors} /></LabCard>
    </div>

    <LabCard eyebrow="Calculation trail" title="Formulas as applied to this record">
      <div className="grid gap-2 font-mono text-[11px] text-slate-600 sm:grid-cols-2">
        <p>{PHYSICS_FORMULAS.velocityConversion} → {p.initialVelocityMps.toFixed(2)} / {p.impactVelocityMps.toFixed(2)} m/s</p>
        <p>{PHYSICS_FORMULAS.deltaV} → {p.deltaVMps.toFixed(2)} m/s</p>
        <p>{PHYSICS_FORMULAS.deceleration} → {p.decelerationMps2.toFixed(1)} m/s²</p>
        <p>{PHYSICS_FORMULAS.gForce} → {p.gForce.toFixed(2)} g</p>
        <p>{PHYSICS_FORMULAS.force} → {p.estimatedForceN.toFixed(0)} N</p>
        <p>{PHYSICS_FORMULAS.kineticEnergy} → {(p.initialKineticEnergyJ / 1000).toFixed(0)} kJ / {(p.impactKineticEnergyJ / 1000).toFixed(0)} kJ</p>
      </div>
      <div className="mt-3"><Disclaimer compact /></div>
    </LabCard>

    <button onClick={() => setLocation('/telemetry')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Play size={13} />Replay this crash in Live Telemetry</button>
  </div>;
}

/* ================================ ABOUT / METHODOLOGY ================================ */

export function MethodologyPage() {
  const validation = computePhysics({ vehicleMassKg: 1500, initialSpeedKmh: 80, impactSpeedKmh: 60, impactDurationS: 0.15, impactType: 'Frontal', roadSurface: 'Dry', vehicleCondition: 'Normal' });

  return <div className="mx-auto max-w-[1100px] space-y-5">
    <LabCard eyebrow="About" title="What this platform is">
      <p className="text-xs leading-5 text-slate-600">RAKSHA SETU's crash lab is a <b>simulation, engineering and educational demonstrator</b>: it converts scenario inputs (mass, speeds, impact duration, type) into vehicle-dynamics results through a transparent one-dimensional physics model, classifies severity with a published deterministic rule, and streams the resulting telemetry through charts and a 2D stage. It is <b>not</b> a certified crash reconstruction system, a medical assessment system, or a real emergency-dispatch system.</p>
      <div className="mt-3"><Disclaimer /></div>
    </LabCard>

    <LabCard eyebrow="Physics engine" title="Formulas (SI internally, km/h at the UI)">
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(PHYSICS_FORMULAS).map(([key, formula]) => <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</p><p className="mt-1 font-mono text-[12px] font-bold text-slate-700">{formula}</p></div>)}
      </div>
      <p className="mt-3 text-[11px] leading-5 text-slate-500">The model assumes constant average deceleration over the impact duration and treats the vehicle as a rigid point mass. Real crashes involve rotation, crush zones, occupant motion and multi-axial forces — none of which this demonstrator models.</p>
    </LabCard>

    <LabCard eyebrow="Validation" title="Worked example — computed live, never hard-coded">
      <p className="text-xs text-slate-600">Inputs: mass 1500 kg · initial 80 km/h · impact 60 km/h · duration 0.15 s. Expected approximate values (spec): ΔV 5.56 m/s · deceleration 37.04 m/s² · 3.78 g · estimated average impact force 55.56 kN.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Initial velocity" value={validation.initialVelocityMps.toFixed(2)} unit="m/s" hint="80 / 3.6" />
        <Metric label="ΔV" value={validation.deltaVMps.toFixed(2)} unit="m/s" hint="|22.22 − 16.67|" />
        <Metric label="Deceleration" value={validation.decelerationMps2.toFixed(2)} unit="m/s²" hint={`${validation.gForce.toFixed(2)} g`} />
        <Metric label="Est. force" value={validation.estimatedForceKN.toFixed(2)} unit="kN" hint="1500 × 37.04 N" />
      </div>
      <p className="mt-2 font-mono text-[10px] text-slate-400">These values are generated by src/engine/physics.ts at render time.</p>
    </LabCard>

    <LabCard eyebrow="Severity engine" title="Deterministic scoring rule (demonstration model)">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weights</p>
          <div className="mt-2 space-y-1.5">{Object.entries(SEVERITY_WEIGHTS).map(([factor, weight]) => <div key={factor} className="flex items-center gap-2 text-[11px]"><span className="w-24 font-bold capitalize text-slate-600">{factor}</span><div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${weight * 100 * 2}%` }} /></div><span className="w-10 text-right font-mono text-slate-500">{Math.round(weight * 100)}%</span></div>)}</div>
          <p className="mt-2 font-mono text-[9px] leading-4 text-slate-400">Envelopes: ΔV {SEVERITY_ENVELOPES.deltaV} m/s · decel {SEVERITY_ENVELOPES.deceleration} m/s² · force {SEVERITY_ENVELOPES.forceKN} kN · duration {SEVERITY_ENVELOPES.duration} s (inverted). Impact-type factor: {Object.entries(IMPACT_TYPE_FACTORS).map(([type, factor]) => `${type} ×${factor}`).join(' · ')}.</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category thresholds</p>
          <div className="mt-2 space-y-1.5">{(Object.entries(SEVERITY_THRESHOLDS) as [SeverityLevel, readonly number[]][]).map(([level, [lo, hi]]) => <div key={level} className="flex items-center gap-2 text-[11px]"><span className={cn('w-20 rounded px-1.5 py-0.5 text-center font-mono font-bold text-white', severityBarClass(level).replace('bg-', 'bg-'))} style={{ backgroundColor: SEVERITY_COLORS[level] }}>{level}</span><span className="font-mono text-slate-500">{lo}–{hi}</span></div>)}</div>
          <p className="mt-3 rounded-lg border border-dashed border-amber-300 bg-[#fff8e3] p-2.5 text-[10px] leading-4 text-amber-900">Severity classification is a demonstration rule based on simulated vehicle dynamics. It is not a certified crashworthiness or medical severity assessment.</p>
        </div>
      </div>
    </LabCard>

    <LabCard eyebrow="Simulation engine" title="Deterministic telemetry series">
      <div className="space-y-2 text-[11px] leading-5 text-slate-600">
        <p><b>Phase 1 — approach (0 → 1.5 s):</b> constant initial speed, sampled at 100 ms.</p>
        <p><b>Phase 2 — impact pulse (Δt):</b> speed follows a half-sine decay from initial to impact speed, v(t) = v₁ + ΔV·(1 + cos(πt/Δt))/2, with instantaneous acceleration a(t) = −ΔV·π/(2Δt)·sin(πt/Δt). The pulse's average acceleration equals the constant-deceleration headline, so charts and summary numbers always agree.</p>
        <p><b>Phase 3 — run-out (1 s):</b> vehicle continues at the impact speed.</p>
        <p>For identical inputs the produced series is always identical — there is no random telemetry anywhere in the platform.</p>
      </div>
    </LabCard>

    <LabCard eyebrow="Emergency-response context" title="What is and isn't contacted">
      <div className="space-y-2 text-[11px] leading-5 text-slate-600">
        <p>The control-center pages (incidents, dispatch, cancellation window, contact notifications) operate on <b>local simulated data</b>. When the optional vehicle-integration bridge and api-server are running, demo crash events flow through the real ingest pipeline — SMS providers run in demo/queue mode unless real credentials are configured.</p>
        <p>No police, ambulance, hospital or ERSS-112 service is ever contacted by this software. See <b>DEPLOYMENT.md</b> at the repository root for the legal roadmap toward authorized integration.</p>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[10px] font-semibold text-slate-500"><Info size={13} />Version 1.0 · simulation bench build · runs fully offline after install.</div>
    </LabCard>
  </div>;
}

/* ================================ ANALYTICS (sim section) ================================ */

/** Crash-lab analytics derived from stored records — embedded into the Analytics page. */
export function SimulationAnalyticsSection() {
  const { records } = useSimulationStore();
  const counts = useMemo(() => {
    const levels: SeverityLevel[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
    return levels.map((level) => ({ level, count: records.filter((record) => record.severity.level === level).length }));
  }, [records]);
  const points = useMemo(() => records.map((record) => ({ dv: record.physics.deltaVKmh, force: record.physics.estimatedForceKN, level: record.severity.level, id: record.id })), [records]);
  const avgForce = records.length ? records.reduce((total, record) => total + record.physics.estimatedForceKN, 0) / records.length : 0;

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Stored simulations" value={String(records.length)} icon={FlaskConical} />
      <Metric label="Critical simulations" value={String(counts.find((c) => c.level === 'CRITICAL')?.count ?? 0)} icon={Zap} />
      <Metric label="Avg estimated force" value={avgForce.toFixed(1)} unit="kN" icon={Activity} />
      <Metric label="Avg ΔV" value={records.length ? (records.reduce((total, record) => total + record.physics.deltaVKmh, 0) / records.length).toFixed(1) : '0.0'} unit="km/h" icon={Gauge} />
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <LabCard eyebrow="Crash lab · severity mix" title="Simulations by severity class"><SeverityDistributionChart counts={counts} /></LabCard>
      <LabCard eyebrow="Crash lab · dynamics" title="ΔV vs estimated impact force"><DeltaVForceScatter points={points} /></LabCard>
    </div>
    {records.length === 0 && <p className="text-[11px] text-slate-500">No crash-lab records yet — run simulations in the Crash Simulator and these charts fill from your stored history.</p>}
  </div>;
}
