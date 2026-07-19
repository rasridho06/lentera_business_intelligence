import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }));

import { proxy, config } from '@/proxy';

const matchers = config.matcher as string[];
// Next.js applies the matcher against the full pathname, anchored at the start.
const matcherRegex = new RegExp('^(?:' + matchers[0] + ')$');

function matchesMatcher(path: string): boolean {
  const candidate = path.startsWith('/') ? path : '/' + path;
  return matcherRegex.test(candidate);
}

describe('proxy', () => {
  it.each(['/api', '/api/connectors'])('returns JSON 401 for %s without a session', async (path) => {
    const response = await proxy(new NextRequest('http://localhost:3000' + path));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});

describe('proxy matcher carve-out', () => {
  it.each([
    '/login',
    '/api/auth/session',
    '/sql-wasm-browser.wasm',
    '/_next/static/chunk.js',
  ])('does NOT invoke proxy for %s (matcher excludes it)', (path) => {
    expect(matchesMatcher(path)).toBe(false);
  });

  it.each([
    '/overview',
    '/connectors',
    '/query',
    '/lineage',
    '/api/connectors',
    '/sql-wasm-browser.wasm/foo',
  ])('invokes proxy for %s (matcher matches it)', (path) => {
    expect(matchesMatcher(path)).toBe(true);
  });
});