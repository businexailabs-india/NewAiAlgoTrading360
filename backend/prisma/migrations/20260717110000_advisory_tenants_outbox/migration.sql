-- Personal tenants + memberships + event outbox

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "owner_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_owner_id_idx" ON "tenants"("owner_id");

CREATE TABLE IF NOT EXISTS "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_id_idx" ON "tenant_memberships"("user_id");

CREATE TABLE IF NOT EXISTS "event_outbox" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_outbox_event_id_key" ON "event_outbox"("event_id");
CREATE INDEX IF NOT EXISTS "event_outbox_status_created_at_idx" ON "event_outbox"("status", "created_at");
CREATE INDEX IF NOT EXISTS "event_outbox_user_id_topic_idx" ON "event_outbox"("user_id", "topic");

DO $$ BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill personal tenant per existing user
INSERT INTO "tenants" ("id", "name", "slug", "kind", "owner_id", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid()::text,
       COALESCE(u.name, split_part(u.email, '@', 1)) || ' Personal',
       'personal-' || replace(u.id, '-', ''),
       'personal',
       u.id,
       true,
       NOW(),
       NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "tenants" t WHERE t.owner_id = u.id AND t.kind = 'personal'
);

INSERT INTO "tenant_memberships" ("id", "tenant_id", "user_id", "role", "created_at")
SELECT gen_random_uuid()::text, t.id, t.owner_id, 'owner', NOW()
FROM "tenants" t
WHERE t.kind = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM "tenant_memberships" m WHERE m.tenant_id = t.id AND m.user_id = t.owner_id
  );
