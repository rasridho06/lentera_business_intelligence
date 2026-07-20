-- Phase 4 remedial R4 + R6: scheduler fields and Edge lineage linkage
-- All additions are nullable / have defaults so existing rows remain valid.

-- R4: JobDefinition scheduler fields for Phase 6.4
ALTER TABLE "JobDefinition" ADD COLUMN "lockKey" TEXT;
ALTER TABLE "JobDefinition" ADD COLUMN "lockedAt" DATETIME;
ALTER TABLE "JobDefinition" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "JobDefinition" ADD COLUMN "missedRunPolicy" TEXT;

-- Drop the old (enabled, nextRunAt) index and replace with one that includes lockKey
-- so the scheduler can claim the next runnable job with a single indexed scan.
DROP INDEX IF EXISTS "JobDefinition_enabled_nextRunAt_idx";
CREATE INDEX "JobDefinition_enabled_nextRunAt_lockKey_idx"
  ON "JobDefinition"("enabled", "nextRunAt", "lockKey");

-- R6: Edge lineage linkage for Phase 7.0a
-- Nullable columns; populated when an AssetRevision creates/updates a semantic edge.
-- Legacy lineage-only Edges (dbt/Superset imports) remain null until backfilled.
ALTER TABLE "Edge" ADD COLUMN "assetType" TEXT;
ALTER TABLE "Edge" ADD COLUMN "assetId" TEXT;
ALTER TABLE "Edge" ADD COLUMN "sourceRevisionId" TEXT;

CREATE INDEX "Edge_assetType_assetId_idx" ON "Edge"("assetType", "assetId");