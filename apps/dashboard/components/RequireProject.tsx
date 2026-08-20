'use client';

import Link from 'next/link';
import { useSession } from '@/lib/session';
import { ReactNode } from 'react';

export function RequireProject({ children }: { children: ReactNode }) {
  const { organizationId, projectId, ready } = useSession();

  if (!ready) return null;

  if (!organizationId) {
    return (
      <EmptyState
        title="No organization yet"
        body="Create an organization to get started. Every project, trace, and API key lives under one."
        cta={{ href: '/onboarding', label: 'Get started' }}
      />
    );
  }

  if (!projectId) {
    return (
      <EmptyState
        title="No project selected"
        body="Pick a project from the sidebar, or create one if this organization doesn't have any yet."
        cta={{ href: '/onboarding', label: 'Create a project' }}
      />
    );
  }

  return <>{children}</>;
}

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-24 text-center">
      <h2 className="mb-2 text-base font-semibold text-text">{title}</h2>
      <p className="mb-6 max-w-sm text-sm text-textMuted">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
