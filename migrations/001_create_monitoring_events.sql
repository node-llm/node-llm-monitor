-- Migration: Create monitoring_events table
-- Target: PostgreSQL (compatible with most SQL dialects)

CREATE TABLE IF NOT EXISTS "monitoring_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sessionId" TEXT,
    "transactionId" TEXT,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "cost" DOUBLE PRECISION,
    "cpuTime" DOUBLE PRECISION,
    "gcTime" DOUBLE PRECISION,
    "allocations" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,

    CONSTRAINT "monitoring_events_pkey" PRIMARY KEY ("id")
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS "monitoring_events_requestId_idx" ON "monitoring_events"("requestId");
CREATE INDEX IF NOT EXISTS "monitoring_events_sessionId_idx" ON "monitoring_events"("sessionId");
CREATE INDEX IF NOT EXISTS "monitoring_events_transactionId_idx" ON "monitoring_events"("transactionId");
CREATE INDEX IF NOT EXISTS "monitoring_events_time_idx" ON "monitoring_events"("time");
