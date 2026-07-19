import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <Link href="/" className="rounded bg-primary px-4 py-2 text-primary-foreground">Go home</Link>
    </div>
  );
}
