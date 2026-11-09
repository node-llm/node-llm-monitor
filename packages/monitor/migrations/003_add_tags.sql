-- Migration: Add tags to monitoring_events, for filtering calls by plain labels such as a project
-- Added on: 2026-11-09

-- AlterTable
ALTER TABLE "monitoring_events" ADD COLUMN "tags" JSONB;

-- Filtering by tags
CREATE INDEX IF NOT EXISTS "monitoring_events_tags_idx" ON "monitoring_events" USING GIN ("tags");
