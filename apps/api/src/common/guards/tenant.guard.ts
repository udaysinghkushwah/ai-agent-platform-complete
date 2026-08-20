import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { MIN_ROLE_KEY } from '../decorators/roles.decorator';
import { meetsMinimumRole } from '../roles';
import { OrgRole } from '@prisma/client';

/**
 * SECURITY-CRITICAL: this is the single choke point that enforces tenant
 * isolation. It resolves "which organization is this request acting on"
 * ONLY from the URL (:orgId or :projectId), never from the request body —
 * a client cannot claim a different tenant by putting a different
 * organizationId in the payload.
 *
 * Must run AFTER JwtAuthGuard (needs req.user already populated).
 * Attaches `req.membership = { organizationId, role }` for downstream use.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const organizationId = await this.resolveOrganizationId(request);
    if (!organizationId) {
      throw new NotFoundException('Organization or project not found');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    if (!membership) {
      // Deliberately the same error whether the org doesn't exist or the
      // user just isn't a member of it — don't leak existence of tenants
      // the caller has no access to.
      throw new NotFoundException('Organization or project not found');
    }

    const minRole = this.reflector.get<OrgRole | undefined>(
      MIN_ROLE_KEY,
      context.getHandler(),
    );
    if (minRole && !meetsMinimumRole(membership.role, minRole)) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    request.membership = { organizationId, role: membership.role };
    return true;
  }

  private async resolveOrganizationId(request: any): Promise<string | null> {
    const params = request.params ?? {};

    if (params.orgId) {
      return params.orgId;
    }

    if (params.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: params.projectId },
        select: { organizationId: true },
      });
      return project?.organizationId ?? null;
    }

    return null;
  }
}
