CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "signer_address" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sequence_number" integer NOT NULL,
  "status" varchar(32) NOT NULL,
  "network" varchar(32) NOT NULL,
  "treasury_address" varchar(64) NOT NULL,
  "permission_id" integer NOT NULL,
  "token_contract_address" varchar(64) NOT NULL,
  "token_symbol" varchar(16) NOT NULL,
  "token_decimals" integer NOT NULL,
  "recipient_address" varchar(64) NOT NULL,
  "amount_raw" varchar(64) NOT NULL,
  "amount_display" varchar(32) NOT NULL,
  "purpose" text NOT NULL,
  "external_reference" varchar(255) NOT NULL,
  "document_url" text,
  "expiration_at" timestamp with time zone NOT NULL,
  "raw_transaction_json" jsonb NOT NULL,
  "raw_data_hex" text NOT NULL,
  "tx_id" varchar(128) NOT NULL,
  "canonical_payload_json" text NOT NULL,
  "canonical_payload_hash" varchar(64) NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "broadcast_tx_id" varchar(128),
  "broadcasted_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "failure_reason" text,
  "version" integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "signatures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_request_id" uuid NOT NULL REFERENCES "payment_requests"("id"),
  "signer_address" varchar(64) NOT NULL,
  "signature_hex" text NOT NULL,
  "recovered_address" varchar(64) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "tx_id" varchar(128) NOT NULL,
  "signer_user_id" uuid NOT NULL,
  "ledger_device_metadata" jsonb,
  "verification_result" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "signatures_request_signer_unique"
  ON "signatures" ("payment_request_id", "signer_address");

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "actor_user_id" uuid,
  "actor_role" varchar(32),
  "event_type" varchar(64) NOT NULL,
  "payment_request_id" uuid,
  "before_state_json" jsonb,
  "after_state_json" jsonb,
  "ip_address" varchar(64),
  "user_agent" text,
  "correlation_id" uuid,
  "immutable_event_hash" varchar(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS "signing_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "payment_request_id" uuid NOT NULL REFERENCES "payment_requests"("id"),
  "user_id" uuid NOT NULL,
  "signer_address" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_config_state" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "config_valid" boolean DEFAULT false NOT NULL,
  "last_validated_at" timestamp with time zone,
  "validation_errors" jsonb DEFAULT '[]'::jsonb
);

CREATE SEQUENCE IF NOT EXISTS payment_request_sequence START 1000;
