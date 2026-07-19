import { db } from '@/lib/db';

const NODE_TYPES = {
  SOURCE: 'source',
  MODEL: 'model',
  SEED: 'seed',
  SNAPSHOT: 'snapshot',
  EXPOSURE: 'exposure',
  DATASET: 'dataset',
  CHART: 'chart',
  DASHBOARD: 'dashboard',
  METRIC: 'metric',
  COLUMN: 'column',
  CALCULATED_COLUMN: 'calculated_column',
  FILTER: 'filter',
  DIMENSION: 'dimension',
  CANONICAL_METRIC: 'canonical_metric',
};

const EDGE_TYPES = {
  CONTAINS: 'CONTAINS',
  DERIVED_FROM: 'DERIVED_FROM',
  USES_COLUMN: 'USES_COLUMN',
  AGGREGATES: 'AGGREGATES',
  GROUPED_BY: 'GROUPED_BY',
  TIME_DIMENSION: 'TIME_DIMENSION',
  FILTERED_BY: 'FILTERED_BY',
  JOINS_WITH: 'JOINS_WITH',
  DISPLAYED_IN: 'DISPLAYED_IN',
  BELONGS_TO: 'BELONGS_TO',
  PRODUCES: 'PRODUCES',
  IMPLEMENTS_METRIC: 'IMPLEMENTS_METRIC',
};

const CONFIDENCE = {
  VERIFIED: 'verified',
  DECLARED: 'declared',
  INFERRED: 'inferred',
  PARTIAL: 'partial',
  UNKNOWN: 'unknown',
};

async function seed() {
  console.log('🌱 Seeding Lentera database...');

  await db.finding.deleteMany();
  await db.edge.deleteMany();
  await db.node.deleteMany();
  await db.canonicalMetric.deleteMany();
  await db.buildRun.deleteMany();

  // ==========================================
  // NODES
  // ==========================================

  const srcReservations = await db.node.create({ data: { externalId: 'src.booking_production.reservations', platform: 'clickhouse', nodeType: NODE_TYPES.SOURCE, name: 'reservations', qualifiedName: 'booking_production.reservations', description: 'Raw reservation data from the booking system. Contains all reservation attempts including temporary and system-generated entries.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const srcPayments = await db.node.create({ data: { externalId: 'src.booking_production.payments', platform: 'clickhouse', nodeType: NODE_TYPES.SOURCE, name: 'payments', qualifiedName: 'booking_production.payments', description: 'Raw payment records linked to reservations.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const srcRestaurants = await db.node.create({ data: { externalId: 'src.booking_production.restaurants', platform: 'clickhouse', nodeType: NODE_TYPES.SOURCE, name: 'restaurants', qualifiedName: 'booking_production.restaurants', description: 'Restaurant master data including location and cuisine type.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const srcChannels = await db.node.create({ data: { externalId: 'src.booking_production.channels', platform: 'clickhouse', nodeType: NODE_TYPES.SOURCE, name: 'channels', qualifiedName: 'booking_production.channels', description: 'Channel configuration for booking sources.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });

  const stgReservations = await db.node.create({ data: { externalId: 'model.staging.stg_reservations', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'stg_reservations', qualifiedName: 'staging.stg_reservations', description: 'Cleaned reservation data with deduplication and basic filtering applied.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'view', schema: 'staging', tags: ['staging'] }) } });
  const stgPayments = await db.node.create({ data: { externalId: 'model.staging.stg_payments', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'stg_payments', qualifiedName: 'staging.stg_payments', description: 'Cleaned payment records with currency normalization.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'view', schema: 'staging', tags: ['staging'] }) } });
  const stgRestaurants = await db.node.create({ data: { externalId: 'model.staging.stg_restaurants', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'stg_restaurants', qualifiedName: 'staging.stg_restaurants', description: 'Cleaned restaurant dimension with standardized categories.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'view', schema: 'staging', tags: ['staging'] }) } });

  const intReservationPayments = await db.node.create({ data: { externalId: 'model.intermediate.int_reservation_payments', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'int_reservation_payments', qualifiedName: 'intermediate.int_reservation_payments', description: 'Joined reservation-payment data with business logic for active, non-temporary reservations.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'intermediate', tags: ['intermediate'] }) } });

  const martBookingGmv = await db.node.create({ data: { externalId: 'model.marts.mart_booking_gmv', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'mart_booking_gmv', qualifiedName: 'marts.mart_booking_gmv', description: 'GMV mart aggregating valid reservation revenue by restaurant, channel, and date.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'gmv', 'critical'] }) } });
  const martRestaurantWeekly = await db.node.create({ data: { externalId: 'model.marts.mart_restaurant_weekly_stats', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'mart_restaurant_weekly_stats', qualifiedName: 'marts.mart_restaurant_weekly_stats', description: 'Weekly restaurant performance metrics.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'restaurants'] }) } });
  const martSales = await db.node.create({ data: { externalId: 'model.marts.mart_sales', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'mart_sales', qualifiedName: 'marts.mart_sales', description: 'Sales fact table with reservation and restaurant dimensions.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'sales', 'critical'] }) } });
  const martBypassed = await db.node.create({ data: { externalId: 'model.marts.mart_finance_export', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'mart_finance_export', qualifiedName: 'marts.mart_finance_export', description: 'Finance export model that directly reads from raw reservation data, bypassing staging.', owner: 'finance-team', status: 'active', metadata: JSON.stringify({ materialization: 'table', schema: 'marts', tags: ['mart', 'finance'] }) } });
  const excludedModel = await db.node.create({ data: { externalId: 'model.marts.fct_reservations', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'fct_reservations', qualifiedName: 'marts.fct_reservations', description: 'Legacy reservation fact table. Excluded from CI but still referenced by active dashboards.', owner: 'analytics-engineering', status: 'excluded', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['legacy', 'excluded'] }) } });
  const duplicateModel = await db.node.create({ data: { externalId: 'model.marts.mart_booking_gmv_v2', platform: 'dbt', nodeType: NODE_TYPES.MODEL, name: 'mart_booking_gmv_v2', qualifiedName: 'marts.mart_booking_gmv_v2', description: 'Near-duplicate of mart_booking_gmv with minor column renaming.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'gmv'] }) } });

  const colPriceCents = await db.node.create({ data: { externalId: 'col.reservations.price_cents', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'price_cents', qualifiedName: 'booking_production.reservations.price_cents', description: 'Reservation price in cents.', metadata: JSON.stringify({ dataType: 'Int64' }) } });
  const colActive = await db.node.create({ data: { externalId: 'col.reservations.active', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'active', qualifiedName: 'booking_production.reservations.active', description: 'Active reservation flag.', metadata: JSON.stringify({ dataType: 'UInt8' }) } });
  const colNoShow = await db.node.create({ data: { externalId: 'col.reservations.no_show', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'no_show', qualifiedName: 'booking_production.reservations.no_show', description: 'No-show flag.', metadata: JSON.stringify({ dataType: 'UInt8' }) } });
  const colCurrency = await db.node.create({ data: { externalId: 'col.reservations.price_currency', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'price_currency', qualifiedName: 'booking_production.reservations.price_currency', description: 'Currency code.', metadata: JSON.stringify({ dataType: 'String' }) } });
  const colChannelId = await db.node.create({ data: { externalId: 'col.reservations.channel_id', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'channel_id', qualifiedName: 'booking_production.reservations.channel_id', description: 'Booking channel FK.', metadata: JSON.stringify({ dataType: 'Int32' }) } });
  const colCategory = await db.node.create({ data: { externalId: 'col.restaurants.category_name', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'category_name', qualifiedName: 'booking_production.restaurants.category_name', description: 'Restaurant cuisine category.', metadata: JSON.stringify({ dataType: 'String' }) } });
  const colSalesAmount = await db.node.create({ data: { externalId: 'col.mart_sales.sales_amount', platform: 'dbt', nodeType: NODE_TYPES.COLUMN, name: 'sales_amount', qualifiedName: 'marts.mart_sales.sales_amount', description: 'Aggregated sales amount in currency units.', metadata: JSON.stringify({ dataType: 'Float64' }) } });
  const colCalendarDate = await db.node.create({ data: { externalId: 'col.dim_calendar.calendar_date', platform: 'clickhouse', nodeType: NODE_TYPES.COLUMN, name: 'calendar_date', qualifiedName: 'analytics.dim_calendar.calendar_date', description: 'Calendar date dimension.', metadata: JSON.stringify({ dataType: 'Date' }) } });

  const dsBookingGmv = await db.node.create({ data: { externalId: 'dataset.booking_gmv', platform: 'superset', nodeType: NODE_TYPES.DATASET, name: 'Booking GMV', qualifiedName: 'marts.mart_booking_gmv', description: 'Superset physical dataset connected to mart_booking_gmv.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsRestaurantWeekly = await db.node.create({ data: { externalId: 'dataset.restaurant_weekly_stats', platform: 'superset', nodeType: NODE_TYPES.DATASET, name: 'Restaurant Weekly Stats', qualifiedName: 'marts.mart_restaurant_weekly_stats', description: 'Weekly restaurant performance dataset.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsSales = await db.node.create({ data: { externalId: 'dataset.sales_performance', platform: 'superset', nodeType: NODE_TYPES.DATASET, name: 'Sales Performance', qualifiedName: 'marts.mart_sales', description: 'Sales analytics dataset.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsRawReservations = await db.node.create({ data: { externalId: 'dataset.raw_reservations', platform: 'superset', nodeType: NODE_TYPES.DATASET, name: 'Raw Reservations (Direct)', qualifiedName: 'booking_production.reservations', description: 'WARNING: Dataset pointing directly to raw source table.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'booking_production', kind: 'physical' }) } });
  const dsLegacyFct = await db.node.create({ data: { externalId: 'dataset.legacy_fct_reservations', platform: 'superset', nodeType: NODE_TYPES.DATASET, name: 'Legacy FCT Reservations', qualifiedName: 'marts.fct_reservations', description: 'Dataset linked to excluded fct_reservations model.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsUnresolved = await db.node.create({ data: { externalId: 'dataset.unresolved_external_api', platform: 'superset', nodeType: NODE_TYPES.DATASET, name: 'External API Data', qualifiedName: 'external_api.orders', description: 'Virtual dataset from external API. Cannot be matched to any dbt model.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ database: 'External API', kind: 'virtual' }) } });

  const metricTotalSales = await db.node.create({ data: { externalId: 'metric.total_sales', platform: 'superset', nodeType: NODE_TYPES.METRIC, name: 'Total Sales', qualifiedName: 'dataset.sales_performance.metric.total_sales', description: 'Sum of sales_amount.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'SUM', expression: 'sales_amount' }) } });
  const metricGmv = await db.node.create({ data: { externalId: 'metric.gmv', platform: 'superset', nodeType: NODE_TYPES.METRIC, name: 'GMV', qualifiedName: 'dataset.booking_gmv.metric.gmv', description: 'Gross Merchandise Value: sum of price_cents / 100.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'SUM', expression: 'price_cents / 100' }) } });
  const metricGmvIncomplete = await db.node.create({ data: { externalId: 'metric.gmv_incomplete', platform: 'superset', nodeType: NODE_TYPES.METRIC, name: 'GMV (Incomplete)', qualifiedName: 'dataset.raw_reservations.metric.gmv_incomplete', description: 'Incomplete GMV without canonical filters.', owner: 'unknown', metadata: JSON.stringify({ aggregation: 'SUM', expression: 'price_cents / 100' }) } });
  const metricReservationCount = await db.node.create({ data: { externalId: 'metric.reservation_count', platform: 'superset', nodeType: NODE_TYPES.METRIC, name: 'Reservation Count', qualifiedName: 'dataset.booking_gmv.metric.reservation_count', description: 'Count of total reservations.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'COUNT', expression: '*' }) } });
  const metricAvgBookingValue = await db.node.create({ data: { externalId: 'metric.avg_booking_value', platform: 'superset', nodeType: NODE_TYPES.METRIC, name: 'Avg Booking Value', qualifiedName: 'dataset.restaurant_weekly_stats.metric.avg_booking_value', description: 'Average booking value per restaurant per week.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'AVG', expression: 'booking_value' }) } });

  const dimCategory = await db.node.create({ data: { externalId: 'dim.category_name', platform: 'superset', nodeType: NODE_TYPES.DIMENSION, name: 'Category', qualifiedName: 'dataset.sales_performance.dim.category_name', description: 'Restaurant category dimension.', metadata: JSON.stringify({ expression: 'category_name' }) } });
  const dimCalendar = await db.node.create({ data: { externalId: 'dim.calendar_date', platform: 'superset', nodeType: 'time_dimension', name: 'Calendar Date', qualifiedName: 'dataset.sales_performance.dim.calendar_date', description: 'Time dimension for date-based analysis.', metadata: JSON.stringify({ expression: 'calendar_date', timeGrain: 'P1D' }) } });

  const filterActive = await db.node.create({ data: { externalId: 'filter.active_eq_1', platform: 'superset', nodeType: NODE_TYPES.FILTER, name: 'Active Only', qualifiedName: 'filter.active_eq_1', description: 'Chart-level filter: active = 1.', metadata: JSON.stringify({ clause: 'active = 1', filterType: 'chart' }) } });
  const filterNoShow = await db.node.create({ data: { externalId: 'filter.no_show_eq_0', platform: 'superset', nodeType: NODE_TYPES.FILTER, name: 'Exclude No-Shows', qualifiedName: 'filter.no_show_eq_0', description: 'Chart-level filter: no_show = 0.', metadata: JSON.stringify({ clause: 'no_show = 0', filterType: 'chart' }) } });
  const filterDashboardDate = await db.node.create({ data: { externalId: 'filter.dashboard_date_range', platform: 'superset', nodeType: NODE_TYPES.FILTER, name: 'Date Range', qualifiedName: 'filter.dashboard_date_range', description: 'Dashboard-level native filter for date range.', metadata: JSON.stringify({ clause: 'calendar_date BETWEEN {{ from }} AND {{ to }}', filterType: 'native', scope: 'dashboard' }) } });

  const chartMonthlySales = await db.node.create({ data: { externalId: 'chart.monthly_sales_by_category', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'Monthly Sales by Product Category', qualifiedName: 'chart.monthly_sales_by_category', description: 'Line chart showing monthly sales trends by restaurant category.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'line_chart' }) } });
  const chartGmvTrend = await db.node.create({ data: { externalId: 'chart.gmv_trend', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'GMV Trend Over Time', qualifiedName: 'chart.gmv_trend', description: 'Area chart showing GMV trends with canonical filters.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'area_chart' }) } });
  const chartGmvIncomplete = await db.node.create({ data: { externalId: 'chart.gmv_quick_view', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'GMV Quick View', qualifiedName: 'chart.gmv_quick_view', description: 'Bar chart showing GMV without all canonical filters - potential metric drift.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ vizType: 'bar_chart' }) } });
  const chartRestaurantPerformance = await db.node.create({ data: { externalId: 'chart.restaurant_weekly_performance', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'Restaurant Weekly Performance', qualifiedName: 'chart.restaurant_weekly_performance', description: 'Table chart showing weekly restaurant metrics.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'table_chart' }) } });
  const chartReservationCount = await db.node.create({ data: { externalId: 'chart.reservation_count_trend', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'Reservation Count Trend', qualifiedName: 'chart.reservation_count_trend', description: 'Line chart showing reservation count trends.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'line_chart' }) } });
  const chartLegacyReservations = await db.node.create({ data: { externalId: 'chart.legacy_reservation_detail', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'Legacy Reservation Detail', qualifiedName: 'chart.legacy_reservation_detail', description: 'Detailed view using excluded fct_reservations model.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ vizType: 'table_chart' }) } });
  const chartBypassedRaw = await db.node.create({ data: { externalId: 'chart.raw_booking_export', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'Raw Booking Export', qualifiedName: 'chart.raw_booking_export', description: 'Chart querying raw reservations directly. Bypasses governance.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ vizType: 'table_chart' }) } });
  const chartSalesPie = await db.node.create({ data: { externalId: 'chart.sales_by_category_pie', platform: 'superset', nodeType: NODE_TYPES.CHART, name: 'Sales by Category (Pie)', qualifiedName: 'chart.sales_by_category_pie', description: 'Pie chart showing sales distribution by category.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'pie_chart' }) } });

  const dashSales = await db.node.create({ data: { externalId: 'dashboard.sales_performance', platform: 'superset', nodeType: NODE_TYPES.DASHBOARD, name: 'Sales Performance', qualifiedName: 'dashboard.sales_performance', description: 'Executive sales performance dashboard with trends and KPIs.', owner: 'head-of-data', status: 'active' } });
  const dashGmv = await db.node.create({ data: { externalId: 'dashboard.gmv_overview', platform: 'superset', nodeType: NODE_TYPES.DASHBOARD, name: 'GMV Overview', qualifiedName: 'dashboard.gmv_overview', description: 'GMV tracking dashboard with trends and counts.', owner: 'analytics-engineering', status: 'active' } });
  const dashRestaurant = await db.node.create({ data: { externalId: 'dashboard.restaurant_analytics', platform: 'superset', nodeType: NODE_TYPES.DASHBOARD, name: 'Restaurant Analytics', qualifiedName: 'dashboard.restaurant_analytics', description: 'Restaurant performance analytics with weekly metrics.', owner: 'analytics-engineering', status: 'active' } });
  const dashLegacy = await db.node.create({ data: { externalId: 'dashboard.legacy_operations', platform: 'superset', nodeType: NODE_TYPES.DASHBOARD, name: 'Legacy Operations', qualifiedName: 'dashboard.legacy_operations', description: 'Old operations dashboard using excluded models.', owner: 'unknown', status: 'active' } });

  // ==========================================
  // EDGES
  // ==========================================
  const mkEdge = (src: string, tgt: string, type: string, conf: string, method: string, platform: string, expr?: string) => db.edge.create({ data: { sourceNodeId: src, targetNodeId: tgt, edgeType: type, confidence: conf, extractionMethod: method, sourcePlatform: platform, expression: expr } });

  // dbt lineage
  await mkEdge(srcReservations.id, stgReservations.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(srcPayments.id, stgPayments.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(srcRestaurants.id, stgRestaurants.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgReservations.id, intReservationPayments.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgPayments.id, intReservationPayments.id, EDGE_TYPES.JOINS_WITH, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt', 'ON reservations.id = payments.reservation_id');
  await mkEdge(intReservationPayments.id, martBookingGmv.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgRestaurants.id, martBookingGmv.id, EDGE_TYPES.JOINS_WITH, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt', 'ON restaurant_id');
  await mkEdge(stgReservations.id, martRestaurantWeekly.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgRestaurants.id, martRestaurantWeekly.id, EDGE_TYPES.JOINS_WITH, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgPayments.id, martSales.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgReservations.id, martSales.id, EDGE_TYPES.JOINS_WITH, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgRestaurants.id, martSales.id, EDGE_TYPES.JOINS_WITH, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(srcReservations.id, martBypassed.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgReservations.id, excludedModel.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(intReservationPayments.id, duplicateModel.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');
  await mkEdge(stgRestaurants.id, duplicateModel.id, EDGE_TYPES.JOINS_WITH, CONFIDENCE.VERIFIED, 'dbt_manifest', 'dbt');

  // Dataset -> Model
  await mkEdge(martBookingGmv.id, dsBookingGmv.id, EDGE_TYPES.PRODUCES, CONFIDENCE.DECLARED, 'fqtn_match', 'lentera');
  await mkEdge(martRestaurantWeekly.id, dsRestaurantWeekly.id, EDGE_TYPES.PRODUCES, CONFIDENCE.DECLARED, 'fqtn_match', 'lentera');
  await mkEdge(martSales.id, dsSales.id, EDGE_TYPES.PRODUCES, CONFIDENCE.DECLARED, 'fqtn_match', 'lentera');
  await mkEdge(srcReservations.id, dsRawReservations.id, EDGE_TYPES.PRODUCES, CONFIDENCE.DECLARED, 'fqtn_match', 'lentera');
  await mkEdge(excludedModel.id, dsLegacyFct.id, EDGE_TYPES.PRODUCES, CONFIDENCE.DECLARED, 'fqtn_match', 'lentera');

  // Chart -> Dataset
  await mkEdge(dsSales.id, chartMonthlySales.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsBookingGmv.id, chartGmvTrend.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsRawReservations.id, chartGmvIncomplete.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsRestaurantWeekly.id, chartRestaurantPerformance.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsBookingGmv.id, chartReservationCount.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsLegacyFct.id, chartLegacyReservations.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsRawReservations.id, chartBypassedRaw.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(dsSales.id, chartSalesPie.id, EDGE_TYPES.DERIVED_FROM, CONFIDENCE.VERIFIED, 'superset_api', 'superset');

  // Chart -> Dashboard
  await mkEdge(chartMonthlySales.id, dashSales.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartSalesPie.id, dashSales.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartGmvTrend.id, dashGmv.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartGmvIncomplete.id, dashGmv.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartReservationCount.id, dashGmv.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartRestaurantPerformance.id, dashRestaurant.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartLegacyReservations.id, dashLegacy.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(chartBypassedRaw.id, dashLegacy.id, EDGE_TYPES.DISPLAYED_IN, CONFIDENCE.VERIFIED, 'superset_api', 'superset');

  // Metric -> Chart
  await mkEdge(metricTotalSales.id, chartMonthlySales.id, EDGE_TYPES.IMPLEMENTS_METRIC, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(metricGmv.id, chartGmvTrend.id, EDGE_TYPES.IMPLEMENTS_METRIC, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(metricGmvIncomplete.id, chartGmvIncomplete.id, EDGE_TYPES.IMPLEMENTS_METRIC, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(metricReservationCount.id, chartReservationCount.id, EDGE_TYPES.IMPLEMENTS_METRIC, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(metricAvgBookingValue.id, chartRestaurantPerformance.id, EDGE_TYPES.IMPLEMENTS_METRIC, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(metricTotalSales.id, chartSalesPie.id, EDGE_TYPES.IMPLEMENTS_METRIC, CONFIDENCE.DECLARED, 'superset_api', 'superset');

  // Metric -> Dataset
  await mkEdge(metricTotalSales.id, dsSales.id, EDGE_TYPES.BELONGS_TO, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(metricGmv.id, dsBookingGmv.id, EDGE_TYPES.BELONGS_TO, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(metricGmvIncomplete.id, dsRawReservations.id, EDGE_TYPES.BELONGS_TO, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(metricReservationCount.id, dsBookingGmv.id, EDGE_TYPES.BELONGS_TO, CONFIDENCE.VERIFIED, 'superset_api', 'superset');
  await mkEdge(metricAvgBookingValue.id, dsRestaurantWeekly.id, EDGE_TYPES.BELONGS_TO, CONFIDENCE.VERIFIED, 'superset_api', 'superset');

  // Column -> Metric
  await mkEdge(colPriceCents.id, metricGmv.id, EDGE_TYPES.AGGREGATES, CONFIDENCE.INFERRED, 'superset_api', 'superset', 'SUM(price_cents / 100)');
  await mkEdge(colSalesAmount.id, metricTotalSales.id, EDGE_TYPES.AGGREGATES, CONFIDENCE.INFERRED, 'superset_api', 'superset', 'SUM(sales_amount)');

  // Filters
  await mkEdge(filterActive.id, chartMonthlySales.id, EDGE_TYPES.FILTERED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(filterNoShow.id, chartMonthlySales.id, EDGE_TYPES.FILTERED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(filterActive.id, chartGmvTrend.id, EDGE_TYPES.FILTERED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(filterNoShow.id, chartGmvTrend.id, EDGE_TYPES.FILTERED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(filterActive.id, chartGmvIncomplete.id, EDGE_TYPES.FILTERED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(filterNoShow.id, chartGmvIncomplete.id, EDGE_TYPES.FILTERED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');

  // Dimensions
  await mkEdge(dimCategory.id, chartMonthlySales.id, EDGE_TYPES.GROUPED_BY, CONFIDENCE.DECLARED, 'superset_api', 'superset');
  await mkEdge(dimCalendar.id, chartMonthlySales.id, EDGE_TYPES.TIME_DIMENSION, CONFIDENCE.DECLARED, 'superset_api', 'superset');

  // ==========================================
  // CANONICAL METRICS
  // ==========================================
  await db.canonicalMetric.create({ data: { name: 'gmv', aliases: JSON.stringify(['GMV', 'Gross Merchandise Value']), description: 'Gross merchandise value for valid reservations. Canonical business definition.', expression: 'price_cents / 100', aggregation: 'sum', requiredFilters: JSON.stringify(['active = 1', 'no_show = 0', 'revenue > 0', 'is_temporary = 0', 'for_locking_system = 0', 'channel_id != 5', 'ack = 1']), dimensions: JSON.stringify(['restaurant_id', 'category_name', 'channel_id', 'price_currency']), currencyRequirement: 'price_currency', timeGrain: 'P1D', owner: 'data-team', version: '1.0', severityOnDrift: 'error' } });
  await db.canonicalMetric.create({ data: { name: 'total_sales', aliases: JSON.stringify(['Total Sales']), description: 'Total sales amount from confirmed and active transactions.', expression: 'sales_amount', aggregation: 'sum', requiredFilters: JSON.stringify(['active = 1', 'payment_status = confirmed']), dimensions: JSON.stringify(['category_name', 'calendar_date']), timeGrain: 'P1D', owner: 'data-team', version: '1.0', severityOnDrift: 'warning' } });

  // ==========================================
  // FINDINGS
  // ==========================================
  await db.finding.create({ data: { ruleId: 'R1', severity: 'error', nodeId: martBypassed.id, title: 'Bypass Governance: Model reads directly from raw source', description: 'The model mart_finance_export reads directly from booking_production.reservations, bypassing the required staging layer.', evidence: JSON.stringify({ model: 'marts.mart_finance_export', source: 'booking_production.reservations' }), recommendation: 'Route through an approved staging model or suppress with justification.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R1', severity: 'error', nodeId: dsRawReservations.id, title: 'Bypass Governance: Dataset points to raw source table', description: 'Superset dataset "Raw Reservations (Direct)" points to raw source table booking_production.reservations.', evidence: JSON.stringify({ dataset: 'dataset.raw_reservations', schema: 'booking_production' }), recommendation: 'Replace with a mart dataset or suppress if approved.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R2', severity: 'warning', nodeId: dsUnresolved.id, title: 'Orphaned Dataset: Cannot match to dbt or warehouse object', description: 'The Superset dataset "External API Data" cannot be matched to any dbt model or warehouse object.', evidence: JSON.stringify({ dataset: 'dataset.unresolved_external_api', qualifiedName: 'external_api.orders' }), recommendation: 'Add a dbt source definition or create a manual mapping.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R3', severity: 'error', nodeId: metricGmvIncomplete.id, title: 'Metric Drift: GMV (Incomplete) differs from canonical definition', description: 'The observed GMV metric only uses active=1 and no_show=0 filters. The canonical GMV requires 7 filters. Missing: revenue > 0, is_temporary = 0, for_locking_system = 0, channel_id != 5, ack = 1.', evidence: JSON.stringify({ canonical: { filters: ['active = 1', 'no_show = 0', 'revenue > 0', 'is_temporary = 0', 'for_locking_system = 0', 'channel_id != 5', 'ack = 1'] }, observed: { filters: ['active = 1', 'no_show = 0'] }, missingFilters: ['revenue > 0', 'is_temporary = 0', 'for_locking_system = 0', 'channel_id != 5', 'ack = 1'] }), recommendation: 'Update the chart to use mart_booking_gmv with the canonical GMV metric.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R4', severity: 'critical', nodeId: excludedModel.id, title: 'Excluded Model Used by Active BI Assets', description: 'The model fct_reservations is excluded from CI but still used by active charts and dashboards.', evidence: JSON.stringify({ model: 'marts.fct_reservations', downstreamCharts: 1, downstreamDashboards: 1 }), recommendation: 'Migrate Legacy Operations dashboard to use mart_booking_gmv.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R5', severity: 'warning', nodeId: chartGmvIncomplete.id, title: 'Missing Lineage: Chart uses dataset with incomplete resolution', description: 'The chart "GMV Quick View" uses a raw source dataset. Column-level lineage cannot be resolved.', evidence: JSON.stringify({ chart: 'chart.gmv_quick_view', dataset: 'dataset.raw_reservations' }), recommendation: 'Switch to a governed dataset for full lineage.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R6', severity: 'warning', nodeId: duplicateModel.id, title: 'Duplicate Model: Near-identical SQL to existing model', description: 'mart_booking_gmv_v2 has near-identical SQL to mart_booking_gmv (97% similarity).', evidence: JSON.stringify({ model: 'marts.mart_booking_gmv_v2', duplicateOf: 'marts.mart_booking_gmv', similarityScore: 0.97 }), recommendation: 'Consolidate into the original model.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R7', severity: 'info', nodeId: metricGmvIncomplete.id, title: 'Missing Documentation: Metric has no owner', description: 'The metric "GMV (Incomplete)" has no assigned owner and incomplete description.', evidence: JSON.stringify({ metric: 'metric.gmv_incomplete', owner: 'unknown' }), recommendation: 'Assign an owner and add a complete description.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R8', severity: 'error', nodeId: dsRawReservations.id, title: 'Direct Raw-Table Dataset: Dataset uses raw schema', description: 'Dataset "Raw Reservations (Direct)" uses schema booking_production which is classified as raw.', evidence: JSON.stringify({ dataset: 'dataset.raw_reservations', schema: 'booking_production' }), recommendation: 'Migrate charts to mart datasets and deprecate raw dataset.', status: 'open' } });

  // ==========================================
  // BUILD RUN
  // ==========================================
  await db.buildRun.create({ data: { projectId: 'hungryhub-analytics', status: 'warning', totalModels: 8, totalDatasets: 6, totalCharts: 8, totalDashboards: 4, unresolvedCount: 1, lineageCoverage: 0.83, errorFindings: 3, warningFindings: 3, criticalFindings: 1, infoFindings: 1, duration: 127 } });

  console.log('✅ Seeding complete!');
  console.log(`  Nodes: ${await db.node.count()}`);
  console.log(`  Edges: ${await db.edge.count()}`);
  console.log(`  Findings: ${await db.finding.count()}`);
}

seed().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
