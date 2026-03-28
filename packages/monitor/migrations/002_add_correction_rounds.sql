-- Migration: Add correctionRounds to monitoring_events
-- Added on: 2026-03-28

-- AlterTable
ALTER TABLE "monitoring_events" ADD COLUMN "correctionRounds" INTEGER;
