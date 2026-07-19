import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity');
    const ruleId = searchParams.get('ruleId');
    const nodeType = searchParams.get('nodeType');
    const status = searchParams.get('status');

    const where: Prisma.FindingWhereInput = {};
    if (severity) where.severity = severity;
    if (ruleId) where.ruleId = ruleId;
    if (status) where.status = status;

    const findings = await db.finding.findMany({
      where,
      include: {
        node: {
          select: {
            id: true,
            name: true,
            nodeType: true,
            platform: true,
            qualifiedName: true,
            owner: true,
            status: true,
          },
        },
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // If filtering by nodeType, filter in-memory since it's a relation field
    const filtered = nodeType
      ? findings.filter((f) => f.node?.nodeType === nodeType)
      : findings;

    const rules = [
      { id: 'R1', name: 'Bypass Governance', description: 'Detects models/datasets bypassing required transformation layers.' },
      { id: 'R2', name: 'Orphaned Dataset', description: 'Detects datasets that cannot be matched to dbt or warehouse objects.' },
      { id: 'R3', name: 'Metric Drift', description: 'Detects observed metrics differing from canonical definitions.' },
      { id: 'R4', name: 'Excluded Model in Use', description: 'Detects excluded models still used by active BI assets.' },
      { id: 'R5', name: 'Missing Lineage', description: 'Detects charts with unresolved dataset or metric lineage.' },
      { id: 'R6', name: 'Duplicate Model', description: 'Detects models with near-identical SQL.' },
      { id: 'R7', name: 'Missing Documentation', description: 'Detects critical assets without owner or description.' },
      { id: 'R8', name: 'Direct Raw-Table Dataset', description: 'Detects datasets using configured raw schemas.' },
    ];

    const severityCounts = {
      critical: findings.filter((f) => f.severity === 'critical').length,
      error: findings.filter((f) => f.severity === 'error').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    };

    return NextResponse.json({
      findings: filtered.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        ruleVersion: f.ruleVersion,
        severity: f.severity,
        title: f.title,
        description: f.description,
        evidence: f.evidence ? JSON.parse(f.evidence) : null,
        recommendation: f.recommendation,
        status: f.status,
        suppressionReason: f.suppressionReason,
        node: f.node ? {
          id: f.node.id,
          name: f.node.name,
          type: f.node.nodeType,
          platform: f.node.platform,
          qualifiedName: f.node.qualifiedName,
        } : null,
        createdAt: f.createdAt,
      })),
      rules,
      severityCounts,
      total: filtered.length,
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit findings' }, { status: 500 });
  }
}
