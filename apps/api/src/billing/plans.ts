/**
 * Pilot-stage billing is deliberately a hardcoded plan table, not a
 * DB-driven pricing engine — that's real scope for later (Stripe products/
 * prices, proration, etc.). This is enough to (a) stop a free account from
 * costing you money unbounded, and (b) give the dashboard something
 * concrete to show usage against. Organization.plan is already a free-text
 * column (set at signup, changed manually for now); this table just maps
 * that string to limits.
 */
export interface PlanLimits {
  displayName: string;
  maxTracesPerMonth: number;
  maxEvalCasesPerMonth: number;
  maxRetentionDays: number;
  maxTeamMembers: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    displayName: 'Free',
    maxTracesPerMonth: 5_000,
    maxEvalCasesPerMonth: 500,
    maxRetentionDays: 14,
    maxTeamMembers: 3,
  },
  pro: {
    displayName: 'Pro',
    maxTracesPerMonth: 250_000,
    maxEvalCasesPerMonth: 25_000,
    maxRetentionDays: 90,
    maxTeamMembers: 25,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
