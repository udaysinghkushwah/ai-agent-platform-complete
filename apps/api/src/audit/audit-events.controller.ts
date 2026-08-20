import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { MinRole } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('organizations/:orgId/audit-events')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AuditEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('export')
  @MinRole('ADMIN')
  async exportAuditLog(
    @Param('orgId') orgId: string,
    @Query('format') format: string = 'csv',
    @Res() res: Response,
  ) {
    const events = await this.prisma.auditEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit_log_${orgId}.json"`);
      return res.send(JSON.stringify({ organizationId: orgId, exportedAt: new Date().toISOString(), events }, null, 2));
    }

    const headers = ['ID', 'Timestamp', 'Actor Type', 'Actor ID', 'Action', 'Resource Type', 'Resource ID', 'Project ID'];
    const rows = events.map((e) => [
      e.id,
      e.createdAt.toISOString(),
      e.actorType,
      e.actorId,
      e.action,
      e.resourceType,
      e.resourceId || '',
      e.projectId || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="soc2_audit_log_${orgId}.csv"`);
    return res.send(csvContent);
  }

  // Audit events are one of the more sensitive reads in the platform
  // (they show every allow/block decision and every credential change) —
  // Admin/Owner only, not the general Viewer floor the rest of the read
  // endpoints use.
  @Get()
  @MinRole('ADMIN')
  async list(
    @Param('orgId') orgId: string,
    @Query('cursor') cursor?: string,
    @Query('resourceType') resourceType?: string,
    @Query('projectId') projectId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);

    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId: orgId,
        ...(resourceType ? { resourceType } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = events.length > limit;
    const page = hasMore ? events.slice(0, limit) : events;

    return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
  }
}
