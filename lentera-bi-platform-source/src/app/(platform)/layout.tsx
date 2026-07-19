import { Toaster } from '@/components/ui/toaster';
import { Providers } from '../providers';

export default function PlatformLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Providers>
      {children}
      <Toaster />
    </Providers>
  );
}
