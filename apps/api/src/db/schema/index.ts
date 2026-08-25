import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash"),
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  signerAddress: varchar("signer_address", { length: 64 }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  credentialsUpdatedAt: timestamp("credentials_updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  message: text("message").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paymentRequests = pgTable("payment_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  sequenceNumber: integer("sequence_number").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  network: varchar("network", { length: 32 }).notNull(),
  treasuryAddress: varchar("treasury_address", { length: 64 }).notNull(),
  permissionId: integer("permission_id").notNull(),
  tokenContractAddress: varchar("token_contract_address", { length: 64 }).notNull(),
  tokenSymbol: varchar("token_symbol", { length: 16 }).notNull(),
  tokenDecimals: integer("token_decimals").notNull(),
  recipientAddress: varchar("recipient_address", { length: 64 }).notNull(),
  amountRaw: varchar("amount_raw", { length: 64 }).notNull(),
  amountDisplay: varchar("amount_display", { length: 32 }).notNull(),
  purpose: text("purpose").notNull(),
  externalReference: varchar("external_reference", { length: 255 }).notNull(),
  documentUrl: text("document_url"),
  expirationAt: timestamp("expiration_at", { withTimezone: true }).notNull(),
  rawTransactionJson: jsonb("raw_transaction_json").notNull(),
  rawDataHex: text("raw_data_hex").notNull(),
  txId: varchar("tx_id", { length: 128 }).notNull(),
  canonicalPayloadJson: text("canonical_payload_json").notNull(),
  canonicalPayloadHash: varchar("canonical_payload_hash", { length: 64 }).notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  broadcastTxId: varchar("broadcast_tx_id", { length: 128 }),
  broadcastedAt: timestamp("broadcasted_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  version: integer("version").notNull().default(1),
});

export const signatures = pgTable("signatures", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentRequestId: uuid("payment_request_id")
    .notNull()
    .references(() => paymentRequests.id),
  signerAddress: varchar("signer_address", { length: 64 }).notNull(),
  signatureHex: text("signature_hex").notNull(),
  recoveredAddress: varchar("recovered_address", { length: 64 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  txId: varchar("tx_id", { length: 128 }).notNull(),
  signerUserId: uuid("signer_user_id").notNull(),
  ledgerDeviceMetadata: jsonb("ledger_device_metadata"),
  verificationResult: varchar("verification_result", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  actorUserId: uuid("actor_user_id"),
  actorRole: varchar("actor_role", { length: 32 }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  paymentRequestId: uuid("payment_request_id"),
  beforeStateJson: jsonb("before_state_json"),
  afterStateJson: jsonb("after_state_json"),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  correlationId: uuid("correlation_id"),
  immutableEventHash: varchar("immutable_event_hash", { length: 64 }).notNull(),
});

export const signingSessions = pgTable("signing_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  paymentRequestId: uuid("payment_request_id")
    .notNull()
    .references(() => paymentRequests.id),
  userId: uuid("user_id").notNull(),
  signerAddress: varchar("signer_address", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appConfigState = pgTable("app_config_state", {
  id: integer("id").primaryKey().default(1),
  configValid: boolean("config_valid").notNull().default(false),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  validationErrors: jsonb("validation_errors").$type<string[]>().default([]),
});

export type TreasurySignerRow = {
  label: string;
  address: string;
  weight: number;
  role: "signer";
};

export const treasurySettings = pgTable("treasury_settings", {
  id: integer("id").primaryKey().default(1),
  treasuryAddress: varchar("treasury_address", { length: 64 }).notNull(),
  activePermissionId: integer("active_permission_id").notNull(),
  activePermissionName: varchar("active_permission_name", { length: 255 }).notNull(),
  threshold: integer("threshold").notNull(),
  signers: jsonb("signers").$type<TreasurySignerRow[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
});
