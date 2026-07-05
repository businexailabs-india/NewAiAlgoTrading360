-- Add user_id to strategies for per-user JSON rule strategies
ALTER TABLE "strategies" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- Backfill not needed (table likely empty); set NOT NULL only when user_id populated
-- For existing rows without user, delete or skip
DELETE FROM "strategies" WHERE "user_id" IS NULL;

ALTER TABLE "strategies" ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "strategies_user_id_is_active_idx" ON "strategies"("user_id", "is_active");
