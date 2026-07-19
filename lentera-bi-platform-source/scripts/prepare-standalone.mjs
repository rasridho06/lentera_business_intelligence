import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const standalone = join('.next', 'standalone');

if (!existsSync(standalone)) {
  throw new Error('Missing .next/standalone. Run next build first.');
}

cpSync(join('.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
cpSync('public', join(standalone, 'public'), { recursive: true });
cpSync('prisma', join(standalone, 'prisma'), { recursive: true });
mkdirSync(join(standalone, 'upload'), { recursive: true });
