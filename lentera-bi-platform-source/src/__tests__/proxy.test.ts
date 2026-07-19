import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn().mockResolvedValue(null) }));

import { proxy } from '@/proxy';

describe('proxy', () => {
  it('returns JSON 401 for an unauthenticated API request', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/api/connectors'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});
