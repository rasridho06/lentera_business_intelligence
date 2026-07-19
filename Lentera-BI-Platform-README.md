# Lentera BI Platform

A comprehensive Business Intelligence platform inspired by Apache Superset, built with Next.js 16, TypeScript, Tailwind CSS 4, and shadcn/ui.

## Features

- **Data Lineage** — Visualize data flow between tables and columns with ReactFlow
- **Dashboards** — Create and manage interactive dashboards with drag-and-drop charts
- **Charts** — Build charts (bar, line, pie, area, scatter) from datasets, Superset/Looker Studio style
- **Datasets** — Virtual datasets with cross-table queries and Python script support
- **Data Sources** — Connect to ClickHouse, OLTP/OLAP databases (DBeaver-style UI), or upload files (CSV/JSON/Excel/Parquet)
- **Metrics** — Define and manage cross-table/cross-column metrics
- **Real-time Collaboration** — Live cursor tracking and presence via WebSocket
- **Version Control** — GitHub-style branching, merging, and conflict detection
- **ML Integration** — Python-based data transforms and ML pipelines
- **Impact Analysis** — Assess downstream impact of changes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Charts | Recharts |
| Flow Diagrams | ReactFlow |
| State | Zustand |
| Database | SQLite (Prisma ORM) |
| API Server | Bun (Hono) |
| Collaboration | WebSocket |

## Quick Start

### Prerequisites

- Node.js 18+ (or Bun runtime)
- npm, yarn, or bun package manager

### Installation

```bash
# 1. Clone/extract to your desired folder
#    e.g., D:\Data Engineer\Portofolio\lentera-bi-platform

# 2. Navigate to the project directory
cd lentera-bi-platform

# 3. Install dependencies
npm install
# or: bun install

# 4. Generate Prisma client
npx prisma generate

# 5. Push database schema
npx prisma db push

# 6. Seed with dummy data (optional)
npx tsx scripts/seed-bi-platform.ts

# 7. Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm run start
```

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (charts, dashboards, datasets, etc.)
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main page (BI platform shell)
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── lentera/            # BI platform components
│   │   │   ├── charts-view.tsx
│   │   │   ├── dashboards-view.tsx
│   │   │   ├── datasets-view.tsx
│   │   │   ├── connectors-view.tsx
│   │   │   ├── lineage-view.tsx
│   │   │   ├── metrics-view.tsx
│   │   │   ├── collaboration-view.tsx
│   │   │   └── ...
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── home-client.tsx
│   │   └── error-boundary.tsx
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility functions, DB client, validations
│   └── __tests__/              # Test suites (unit, integration, system, UAT)
├── prisma/
│   └── schema.prisma           # Database schema
├── scripts/
│   ├── seed-bi-platform.ts     # Seed script for dummy data
│   └── seed-csv-charts.ts      # Seed script for CSV-based charts
├── mini-services/
│   └── collab-service/         # WebSocket collaboration microservice
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── vitest.config.ts
```

## Navigation (Superset-Inspired)

The main sidebar provides access to:

1. **Overview** — Platform summary and KPIs
2. **Charts** — Create and manage chart visualizations
3. **Dashboards** — Build and view dashboards
4. **Datasets** — Manage virtual datasets and SQL queries
5. **Lineage** — Visual data lineage tracking
6. **Data Sources** — Connect databases and upload files
7. **Metrics** — Define and monitor metrics
8. **Collaboration** — Real-time collaboration features
9. **Version Control** — Branch management and merge requests

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/charts` | GET/POST | List or create charts |
| `/api/dashboards` | GET/POST | List or create dashboards |
| `/api/datasets` | GET/POST | List or create datasets |
| `/api/connectors` | GET/POST | Manage database connections |
| `/api/upload` | POST | Upload file data sources |
| `/api/lineage` | GET | Get lineage graph data |
| `/api/metrics` | GET | Get metrics data |
| `/api/overview` | GET | Get platform overview stats |
| `/api/collaboration` | GET | Collaboration WebSocket |
| `/api/branches` | GET/POST | Version control branches |
| `/api/merge-requests` | GET/POST | Merge requests |

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:system
npm run test:uat
```

## License

Private / Portfolio Project
