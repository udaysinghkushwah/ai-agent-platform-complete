'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, token } = useSession();

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  if (!ready || !token) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Top Global Header Bar */}
      <Header />

      {/* Main Container with Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-950">{children}</main>
      </div>
    </div>
  );
}
