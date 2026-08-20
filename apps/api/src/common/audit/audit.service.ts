import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ActorType = 'user' | 'api_key' | 'system';

interface RecordAuditEventInput {
  organizationId: string;
  projectId?: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Every sensitive mutation in the platform should call this. Kept
 * deliberately dumb (single insert, no queue) for MVP-0 — once ingestion
 * volume matters this can move to async writes without changing callers.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: (input.metadata as any) ?? {},
      },
    });
  }
}
