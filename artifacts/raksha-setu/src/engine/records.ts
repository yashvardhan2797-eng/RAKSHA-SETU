/**
 * RAKSHA SETU — simulation record store.
 *
 * Persists completed simulations to localStorage so Dashboard statistics,
 * History, Reports and Analytics are always derived from real stored records —
 * never hard-coded. Falls back gracefully when storage is unavailable.
 */

import type { SimulationRun } from './simulation';

const STORAGE_KEY = 'rs-simulations-v1';
const MAX_RECORDS = 200;

export type SimulationRecord = SimulationRun & {
  /** wall-clock time shown in tables (IST-style locale string) */
  recordedAt: string;
};

function safeParse(raw: string | null): SimulationRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SimulationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadRecords(): SimulationRecord[] {
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecords(records: SimulationRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    /* storage unavailable (private mode) — session-only history */
  }
}

export function addRecord(records: SimulationRecord[], record: SimulationRecord): SimulationRecord[] {
  return [record, ...records].slice(0, MAX_RECORDS);
}

export function removeRecord(records: SimulationRecord[], id: string): SimulationRecord[] {
  return records.filter((record) => record.id !== id);
}

export function clearRecords(): SimulationRecord[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

/** Statistics derived from actual stored records — the dashboard consumes these. */
export type SimulationStats = {
  totalSimulations: number;
  crashEvents: number;
  criticalEvents: number;
  averageImpactForceKN: number;
  maxImpactForceKN: number;
  averageDeltaVKmh: number;
  averageDecelerationMps2: number;
  lastSimulationAt: string | null;
  currentVehicleStatus: string;
};

export function computeStats(records: SimulationRecord[]): SimulationStats {
  const crashEvents = records.length;
  const criticalEvents = records.filter((record) => record.severity.level === 'CRITICAL').length;
  const sum = (pick: (record: SimulationRecord) => number) => records.reduce((total, record) => total + pick(record), 0);
  const last = records[0];
  return {
    totalSimulations: records.length,
    crashEvents,
    criticalEvents,
    averageImpactForceKN: crashEvents ? sum((record) => record.physics.estimatedForceKN) / crashEvents : 0,
    maxImpactForceKN: records.reduce((max, record) => Math.max(max, record.physics.estimatedForceKN), 0),
    averageDeltaVKmh: crashEvents ? sum((record) => record.physics.deltaVKmh) / crashEvents : 0,
    averageDecelerationMps2: crashEvents ? sum((record) => record.physics.decelerationMps2) / crashEvents : 0,
    lastSimulationAt: last ? new Date(last.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null,
    currentVehicleStatus: 'SIMULATION BENCH · IDLE',
  };
}
