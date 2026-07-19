import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }));

import { proxy } from '@/proxy';

describe('proxy', () => {
  it.each(['/api', '/api/connectors'])('returns JSON 401 for %s without a session', async (path) => {
    const response = await proxy(new NextRequest('http://localhost:3000' + path));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});
