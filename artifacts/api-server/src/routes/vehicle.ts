import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  emergencyContacts,
  incidents,
  owners,
  contactNotifications,
  type ContactNotification,
  type Incident,
} from "@workspace/db";
import { dispatchToContacts, dispatchProviderName, normalizePhone } from "../lib/dispatch";
import { logger } from "../lib/logger";

/**
 * RAKSHA SETU — vehicle incident ingest (the production integration point that
 * the vehicle-integration bridge forwards to; flowchart step 8).
 *
 * With DATABASE_URL set, everything persists to Postgres via Drizzle.
 * Without it, an in-memory store keeps the demo/CI flow identical
 * (responses carry persisted:false so the UI can show the mode honestly).
 */

const packetSchema = z.object({
  packetId: z.string(),
  eventType: z.string(),
  vehicleId: z.string(),
  timestamp: z.string(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    simulated: z.boolean().optional(),
    label: z.string().optional(),
  }),
  vehicle: z.record(z.string(), z.unknown()).optional(),
  signals: z.record(z.string(), z.unknown()).optional(),
  driver: z.record(z.string(), z.unknown()).optional(),
  risk: z.object({
    score: z.number(),
    category: z.string(),
    factors: z.array(z.string()).default([]),
    model: z.string().optional(),
  }),
  // Vehicle Agent crash-confidence evidence (ECU/OEM sensor window snapshot).
  ecu: z
    .object({
      confidence: z.number(),
      decision: z.string(),
      model: z.string().optional(),
      evidence: z.record(z.string(), z.unknown()),
    })
    .optional(),
  // Real registered-owner profile + emergency contacts, sent by the RAKSHA SETU
  // user app when its user triggers an SOS. Optional: the vehicle bridge sends
  // packets without PII and keeps the placeholder behaviour.
  owner: z
    .object({
      fullName: z.string(),
      address: z.string(),
      bloodGroup: z.string(),
      disease: z.string(),
      medication: z.string(),
      gender: z.string(),
      age: z.number(),
    })
    .optional(),
  emergencyContacts: z
    .array(
      z.object({
        name: z.string(),
        relation: z.string(),
        phone: z.string(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .optional(),
});

const accidentBodySchema = z.object({
  source: z.string().optional(),
  eventId: z.string().optional(),
  packet: packetSchema,
});

const severityFor = (category: string): string =>
  category === "CRITICAL" ? "Critical" : category === "HIGH" ? "High" : category === "MEDIUM" ? "Medium" : "Low";

// ---------------------------------------------------------------------------
// In-memory fallback store (used only when DATABASE_URL is not configured)
// ---------------------------------------------------------------------------

type MemoryIncident = Incident & { notifications: ContactNotification[] };

const memory = {
  owners: new Map<string, { id: number } & Record<string, unknown>>(),
  contacts: [] as Array<{ id: number; ownerId: number; name: string; relation: string; phone: string; isPrimary: boolean }>,
  incidents: [] as MemoryIncident[],
  nextId: 1,
  nextContactId: 1,
  nextNotificationId: 1,
};

function usingDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Owner + contact resolution
// ---------------------------------------------------------------------------

type OwnerUpsert = {
  vehicleId: string;
  fullName: string;
  address: string;
  bloodGroup: string;
  disease: string;
  medication: string;
  gender: string;
  age: number;
};

async function upsertOwnerFromPacket(packet: z.infer<typeof packetSchema>): Promise<void> {
  // When the sender is the user app, the packet carries the real registered
  // profile and emergency contacts — ingest them verbatim. The vehicle bridge
  // sends no PII, so it keeps the placeholder profile.
  const appOwner = packet.owner;
  const appContacts = packet.emergencyContacts ?? [];
  const owner: OwnerUpsert = appOwner
    ? {
        vehicleId: packet.vehicleId,
        fullName: appOwner.fullName,
        address: appOwner.address,
        bloodGroup: appOwner.bloodGroup,
        disease: appOwner.disease,
        medication: appOwner.medication,
        gender: appOwner.gender,
        age: appOwner.age,
      }
    : {
        vehicleId: packet.vehicleId,
        // The bridge packet does not carry PII; register a placeholder profile that
        // the control center edits afterwards. Never fake medical data.
        fullName: `Registered owner (${packet.vehicleId})`,
        address: packet.location.label ?? "Not provided",
        bloodGroup: "—",
        disease: "",
        medication: "",
        gender: "Unknown",
        age: 0,
      };

  if (!usingDatabase()) {
    const existing = memory.owners.get(owner.vehicleId);
    const id = existing?.id ?? memory.owners.size + 1;
    memory.owners.set(owner.vehicleId, { id, ...owner });
    // User app sent contacts -> replace; otherwise seed a placeholder once.
    if (appContacts.length > 0) {
      memory.contacts = memory.contacts.filter((c) => c.ownerId !== id);
      appContacts.forEach((c, index) =>
        memory.contacts.push({
          id: memory.nextContactId++,
          ownerId: id,
          name: c.name,
          relation: c.relation,
          phone: c.phone,
          isPrimary: c.isPrimary ?? index === 0,
        }),
      );
    } else if (!memory.contacts.some((c) => c.ownerId === id)) {
      memory.contacts.push({
        id: memory.nextContactId++,
        ownerId: id,
        name: "Primary Emergency Contact",
        relation: "Family",
        phone: "+919000000001",
        isPrimary: true,
      });
    }
    return;
  }

  await db
    .insert(owners)
    .values(owner)
    .onConflictDoUpdate({
      target: owners.vehicleId,
      set: {
        fullName: owner.fullName,
        address: owner.address,
        bloodGroup: owner.bloodGroup,
        disease: owner.disease,
        medication: owner.medication,
        gender: owner.gender,
        age: owner.age,
        updatedAt: new Date(),
      },
    });

  const existing = await db.select({ id: owners.id }).from(owners).where(eq(owners.vehicleId, owner.vehicleId));
  const ownerId = existing[0]?.id;
  if (!ownerId) return;

  // User app sent contacts -> they are authoritative; replace the stored set.
  if (appContacts.length > 0) {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.ownerId, ownerId));
    await db.insert(emergencyContacts).values(
      appContacts.map((c, index) => ({
        ownerId,
        name: c.name,
        relation: c.relation,
        phone: c.phone,
        isPrimary: c.isPrimary ?? index === 0,
      })),
    );
    return;
  }

  const existingContacts = await db
    .select({ id: emergencyContacts.id })
    .from(emergencyContacts)
    .where(eq(emergencyContacts.ownerId, ownerId));
  if (existingContacts.length === 0) {
    await db.insert(emergencyContacts).values({
      ownerId,
      name: "Primary Emergency Contact",
      relation: "Family",
      phone: "+919000000001",
      isPrimary: true,
    });
  }
}

async function resolveContacts(vehicleId: string): Promise<Array<{ name: string; phone: string; id?: number }>> {
  if (!usingDatabase()) {
    const ownerId = memory.owners.get(vehicleId)?.id;
    return memory.contacts
      .filter((c) => c.ownerId === ownerId)
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
  }
  const rows = await db
    .select({
      id: emergencyContacts.id,
      name: emergencyContacts.name,
      phone: emergencyContacts.phone,
    })
    .from(emergencyContacts)
    .innerJoin(owners, eq(emergencyContacts.ownerId, owners.id))
    .where(eq(owners.vehicleId, vehicleId));
  return rows;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistIncident(
  eventId: string,
  packet: z.infer<typeof packetSchema>,
  dispatchResults: Awaited<ReturnType<typeof dispatchToContacts>>,
): Promise<{ incidentId: number; notifications: ContactNotification[] }> {
  if (!usingDatabase()) {
    const incidentId = memory.nextId++;
    const now = new Date();
    const record: MemoryIncident = {
      id: incidentId,
      bridgeEventId: eventId,
      vehicleId: packet.vehicleId,
      eventType: packet.eventType,
      status: "RAKSHA_SETU_ACKNOWLEDGED",
      severity: severityFor(packet.risk.category),
      riskScore: Math.round(packet.risk.score),
      latitude: packet.location.latitude,
      longitude: packet.location.longitude,
      locationLabel: packet.location.label ?? null,
      packet: packet as unknown as Record<string, unknown>,
      outcome: "open",
      cancelledAsFalseAlarm: false,
      driverConfirmedSafe: false,
      createdAt: now,
      updatedAt: now,
      notifications: dispatchResults.map((r, index) => ({
        id: memory.nextNotificationId++,
        incidentId,
        contactId: null,
        contactName: r.contactName,
        contactPhone: r.contactPhone,
        channel: r.channel,
        status: r.status,
        providerMessageId: r.providerMessageId ?? null,
        errorMessage: r.errorMessage ?? null,
        createdAt: new Date(now.getTime() + index),
      })),
    };
    memory.incidents.unshift(record);
    return { incidentId, notifications: record.notifications };
  }

  const inserted = await db
    .insert(incidents)
    .values({
      bridgeEventId: eventId,
      vehicleId: packet.vehicleId,
      eventType: packet.eventType,
      status: "RAKSHA_SETU_ACKNOWLEDGED",
      severity: severityFor(packet.risk.category),
      riskScore: Math.round(packet.risk.score),
      latitude: packet.location.latitude,
      longitude: packet.location.longitude,
      locationLabel: packet.location.label ?? null,
      packet: packet as unknown as Record<string, unknown>,
    })
    .returning({ id: incidents.id });
  const incidentId = inserted[0]!.id;

  const contactRows = await resolveContacts(packet.vehicleId);
  const notificationRows = await db
    .insert(contactNotifications)
    .values(
      dispatchResults.map((r, index) => ({
        incidentId,
        contactId: contactRows.find((c) => normalizePhone(c.phone) === r.contactPhone)?.id,
        contactName: r.contactName,
        contactPhone: r.contactPhone,
        channel: r.channel,
        status: r.status,
        providerMessageId: r.providerMessageId,
        errorMessage: r.errorMessage,
        createdAt: new Date(Date.now() + index),
      })),
    )
    .returning();

  return { incidentId, notifications: notificationRows };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const router: IRouter = Router();

/** Ingest one accident/SOS event from the vehicle-integration bridge. */
router.post("/vehicle/accident", async (req, res) => {
  const parsed = accidentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid accident payload", details: parsed.error.flatten() });
    return;
  }

  const { eventId, packet } = parsed.data;
  const bridgeEventId = eventId ?? packet.packetId;

  try {
    await upsertOwnerFromPacket(packet);

    const contacts = await resolveContacts(packet.vehicleId);
    logger.info({ bridgeEventId, vehicleId: packet.vehicleId, contacts: contacts.length }, "Accident accepted");

    const dispatchResults = await dispatchToContacts(
      {
        eventId: bridgeEventId,
        eventType: packet.eventType,
        riskScore: packet.risk.score,
        riskCategory: packet.risk.category,
        latitude: packet.location.latitude,
        longitude: packet.location.longitude,
      },
      contacts,
    );

    const { incidentId, notifications } = await persistIncident(bridgeEventId, packet, dispatchResults);

    res.json({
      ok: true,
      incidentId,
      bridgeEventId,
      persisted: usingDatabase(),
      dispatchProvider: dispatchProviderName(),
      notifications,
    });
  } catch (err) {
    logger.error({ err, bridgeEventId }, "Failed to process accident");
    res.status(500).json({ ok: false, error: "Accident processing failed" });
  }
});

/** List recent incidents (newest first). */
router.get("/vehicle/incidents", async (_req, res) => {
  if (!usingDatabase()) {
    res.json({
      ok: true,
      persisted: false,
      count: memory.incidents.length,
      incidents: memory.incidents.map(({ notifications, ...incident }) => ({ ...incident, notifications })),
    });
    return;
  }
  const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
  const withNotifications = await Promise.all(
    rows.map(async (incident) => ({
      ...incident,
      notifications: await db
        .select()
        .from(contactNotifications)
        .where(eq(contactNotifications.incidentId, incident.id)),
    })),
  );
  res.json({ ok: true, persisted: true, count: rows.length, incidents: withNotifications });
});

/** Incident detail. */
router.get("/vehicle/incidents/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ ok: false, error: "Invalid incident id" });
    return;
  }

  if (!usingDatabase()) {
    const found = memory.incidents.find((i) => i.id === id);
    if (!found) {
      res.status(404).json({ ok: false, error: "Incident not found" });
      return;
    }
    res.json({ ok: true, persisted: false, incident: found });
    return;
  }

  const rows = await db.select().from(incidents).where(eq(incidents.id, id));
  const incident = rows[0];
  if (!incident) {
    res.status(404).json({ ok: false, error: "Incident not found" });
    return;
  }
  const notifications = await db
    .select()
    .from(contactNotifications)
    .where(eq(contactNotifications.incidentId, id));
  res.json({ ok: true, persisted: true, incident: { ...incident, notifications } });
});

/** Mark an incident as a false alarm (called from the 30-second window). */
router.post("/vehicle/incidents/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ ok: false, error: "Invalid incident id" });
    return;
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "false-alarm";

  if (!usingDatabase()) {
    const found = memory.incidents.find((i) => i.id === id);
    if (!found) {
      res.status(404).json({ ok: false, error: "Incident not found" });
      return;
    }
    found.outcome = "false-alarm";
    found.cancelledAsFalseAlarm = true;
    found.status = "CANCELLED";
    found.updatedAt = new Date();
    res.json({ ok: true, persisted: false, incidentId: id, outcome: found.outcome });
    return;
  }

  const updated = await db
    .update(incidents)
    .set({
      outcome: "false-alarm",
      cancelledAsFalseAlarm: true,
      status: "CANCELLED",
      updatedAt: new Date(),
    })
    .where(and(eq(incidents.id, id)))
    .returning({ id: incidents.id, outcome: incidents.outcome });

  if (!updated[0]) {
    res.status(404).json({ ok: false, error: "Incident not found" });
    return;
  }
  logger.info({ incidentId: id, reason }, "Incident cancelled as false alarm");
  res.json({ ok: true, persisted: true, incidentId: id, outcome: updated[0].outcome });
});

export default router;
