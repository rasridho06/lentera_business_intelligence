import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function upsertUser(id: string, name: string, email: string, role: string, color?: string) {
  return db.user.upsert({
    where: { email },
    create: { id, name, email, role, color: color || null },
    update: { name, role, color: color || null },
  });
}

async function main() {
  console.log('Seeding database...');

  // ── Users ──
  const admin = await upsertUser('user-admin', 'Admin User', 'admin@lentera.io', 'admin', '#6366f1');
  const editor = await upsertUser('user-editor', 'Editor User', 'editor@lentera.io', 'editor', '#10b981');
  const viewer = await upsertUser('user-viewer', 'Viewer User', 'viewer@lentera.io', 'viewer', '#f59e0b');
  console.log(`  Users: ${admin.name}, ${editor.name}, ${viewer.name}`);

  // ── Dashboards ──
  await db.dashboard.deleteMany({ where: { ownerUserId: { in: [admin.id, editor.id] } } });
  const dashboards = await Promise.all([
    db.dashboard.create({ data: { name: 'Sales Overview', description: 'Key sales metrics and revenue tracking', status: 'published', ownerUserId: admin.id } }),
    db.dashboard.create({ data: { name: 'Marketing Analytics', description: 'Campaign performance and user acquisition', status: 'published', ownerUserId: editor.id } }),
    db.dashboard.create({ data: { name: 'Operations Dashboard', description: 'Infrastructure and system monitoring', status: 'published', ownerUserId: admin.id } }),
  ]);
  console.log(`  Dashboards: ${dashboards.map(d => d.name).join(', ')}`);

  // ── Lineage: Nodes, Edges, Findings ──
  await db.finding.deleteMany();
  await db.edge.deleteMany();
  await db.node.deleteMany();
  await db.canonicalMetric.deleteMany();
  await db.buildRun.deleteMany();

  const srcReservations = await db.node.create({ data: { externalId: 'src.booking_production.reservations', platform: 'clickhouse', nodeType: 'source', name: 'reservations', qualifiedName: 'booking_production.reservations', description: 'Raw reservation data from the booking system.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const srcPayments = await db.node.create({ data: { externalId: 'src.booking_production.payments', platform: 'clickhouse', nodeType: 'source', name: 'payments', qualifiedName: 'booking_production.payments', description: 'Raw payment records linked to reservations.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const srcRestaurants = await db.node.create({ data: { externalId: 'src.booking_production.restaurants', platform: 'clickhouse', nodeType: 'source', name: 'restaurants', qualifiedName: 'booking_production.restaurants', description: 'Restaurant master data.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const srcChannels = await db.node.create({ data: { externalId: 'src.booking_production.channels', platform: 'clickhouse', nodeType: 'source', name: 'channels', qualifiedName: 'booking_production.channels', description: 'Channel configuration.', owner: 'data-engineering', status: 'active', metadata: JSON.stringify({ schema: 'booking_production', engine: 'MergeTree' }) } });
  const stgReservations = await db.node.create({ data: { externalId: 'model.staging.stg_reservations', platform: 'dbt', nodeType: 'model', name: 'stg_reservations', qualifiedName: 'staging.stg_reservations', description: 'Cleaned reservation data.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'view', schema: 'staging', tags: ['staging'] }) } });
  const stgPayments = await db.node.create({ data: { externalId: 'model.staging.stg_payments', platform: 'dbt', nodeType: 'model', name: 'stg_payments', qualifiedName: 'staging.stg_payments', description: 'Cleaned payment records.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'view', schema: 'staging', tags: ['staging'] }) } });
  const stgRestaurants = await db.node.create({ data: { externalId: 'model.staging.stg_restaurants', platform: 'dbt', nodeType: 'model', name: 'stg_restaurants', qualifiedName: 'staging.stg_restaurants', description: 'Cleaned restaurant dimension.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'view', schema: 'staging', tags: ['staging'] }) } });
  const intReservationPayments = await db.node.create({ data: { externalId: 'model.intermediate.int_reservation_payments', platform: 'dbt', nodeType: 'model', name: 'int_reservation_payments', qualifiedName: 'intermediate.int_reservation_payments', description: 'Joined reservation-payment data.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'intermediate', tags: ['intermediate'] }) } });
  const martBookingGmv = await db.node.create({ data: { externalId: 'model.marts.mart_booking_gmv', platform: 'dbt', nodeType: 'model', name: 'mart_booking_gmv', qualifiedName: 'marts.mart_booking_gmv', description: 'GMV mart aggregating reservation revenue.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'gmv', 'critical'] }) } });
  const martRestaurantWeekly = await db.node.create({ data: { externalId: 'model.marts.mart_restaurant_weekly_stats', platform: 'dbt', nodeType: 'model', name: 'mart_restaurant_weekly_stats', qualifiedName: 'marts.mart_restaurant_weekly_stats', description: 'Weekly restaurant performance metrics.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'restaurants'] }) } });
  const martSales = await db.node.create({ data: { externalId: 'model.marts.mart_sales', platform: 'dbt', nodeType: 'model', name: 'mart_sales', qualifiedName: 'marts.mart_sales', description: 'Sales fact table.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'sales', 'critical'] }) } });
  const martBypassed = await db.node.create({ data: { externalId: 'model.marts.mart_finance_export', platform: 'dbt', nodeType: 'model', name: 'mart_finance_export', qualifiedName: 'marts.mart_finance_export', description: 'Finance export model reading raw data directly.', owner: 'finance-team', status: 'active', metadata: JSON.stringify({ materialization: 'table', schema: 'marts', tags: ['mart', 'finance'] }) } });
  const excludedModel = await db.node.create({ data: { externalId: 'model.marts.fct_reservations', platform: 'dbt', nodeType: 'model', name: 'fct_reservations', qualifiedName: 'marts.fct_reservations', description: 'Legacy reservation fact table. Excluded from CI.', owner: 'analytics-engineering', status: 'excluded', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['legacy', 'excluded'] }) } });
  const duplicateModel = await db.node.create({ data: { externalId: 'model.marts.mart_booking_gmv_v2', platform: 'dbt', nodeType: 'model', name: 'mart_booking_gmv_v2', qualifiedName: 'marts.mart_booking_gmv_v2', description: 'Near-duplicate of mart_booking_gmv.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ materialization: 'incremental', schema: 'marts', tags: ['mart', 'gmv'] }) } });
  const colPriceCents = await db.node.create({ data: { externalId: 'col.reservations.price_cents', platform: 'clickhouse', nodeType: 'column', name: 'price_cents', qualifiedName: 'booking_production.reservations.price_cents', description: 'Reservation price in cents.', metadata: JSON.stringify({ dataType: 'Int64' }) } });
  const colActive = await db.node.create({ data: { externalId: 'col.reservations.active', platform: 'clickhouse', nodeType: 'column', name: 'active', qualifiedName: 'booking_production.reservations.active', description: 'Active reservation flag.', metadata: JSON.stringify({ dataType: 'UInt8' }) } });
  const colNoShow = await db.node.create({ data: { externalId: 'col.reservations.no_show', platform: 'clickhouse', nodeType: 'column', name: 'no_show', qualifiedName: 'booking_production.reservations.no_show', description: 'No-show flag.', metadata: JSON.stringify({ dataType: 'UInt8' }) } });
  const colCurrency = await db.node.create({ data: { externalId: 'col.reservations.price_currency', platform: 'clickhouse', nodeType: 'column', name: 'price_currency', qualifiedName: 'booking_production.reservations.price_currency', description: 'Currency code.', metadata: JSON.stringify({ dataType: 'String' }) } });
  const colChannelId = await db.node.create({ data: { externalId: 'col.reservations.channel_id', platform: 'clickhouse', nodeType: 'column', name: 'channel_id', qualifiedName: 'booking_production.reservations.channel_id', description: 'Booking channel FK.', metadata: JSON.stringify({ dataType: 'Int32' }) } });
  const colCategory = await db.node.create({ data: { externalId: 'col.restaurants.category_name', platform: 'clickhouse', nodeType: 'column', name: 'category_name', qualifiedName: 'booking_production.restaurants.category_name', description: 'Restaurant cuisine category.', metadata: JSON.stringify({ dataType: 'String' }) } });
  const colSalesAmount = await db.node.create({ data: { externalId: 'col.mart_sales.sales_amount', platform: 'dbt', nodeType: 'column', name: 'sales_amount', qualifiedName: 'marts.mart_sales.sales_amount', description: 'Aggregated sales amount.', metadata: JSON.stringify({ dataType: 'Float64' }) } });
  const colCalendarDate = await db.node.create({ data: { externalId: 'col.dim_calendar.calendar_date', platform: 'clickhouse', nodeType: 'column', name: 'calendar_date', qualifiedName: 'analytics.dim_calendar.calendar_date', description: 'Calendar date dimension.', metadata: JSON.stringify({ dataType: 'Date' }) } });
  const dsBookingGmv = await db.node.create({ data: { externalId: 'dataset.booking_gmv', platform: 'superset', nodeType: 'dataset', name: 'Booking GMV', qualifiedName: 'marts.mart_booking_gmv', description: 'Superset physical dataset.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsRestaurantWeekly = await db.node.create({ data: { externalId: 'dataset.restaurant_weekly_stats', platform: 'superset', nodeType: 'dataset', name: 'Restaurant Weekly Stats', qualifiedName: 'marts.mart_restaurant_weekly_stats', description: 'Weekly restaurant performance dataset.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsSales = await db.node.create({ data: { externalId: 'dataset.sales_performance', platform: 'superset', nodeType: 'dataset', name: 'Sales Performance', qualifiedName: 'marts.mart_sales', description: 'Sales analytics dataset.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsRawReservations = await db.node.create({ data: { externalId: 'dataset.raw_reservations', platform: 'superset', nodeType: 'dataset', name: 'Raw Reservations (Direct)', qualifiedName: 'booking_production.reservations', description: 'Dataset pointing directly to raw source table.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'booking_production', kind: 'physical' }) } });
  const dsLegacyFct = await db.node.create({ data: { externalId: 'dataset.legacy_fct_reservations', platform: 'superset', nodeType: 'dataset', name: 'Legacy FCT Reservations', qualifiedName: 'marts.fct_reservations', description: 'Dataset linked to excluded model.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ database: 'ClickHouse Prod', schema: 'marts', kind: 'physical' }) } });
  const dsUnresolved = await db.node.create({ data: { externalId: 'dataset.unresolved_external_api', platform: 'superset', nodeType: 'dataset', name: 'External API Data', qualifiedName: 'external_api.orders', description: 'Virtual dataset from external API.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ database: 'External API', kind: 'virtual' }) } });
  const metricTotalSales = await db.node.create({ data: { externalId: 'metric.total_sales', platform: 'superset', nodeType: 'metric', name: 'Total Sales', qualifiedName: 'dataset.sales_performance.metric.total_sales', description: 'Sum of sales_amount.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'SUM', expression: 'sales_amount' }) } });
  const metricGmv = await db.node.create({ data: { externalId: 'metric.gmv', platform: 'superset', nodeType: 'metric', name: 'GMV', qualifiedName: 'dataset.booking_gmv.metric.gmv', description: 'Gross Merchandise Value.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'SUM', expression: 'price_cents / 100' }) } });
  const metricGmvIncomplete = await db.node.create({ data: { externalId: 'metric.gmv_incomplete', platform: 'superset', nodeType: 'metric', name: 'GMV (Incomplete)', qualifiedName: 'dataset.raw_reservations.metric.gmv_incomplete', description: 'Incomplete GMV without canonical filters.', owner: 'unknown', metadata: JSON.stringify({ aggregation: 'SUM', expression: 'price_cents / 100' }) } });
  const metricReservationCount = await db.node.create({ data: { externalId: 'metric.reservation_count', platform: 'superset', nodeType: 'metric', name: 'Reservation Count', qualifiedName: 'dataset.booking_gmv.metric.reservation_count', description: 'Count of total reservations.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'COUNT', expression: '*' }) } });
  const metricAvgBookingValue = await db.node.create({ data: { externalId: 'metric.avg_booking_value', platform: 'superset', nodeType: 'metric', name: 'Avg Booking Value', qualifiedName: 'dataset.restaurant_weekly_stats.metric.avg_booking_value', description: 'Average booking value per restaurant.', owner: 'analytics-engineering', metadata: JSON.stringify({ aggregation: 'AVG', expression: 'booking_value' }) } });
  const dimCategory = await db.node.create({ data: { externalId: 'dim.category_name', platform: 'superset', nodeType: 'dimension', name: 'Category', qualifiedName: 'dataset.sales_performance.dim.category_name', description: 'Restaurant category dimension.', metadata: JSON.stringify({ expression: 'category_name' }) } });
  const dimCalendar = await db.node.create({ data: { externalId: 'dim.calendar_date', platform: 'superset', nodeType: 'time_dimension', name: 'Calendar Date', qualifiedName: 'dataset.sales_performance.dim.calendar_date', description: 'Time dimension.', metadata: JSON.stringify({ expression: 'calendar_date', timeGrain: 'P1D' }) } });
  const filterActive = await db.node.create({ data: { externalId: 'filter.active_eq_1', platform: 'superset', nodeType: 'filter', name: 'Active Only', qualifiedName: 'filter.active_eq_1', description: 'Chart-level filter: active = 1.', metadata: JSON.stringify({ clause: 'active = 1', filterType: 'chart' }) } });
  const filterNoShow = await db.node.create({ data: { externalId: 'filter.no_show_eq_0', platform: 'superset', nodeType: 'filter', name: 'Exclude No-Shows', qualifiedName: 'filter.no_show_eq_0', description: 'Chart-level filter: no_show = 0.', metadata: JSON.stringify({ clause: 'no_show = 0', filterType: 'chart' }) } });
  const filterDashboardDate = await db.node.create({ data: { externalId: 'filter.dashboard_date_range', platform: 'superset', nodeType: 'filter', name: 'Date Range', qualifiedName: 'filter.dashboard_date_range', description: 'Dashboard-level native filter.', metadata: JSON.stringify({ clause: 'calendar_date BETWEEN {{ from }} AND {{ to }}', filterType: 'native', scope: 'dashboard' }) } });
  const chartMonthlySales = await db.node.create({ data: { externalId: 'chart.monthly_sales_by_category', platform: 'superset', nodeType: 'chart', name: 'Monthly Sales by Product Category', qualifiedName: 'chart.monthly_sales_by_category', description: 'Line chart showing monthly sales trends.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'line_chart' }) } });
  const chartGmvTrend = await db.node.create({ data: { externalId: 'chart.gmv_trend', platform: 'superset', nodeType: 'chart', name: 'GMV Trend Over Time', qualifiedName: 'chart.gmv_trend', description: 'Area chart showing GMV trends.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'area_chart' }) } });
  const chartGmvIncomplete = await db.node.create({ data: { externalId: 'chart.gmv_quick_view', platform: 'superset', nodeType: 'chart', name: 'GMV Quick View', qualifiedName: 'chart.gmv_quick_view', description: 'Bar chart showing GMV without canonical filters.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ vizType: 'bar_chart' }) } });
  const chartRestaurantPerformance = await db.node.create({ data: { externalId: 'chart.restaurant_weekly_performance', platform: 'superset', nodeType: 'chart', name: 'Restaurant Weekly Performance', qualifiedName: 'chart.restaurant_weekly_performance', description: 'Table chart of weekly restaurant metrics.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'table_chart' }) } });
  const chartReservationCount = await db.node.create({ data: { externalId: 'chart.reservation_count_trend', platform: 'superset', nodeType: 'chart', name: 'Reservation Count Trend', qualifiedName: 'chart.reservation_count_trend', description: 'Line chart of reservation counts.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'line_chart' }) } });
  const chartLegacyReservations = await db.node.create({ data: { externalId: 'chart.legacy_reservation_detail', platform: 'superset', nodeType: 'chart', name: 'Legacy Reservation Detail', qualifiedName: 'chart.legacy_reservation_detail', description: 'Table using excluded model.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ vizType: 'table_chart' }) } });
  const chartBypassedRaw = await db.node.create({ data: { externalId: 'chart.raw_booking_export', platform: 'superset', nodeType: 'chart', name: 'Raw Booking Export', qualifiedName: 'chart.raw_booking_export', description: 'Chart querying raw data directly.', owner: 'unknown', status: 'active', metadata: JSON.stringify({ vizType: 'table_chart' }) } });
  const chartSalesPie = await db.node.create({ data: { externalId: 'chart.sales_by_category_pie', platform: 'superset', nodeType: 'chart', name: 'Sales by Category (Pie)', qualifiedName: 'chart.sales_by_category_pie', description: 'Pie chart of sales distribution.', owner: 'analytics-engineering', status: 'active', metadata: JSON.stringify({ vizType: 'pie_chart' }) } });
  const dashSales = await db.node.create({ data: { externalId: 'dashboard.sales_performance', platform: 'superset', nodeType: 'dashboard', name: 'Sales Performance', qualifiedName: 'dashboard.sales_performance', description: 'Executive sales dashboard.', owner: 'head-of-data', status: 'active' } });
  const dashGmv = await db.node.create({ data: { externalId: 'dashboard.gmv_overview', platform: 'superset', nodeType: 'dashboard', name: 'GMV Overview', qualifiedName: 'dashboard.gmv_overview', description: 'GMV tracking dashboard.', owner: 'analytics-engineering', status: 'active' } });
  const dashRestaurant = await db.node.create({ data: { externalId: 'dashboard.restaurant_analytics', platform: 'superset', nodeType: 'dashboard', name: 'Restaurant Analytics', qualifiedName: 'dashboard.restaurant_analytics', description: 'Restaurant performance dashboard.', owner: 'analytics-engineering', status: 'active' } });
  const dashLegacy = await db.node.create({ data: { externalId: 'dashboard.legacy_operations', platform: 'superset', nodeType: 'dashboard', name: 'Legacy Operations', qualifiedName: 'dashboard.legacy_operations', description: 'Legacy operations dashboard.', owner: 'unknown', status: 'active' } });

  const mkEdge = (src: string, tgt: string, type: string, conf: string) =>
    db.edge.create({ data: { sourceNodeId: src, targetNodeId: tgt, edgeType: type, confidence: conf, extractionMethod: 'manifest', sourcePlatform: 'dbt' } });

  await mkEdge(srcReservations.id, stgReservations.id, 'DERIVED_FROM', 'verified');
  await mkEdge(srcPayments.id, stgPayments.id, 'DERIVED_FROM', 'verified');
  await mkEdge(srcRestaurants.id, stgRestaurants.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgReservations.id, intReservationPayments.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgPayments.id, intReservationPayments.id, 'JOINS_WITH', 'verified');
  await mkEdge(intReservationPayments.id, martBookingGmv.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgRestaurants.id, martBookingGmv.id, 'JOINS_WITH', 'verified');
  await mkEdge(stgReservations.id, martRestaurantWeekly.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgRestaurants.id, martRestaurantWeekly.id, 'JOINS_WITH', 'verified');
  await mkEdge(stgPayments.id, martSales.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgReservations.id, martSales.id, 'JOINS_WITH', 'verified');
  await mkEdge(stgRestaurants.id, martSales.id, 'JOINS_WITH', 'verified');
  await mkEdge(srcReservations.id, martBypassed.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgReservations.id, excludedModel.id, 'DERIVED_FROM', 'verified');
  await mkEdge(intReservationPayments.id, duplicateModel.id, 'DERIVED_FROM', 'verified');
  await mkEdge(stgRestaurants.id, duplicateModel.id, 'JOINS_WITH', 'verified');
  await mkEdge(martBookingGmv.id, dsBookingGmv.id, 'PRODUCES', 'declared');
  await mkEdge(martRestaurantWeekly.id, dsRestaurantWeekly.id, 'PRODUCES', 'declared');
  await mkEdge(martSales.id, dsSales.id, 'PRODUCES', 'declared');
  await mkEdge(srcReservations.id, dsRawReservations.id, 'PRODUCES', 'declared');
  await mkEdge(excludedModel.id, dsLegacyFct.id, 'PRODUCES', 'declared');
  await mkEdge(dsSales.id, chartMonthlySales.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsBookingGmv.id, chartGmvTrend.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsRawReservations.id, chartGmvIncomplete.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsRestaurantWeekly.id, chartRestaurantPerformance.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsBookingGmv.id, chartReservationCount.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsLegacyFct.id, chartLegacyReservations.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsRawReservations.id, chartBypassedRaw.id, 'DERIVED_FROM', 'verified');
  await mkEdge(dsSales.id, chartSalesPie.id, 'DERIVED_FROM', 'verified');
  await mkEdge(chartMonthlySales.id, dashSales.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartSalesPie.id, dashSales.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartGmvTrend.id, dashGmv.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartGmvIncomplete.id, dashGmv.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartReservationCount.id, dashGmv.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartRestaurantPerformance.id, dashRestaurant.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartLegacyReservations.id, dashLegacy.id, 'DISPLAYED_IN', 'verified');
  await mkEdge(chartBypassedRaw.id, dashLegacy.id, 'DISPLAYED_IN', 'verified');

  await db.canonicalMetric.create({ data: { name: 'gmv', aliases: JSON.stringify(['GMV', 'Gross Merchandise Value']), description: 'Gross merchandise value for valid reservations.', expression: 'price_cents / 100', aggregation: 'sum', requiredFilters: JSON.stringify(['active = 1', 'no_show = 0', 'revenue > 0', 'is_temporary = 0', 'for_locking_system = 0', 'channel_id != 5', 'ack = 1']), dimensions: JSON.stringify(['restaurant_id', 'category_name', 'channel_id', 'price_currency']), currencyRequirement: 'price_currency', timeGrain: 'P1D', owner: 'data-team', version: '1.0', severityOnDrift: 'error' } });
  await db.canonicalMetric.create({ data: { name: 'total_sales', aliases: JSON.stringify(['Total Sales']), description: 'Total sales from confirmed transactions.', expression: 'sales_amount', aggregation: 'sum', requiredFilters: JSON.stringify(['active = 1', 'payment_status = confirmed']), dimensions: JSON.stringify(['category_name', 'calendar_date']), timeGrain: 'P1D', owner: 'data-team', version: '1.0', severityOnDrift: 'warning' } });

  await db.finding.create({ data: { ruleId: 'R1', severity: 'error', nodeId: martBypassed.id, title: 'Bypass Governance: Model reads directly from raw source', description: 'Model reads directly from booking_production.reservations bypassing staging.', evidence: JSON.stringify({ model: 'marts.mart_finance_export', source: 'booking_production.reservations' }), recommendation: 'Route through an approved staging model.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R1', severity: 'error', nodeId: dsRawReservations.id, title: 'Bypass Governance: Dataset points to raw source table', description: 'Superset dataset points to raw source table.', evidence: JSON.stringify({ dataset: 'dataset.raw_reservations', schema: 'booking_production' }), recommendation: 'Replace with a mart dataset.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R2', severity: 'warning', nodeId: dsUnresolved.id, title: 'Orphaned Dataset: Cannot match to dbt or warehouse object', description: 'Dataset cannot be matched to any dbt model.', evidence: JSON.stringify({ dataset: 'dataset.unresolved_external_api' }), recommendation: 'Add a dbt source definition.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R3', severity: 'error', nodeId: metricGmvIncomplete.id, title: 'Metric Drift: GMV (Incomplete) differs from canonical definition', description: 'Observed GMV uses 2 of 7 canonical filters.', evidence: JSON.stringify({ missingFilters: ['revenue > 0', 'is_temporary = 0', 'for_locking_system = 0', 'channel_id != 5', 'ack = 1'] }), recommendation: 'Use mart_booking_gmv with canonical GMV metric.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R4', severity: 'critical', nodeId: excludedModel.id, title: 'Excluded Model Used by Active BI Assets', description: 'Excluded model still used by active charts/dashboards.', evidence: JSON.stringify({ downstreamCharts: 1, downstreamDashboards: 1 }), recommendation: 'Migrate Legacy Operations dashboard.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R5', severity: 'warning', nodeId: chartGmvIncomplete.id, title: 'Missing Lineage: Chart uses dataset with incomplete resolution', description: 'Chart uses raw source dataset, cannot resolve column-level lineage.', recommendation: 'Switch to a governed dataset.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R6', severity: 'warning', nodeId: duplicateModel.id, title: 'Duplicate Model: Near-identical SQL', description: 'Near-identical to mart_booking_gmv (97% similarity).', evidence: JSON.stringify({ similarityScore: 0.97 }), recommendation: 'Consolidate into the original model.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R7', severity: 'info', nodeId: metricGmvIncomplete.id, title: 'Missing Documentation: Metric has no owner', description: 'Metric has no assigned owner.', evidence: JSON.stringify({ owner: 'unknown' }), recommendation: 'Assign an owner.', status: 'open' } });
  await db.finding.create({ data: { ruleId: 'R8', severity: 'error', nodeId: dsRawReservations.id, title: 'Direct Raw-Table Dataset', description: 'Dataset uses raw schema.', evidence: JSON.stringify({ schema: 'booking_production' }), recommendation: 'Migrate to mart datasets.', status: 'open' } });

  await db.buildRun.create({ data: { projectId: 'hungryhub-analytics', status: 'warning', totalModels: 8, totalDatasets: 6, totalCharts: 8, totalDashboards: 4, unresolvedCount: 1, lineageCoverage: 0.83, errorFindings: 3, warningFindings: 3, criticalFindings: 1, infoFindings: 1, duration: 127 } });

  console.log(`  Nodes: ${await db.node.count()}, Edges: ${await db.edge.count()}, Findings: ${await db.finding.count()}`);
  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
