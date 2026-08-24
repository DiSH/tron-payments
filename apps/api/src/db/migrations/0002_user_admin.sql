ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "credentials_updated_at" timestamp with time zone DEFAULT now() NOT NULL;
