import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateAlertRuleDto, UpdateAlertEventStatusDto, UpdateAlertRuleStatusDto } from './dto/alerts.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createRule(organizationId: string, projectId: string, userId: string, dto: CreateAlertRuleDto) {
    const existing = await this.prisma.alertRule.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException('An alert rule with this name already exists in this project');

    const rule = await this.prisma.alertRule.create({
      data: {
        organizationId,
        projectId,
        name: dto.name,
        metric: dto.metric,
        comparator: dto.comparator,
        threshold: dto.threshold,
        windowMinutes: dto.windowMinutes ?? 15,
        cooldownMinutes: dto.cooldownMinutes ?? 30,
        notifyEmails: dto.notifyEmails ?? [],
        status: 'ACTIVE',
        createdBy: userId,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'alert_rule.created',
      resourceType: 'alert_rule',
      resourceId: rule.id,
      metadata: { name: rule.name, metric: rule.metric },
    });

    return rule;
  }

  async listRules(projectId: string) {
    return this.prisma.alertRule.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  async updateRuleStatus(
    organizationId: string,
    projectId: string,
    ruleId: string,
    userId: string,
    dto: UpdateAlertRuleStatusDto,
  ) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id: ruleId, projectId } });
    if (!rule) throw new NotFoundException('Alert rule not found');

    const updated = await this.prisma.alertRule.update({ where: { id: ruleId }, data: { status: dto.status } });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'alert_rule.status_changed',
      resourceType: 'alert_rule',
      resourceId: ruleId,
      metadata: { from: rule.status, to: dto.status },
    });

    return updated;
  }

  async listEvents(projectId: string, status?: string) {
    return this.prisma.alertEvent.findMany({
      where: { projectId, ...(status ? { status: status as any } : {}) },
      orderBy: { triggeredAt: 'desc' },
      include: { rule: { select: { name: true, metric: true } } },
    });
  }

  async updateEventStatus(
    organizationId: string,
    projectId: string,
    eventId: string,
    userId: string,
    dto: UpdateAlertEventStatusDto,
  ) {
    const event = await this.prisma.alertEvent.findFirst({ where: { id: eventId, projectId } });
    if (!event) throw new NotFoundException('Alert event not found');

    const updated = await this.prisma.alertEvent.update({
      where: { id: eventId },
      data: {
        status: dto.status,
        resolvedAt: dto.status === 'RESOLVED' ? new Date() : undefined,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'alert_event.status_changed',
      resourceType: 'alert_event',
      resourceId: eventId,
      metadata: { from: event.status, to: dto.status },
    });

    return updated;
  }
}
