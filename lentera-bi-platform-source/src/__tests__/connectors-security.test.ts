import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    connector: {
      findMany: vi.fn().mockResolvedValue([{ id: 'connector-1', name: 'Warehouse', password: 'encrypted-secret', tables: [] }]),
    },
  },
}));

import { GET } from '@/app/api/connectors/route';

describe('connectors API', () => {
  it('does not return connector passwords', async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual([{ id: 'connector-1', name: 'Warehouse', tables: [] }]);
  });
});
