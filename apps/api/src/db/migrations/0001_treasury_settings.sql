CREATE TABLE IF NOT EXISTS "treasury_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "treasury_address" varchar(64) NOT NULL,
  "active_permission_id" integer NOT NULL,
  "active_permission_name" varchar(255) NOT NULL,
  "threshold" integer NOT NULL,
  "signers" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid REFERENCES "users"("id")
);

INSERT INTO "app_config_state" ("id", "config_valid", "validation_errors")
VALUES (1, false, '[]'::jsonb)
ON CONFLICT ("id") DO NOTHING;
