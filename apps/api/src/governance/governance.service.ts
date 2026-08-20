import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateGovernancePolicyDto, PolicyCheckDto, UpdatePolicyStatusDto } from './dto/governance.dto';

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /DAN\s+mode/i,
  /jailbreak/i,
  /reveal\s+your\s+system\s+prompt/i,
  /disregard\s+all\s+prior\s+rules/i,
  /drop\s+table/i,
  /truncate\s+table/i,
];

function isPromptInjection(parameters?: Record<string, unknown>): boolean {
  if (!parameters) return false;
  const str = JSON.stringify(parameters);
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(str));
}

export type PolicyCheckOutcome = 'ALLOWED' | 'DENIED' | 'REQUIRES_APPROVAL';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async createPolicy(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: CreateGovernancePolicyDto,
  ) {
    const existing = await this.prisma.governancePolicy.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException('A policy with this name already exists in this project');

    const policy = await this.prisma.governancePolicy.create({
      data: {
        organizationId,
        projectId,
        name: dto.name,
        allowedTools: dto.allowedTools ?? [],
        blockedTools: dto.blockedTools ?? [],
        requireApprovalTools: dto.requireApprovalTools ?? [],
        restrictedEnvironments: dto.restrictedEnvironments ?? [],
        maxParameterValues: dto.maxParameterValues as any,
        status: 'ACTIVE',
        createdBy: userId,
      },
    });

    await this.audit.record({
      organizationId,
      actorType: 'user',
      actorId: userId,
      action: 'governance_policy.created',
      resourceType: 'governance_policy',
      resourceId: policy.id,
      metadata: { name: policy.name },
    });

    return policy;
  }

  async listPolicies(projectId: string) {
    return this.prisma.governancePolicy.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(
    organizationId: string,
    projectId: string,
    policyId: string,
    userId: string,
    dto: UpdatePolicyStatusDto,
  ) {
    const policy = await this.prisma.governancePolicy.findFirst({ where: { id: policyId, projectId } });
    if (!policy) throw new NotFoundException('Policy not found');

    const updated = await this.prisma.governancePolicy.update({
      where: { id: policyId },
      data: { status: dto.status },
    });

    await this.audit.record({
      organizationId,
      actorType: 'user',
      actorId: userId,
      action: 'governance_policy.status_changed',
      resourceType: 'governance_policy',
      resourceId: policyId,
      metadata: { from: policy.status, to: dto.status },
    });

    return updated;
  }

  /**
   * Called by the customer's agent runtime before executing a tool.
   * Fail-closed semantics: an explicit block always wins; an allow-list, if
   * configured, is exclusive (anything not on it is denied); parameter
   * limits are hard denies, not warnings. Every call is audited regardless
   * of outcome — this endpoint IS the audit trail for tool execution, not
   * just a yes/no API.
   */
  async checkTool(
    organizationId: string,
    projectId: string,
    apiKeyId: string,
    dto: PolicyCheckDto,
  ): Promise<{ outcome: PolicyCheckOutcome; reason: string; policyId?: string; approvalId?: string }> {
    const policies = await this.prisma.governancePolicy.findMany({
      where: { projectId, status: 'ACTIVE' },
    });

    const applicable = policies.filter(
      (p) =>
        p.restrictedEnvironments.length === 0 ||
        !dto.environment ||
        p.restrictedEnvironments.includes(dto.environment),
    );

    let outcome: PolicyCheckOutcome = 'ALLOWED';
    let reason = 'No policy restricted this tool call.';
    let matchedPolicyId: string | undefined;

    if (isPromptInjection(dto.parameters)) {
      outcome = 'DENIED';
      reason = 'Security Policy Guardrail: Prompt Injection or malicious query pattern detected in tool execution parameters.';
      await this.audit.record({
        organizationId,
        projectId,
        actorType: 'api_key',
        actorId: apiKeyId,
        action: 'tool_call.security_alert',
        resourceType: 'tool',
        resourceId: dto.toolName,
        metadata: { outcome, reason, securityAlert: 'PROMPT_INJECTION_ATTEMPT' },
      });
      return { outcome, reason };
    }

    for (const policy of applicable) {
      if (policy.blockedTools.includes(dto.toolName)) {
        outcome = 'DENIED';
        reason = `Tool "${dto.toolName}" is explicitly blocked by policy "${policy.name}".`;
        matchedPolicyId = policy.id;
        break; // a block is decisive — no need to check further policies
      }

      if (policy.allowedTools.length > 0 && !policy.allowedTools.includes(dto.toolName)) {
        outcome = 'DENIED';
        reason = `Policy "${policy.name}" only allows specific tools, and "${dto.toolName}" is not one of them.`;
        matchedPolicyId = policy.id;
        break;
      }

      const paramLimits = (policy.maxParameterValues as Record<string, Record<string, number>> | null)?.[
        dto.toolName
      ];
      if (paramLimits && dto.parameters) {
        for (const [param, max] of Object.entries(paramLimits)) {
          const value = dto.parameters[param];
          if (typeof value === 'number' && value > max) {
            outcome = 'DENIED';
            reason = `Parameter "${param}" (${value}) exceeds the limit of ${max} set by policy "${policy.name}".`;
            matchedPolicyId = policy.id;
          }
        }
        if (outcome === 'DENIED') break;
      }

      if (policy.requireApprovalTools.includes(dto.toolName) && outcome === 'ALLOWED') {
        outcome = 'REQUIRES_APPROVAL';
        reason = `Tool "${dto.toolName}" requires approval under policy "${policy.name}".`;
        matchedPolicyId = policy.id;
        // don't break — a later policy could still explicitly block it,
        // and a block should win over a mere approval requirement
      }
    }

    let approvalId: string | undefined;
    if (outcome === 'REQUIRES_APPROVAL') {
      const approval = await this.prisma.pendingApproval.create({
        data: {
          organizationId,
          projectId,
          toolName: dto.toolName,
          environment: dto.environment || 'production',
          parameters: dto.parameters as any,
          status: 'PENDING',
          reason,
        },
      });
      approvalId = approval.id;

      this.notificationService.dispatchHitlApprovalNotification({
        approvalId: approval.id,
        projectId,
        toolName: dto.toolName,
        environment: dto.environment || 'production',
        parameters: (dto.parameters as Record<string, unknown>) || {},
        reason,
      });
    }

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'api_key',
      actorId: apiKeyId,
      action: 'tool_call.checked',
      resourceType: 'tool',
      resourceId: dto.toolName,
      metadata: { outcome, reason, environment: dto.environment, policyId: matchedPolicyId, approvalId },
    });

    return { outcome, reason, policyId: matchedPolicyId, approvalId };
  }

  async listApprovals(projectId: string) {
    return this.prisma.pendingApproval.findMany({
      where: { projectId },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });
  }

  async resolveApproval(
    organizationId: string,
    projectId: string,
    approvalId: string,
    userId: string,
    action: 'APPROVE' | 'REJECT',
  ) {
    const approval = await this.prisma.pendingApproval.findFirst({
      where: { id: approvalId, projectId },
    });
    if (!approval) throw new NotFoundException('Approval request not found');

    const updated = await this.prisma.pendingApproval.update({
      where: { id: approvalId },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: `approval.${action.toLowerCase()}`,
      resourceType: 'pending_approval',
      resourceId: approvalId,
      metadata: { toolName: approval.toolName, status: updated.status },
    });

    return updated;
  }

  async getApprovalStatus(approvalId: string) {
    const approval = await this.prisma.pendingApproval.findUnique({
      where: { id: approvalId },
    });
    if (!approval) throw new NotFoundException('Approval request not found');
    return { id: approval.id, status: approval.status, resolvedAt: approval.resolvedAt };
  }
}
