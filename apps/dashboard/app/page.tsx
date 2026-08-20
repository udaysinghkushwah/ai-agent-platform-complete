'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';

export default function RootPage() {
  const router = useRouter();
  const { ready, token } = useSession();

  useEffect(() => {
    if (!ready) return;
    router.replace(token ? '/dashboard' : '/login');
  }, [ready, token, router]);

  return null;
}
