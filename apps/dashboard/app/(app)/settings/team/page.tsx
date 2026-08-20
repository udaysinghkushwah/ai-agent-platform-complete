'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { team, OrgMember, ApiError } from '@/lib/api';
import { formatTime } from '@/lib/format';

const ROLES = ['ADMIN', 'DEVELOPER', 'ANALYST', 'SECURITY_REVIEWER', 'VIEWER'];

export default function TeamPage() {
  const { organizationId, user, ready } = useSession();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(ROLES[1]);
  const [inviting, setInviting] = useState(false);

  function refresh() {
    if (!organizationId) return;
    setLoading(true);
    team
      .list(organizationId)
      .then(setMembers)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.status === 403
              ? 'You need Admin or Owner access to manage the team.'
              : err.message
            : 'Failed to load team',
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [organizationId]);

  async function handleInvite() {
    if (!organizationId || !email.includes('@')) return;
    setInviting(true);
    setError(null);
    try {
      await team.invite(organizationId, email, role);
      setEmail('');
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(targetUserId: string) {
    if (!organizationId) return;
    if (!confirm('Remove this person from the organization?')) return;
    try {
      await team.remove(organizationId, targetUserId);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member');
    }
  }

  if (!ready) return null;

  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-semibold text-text">Team</h1>
      <p className="mb-6 text-sm text-textMuted">
        Add teammates by email — they need an existing account first (no email invite link yet).
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          className="min-w-[220px] flex-1 rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={handleInvite}
          disabled={inviting}
          className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-textMuted">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-textFaint">
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-borderMuted last:border-b-0">
                  <td className="px-3 py-2.5 text-text">{m.user.name ?? m.user.email}</td>
                  <td className="px-3 py-2.5 text-xs text-textMuted">{m.role}</td>
                  <td className="px-3 py-2.5 text-xs text-textFaint">{formatTime(m.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {m.role !== 'OWNER' && m.user.id !== user?.id && (
                      <button
                        onClick={() => handleRemove(m.user.id)}
                        className="text-xs text-error underline decoration-error/30 underline-offset-2 hover:decoration-error"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
