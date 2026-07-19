-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL DEFAULT 'hungryhub-analytics',
    "externalId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualifiedName" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "status" TEXT,
    "metadata" TEXT,
    "definitionHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edge" (
    "id" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "expression" TEXT,
    "sourcePlatform" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'inferred',
    "extractionMethod" TEXT,
    "evidence" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL DEFAULT '1.0',
    "severity" TEXT NOT NULL,
    "nodeId" TEXT,
    "edgeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "recommendation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "suppressionReason" TEXT,
    "suppressionExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalMetric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT,
    "description" TEXT,
    "expression" TEXT,
    "aggregation" TEXT,
    "requiredFilters" TEXT,
    "excludedFilters" TEXT,
    "dimensions" TEXT,
    "currencyRequirement" TEXT,
    "timeGrain" TEXT,
    "owner" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "severityOnDrift" TEXT NOT NULL DEFAULT 'warning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL DEFAULT 'hungryhub-analytics',
    "status" TEXT NOT NULL DEFAULT 'success',
    "totalModels" INTEGER NOT NULL DEFAULT 0,
    "totalDatasets" INTEGER NOT NULL DEFAULT 0,
    "totalCharts" INTEGER NOT NULL DEFAULT 0,
    "totalDashboards" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "lineageCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorFindings" INTEGER NOT NULL DEFAULT 0,
    "warningFindings" INTEGER NOT NULL DEFAULT 0,
    "criticalFindings" INTEGER NOT NULL DEFAULT 0,
    "infoFindings" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'olap',
    "host" TEXT,
    "port" INTEGER,
    "database" TEXT,
    "username" TEXT,
    "password" TEXT,
    "schema" TEXT,
    "filePath" TEXT,
    "fileConfig" TEXT,
    "config" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSourceTable" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "schema" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rowCount" INTEGER,
    "sizeBytes" INTEGER,
    "description" TEXT,
    "columns" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSourceTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layout" TEXT,
    "filters" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "branch" TEXT NOT NULL DEFAULT 'main',
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'virtual',
    "language" TEXT NOT NULL DEFAULT 'sql',
    "code" TEXT,
    "sourceTables" TEXT,
    "outputColumns" TEXT,
    "connectorId" TEXT,
    "schedule" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "branch" TEXT NOT NULL DEFAULT 'main',
    "ownerUserId" TEXT,
    "dashboardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chart" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chartType" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "dataSourceType" TEXT,
    "datasetId" TEXT,
    "config" TEXT,
    "customSQL" TEXT,
    "layout" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "branch" TEXT NOT NULL DEFAULT 'main',
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expression" TEXT,
    "language" TEXT NOT NULL DEFAULT 'sql',
    "aggregation" TEXT,
    "sourceTableId" TEXT,
    "sourceColumn" TEXT,
    "filters" TEXT,
    "dimensions" TEXT,
    "timeGrain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "branch" TEXT NOT NULL DEFAULT 'main',
    "ownerUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSource" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "tableId" TEXT,
    "connectorId" TEXT,
    "schemaName" TEXT,
    "tableName" TEXT NOT NULL,
    "columnName" TEXT,
    "role" TEXT NOT NULL,
    "expression" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartMetric" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "alias" TEXT,
    "axis" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "config" TEXT,
    "inputTables" TEXT,
    "outputSpec" TEXT,
    "schedule" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "environment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "branch" TEXT NOT NULL DEFAULT 'main',
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "dashboardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationSession" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cursorX" INTEGER NOT NULL DEFAULT 0,
    "cursorY" INTEGER NOT NULL DEFAULT 0,
    "activeChartId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardBranch" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseBranch" TEXT NOT NULL DEFAULT 'main',
    "baseCommitAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MergeRequest" (
    "id" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL DEFAULT 'main',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "conflictDetails" TEXT,
    "ownerUserId" TEXT,
    "reviewerUserId" TEXT,
    "mergedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MergeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "error" TEXT,
    "request" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Node_externalId_nodeType_platform_key" ON "Node"("externalId", "nodeType", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationSession_dashboardId_userId_key" ON "CollaborationSession"("dashboardId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardBranch_dashboardId_name_key" ON "DashboardBranch"("dashboardId", "name");

-- CreateIndex
CREATE INDEX "ApiLog_path_idx" ON "ApiLog"("path");

-- CreateIndex
CREATE INDEX "ApiLog_status_idx" ON "ApiLog"("status");

-- CreateIndex
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_edgeId_fkey" FOREIGN KEY ("edgeId") REFERENCES "Edge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSourceTable" ADD CONSTRAINT "DataSourceTable_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chart" ADD CONSTRAINT "Chart_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSource" ADD CONSTRAINT "MetricSource_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "MetricDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartMetric" ADD CONSTRAINT "ChartMetric_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "Chart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartMetric" ADD CONSTRAINT "ChartMetric_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "MetricDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardBranch" ADD CONSTRAINT "DashboardBranch_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeRequest" ADD CONSTRAINT "MergeRequest_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "DashboardBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
