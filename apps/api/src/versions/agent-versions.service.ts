import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateAgentVersionDto, UpdateVersionStatusDto } from './dto/versions.dto';

@Injectable()
export class AgentVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, projectId: string, userId: string, dto: CreateAgentVersionDto) {
    const existing = await this.prisma.agentVersion.findUnique({
      where: { projectId_agentId_version: { projectId, agentId: dto.agentId, version: dto.version } },
    });
    if (existing) {
      throw new ConflictException('This agent already has a version with that identifier');
    }

    const created = await this.prisma.agentVersion.create({
      data: {
        organizationId,
        projectId,
        agentId: dto.agentId,
        version: dto.version,
        description: dto.description,
        metadata: dto.metadata as any,
        status: 'CANDIDATE',
        createdBy: userId,
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'agent_version.created',
      resourceType: 'agent_version',
      resourceId: created.id,
      metadata: { agentId: created.agentId, version: created.version },
    });

    return created;
  }

  async list(projectId: string, agentId?: string) {
    return this.prisma.agentVersion.findMany({
      where: { projectId, ...(agentId ? { agentId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    organizationId: string,
    projectId: string,
    versionId: string,
    userId: string,
    dto: UpdateVersionStatusDto,
  ) {
    const version = await this.prisma.agentVersion.findFirst({ where: { id: versionId, projectId } });
    if (!version) throw new NotFoundException('Agent version not found');

    const updated = await this.prisma.agentVersion.update({
      where: { id: versionId },
      data: { status: dto.status },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'agent_version.status_changed',
      resourceType: 'agent_version',
      resourceId: versionId,
      metadata: { from: version.status, to: dto.status },
    });

    return updated;
  }
}
