'use client';

import type { PropsWithChildren } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

export function PlatformShell({ children }: PropsWithChildren) {
  return (
    <TooltipProvider>
      <div className="min-h-screen flex bg-background">{children}</div>
    </TooltipProvider>
  );
}
