---
Task ID: 1
Agent: Main Agent
Task: Fix Lentera BI Platform - Client-side exception, chart creation, CSV data integration

Work Log:
- Explored project structure: Next.js 16.1.1 + Prisma + SQLite + 14 view components
- Identified root cause: Server OOM (Out of Memory) due to heavy SSR rendering
- Next.js server process gets killed by container's cgroup memory limit when rendering the page
- All API routes work correctly when tested individually
- Created lightweight Bun API server (bun-api-server.ts) as alternative to Next.js API server
- Created custom-server.ts that serves static HTML for pages + proxies API to Bun server
- Added error boundary component for graceful client-side error handling
- Refactored page.tsx to use dynamic imports with ssr: false for all heavy components
- Created home-client.tsx as the main SPA component with lazy-loaded views
- Seeded CSV data from Warehouse_and_Retail_Sales.csv (307,645 rows)
- Created 6 charts from CSV data: Monthly Trend, Item Type Pie, Sales by Type Bar, Top Suppliers, YoY Comparison, KPI Overview
- Created 1 dashboard: "Warehouse & Retail Sales Analytics"
- Created CSV file connector with schema detection
- Created 2 metrics: Total Retail Sales, Total Warehouse Sales
- Updated chart renderer to support real chart data from config.chartData
- Added multi-metric card support in chart renderer
- Created start-lentera.sh auto-restart script for server stability
- Updated package.json with new scripts

Stage Summary:
- Architecture changed from: Next.js SSR → Bun static HTML + Bun API proxy
- This avoids the OOM issue that kills the Next.js server process
- Data: 17 charts, 4 dashboards, 9 connectors, 3 datasets, 6 metrics
- CSV data: 307,645 rows from Warehouse_and_Retail_Sales.csv
- Key files created: bun-api-server.ts, custom-server.ts, home-client.tsx, error-boundary.tsx, start-lentera.sh
- Auto-restart mechanism ensures server availability despite memory constraints
