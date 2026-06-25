-- AskMeAnything baseline migration.
--
-- Embedding dimension defaults to 768 (Google Gemini text-embedding-004).
-- If you use a different embedding model (e.g. OpenAI text-embedding-3-small
-- which is 1536), change every `vector(768)` below to your dimension BEFORE
-- running the migration, and set EMBEDDING_DIMENSION in your .env to match.

-- Required extension for vector similarity search.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "contentHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourcesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hi! Ask me anything about this site.',
    "accentColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WidgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "pagesFound" INTEGER NOT NULL DEFAULT 0,
    "pagesIndexed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX "Source_projectId_idx" ON "Source"("projectId");
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");
CREATE INDEX "Document_sourceId_idx" ON "Document"("sourceId");
CREATE INDEX "Document_projectId_contentHash_idx" ON "Document"("projectId", "contentHash");
CREATE INDEX "DocumentChunk_projectId_idx" ON "DocumentChunk"("projectId");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX "Conversation_projectId_idx" ON "Conversation"("projectId");
CREATE INDEX "Conversation_projectId_visitorId_idx" ON "Conversation"("projectId", "visitorId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE UNIQUE INDEX "WidgetSettings_projectId_key" ON "WidgetSettings"("projectId");
CREATE INDEX "CrawlJob_projectId_idx" ON "CrawlJob"("projectId");
CREATE INDEX "CrawlJob_sourceId_idx" ON "CrawlJob"("sourceId");

-- Approximate nearest-neighbour index for cosine distance.
-- ivfflat needs a fixed dimension; it must match the vector(...) column above.
CREATE INDEX "DocumentChunk_embedding_idx"
    ON "DocumentChunk"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- Foreign keys
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WidgetSettings" ADD CONSTRAINT "WidgetSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
