import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { slugify } from '../organizations/dto/create-organization.dto';
import { v4 as uuid } from 'uuid';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateProjectDto) {
    const baseSlug = slugify(dto.name) || 'project';
    const slug = `${baseSlug}-${uuid().slice(0, 6)}`;

    const project = await this.prisma.project.create({
      data: {
        organizationId,
        name: dto.name,
        slug,
        environment: dto.environment ?? 'production',
      },
    });

    await this.audit.record({
      organizationId,
      projectId: project.id,
      actorType: 'user',
      actorId: userId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
      metadata: { name: project.name, environment: project.environment },
    });

    return project;
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOneForOrganization(organizationId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
  }

  async updatePrivacySettings(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: {
      disableRawPayloadStorage?: boolean;
      sensitiveFieldMasks?: string[];
      retentionDays?: number | null;
    },
  ) {
    if (dto.retentionDays !== undefined && dto.retentionDays !== null) {
      const maxRetentionDays = await this.billing.maxRetentionDaysForOrg(organizationId);
      if (dto.retentionDays > maxRetentionDays) {
        throw new BadRequestException(
          `This organization's plan allows retention up to ${maxRetentionDays} days. Upgrade to set a longer retention period.`,
        );
      }
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        disableRawPayloadStorage: dto.disableRawPayloadStorage,
        sensitiveFieldMasks: dto.sensitiveFieldMasks,
        retentionDays: dto.retentionDays,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'project.privacy_settings_changed',
      resourceType: 'project',
      resourceId: projectId,
      metadata: dto,
    });

    return updated;
  }

  async updateIntegrations(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: {
      webhookUrl?: string | null;
      slackWebhookUrl?: string | null;
    },
  ) {
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        webhookUrl: dto.webhookUrl,
        slackWebhookUrl: dto.slackWebhookUrl,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'project.integrations_updated',
      resourceType: 'project',
      resourceId: projectId,
      metadata: dto,
    });

    return updated;
  }
}
