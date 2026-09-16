// ============================================================================
// RAKSHA SETU — Vehicle Integration Simulator (ISOLATED DEMO COMPONENT)
// OPTIONAL AI incident narration via the Groq API (gsk_... key).
// - Zero dependencies: plain REST call with Node's native fetch.
// - Key is loaded from the local, gitignored vehicle-integration/.env file.
// - Best-effort only: any failure is logged and the demo continues normally.
// - The narration is clearly labelled as AI-generated on SIMULATED data.
// ============================================================================

import { CONFIG } from './config.ts';
import type { AccidentEvent } from './types.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  'You are the incident narration assistant of the RAKSHA SETU vehicle-integration DEMO. ' +
  'All vehicle data is SIMULATED. Write a concise 2-3 sentence control-room summary of the ' +
  'incident based on the telemetry: what happened, the risk level, and the recommended next ' +
  'workflow step (driver verification or escalation). Never claim a real emergency service ' +
  'was contacted. Plain text only, no markdown.';

export function aiConfigured(): boolean {
  return Boolean(CONFIG.ai.enabled && CONFIG.ai.apiKey);
}

export type AiSummary = { model: string; summary: string; generatedAt: string };

export async function summarizeIncident(event: AccidentEvent): Promise<AiSummary | null> {
  if (!aiConfigured()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${CONFIG.ai.apiKey}`, 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: CONFIG.ai.model,
        temperature: 0.3,
        max_tokens: 512,
        // gpt-oss models emit hidden reasoning tokens first — minimize them.
        ...(CONFIG.ai.model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ event, packet: event.packet }) },
        ],
      }),
    });
    if (!res.ok) {
      console.log(`[ai] Groq HTTP ${res.status} — AI summary skipped (demo continues)`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return null;
    console.log(`[ai] summary generated for ${event.eventId} (model ${CONFIG.ai.model})`);
    return { model: CONFIG.ai.model, summary, generatedAt: new Date().toISOString() };
  } catch (err) {
    console.log(`[ai] summary failed (${err instanceof Error ? err.message : String(err)}) — demo continues`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
