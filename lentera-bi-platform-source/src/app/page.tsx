'use client';

import dynamic from 'next/dynamic';

const HomeClient = dynamic(() => import('@/components/home-client'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      <span className="ml-3 text-muted-foreground">Loading Lentera...</span>
    </div>
  ),
});

export default function Home() {
  return <HomeClient />;
}
