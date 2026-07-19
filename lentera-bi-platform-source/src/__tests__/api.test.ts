import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { cleanupTestData, trackIds } from './helpers/cleanup';
import { GET as OverviewGET } from '@/app/api/overview/route';
import { GET as AuditGET } from '@/app/api/audit/route';
import { GET as SearchGET } from '@/app/api/search/route';
import { GET as NodesGET } from '@/app/api/nodes/route';
import { GET as LineageGET } from '@/app/api/lineage/route';
import { GET as ImpactGET } from '@/app/api/impact/route';

const prisma = new PrismaClient();
const testIds: Record<string, string[]> = {};
const track = trackIds(testIds);

afterAll(async () => {
  await cleanupTestData(prisma, testIds);
  await prisma.$disconnect();
});

function mockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('API Route Handlers', () => {
  let nodeId: string;
  let edgeId: string;
  let findingId: string;

  it('GET /api/overview returns 200 with valid structure', async () => {
    const response = await OverviewGET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('nodeCounts');
    expect(data).toHaveProperty('severityCounts');
    expect(data).toHaveProperty('totalNodes');
    expect(data).toHaveProperty('totalEdges');
  });

  it('should seed test data for downstream API tests', async () => {
    const node = await prisma.node.create({
      data: {
        externalId: 'api-test-node',
        platform: 'test',
        nodeType: 'dataset',
        name: 'API Test Dataset',
        qualifiedName: 'test.api_test_dataset',
      },
    });
    nodeId = node.id;
    track('node', nodeId);

    const node2 = await prisma.node.create({
      data: {
        externalId: 'api-test-node-2',
        platform: 'test',
        nodeType: 'chart',
        name: 'API Test Chart',
        qualifiedName: 'test.api_test_chart',
      },
    });
    track('node', node2.id);

    const edge = await prisma.edge.create({
      data: {
        sourceNodeId: nodeId,
        targetNodeId: node2.id,
        edgeType: 'DERIVED_FROM',
        confidence: 'declared',
      },
    });
    edgeId = edge.id;
    track('edge', edgeId);

    const finding = await prisma.finding.create({
      data: {
        ruleId: 'R1',
        severity: 'warning',
        title: 'API Test Finding',
        description: 'Test finding for API test',
        nodeId,
      },
    });
    findingId = finding.id;
    track('finding', findingId);

    expect(node.id).toBeDefined();
    expect(edge.id).toBeDefined();
    expect(finding.id).toBeDefined();
  });

  it('GET /api/audit returns 200 with findings', async () => {
    const response = await AuditGET(mockRequest('/api/audit'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('findings');
    expect(data).toHaveProperty('rules');
    expect(data).toHaveProperty('severityCounts');
    expect(Array.isArray(data.findings)).toBe(true);
  });

  it('GET /api/audit?severity=warning filters results', async () => {
    const response = await AuditGET(mockRequest('/api/audit?severity=warning'));
    expect(response.status).toBe(200);
    const data = await response.json();
    for (const f of data.findings) {
      expect(f.severity).toBe('warning');
    }
  });

  it('GET /api/search?q=API returns 200 with results', async () => {
    const response = await SearchGET(mockRequest('/api/search?q=API'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('results');
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
  });

  it('GET /api/search without query returns empty results', async () => {
    const response = await SearchGET(mockRequest('/api/search?q=a'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results).toHaveLength(0);
  });

  it('GET /api/nodes?id= returns 400 when id missing', async () => {
    const response = await NodesGET(mockRequest('/api/nodes'));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('GET /api/nodes?id= returns 200 with node detail', async () => {
    const response = await NodesGET(mockRequest(`/api/nodes?id=${nodeId}`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('node');
    expect(data.node.name).toBe('API Test Dataset');
    expect(data).toHaveProperty('upstream');
    expect(data).toHaveProperty('downstream');
    expect(data).toHaveProperty('findings');
  });

  it('GET /api/lineage returns 200 with nodes and edges', async () => {
    const response = await LineageGET(mockRequest('/api/lineage'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('nodes');
    expect(data).toHaveProperty('edges');
    expect(Array.isArray(data.nodes)).toBe(true);
  });

  it('GET /api/lineage?focus= filters by node', async () => {
    const response = await LineageGET(mockRequest(`/api/lineage?focus=${nodeId}&depth=5`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/impact?nodeId= returns 400 when nodeId missing', async () => {
    const response = await ImpactGET(mockRequest('/api/impact'));
    expect(response.status).toBe(400);
  });

  it('GET /api/impact?nodeId= returns 200 with impact data', async () => {
    const response = await ImpactGET(mockRequest(`/api/impact?nodeId=${nodeId}`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('sourceNode');
    expect(data).toHaveProperty('affectedNodes');
    expect(data).toHaveProperty('totalAffected');
  });
});
