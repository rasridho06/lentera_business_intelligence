-- Phase 5b: Virtual dataset dependency tracking
-- Tracks which tables and datasets a virtual dataset references in its SQL/Python code.

-- CreateTable
CREATE TABLE "DatasetDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "dependsOnDatasetId" TEXT,
    "dependsOnTable" TEXT,
    "connectorId" TEXT,
    "dependencyType" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'table_level',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetDependency_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DatasetDependency_dependsOnDatasetId_fkey" FOREIGN KEY ("dependsOnDatasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DatasetDependency_datasetId_idx" ON "DatasetDependency"("datasetId");

-- CreateIndex
CREATE INDEX "DatasetDependency_dependsOnDatasetId_idx" ON "DatasetDependency"("dependsOnDatasetId");