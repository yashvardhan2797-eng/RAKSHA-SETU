import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Vehicle owners — the registered person a crash is attributed to.
// Mirrors the PersonalInfo profile in the frontend.
// ---------------------------------------------------------------------------

export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  vehicleId: varchar("vehicle_id", { length: 64 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  address: text("address").notNull(),
  bloodGroup: varchar("blood_group", { length: 8 }).notNull(),
  /** Known medical conditions ("" = none declared). */
  disease: text("disease").notNull().default(""),
  /** Regular medication ("" = none declared). */
  medication: text("medication").notNull().default(""),
  gender: varchar("gender", { length: 16 }).notNull(),
  age: integer("age").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Emergency contacts — multiple per owner (relatives etc.).
// ---------------------------------------------------------------------------

export const emergencyContacts = pgTable(
  "emergency_contacts",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relation: varchar("relation", { length: 64 }).notNull(),
    /** E.164 preferred (e.g. +919876543210); normalized before sending. */
    phone: varchar("phone", { length: 24 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("emergency_contacts_owner_idx").on(table.ownerId)],
);

// ---------------------------------------------------------------------------
// Incidents — every crash event accepted from the vehicle bridge.
// ---------------------------------------------------------------------------

export const incidents = pgTable(
  "incidents",
  {
    id: serial("id").primaryKey(),
    /** Bridge-side event id (EVT-0001). Unique per bridge, not globally. */
    bridgeEventId: varchar("bridge_event_id", { length: 32 }),
    vehicleId: varchar("vehicle_id", { length: 64 }).notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("RAKSHA_SETU_ACKNOWLEDGED"),
    severity: varchar("severity", { length: 16 }).notNull().default("HIGH"),
    riskScore: integer("risk_score").notNull().default(0),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    locationLabel: text("location_label"),
    /** Full telemetry packet, kept verbatim for audit/analysis. */
    packet: jsonb("packet").notNull(),
    /** open | false-alarm | driver-safe | escalated | resolved */
    outcome: varchar("outcome", { length: 24 }).notNull().default("open"),
    cancelledAsFalseAlarm: boolean("cancelled_as_false_alarm").notNull().default(false),
    driverConfirmedSafe: boolean("driver_confirmed_safe").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("incidents_vehicle_idx").on(table.vehicleId),
    index("incidents_created_idx").on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Contact notifications — one row per SMS/queue event (flow step 7A log).
// ---------------------------------------------------------------------------

export const contactNotifications = pgTable(
  "contact_notifications",
  {
    id: serial("id").primaryKey(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => emergencyContacts.id, {
      onDelete: "set null",
    }),
    /** Snapshot of name/phone at send time (survives contact deletion). */
    contactName: text("contact_name").notNull(),
    contactPhone: varchar("contact_phone", { length: 24 }).notNull(),
    /** sms | queued */
    channel: varchar("channel", { length: 16 }).notNull().default("queued"),
    /** queued | sent | failed | simulated */
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contact_notifications_incident_idx").on(table.incidentId)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const ownersRelations = relations(owners, ({ many }) => ({
  emergencyContacts: many(emergencyContacts),
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  owner: one(owners, { fields: [emergencyContacts.ownerId], references: [owners.id] }),
}));

export const incidentsRelations = relations(incidents, ({ one, many }) => ({
  owner: one(owners, { fields: [incidents.vehicleId], references: [owners.vehicleId] }),
  notifications: many(contactNotifications),
}));

export const contactNotificationsRelations = relations(contactNotifications, ({ one }) => ({
  incident: one(incidents, {
    fields: [contactNotifications.incidentId],
    references: [incidents.id],
  }),
  contact: one(emergencyContacts, {
    fields: [contactNotifications.contactId],
    references: [emergencyContacts.id],
  }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Owner = typeof owners.$inferSelect;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type ContactNotification = typeof contactNotifications.$inferSelect;