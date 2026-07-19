import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q')?.toLowerCase() || '';
    const type = searchParams.get('type');

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const where: Record<string, unknown> = {
      OR: [
        { name: { contains: q } },
        { qualifiedName: { contains: q } },
        { description: { contains: q } },
        { owner: { contains: q } },
        { externalId: { contains: q } },
      ],
    };

    if (type) {
      where.nodeType = type;
    }

    const nodes = await db.node.findMany({
      where,
      take: 50,
    });

    const results = nodes.map((n) => ({
      id: n.id,
      externalId: n.externalId,
      name: n.name,
      type: n.nodeType,
      platform: n.platform,
      qualifiedName: n.qualifiedName,
      description: n.description?.substring(0, 150),
      owner: n.owner,
      status: n.status,
    }));

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
