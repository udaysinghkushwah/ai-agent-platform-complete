import { OrgRole } from '@prisma/client';

// Lower number = more privileged. Used only for convenience helpers below;
// actual authorization checks should use ROLE_PERMITS, not numeric comparison,
// since permission is not strictly linear (e.g. Security Reviewer vs Analyst).
export const ROLE_RANK: Record<OrgRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  SECURITY_REVIEWER: 2,
  DEVELOPER: 3,
  ANALYST: 4,
  VIEWER: 5,
};

/**
 * requireAtLeast('ADMIN') means: OWNER or ADMIN pass, everyone else is denied.
 * This is intentionally simple for MVP-0. Fine-grained per-resource policies
 * (e.g. Security Reviewer can touch policies but not billing) get added in
 * MVP-5 (Governance) without changing this file's shape.
 */
export function meetsMinimumRole(actual: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[actual] <= ROLE_RANK[minimum];
}
