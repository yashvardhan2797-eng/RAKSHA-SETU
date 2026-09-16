/**
 * RAKSHA SETU — simulation store.
 *
 * React context holding: the localStorage-backed record history and the LIVE
 * simulation runner (deterministic playback that Simulator and Live Telemetry
 * both consume, so telemetry can never drift from the simulation).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addRecord, clearRecords, loadRecords, removeRecord, saveRecords, computeStats, type SimulationRecord, type SimulationStats } from './records';
import { runSimulation, sampleAt, seriesDuration, type SimulationRun, type TelemetrySample } from './simulation';
import type { SimulationInput } from './physics';

export type PlaybackState = {
  run: SimulationRun | null;
  /** seconds of playback elapsed (drives telemetry + visualization) */
  elapsed: number;
  playing: boolean;
  finished: boolean;
};

type SimulationStore = {
  records: SimulationRecord[];
  stats: SimulationStats;
  recordRun: (run: SimulationRun) => void;
  deleteRecord: (id: string) => void;
  clearAll: () => void;
  // live runner
  playback: PlaybackState;
  startRun: (input: SimulationInput) => SimulationRun;
  play: () => void;
  pause: () => void;
  reset: () => void;
  loadRecord: (record: SimulationRecord) => void;
  /** the sample at the current playback position */
  live: TelemetrySample | null;
};

const SimulationContext = createContext<SimulationStore | null>(null);

export function useSimulationStore(): SimulationStore {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('SimulationStore is unavailable — wrap the app in <SimulationStoreProvider>');
  return context;
}

const PLAYBACK_RATE = 1; // 1 s of series per real second (series is ~2.6 s long)

export function SimulationStoreProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<SimulationRecord[]>(() => loadRecords());
  const [playback, setPlayback] = useState<PlaybackState>({ run: null, elapsed: 0, playing: false, finished: false });
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  // Deterministic playback loop: advances `elapsed` from real frame time.
  useEffect(() => {
    if (!playback.playing || !playback.run) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const delta = ((now - lastTickRef.current) / 1000) * PLAYBACK_RATE;
      lastTickRef.current = now;
      setPlayback((current) => {
        if (!current.run || !current.playing) return current;
        const duration = seriesDuration(current.run.samples);
        const elapsed = current.elapsed + delta;
        if (elapsed >= duration) return { ...current, elapsed: duration, playing: false, finished: true };
        return { ...current, elapsed };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playback.playing, playback.run]);

  const recordRun = useCallback((run: SimulationRun) => {
    setRecords((current) => addRecord(current, { ...run, recordedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }));
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords((current) => removeRecord(current, id));
  }, []);

  const clearAll = useCallback(() => setRecords(clearRecords()), []);

  const startRun = useCallback((input: SimulationInput) => {
    const run = runSimulation(input);
    setPlayback({ run, elapsed: 0, playing: true, finished: false });
    return run;
  }, []);

  // Play resumes from the current position — or restarts cleanly when the run finished.
  const play = useCallback(() => setPlayback((current) => {
    if (!current.run) return current;
    const done = current.finished || current.elapsed >= seriesDuration(current.run.samples);
    return done ? { ...current, elapsed: 0, playing: true, finished: false } : { ...current, playing: true, finished: false };
  }), []);
  const pause = useCallback(() => setPlayback((current) => ({ ...current, playing: false })), []);
  const reset = useCallback(() => setPlayback((current) => ({ run: current.run, elapsed: 0, playing: false, finished: false })), []);

  const loadRecord = useCallback((record: SimulationRecord) => {
    setPlayback({ run: record, elapsed: 0, playing: false, finished: false });
  }, []);

  const live = useMemo(() => {
    if (!playback.run) return null;
    return sampleAt(playback.run.samples, playback.elapsed);
  }, [playback]);

  const stats = useMemo(() => computeStats(records), [records]);

  const value: SimulationStore = { records, stats, recordRun, deleteRecord, clearAll, playback, startRun, play, pause, reset, loadRecord, live };
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}
