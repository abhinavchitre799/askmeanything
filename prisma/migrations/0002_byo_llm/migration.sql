-- Bring-Your-Own-Key: per-project LLM credentials.

-- CreateTable
CREATE TABLE "ProjectLlmConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "chatModel" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "apiBaseUrl" TEXT,
    "embeddingDimension" INTEGER NOT NULL DEFAULT 768,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectLlmConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectLlmConfig_projectId_key" ON "ProjectLlmConfig"("projectId");

ALTER TABLE "ProjectLlmConfig"
    ADD CONSTRAINT "ProjectLlmConfig_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Relax the embedding column so different projects can use embedding models of
-- different dimensions (e.g. Gemini 768 vs OpenAI 1536). pgvector's ivfflat
-- index requires a fixed dimension, so we drop it; retrieval is project-scoped,
-- which keeps the scanned set small at MVP scale. Within a project, all chunks
-- share one model (and dimension), so cosine comparisons remain valid.
DROP INDEX IF EXISTS "DocumentChunk_embedding_idx";
ALTER TABLE "DocumentChunk" ALTER COLUMN "embedding" TYPE vector USING "embedding"::vector;
