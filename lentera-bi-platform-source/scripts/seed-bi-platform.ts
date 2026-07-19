import { db } from '../src/lib/db';

async function seed() {
  console.log('Seeding BI platform data...');

  // Create demo users
  const user1 = await db.user.upsert({
    where: { email: 'andi@lentera.io' },
    update: {},
    create: { name: 'Andi Pratama', email: 'andi@lentera.io', avatar: null, role: 'admin', color: '#16a34a' },
  });
  const user2 = await db.user.upsert({
    where: { email: 'maya@lentera.io' },
    update: {},
    create: { name: 'Maya Sari', email: 'maya@lentera.io', avatar: null, role: 'editor', color: '#dc2626' },
  });
  const user3 = await db.user.upsert({
    where: { email: 'budi@lentera.io' },
    update: {},
    create: { name: 'Budi Santoso', email: 'budi@lentera.io', avatar: null, role: 'editor', color: '#7c3aed' },
  });

  // ═══════════════════════════════════════════
  // DATABASE CONNECTORS (OLTP/OLAP)
  // ═══════════════════════════════════════════

  const chConnector = await db.connector.upsert({
    where: { id: 'connector-ch-demo' },
    update: {},
    create: {
      id: 'connector-ch-demo',
      name: 'ClickHouse Production',
      type: 'clickhouse',
      category: 'olap',
      host: 'clickhouse.production.internal',
      port: 9000,
      database: 'booking_production',
      schema: 'analytics',
      username: 'default',
      password: '****',
      status: 'connected',
    },
  });

  const pgConnector = await db.connector.upsert({
    where: { id: 'connector-pg-demo' },
    update: {},
    create: {
      id: 'connector-pg-demo',
      name: 'PostgreSQL Analytics',
      type: 'postgres',
      category: 'oltp',
      host: 'postgres.analytics.internal',
      port: 5432,
      database: 'analytics_db',
      schema: 'public',
      username: 'analytics_user',
      password: '****',
      status: 'connected',
    },
  });

  const mysqlConnector = await db.connector.upsert({
    where: { id: 'connector-mysql-demo' },
    update: {},
    create: {
      id: 'connector-mysql-demo',
      name: 'MySQL Shop Database',
      type: 'mysql',
      category: 'oltp',
      host: 'mysql.shop.internal',
      port: 3306,
      database: 'shop_db',
      schema: 'shop_db',
      username: 'readonly',
      password: '****',
      status: 'connected',
    },
  });

  // ═══════════════════════════════════════════
  // FILE-BASED CONNECTORS (CSV, JSON, Excel, Parquet)
  // ═══════════════════════════════════════════

  const csvConnector = await db.connector.upsert({
    where: { id: 'connector-csv-demo' },
    update: {},
    create: {
      id: 'connector-csv-demo',
      name: 'Marketing Campaigns CSV',
      type: 'csv',
      category: 'file',
      filePath: '/uploads/marketing_campaigns.csv',
      fileConfig: JSON.stringify({ delimiter: ',', encoding: 'utf-8', header: true }),
      status: 'connected',
    },
  });

  const jsonConnector = await db.connector.upsert({
    where: { id: 'connector-json-demo' },
    update: {},
    create: {
      id: 'connector-json-demo',
      name: 'API Response Logs JSON',
      type: 'json',
      category: 'file',
      filePath: '/uploads/api_logs.json',
      fileConfig: JSON.stringify({ format: 'jsonl' }),
      status: 'connected',
    },
  });

  const excelConnector = await db.connector.upsert({
    where: { id: 'connector-excel-demo' },
    update: {},
    create: {
      id: 'connector-excel-demo',
      name: 'Budget Report Excel',
      type: 'excel',
      category: 'file',
      filePath: '/uploads/budget_2026.xlsx',
      fileConfig: JSON.stringify({ sheet: 'Q1_Budget' }),
      status: 'connected',
    },
  });

  const parquetConnector = await db.connector.upsert({
    where: { id: 'connector-parquet-demo' },
    update: {},
    create: {
      id: 'connector-parquet-demo',
      name: 'Event Analytics Parquet',
      type: 'parquet',
      category: 'file',
      filePath: '/uploads/events_2026.parquet',
      fileConfig: null,
      status: 'connected',
    },
  });

  // ═══════════════════════════════════════════
  // TABLES for DATABASE CONNECTORS
  // ═══════════════════════════════════════════

  const chTables = [
    { id: 'table-ch-1', connectorId: 'connector-ch-demo', schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: JSON.stringify([
      { name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'user_id', type: 'UInt64', nullable: false }, { name: 'restaurant_id', type: 'UInt64', nullable: false },
      { name: 'reservation_date', type: 'Date', nullable: false }, { name: 'price_cents', type: 'Int32', nullable: true }, { name: 'active', type: 'UInt8', nullable: false },
      { name: 'no_show', type: 'UInt8', nullable: false }, { name: 'channel_id', type: 'UInt32', nullable: true }, { name: 'created_at', type: 'DateTime', nullable: false },
    ]) },
    { id: 'table-ch-2', connectorId: 'connector-ch-demo', schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: JSON.stringify([
      { name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'name', type: 'String', nullable: false }, { name: 'category', type: 'String', nullable: true },
      { name: 'city_id', type: 'UInt32', nullable: true }, { name: 'rating', type: 'Float32', nullable: true },
    ]) },
    { id: 'table-ch-3', connectorId: 'connector-ch-demo', schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: JSON.stringify([
      { name: 'date', type: 'Date', nullable: false }, { name: 'restaurant_id', type: 'UInt64', nullable: false }, { name: 'gmv', type: 'Float64', nullable: true },
      { name: 'total_reservations', type: 'UInt64', nullable: true }, { name: 'channel_name', type: 'String', nullable: true },
    ]) },
    { id: 'table-ch-4', connectorId: 'connector-ch-demo', schema: 'analytics', name: 'fct_reservations', type: 'table', rowCount: 3000000, columns: JSON.stringify([
      { name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'reservation_date', type: 'Date', nullable: false },
      { name: 'sales_amount', type: 'Float64', nullable: true }, { name: 'active', type: 'UInt8', nullable: false }, { name: 'product_category', type: 'String', nullable: true },
    ]) },
    { id: 'table-ch-5', connectorId: 'connector-ch-demo', schema: 'analytics', name: 'dim_calendar', type: 'table', rowCount: 36500, columns: JSON.stringify([
      { name: 'calendar_date', type: 'Date', nullable: false, isPK: true }, { name: 'day_of_week', type: 'UInt8', nullable: false },
      { name: 'month_name', type: 'String', nullable: false }, { name: 'quarter', type: 'UInt8', nullable: false },
    ]) },
    { id: 'table-ch-6', connectorId: 'connector-ch-demo', schema: 'analytics', name: 'dim_product', type: 'table', rowCount: 5000, columns: JSON.stringify([
      { name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'category_name', type: 'String', nullable: false }, { name: 'subcategory', type: 'String', nullable: true },
    ]) },
    { id: 'table-ch-7', connectorId: 'connector-ch-demo', schema: 'staging', name: 'stg_reservations', type: 'view', rowCount: 2500000, columns: JSON.stringify([
      { name: 'id', type: 'UInt64', nullable: false }, { name: 'user_id', type: 'UInt64', nullable: false },
      { name: 'price_cents', type: 'Int32', nullable: true }, { name: 'is_valid', type: 'UInt8', nullable: false },
    ]) },
  ];

  for (const t of chTables) {
    await db.dataSourceTable.upsert({ where: { id: t.id }, update: {}, create: t as any });
  }

  const pgTables = [
    { id: 'table-pg-1', connectorId: 'connector-pg-demo', schema: 'public', name: 'users', type: 'table', rowCount: 50000, columns: JSON.stringify([
      { name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'email', type: 'VARCHAR', nullable: false }, { name: 'name', type: 'VARCHAR', nullable: true },
      { name: 'role', type: 'VARCHAR', nullable: true }, { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ]) },
    { id: 'table-pg-2', connectorId: 'connector-pg-demo', schema: 'public', name: 'orders', type: 'table', rowCount: 200000, columns: JSON.stringify([
      { name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'user_id', type: 'INT', nullable: false },
      { name: 'total_amount', type: 'DECIMAL', nullable: true }, { name: 'status', type: 'VARCHAR', nullable: false }, { name: 'order_date', type: 'DATE', nullable: false },
    ]) },
    { id: 'table-pg-3', connectorId: 'connector-pg-demo', schema: 'public', name: 'order_items', type: 'table', rowCount: 500000, columns: JSON.stringify([
      { name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'order_id', type: 'INT', nullable: false },
      { name: 'product_id', type: 'INT', nullable: false }, { name: 'quantity', type: 'INT', nullable: false }, { name: 'unit_price', type: 'DECIMAL', nullable: false },
    ]) },
  ];

  for (const t of pgTables) {
    await db.dataSourceTable.upsert({ where: { id: t.id }, update: {}, create: t as any });
  }

  const mysqlTables = [
    { id: 'table-mysql-1', connectorId: 'connector-mysql-demo', schema: 'shop_db', name: 'products', type: 'table', rowCount: 8000, columns: JSON.stringify([
      { name: 'id', type: 'INT', nullable: false, isPK: true }, { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'price', type: 'DECIMAL(10,2)', nullable: true }, { name: 'stock', type: 'INT', nullable: false }, { name: 'category_id', type: 'INT', nullable: true },
    ]) },
    { id: 'table-mysql-2', connectorId: 'connector-mysql-demo', schema: 'shop_db', name: 'transactions', type: 'table', rowCount: 1200000, columns: JSON.stringify([
      { name: 'id', type: 'BIGINT', nullable: false, isPK: true }, { name: 'product_id', type: 'INT', nullable: false },
      { name: 'quantity', type: 'INT', nullable: false }, { name: 'total_price', type: 'DECIMAL(10,2)', nullable: false }, { name: 'created_at', type: 'DATETIME', nullable: false },
    ]) },
  ];

  for (const t of mysqlTables) {
    await db.dataSourceTable.upsert({ where: { id: t.id }, update: {}, create: t as any });
  }

  // ═══════════════════════════════════════════
  // TABLES for FILE-BASED CONNECTORS
  // ═══════════════════════════════════════════

  const fileTables = [
    { id: 'table-csv-1', connectorId: 'connector-csv-demo', schema: 'file', name: 'marketing_campaigns', type: 'table', rowCount: 2500, columns: JSON.stringify([
      { name: 'campaign_id', type: 'VARCHAR', nullable: false }, { name: 'campaign_name', type: 'VARCHAR', nullable: false },
      { name: 'channel', type: 'VARCHAR', nullable: true }, { name: 'spend', type: 'DOUBLE', nullable: true },
      { name: 'impressions', type: 'INTEGER', nullable: true }, { name: 'clicks', type: 'INTEGER', nullable: true },
      { name: 'conversions', type: 'INTEGER', nullable: true }, { name: 'start_date', type: 'DATE', nullable: true },
    ]) },
    { id: 'table-json-1', connectorId: 'connector-json-demo', schema: 'file', name: 'api_logs', type: 'table', rowCount: 50000, columns: JSON.stringify([
      { name: 'timestamp', type: 'TIMESTAMP', nullable: false }, { name: 'endpoint', type: 'VARCHAR', nullable: false },
      { name: 'method', type: 'VARCHAR', nullable: false }, { name: 'status_code', type: 'INTEGER', nullable: true },
      { name: 'response_time_ms', type: 'DOUBLE', nullable: true }, { name: 'user_agent', type: 'VARCHAR', nullable: true },
    ]) },
    { id: 'table-excel-1', connectorId: 'connector-excel-demo', schema: 'file', name: 'budget_2026_q1', type: 'table', rowCount: 200, columns: JSON.stringify([
      { name: 'department', type: 'VARCHAR', nullable: false }, { name: 'category', type: 'VARCHAR', nullable: true },
      { name: 'planned_budget', type: 'DOUBLE', nullable: true }, { name: 'actual_spend', type: 'DOUBLE', nullable: true },
      { name: 'variance_pct', type: 'DOUBLE', nullable: true }, { name: 'quarter', type: 'VARCHAR', nullable: false },
    ]) },
    { id: 'table-parquet-1', connectorId: 'connector-parquet-demo', schema: 'file', name: 'events_2026', type: 'table', rowCount: 5000000, columns: JSON.stringify([
      { name: 'event_id', type: 'VARCHAR', nullable: false }, { name: 'event_type', type: 'VARCHAR', nullable: false },
      { name: 'user_id', type: 'INTEGER', nullable: true }, { name: 'session_id', type: 'VARCHAR', nullable: true },
      { name: 'event_time', type: 'TIMESTAMP', nullable: false }, { name: 'platform', type: 'VARCHAR', nullable: true },
      { name: 'properties', type: 'VARCHAR', nullable: true },
    ]) },
  ];

  for (const t of fileTables) {
    await db.dataSourceTable.upsert({ where: { id: t.id }, update: {}, create: t as any });
  }

  // ═══════════════════════════════════════════
  // DASHBOARDS
  // ═══════════════════════════════════════════

  const dash1 = await db.dashboard.upsert({
    where: { id: 'dash-sales' },
    update: {},
    create: {
      id: 'dash-sales',
      name: 'Sales Performance',
      description: 'Main sales dashboard tracking GMV, reservations, and channel performance',
      status: 'published',
      isPublic: true,
      branch: 'main',
      layout: JSON.stringify({ cols: 3, charts: [
        { id: 'chart-monthly-sales', x: 0, y: 0, w: 2, h: 1 },
        { id: 'chart-channel-dist', x: 2, y: 0, w: 1, h: 1 },
        { id: 'chart-gmv-trend', x: 0, y: 1, w: 3, h: 1 },
      ] }),
      ownerUserId: user1.id,
    },
  });

  const dash2 = await db.dashboard.upsert({
    where: { id: 'dash-restaurant' },
    update: {},
    create: {
      id: 'dash-restaurant',
      name: 'Restaurant Analytics',
      description: 'Restaurant performance metrics and category breakdowns',
      status: 'published',
      branch: 'main',
      layout: JSON.stringify({ cols: 2, charts: [
        { id: 'chart-top-restaurants', x: 0, y: 0, w: 1, h: 1 },
        { id: 'chart-category-mix', x: 1, y: 0, w: 1, h: 1 },
      ] }),
      ownerUserId: user2.id,
    },
  });

  // ═══════════════════════════════════════════
  // VIRTUAL DATASETS
  // ═══════════════════════════════════════════

  const datasets = [
    {
      id: 'dataset-user-reservation',
      name: 'User Reservation Summary',
      description: 'Virtual dataset joining reservations with user data from PostgreSQL, enriched with restaurant categories from ClickHouse',
      type: 'virtual',
      language: 'sql',
      code: `SELECT
  r.id AS reservation_id,
  r.user_id,
  u.name AS user_name,
  u.email,
  r.price_cents / 100.0 AS amount,
  r.reservation_date,
  rest.category AS restaurant_category,
  rest.name AS restaurant_name
FROM booking_production.reservations r
JOIN public.users u ON r.user_id = u.id::UInt64
JOIN booking_production.restaurants rest ON r.restaurant_id = rest.id
WHERE r.active = 1 AND r.no_show = 0`,
      sourceTables: JSON.stringify([
        { connectorId: 'connector-ch-demo', schema: 'booking_production', table: 'reservations' },
        { connectorId: 'connector-pg-demo', schema: 'public', table: 'users' },
        { connectorId: 'connector-ch-demo', schema: 'booking_production', table: 'restaurants' },
      ]),
      outputColumns: JSON.stringify([
        { name: 'reservation_id', type: 'INTEGER', description: 'Reservation ID' },
        { name: 'user_id', type: 'INTEGER', description: 'User ID' },
        { name: 'user_name', type: 'VARCHAR', description: 'User name from PostgreSQL' },
        { name: 'email', type: 'VARCHAR', description: 'User email' },
        { name: 'amount', type: 'DOUBLE', description: 'Reservation amount in dollars' },
        { name: 'reservation_date', type: 'DATE', description: 'Date of reservation' },
        { name: 'restaurant_category', type: 'VARCHAR', description: 'Restaurant category' },
        { name: 'restaurant_name', type: 'VARCHAR', description: 'Restaurant name' },
      ]),
      connectorId: 'connector-ch-demo',
      schedule: '0 2 * * *',
      lastRunStatus: 'success',
      lastRunAt: new Date(),
      status: 'published',
      ownerUserId: user1.id,
    },
    {
      id: 'dataset-campaign-roi',
      name: 'Campaign ROI Analysis',
      description: 'Virtual dataset combining CSV marketing campaign data with ClickHouse GMV data to calculate campaign ROI',
      type: 'virtual',
      language: 'sql',
      code: `SELECT
  mc.campaign_id,
  mc.campaign_name,
  mc.channel,
  mc.spend AS campaign_spend,
  mc.impressions,
  mc.clicks,
  mc.conversions,
  gmv.total_gmv,
  (gmv.total_gmv - mc.spend) / NULLIF(mc.spend, 0) AS roi
FROM file.marketing_campaigns mc
LEFT JOIN (
  SELECT channel_name, SUM(gmv) AS total_gmv
  FROM analytics.mart_booking_gmv
  WHERE date >= '2026-01-01'
  GROUP BY channel_name
) gmv ON mc.channel = gmv.channel_name`,
      sourceTables: JSON.stringify([
        { connectorId: 'connector-csv-demo', schema: 'file', table: 'marketing_campaigns' },
        { connectorId: 'connector-ch-demo', schema: 'analytics', table: 'mart_booking_gmv' },
      ]),
      outputColumns: JSON.stringify([
        { name: 'campaign_id', type: 'VARCHAR', description: 'Campaign identifier' },
        { name: 'campaign_name', type: 'VARCHAR', description: 'Campaign name' },
        { name: 'channel', type: 'VARCHAR', description: 'Marketing channel' },
        { name: 'campaign_spend', type: 'DOUBLE', description: 'Amount spent on campaign' },
        { name: 'roi', type: 'DOUBLE', description: 'Return on investment' },
      ]),
      connectorId: 'connector-ch-demo',
      schedule: '0 6 * * *',
      lastRunStatus: 'success',
      lastRunAt: new Date(Date.now() - 86400000),
      status: 'published',
      ownerUserId: user2.id,
    },
    {
      id: 'dataset-churn-features',
      name: 'Churn Feature Table',
      description: 'Python/ML generated dataset computing churn features from reservation history and user data',
      type: 'python_generated',
      language: 'python',
      code: `import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier

# Read from imported tables across connectors
df_reservations = read_table("booking_production.reservations")
df_users = read_table("public.users")

# Feature engineering
user_features = df_reservations.groupby('user_id').agg(
    total_bookings=('id', 'count'),
    avg_booking_value=('price_cents', 'mean'),
    last_booking_date=('reservation_date', 'max'),
    unique_restaurants=('restaurant_id', 'nunique'),
    no_show_count=('no_show', 'sum')
).reset_index()

user_features['days_since_last'] = (pd.Timestamp.now() - user_features['last_booking_date']).dt.days
user_features['is_churned'] = (user_features['days_since_last'] > 90).astype(int)

# Train and predict
features = ['total_bookings', 'avg_booking_value', 'days_since_last', 'unique_restaurants', 'no_show_count']
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(user_features[features], user_features['is_churned'])

user_features['churn_probability'] = model.predict_proba(user_features[features])[:, 1]
user_features['churn_risk'] = pd.cut(user_features['churn_probability'],
    bins=[0, 0.2, 0.5, 0.8, 1.0], labels=['low', 'medium', 'high', 'critical'])

output = user_features[['user_id', 'churn_probability', 'churn_risk', 'total_bookings', 'days_since_last']]`,
      sourceTables: JSON.stringify([
        { connectorId: 'connector-ch-demo', schema: 'booking_production', table: 'reservations' },
        { connectorId: 'connector-pg-demo', schema: 'public', table: 'users' },
      ]),
      outputColumns: JSON.stringify([
        { name: 'user_id', type: 'INTEGER', description: 'User ID' },
        { name: 'churn_probability', type: 'DOUBLE', description: 'ML-predicted churn probability' },
        { name: 'churn_risk', type: 'VARCHAR', description: 'Risk tier: low/medium/high/critical' },
        { name: 'total_bookings', type: 'INTEGER', description: 'Total booking count' },
        { name: 'days_since_last', type: 'INTEGER', description: 'Days since last booking' },
      ]),
      connectorId: 'connector-ch-demo',
      schedule: '0 3 * * 0',
      lastRunStatus: 'success',
      lastRunAt: new Date(Date.now() - 172800000),
      status: 'published',
      ownerUserId: user3.id,
    },
  ];

  for (const d of datasets) {
    await db.dataset.upsert({ where: { id: d.id }, update: {}, create: d as any });
  }

  // ═══════════════════════════════════════════
  // METRICS (cross-table)
  // ═══════════════════════════════════════════

  const metricGmv = await db.metricDef.upsert({
    where: { id: 'metric-gmv' },
    update: {},
    create: {
      id: 'metric-gmv',
      name: 'GMV',
      description: 'Gross merchandise value for valid reservations',
      expression: 'SUM(price_cents) / 100',
      language: 'sql',
      aggregation: 'sum',
      sourceTableId: 'table-ch-1',
      sourceColumn: 'price_cents',
      filters: JSON.stringify({ required: ['active = 1', 'no_show = 0'] }),
      dimensions: JSON.stringify(['channel_name', 'restaurant_id', 'reservation_date']),
      timeGrain: 'day',
      status: 'published',
      ownerUserId: user1.id,
      version: 3,
    },
  });

  const metricReservations = await db.metricDef.upsert({
    where: { id: 'metric-reservations' },
    update: {},
    create: {
      id: 'metric-reservations',
      name: 'Total Reservations',
      description: 'Count of all active reservations',
      expression: 'COUNT(id)',
      language: 'sql',
      aggregation: 'count',
      sourceTableId: 'table-ch-1',
      sourceColumn: 'id',
      dimensions: JSON.stringify(['channel_name', 'product_category']),
      timeGrain: 'day',
      status: 'published',
      ownerUserId: user2.id,
      version: 2,
    },
  });

  const metricRevenue = await db.metricDef.upsert({
    where: { id: 'metric-revenue' },
    update: {},
    create: {
      id: 'metric-revenue',
      name: 'Net Revenue',
      description: 'Revenue after cancellations and no-shows',
      expression: 'SUM(CASE WHEN no_show = 0 AND active = 1 THEN sales_amount ELSE 0 END)',
      language: 'sql',
      aggregation: 'sum',
      sourceTableId: 'table-ch-4',
      sourceColumn: 'sales_amount',
      filters: JSON.stringify({ required: ['active = 1'] }),
      dimensions: JSON.stringify(['product_category']),
      timeGrain: 'month',
      status: 'published',
      ownerUserId: user1.id,
      version: 1,
    },
  });

  const metricChurn = await db.metricDef.upsert({
    where: { id: 'metric-churn-predict' },
    update: {},
    create: {
      id: 'metric-churn-predict',
      name: 'Churn Prediction Score',
      description: 'ML-generated churn probability per user using historical reservation patterns',
      expression: `import pandas as pd\nfrom sklearn.ensemble import RandomForestClassifier\n\ndf = pd.read_sql("SELECT user_id, COUNT(*) as bookings, AVG(price_cents) as avg_price FROM booking_production.reservations GROUP BY user_id", engine)\ndf['churn_score'] = model.predict_proba(df[['bookings', 'avg_price']])[:, 1]\nreturn df[['user_id', 'churn_score']]`,
      language: 'python',
      aggregation: 'custom',
      sourceTableId: 'table-ch-1',
      status: 'draft',
      ownerUserId: user3.id,
      version: 1,
    },
  });

  // Metric sources
  const metricSources = [
    { id: 'ms-1', metricId: 'metric-gmv', tableName: 'booking_production.reservations', columnName: 'price_cents', role: 'measure', connectorId: 'connector-ch-demo' },
    { id: 'ms-2', metricId: 'metric-gmv', tableName: 'analytics.dim_calendar', columnName: 'calendar_date', role: 'time_dimension', connectorId: 'connector-ch-demo' },
    { id: 'ms-3', metricId: 'metric-gmv', tableName: 'booking_production.restaurants', columnName: 'category', role: 'dimension', connectorId: 'connector-ch-demo' },
    { id: 'ms-4', metricId: 'metric-reservations', tableName: 'booking_production.reservations', columnName: 'id', role: 'measure', connectorId: 'connector-ch-demo' },
    { id: 'ms-5', metricId: 'metric-reservations', tableName: 'analytics.dim_product', columnName: 'category_name', role: 'dimension', connectorId: 'connector-ch-demo' },
    { id: 'ms-6', metricId: 'metric-revenue', tableName: 'analytics.fct_reservations', columnName: 'sales_amount', role: 'measure', connectorId: 'connector-ch-demo' },
    { id: 'ms-7', metricId: 'metric-revenue', tableName: 'analytics.fct_reservations', columnName: 'product_category', role: 'dimension', connectorId: 'connector-ch-demo' },
    { id: 'ms-8', metricId: 'metric-churn-predict', tableName: 'booking_production.reservations', columnName: 'user_id', role: 'join_key', connectorId: 'connector-ch-demo' },
    { id: 'ms-9', metricId: 'metric-churn-predict', tableName: 'booking_production.reservations', columnName: 'price_cents', role: 'measure', connectorId: 'connector-ch-demo' },
  ];

  for (const ms of metricSources) {
    await db.metricSource.upsert({ where: { id: ms.id }, update: {}, create: ms as any });
  }

  // ═══════════════════════════════════════════
  // CHARTS (Dashboard + Standalone)
  // ═══════════════════════════════════════════

  const charts = [
    // Dashboard charts
    {
      id: 'chart-monthly-sales',
      dashboardId: 'dash-sales',
      name: 'Monthly Sales by Category',
      chartType: 'bar',
      dataSourceId: 'table-ch-4',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: { column: 'reservation_date', type: 'date', label: 'Month' },
        yAxis: { column: 'sales_amount', type: 'number', label: 'Sales Amount' },
        dimensions: ['product_category'],
        metrics: ['metric-revenue'],
        colors: ['#16a34a', '#7c3aed', '#dc2626'],
      }),
      status: 'published',
    },
    {
      id: 'chart-channel-dist',
      dashboardId: 'dash-sales',
      name: 'Channel Distribution',
      chartType: 'pie',
      dataSourceId: 'table-ch-3',
      dataSourceType: 'table',
      config: JSON.stringify({
        dimension: 'channel_name',
        metric: 'total_reservations',
        colors: ['#16a34a', '#7c3aed', '#dc2626', '#f59e0b', '#0891b2'],
      }),
      status: 'published',
    },
    {
      id: 'chart-gmv-trend',
      dashboardId: 'dash-sales',
      name: 'GMV Trend',
      chartType: 'line',
      dataSourceId: 'table-ch-3',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: { column: 'date', type: 'date', label: 'Date' },
        yAxis: { column: 'gmv', type: 'number', label: 'GMV' },
        metrics: ['metric-gmv'],
        timeGrain: 'day',
      }),
      status: 'published',
    },
    {
      id: 'chart-top-restaurants',
      dashboardId: 'dash-restaurant',
      name: 'Top 10 Restaurants',
      chartType: 'bar',
      dataSourceId: 'table-ch-2',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: { column: 'name', type: 'string', label: 'Restaurant' },
        yAxis: { column: 'rating', type: 'number', label: 'Rating' },
        limit: 10,
      }),
      status: 'published',
    },
    {
      id: 'chart-category-mix',
      dashboardId: 'dash-restaurant',
      name: 'Category Mix',
      chartType: 'pie',
      dataSourceId: 'table-ch-2',
      dataSourceType: 'table',
      config: JSON.stringify({
        dimension: 'category',
        metric: 'count',
        colors: ['#16a34a', '#7c3aed', '#dc2626', '#f59e0b', '#0891b2', '#be185d'],
      }),
      status: 'published',
    },

    // Standalone charts (not in any dashboard)
    {
      id: 'chart-campaign-roi',
      dashboardId: null,
      name: 'Campaign ROI Scatter',
      chartType: 'scatter',
      dataSourceId: 'dataset-campaign-roi',
      dataSourceType: 'dataset',
      datasetId: 'dataset-campaign-roi',
      config: JSON.stringify({
        xAxis: { column: 'campaign_spend', type: 'number', label: 'Spend ($)' },
        yAxis: { column: 'roi', type: 'number', label: 'ROI' },
        dimensions: ['channel'],
      }),
      status: 'published',
    },
    {
      id: 'chart-api-response-time',
      dashboardId: null,
      name: 'API Response Time Distribution',
      chartType: 'histogram',
      dataSourceId: 'table-json-1',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: { column: 'response_time_ms', type: 'number', label: 'Response Time (ms)' },
        bins: 20,
      }),
      status: 'draft',
    },
    {
      id: 'chart-budget-variance',
      dashboardId: null,
      name: 'Budget vs Actual Spend',
      chartType: 'bar',
      dataSourceId: 'table-excel-1',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: { column: 'department', type: 'string', label: 'Department' },
        yAxis: { column: 'planned_budget', type: 'number', label: 'Budget ($)' },
        secondaryYAxis: { column: 'actual_spend', type: 'number', label: 'Actual ($)' },
      }),
      status: 'draft',
    },
    {
      id: 'chart-churn-risk',
      dashboardId: null,
      name: 'Churn Risk Distribution',
      chartType: 'pie',
      dataSourceId: 'dataset-churn-features',
      dataSourceType: 'dataset',
      datasetId: 'dataset-churn-features',
      config: JSON.stringify({
        dimension: 'churn_risk',
        metric: 'count',
        colors: ['#16a34a', '#f59e0b', '#ea580c', '#dc2626'],
      }),
      status: 'published',
    },
    {
      id: 'chart-event-funnel',
      dashboardId: null,
      name: 'User Event Funnel',
      chartType: 'funnel',
      dataSourceId: 'table-parquet-1',
      dataSourceType: 'table',
      config: JSON.stringify({
        steps: ['page_view', 'add_to_cart', 'checkout', 'purchase'],
        metric: 'count',
      }),
      status: 'draft',
    },
    {
      id: 'chart-kpi-gmv',
      dashboardId: null,
      name: 'GMV KPI Card',
      chartType: 'metric_card',
      dataSourceId: 'table-ch-3',
      dataSourceType: 'table',
      config: JSON.stringify({
        metric: 'gmv',
        aggregation: 'sum',
        prefix: '$',
        suffix: 'M',
        comparison: 'previous_period',
      }),
      status: 'published',
    },
  ];

  for (const c of charts) {
    await db.chart.upsert({ where: { id: c.id }, update: {}, create: c as any });
  }

  // Chart-metric junctions
  const chartMetrics = [
    { id: 'cm-1', chartId: 'chart-monthly-sales', metricId: 'metric-revenue' },
    { id: 'cm-2', chartId: 'chart-gmv-trend', metricId: 'metric-gmv' },
    { id: 'cm-3', chartId: 'chart-channel-dist', metricId: 'metric-reservations' },
  ];

  for (const cm of chartMetrics) {
    await db.chartMetric.upsert({ where: { id: cm.id }, update: {}, create: cm });
  }

  // ═══════════════════════════════════════════
  // TRANSFORMS
  // ═══════════════════════════════════════════

  const transforms = [
    {
      id: 'transform-daily-gmv',
      name: 'Daily GMV Aggregation',
      description: 'Aggregate reservation data into daily GMV metrics per channel',
      type: 'sql',
      code: `SELECT\n  reservation_date AS date,\n  channel_id,\n  SUM(price_cents) / 100.0 AS gmv,\n  COUNT(*) AS total_reservations\nFROM booking_production.reservations\nWHERE active = 1 AND no_show = 0\nGROUP BY reservation_date, channel_id`,
      inputTables: JSON.stringify([{ connectorId: 'connector-ch-demo', schema: 'booking_production', table: 'reservations' }]),
      outputSpec: JSON.stringify({ type: 'table', schema: 'analytics', table: 'mart_booking_gmv', columns: ['date', 'channel_id', 'gmv', 'total_reservations'] }),
      schedule: '0 2 * * *',
      lastRunStatus: 'success',
      lastRunAt: new Date(),
      status: 'published',
      ownerUserId: user1.id,
    },
    {
      id: 'transform-churn-model',
      name: 'Churn Prediction Model',
      description: 'Random Forest classifier to predict user churn based on booking patterns',
      type: 'python',
      code: `import pandas as pd\nimport numpy as np\nfrom sklearn.ensemble import RandomForestClassifier\n\nclient = Client('clickhouse.production.internal', port=9000)\ndf = client.query_df("SELECT user_id, COUNT(*) as total_bookings, AVG(price_cents) as avg_booking_value FROM reservations GROUP BY user_id")\nmodel = RandomForestClassifier(n_estimators=100)\nmodel.fit(X, y)\noutput = df[['user_id', 'churn_probability', 'churn_risk_tier']]`,
      inputTables: JSON.stringify([{ connectorId: 'connector-ch-demo', schema: 'booking_production', table: 'reservations' }]),
      outputSpec: JSON.stringify({ type: 'table', schema: 'ml_predictions', table: 'user_churn_scores', columns: ['user_id', 'churn_probability', 'churn_risk_tier'] }),
      schedule: '0 3 * * 0',
      lastRunStatus: 'success',
      lastRunAt: new Date(Date.now() - 86400000),
      environment: JSON.stringify({ python: '3.12', packages: ['pandas', 'numpy', 'scikit-learn', 'clickhouse-driver'] }),
      status: 'published',
      ownerUserId: user3.id,
    },
    {
      id: 'transform-anomaly-detect',
      name: 'Revenue Anomaly Detection',
      description: 'Isolation Forest model to detect anomalous revenue patterns',
      type: 'python',
      code: `import pandas as pd\nfrom sklearn.ensemble import IsolationForest\n\ndf = pd.read_sql("SELECT date, SUM(gmv) as daily_revenue FROM analytics.mart_booking_gmv GROUP BY date", engine)\nclf = IsolationForest(contamination=0.05)\ndf['is_anomaly'] = clf.fit_predict(df[['daily_revenue']].dropna())`,
      inputTables: JSON.stringify([{ connectorId: 'connector-ch-demo', schema: 'analytics', table: 'mart_booking_gmv' }]),
      outputSpec: JSON.stringify({ type: 'table', schema: 'ml_predictions', table: 'revenue_anomalies', columns: ['date', 'daily_revenue', 'anomaly_score'] }),
      schedule: '0 6 * * *',
      lastRunStatus: 'failed',
      lastRunAt: new Date(Date.now() - 172800000),
      environment: JSON.stringify({ python: '3.12', packages: ['pandas', 'numpy', 'scikit-learn'] }),
      status: 'draft',
      ownerUserId: user3.id,
    },
    {
      id: 'transform-clv',
      name: 'Customer Lifetime Value',
      description: 'SQL-based CLV calculation using historical transaction data',
      type: 'sql',
      code: `WITH user_metrics AS (\n  SELECT\n    r.user_id,\n    COUNT(*) as total_orders,\n    AVG(r.price_cents / 100.0) as avg_order_value\n  FROM booking_production.reservations r\n  WHERE r.active = 1\n  GROUP BY r.user_id\n)\nSELECT\n  user_id,\n  total_orders * avg_order_value AS historical_clv\nFROM user_metrics`,
      inputTables: JSON.stringify([{ connectorId: 'connector-ch-demo', schema: 'booking_production', table: 'reservations' }]),
      outputSpec: JSON.stringify({ type: 'table', schema: 'analytics', table: 'user_clv', columns: ['user_id', 'historical_clv', 'customer_segment'] }),
      schedule: '0 4 * * *',
      lastRunStatus: 'success',
      lastRunAt: new Date(Date.now() - 43200000),
      status: 'published',
      ownerUserId: user2.id,
    },
  ];

  for (const t of transforms) {
    await db.transform.upsert({ where: { id: t.id }, update: {}, create: t as any });
  }

  // ═══════════════════════════════════════════
  // BRANCHES, MERGE REQUESTS, ACTIVITIES
  // ═══════════════════════════════════════════

  await db.dashboardBranch.upsert({
    where: { id: 'branch-main-sales' },
    update: {},
    create: { id: 'branch-main-sales', dashboardId: 'dash-sales', name: 'main', description: 'Main branch', baseBranch: 'main', status: 'active', ownerUserId: user1.id },
  });

  await db.dashboardBranch.upsert({
    where: { id: 'branch-feature-gmv' },
    update: {},
    create: { id: 'branch-feature-gmv', dashboardId: 'dash-sales', name: 'feature/add-gmv-funnel', description: 'Adding GMV funnel chart', baseBranch: 'main', status: 'active', ownerUserId: user2.id },
  });

  await db.mergeRequest.upsert({
    where: { id: 'mr-1' },
    update: {},
    create: { id: 'mr-1', dashboardId: 'dash-sales', sourceBranchId: 'branch-feature-gmv', targetBranch: 'main', title: 'Add GMV Funnel Chart', description: 'Adding funnel chart to sales dashboard', status: 'open', ownerUserId: user2.id, reviewerUserId: user1.id },
  });

  const activities = [
    { userId: user1.id, entityType: 'dashboard', entityId: 'dash-sales', action: 'create', details: JSON.stringify({ name: 'Sales Performance' }), dashboardId: 'dash-sales' },
    { userId: user2.id, entityType: 'chart', entityId: 'chart-monthly-sales', action: 'edit', details: JSON.stringify({ changes: 'Updated color scheme' }), dashboardId: 'dash-sales' },
    { userId: user3.id, entityType: 'transform', entityId: 'transform-churn-model', action: 'create', details: JSON.stringify({ type: 'python' }), dashboardId: null },
    { userId: user1.id, entityType: 'metric', entityId: 'metric-gmv', action: 'edit', details: JSON.stringify({ version: '2 → 3' }), dashboardId: null },
    { userId: user2.id, entityType: 'dashboard', entityId: 'dash-sales', action: 'branch', details: JSON.stringify({ branch: 'feature/add-gmv-funnel' }), dashboardId: 'dash-sales' },
  ];

  for (const a of activities) {
    await db.activity.create({ data: a });
  }

  console.log('✅ Seed complete!');
  console.log('  - 3 database connectors (ClickHouse, PostgreSQL, MySQL)');
  console.log('  - 4 file connectors (CSV, JSON, Excel, Parquet)');
  console.log('  - 3 virtual datasets (2 SQL + 1 Python/ML)');
  console.log('  - 11 charts (5 dashboard + 6 standalone)');
  console.log('  - 4 metrics, 4 transforms, 3 users, branches, MRs, activities');
}

seed().catch(console.error);
