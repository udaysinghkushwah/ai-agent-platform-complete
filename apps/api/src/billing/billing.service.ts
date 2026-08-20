import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPlanLimits, startOfCurrentMonth } from './plans';

export interface UsageSnapshot {
  plan: string;
  planDisplayName: string;
  periodStart: string;
  traces: { used: number; limit: number; percentUsed: number };
  evalCases: { used: number; limit: number; percentUsed: number };
  teamMembers: { used: number; limit: number; percentUsed: number };
  retentionDaysLimit: number;
  warnings: string[];
}

const WARNING_THRESHOLD = 0.8;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(organizationId: string): Promise<UsageSnapshot> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const limits = getPlanLimits(org.plan);
    const periodStart = startOfCurrentMonth();

    const [traceCount, evalAgg, memberCount] = await Promise.all([
      this.prisma.trace.count({ where: { organizationId, startedAt: { gte: periodStart } } }),
      this.prisma.evaluationRun.aggregate({
        where: { organizationId, createdAt: { gte: periodStart } },
        _sum: { completedCases: true },
      }),
      this.prisma.organizationMember.count({ where: { organizationId } }),
    ]);

    const evalCaseCount = evalAgg._sum.completedCases ?? 0;

    const traces = fraction(traceCount, limits.maxTracesPerMonth);
    const evalCases = fraction(evalCaseCount, limits.maxEvalCasesPerMonth);
    const teamMembers = fraction(memberCount, limits.maxTeamMembers);

    const warnings: string[] = [];
    if (traces.percentUsed >= 1) warnings.push('Monthly trace limit reached — new events are being rejected.');
    else if (traces.percentUsed >= WARNING_THRESHOLD) warnings.push('Approaching monthly trace limit.');
    if (evalCases.percentUsed >= 1) warnings.push('Monthly evaluation case limit reached.');
    else if (evalCases.percentUsed >= WARNING_THRESHOLD) warnings.push('Approaching monthly evaluation case limit.');
    if (teamMembers.percentUsed >= 1) warnings.push('Team member limit reached.');

    return {
      plan: org.plan,
      planDisplayName: limits.displayName,
      periodStart: periodStart.toISOString(),
      traces,
      evalCases,
      teamMembers,
      retentionDaysLimit: limits.maxRetentionDays,
      warnings,
    };
  }

  /** Cheap, indexed count — see README for the caching note at real scale. */
  async isTraceQuotaExceeded(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return false; // unknown org fails elsewhere (ingestion already validates project/org existence)
    const limits = getPlanLimits(org.plan);
    const count = await this.prisma.trace.count({
      where: { organizationId, startedAt: { gte: startOfCurrentMonth() } },
    });
    return count >= limits.maxTracesPerMonth;
  }

  async isEvalQuotaExceeded(organizationId: string, additionalCases: number): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return false;
    const limits = getPlanLimits(org.plan);
    const agg = await this.prisma.evaluationRun.aggregate({
      where: { organizationId, createdAt: { gte: startOfCurrentMonth() } },
      _sum: { completedCases: true },
    });
    const used = agg._sum.completedCases ?? 0;
    return used + additionalCases > limits.maxEvalCasesPerMonth;
  }

  async isTeamMemberQuotaExceeded(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return false;
    const limits = getPlanLimits(org.plan);
    const count = await this.prisma.organizationMember.count({ where: { organizationId } });
    return count >= limits.maxTeamMembers;
  }

  async maxRetentionDaysForOrg(organizationId: string): Promise<number> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    return getPlanLimits(org?.plan ?? 'free').maxRetentionDays;
  }
}

function fraction(used: number, limit: number): { used: number; limit: number; percentUsed: number } {
  return { used, limit, percentUsed: limit > 0 ? Math.min(used / limit, 1) : 0 };
}
