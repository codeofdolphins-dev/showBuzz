import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl font-black text-admin-indigo">404</p>
      <h1 className="text-lg font-bold text-admin-dark">Page not found</h1>
      <Link href="/dashboard" className="text-xs font-bold text-admin-indigo hover:underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
