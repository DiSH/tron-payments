-- Unify signer_a/b/c → signer; allow Ledger-only users; auth challenges.

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

UPDATE "users"
SET "roles" = (
  SELECT COALESCE(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
  FROM (
    SELECT DISTINCT CASE
      WHEN elem IN ('signer_a', 'signer_b', 'signer_c') THEN 'signer'
      ELSE elem
    END AS v
    FROM jsonb_array_elements_text(COALESCE("roles", '[]'::jsonb)) AS elem
  ) rewritten
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(COALESCE("roles", '[]'::jsonb)) AS elem
  WHERE elem IN ('signer_a', 'signer_b', 'signer_c')
);

UPDATE "treasury_settings"
SET "signers" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem->>'role' IN ('signer_a', 'signer_b', 'signer_c')
        THEN jsonb_set(elem, '{role}', '"signer"')
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE("signers", '[]'::jsonb)) AS elem
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE("signers", '[]'::jsonb)) AS elem
  WHERE elem->>'role' IN ('signer_a', 'signer_b', 'signer_c')
);

CREATE TABLE IF NOT EXISTS "auth_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "auth_challenges_expires_at_idx"
  ON "auth_challenges" ("expires_at");
