import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    connector: { findUnique: mocks.findUnique, update: mocks.update },
    dataSourceTable: { deleteMany: mocks.deleteMany, create: mocks.create },
  },
}));

vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn().mockReturnValue('postgres') }));

import { POST } from '@/app/api/connectors-test/route';

describe('connector test API', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset()
      .mockResolvedValueOnce({ id: 'connector-1', type: 'postgres', host: 'demo-postgres', port: 5432, username: 'postgres', password: 'encrypted-secret', database: 'analytics', schema: null })
      .mockResolvedValueOnce({ id: 'connector-1', tables: [] });
  });

  it('uses stored credentials when connectorId is provided', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/connectors-test', {
      method: 'POST',
      body: JSON.stringify({ connectorId: 'connector-1', type: 'postgres', host: '', port: 0, username: '', password: '', database: '' }),
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, synced: true });
  });
});
