import { logger } from "./logger";

/**
 * Emergency contact dispatch (flowchart step 7A).
 *
 * Provider chain (first configured wins):
 *   1. Twilio  — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
 *   2. MSG91   — MSG91_AUTH_KEY + (optional MSG91_SENDER, MSG91_ROUTE)
 *   3. Demo    — no keys: queue-only, status "simulated", always logged.
 *
 * Dispatch NEVER throws into the ingest path; every failure is returned as a
 * per-contact result so it can be persisted and shown in the UI.
 *
 * Legal note: this dispatches to the SAVED personal emergency contacts
 * (relatives), which is legal for any product. Automated alerts to official
 * emergency services (112/100/108) are NOT sent from here — see DEPLOYMENT.md
 * for the authorized-channel roadmap (dialer handoff, private responders,
 * ERSS-112 MoU).
 */

export type DispatchContact = { name: string; phone: string };

export type DispatchResult = {
  contactName: string;
  contactPhone: string;
  /** sms (real provider) | queued (demo mode) */
  channel: "sms" | "queued";
  /** sent | failed | simulated */
  status: "sent" | "failed" | "simulated";
  providerMessageId?: string;
  errorMessage?: string;
};

export type IncidentForMessage = {
  eventId: string;
  eventType: string;
  riskScore: number;
  riskCategory: string;
  latitude?: number | null;
  longitude?: number | null;
  ownerName?: string | null;
  bloodGroup?: string | null;
  disease?: string | null;
};

/** Normalizes an Indian phone number to E.164 (+91XXXXXXXXXX). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
}

function mapLink(lat?: number | null, lng?: number | null): string {
  if (typeof lat !== "number" || typeof lng !== "number") return "Location unavailable";
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

export function buildCrashMessage(incident: IncidentForMessage): string {
  const header = incident.eventType === "MANUAL_SOS"
    ? "🆘 SOS ALERT (RAKSHA SETU)"
    : "🚨 CRASH ALERT (RAKSHA SETU)";
  const who = incident.ownerName ? `for ${incident.ownerName}` : "";
  const blood = incident.bloodGroup ? `Blood group: ${incident.bloodGroup}.` : "";
  const condition = incident.disease ? `Medical: ${incident.disease}.` : "";
  const where =
    typeof incident.latitude === "number" && typeof incident.longitude === "number"
      ? `Location: ${incident.latitude}, ${incident.longitude}\nMap: ${mapLink(incident.latitude, incident.longitude)}`
      : "Location: unavailable";
  return [
    `${header} ${who}`.trim(),
    `Event ${incident.eventId} · risk ${incident.riskScore}/100 (${incident.riskCategory})`,
    blood, condition, where,
    `Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    "Auto-generated message — verify before acting.",
  ]
    .filter(Boolean)
    .join("\n");
}

function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER,
  );
}

function msg91Configured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY);
}

export function dispatchProviderName(): "twilio" | "msg91" | "demo-queue" {
  if (twilioConfigured()) return "twilio";
  if (msg91Configured()) return "msg91";
  return "demo-queue";
}

async function sendViaTwilio(to: string, message: string): Promise<DispatchResult> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const body = new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) {
      return { contactName: "", contactPhone: to, channel: "sms", status: "failed", errorMessage: `Twilio ${res.status}: ${data.message ?? "unknown"}` };
    }
    return { contactName: "", contactPhone: to, channel: "sms", status: "sent", providerMessageId: data.sid };
  } catch (err) {
    return { contactName: "", contactPhone: to, channel: "sms", status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaMsg91(to: string, message: string): Promise<DispatchResult> {
  try {
    const mobile = to.replace(/^\+91/, "").replace(/^\+/, "");
    const res = await fetch("https://api.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: process.env.MSG91_AUTH_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: process.env.MSG91_SENDER ?? "RKSHST",
        route: process.env.MSG91_ROUTE ?? "4",
        sms: [{ message, to: [mobile] }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { type?: string; message?: string; request_id?: string };
    if (!res.ok || data.type === "error") {
      return { contactName: "", contactPhone: to, channel: "sms", status: "failed", errorMessage: `MSG91 ${res.status}: ${data.message ?? "unknown"}` };
    }
    return { contactName: "", contactPhone: to, channel: "sms", status: "sent", providerMessageId: data.request_id };
  } catch (err) {
    return { contactName: "", contactPhone: to, channel: "sms", status: "failed", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sends the crash message to every saved contact. In demo mode (no provider
 * keys) contacts are "simulated" — queued and logged, never actually messaged.
 */
export async function dispatchToContacts(
  incident: IncidentForMessage,
  contacts: DispatchContact[],
): Promise<DispatchResult[]> {
  const message = buildCrashMessage(incident);
  const provider = dispatchProviderName();
  logger.info({ eventId: incident.eventId, provider, contacts: contacts.length }, "Dispatching emergency contact alerts");

  const results = await Promise.all(
    contacts.map(async (contact) => {
      const phone = normalizePhone(contact.phone);
      let result: DispatchResult;
      if (provider === "twilio") {
        result = await sendViaTwilio(phone, message);
      } else if (provider === "msg91") {
        result = await sendViaMsg91(phone, message);
      } else {
        // Demo queue — visibly simulated, never silent.
        logger.info({ to: phone, eventId: incident.eventId }, "[DEMO] SMS simulated (no provider configured)");
        result = { contactName: "", contactPhone: phone, channel: "queued", status: "simulated" };
      }
      return { ...result, contactName: contact.name };
    }),
  );

  logger.info(
    { eventId: incident.eventId, sent: results.filter((r) => r.status === "sent").length, simulated: results.filter((r) => r.status === "simulated").length, failed: results.filter((r) => r.status === "failed").length },
    "Emergency contact dispatch complete",
  );
  return results;
}
