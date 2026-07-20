-- Phase 5c: Semantic contracts for virtual datasets
-- Tracks column expectations and freshness constraints per dataset.
-- Validation outcomes are persisted as asset revisions, not in this table.

CREATE TABLE "DatasetContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    "freshnessSeconds" INTEGER,
    "acceptedValues" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DatasetContract_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DatasetContract_datasetId_key" ON "DatasetContract"("datasetId");