-- Phase 7: Relationship manager
-- Tracks table-column relationships with cardinality and validation status.

CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceTableId" TEXT NOT NULL,
    "targetTableId" TEXT NOT NULL,
    "sourceColumn" TEXT NOT NULL,
    "targetColumn" TEXT NOT NULL,
    "cardinality" TEXT NOT NULL DEFAULT 'many_to_one',
    "filterDirection" TEXT NOT NULL DEFAULT 'both',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validationStatus" TEXT NOT NULL DEFAULT 'unchecked',
    "ownerUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Relationship_sourceTableId_targetTableId_sourceColumn_targetColumn_key" ON "Relationship"("sourceTableId", "targetTableId", "sourceColumn", "targetColumn");
CREATE INDEX "Relationship_sourceTableId_idx" ON "Relationship"("sourceTableId");
CREATE INDEX "Relationship_targetTableId_idx" ON "Relationship"("targetTableId");
