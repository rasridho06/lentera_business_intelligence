-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "correlationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AssetRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetType" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "auditEventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetRevision_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AuditEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetType" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "retryLimit" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "errorSummary" TEXT,
    "outputRevisionId" TEXT,
    "auditEventId" TEXT,
    CONSTRAINT "JobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JobRun_outputRevisionId_fkey" FOREIGN KEY ("outputRevisionId") REFERENCES "AssetRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JobRun_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AuditEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_correlationId_key" ON "AuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AssetRevision_assetType_assetId_idx" ON "AssetRevision"("assetType", "assetId");

-- CreateIndex
CREATE INDEX "AssetRevision_auditEventId_idx" ON "AssetRevision"("auditEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRevision_assetType_assetId_revision_key" ON "AssetRevision"("assetType", "assetId", "revision");

-- CreateIndex
CREATE INDEX "JobDefinition_enabled_nextRunAt_idx" ON "JobDefinition"("enabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobDefinition_assetType_assetId_key" ON "JobDefinition"("assetType", "assetId");

-- CreateIndex
CREATE INDEX "JobRun_jobId_startedAt_idx" ON "JobRun"("jobId", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt");

