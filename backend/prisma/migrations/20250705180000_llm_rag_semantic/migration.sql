-- Semantic RAG chunks + LLM adapter registry
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "symbol" TEXT,
    "embedding" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_chunks_user_id_idx" ON "knowledge_chunks"("user_id");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

DO $$ BEGIN
    ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey"
        FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "llm_adapters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_model" TEXT NOT NULL,
    "adapter_type" TEXT NOT NULL DEFAULT 'lora',
    "s3_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "metrics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_adapters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "llm_adapters_user_id_status_idx" ON "llm_adapters"("user_id", "status");

DO $$ BEGIN
    ALTER TABLE "llm_adapters" ADD CONSTRAINT "llm_adapters_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "llm_training_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_model" TEXT NOT NULL,
    "train_type" TEXT NOT NULL DEFAULT 'qlora',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB,
    "adapter_path" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_training_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "llm_training_jobs_user_id_status_idx" ON "llm_training_jobs"("user_id", "status");

DO $$ BEGIN
    ALTER TABLE "llm_training_jobs" ADD CONSTRAINT "llm_training_jobs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
