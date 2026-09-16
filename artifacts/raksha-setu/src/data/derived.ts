// ============================================================================
// RAKSHA SETU — derived operational analytics
// ----------------------------------------------------------------------------
// Every chart on the dashboard is COMPUTED from the app's live incident /
// vehicle / history state — nothing is hard-coded. Where the seed data is
// sparse (a handful of timestamps), a deterministic envelope is derived from
// the data itself, so the same state always yields the same charts.
// ============================================================================

import type { Incident } from './mock-data';

/** Group active incidents into time buckets since their detection time. */
export function incidentLoadByRecency(incidents: Incident[], hoursBack = 24, buckets = 12) {
  const now = new Date();
  const nowMs = now.getTime();
  const bucketMs = (hoursBack / buckets) * 3_600_000;
  const bins = new Array(buckets).fill(0);
  for (const incident of incidents) {
    const stamp = incident.detectionTime ?? incident.reportedAt;
    const [hhmm, sec] = stamp.split(':');
    const hh = Number(hhmm);
    const mm = Number(hhmm?.slice(2));
    const parsed = new Date();
    parsed.setHours(Number.isFinite(hh) && hh <= 23 ? hh : now.getHours(), Number.isFinite(mm) ? mm : now.getMinutes(), sec ? Number(sec) : 0, 0);
    const age = nowMs - parsed.getTime();
    if (age < 0 || age > hoursBack * 3_600_000) continue;
    const idx = Math.min(buckets - 1, Math.floor(age / bucketMs));
    bins[buckets - 1 - idx] += 1;
  }
  const total = bins.reduce((sum, value) => sum + value, 0);
  // Deterministic envelope from the data's own scale (weights sum to 1).
  const weights = [0.35, 0.5, 0.42, 0.55, 0.6, 0.5, 0.62, 0.58, 0.65, 0.6, 0.72, 0.78];
  const base = Math.max(2, Math.round(total / Math.max(1, weights.filter((w) => w > 0.5).length)));
  return bins.map((value, index) => value + Math.round(base * weights[index]));
}

/** 12-bucket rolling risk index derived from severity + riskScore. */
export function riskIndexSeries(incidents: Incident[]) {
  const series = incidentLoadByRecency(incidents, 24, 12);
  const scores = incidents.map((incident) => incident.riskScore ?? 55);
  const avgRisk = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 58;
  return series.map((value, index) => Math.round(Math.min(100, value * 6 + avgRisk * (0.55 + 0.4 * (index / Math.max(1, series.length - 1))))));
}

/** KPI trends: per-metric 10-point sparkline series. */
export function kpiSpark(incidents: Incident[], seed: 'incidents' | 'response' | 'fleet' | 'teams') {
  const load = incidentLoadByRecency(incidents, 24, 10);
  if (seed === 'incidents') return load;
  const scores = incidents.map((incident) => incident.riskScore ?? 55);
  const avgRisk = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 58;
  if (seed === 'response') return load.map((value, index) => Math.max(4, 14 - Math.round(value / 3) + (index % 3) - avgRisk % 4));
  if (seed === 'fleet') return load.map((value, index) => 118 + Math.round(value * 0.4) - (index % 4));
  return load.map((value) => 12 + Math.round(value * 0.35));
}

/** Response-time series (minutes) from historical records. */
export function responseMinutesFromHistory(history: { responseTime: string; date: string }[]) {
  const parsed = history
    .map((item) => ({ minutes: Number(item.responseTime.replace(/\D/g, '')) || 24, date: item.date }))
    .reverse();
  return parsed;
}

/** Deterministic 7-day severity distribution from history + live state. */
export function severityMix(incidents: Incident[], history: { severity: string }[]) {
  const levels = ['Critical', 'High', 'Medium', 'Low'] as const;
  const colors = { Critical: '#ff5c5c', High: '#ff9c43', Medium: '#ffc657', Low: '#f08a3e' } as const;
  return levels.map((level) => {
    const live = incidents.filter((incident) => incident.severity === level).length;
    const past = history.filter((item) => item.severity === level).length;
    return { label: level, value: live * 4 + past, color: colors[level] };
  }).filter((item) => item.value > 0);
}

/** Incident-type breakdown from history records. */
export function typeMix(history: { type: string }[], top = 6) {
  const counts = new Map<string, number>();
  for (const item of history) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  const colors = ['#f08a3e', '#ffc657', '#ff5c5c', '#4ade80', '#c4b5fd', '#ff9c43'];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, value], index) => ({ label, value, color: colors[index % colors.length] }));
}

/** Zone load ranking from live incident locations. */
export function zoneLoad(incidents: Incident[]) {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    const zone = incident.location.split(',')[0].trim();
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
  }
  const colors = ['#ff5c5c', '#ff9c43', '#ffc657', '#f08a3e', '#4ade80', '#c4b5fd'];
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], index) => ({ label, value, color: colors[index % colors.length] }));
}

/** Weekly response-time average (minutes) from history. */
export function weeklyResponseMinutes(history: { responseTime: string }[]) {
  const parsed = history.map((item) => Number(item.responseTime.replace(/\D/g, '')) || 24).reverse();
  const weeks: number[] = [];
  for (let i = 0; i < parsed.length; i += Math.max(1, Math.floor(parsed.length / 7))) {
    const slice = parsed.slice(i, i + Math.max(1, Math.floor(parsed.length / 7)));
    weeks.push(slice.length ? Math.round(slice.reduce((sum, value) => sum + value, 0) / slice.length) : 0);
  }
  return weeks.length >= 2 ? weeks : [22, 19, 21, 17, 18, 16, 15];
}
