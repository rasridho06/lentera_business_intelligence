import { notFound } from 'next/navigation';
import HomeClient from '@/components/home-client';
import { routeViewIds, type ViewType } from '@/lib/navigation';

export default async function ViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!routeViewIds.has(view as ViewType)) notFound();
  return <HomeClient initialView={view as ViewType} />;
}
