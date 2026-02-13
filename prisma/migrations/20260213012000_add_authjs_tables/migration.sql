ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "image" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verified" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL,
  "session_token" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_session_token_key" ON "sessions"("session_token");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
