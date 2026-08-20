import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateOrganizationDto, slugify } from './dto/create-organization.dto';
import { v4 as uuid } from 'uuid';
import { BillingService } from '../billing/billing.service';
import { OrgRole } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const baseSlug = slugify(dto.name) || 'org';
    const slug = `${baseSlug}-${uuid().slice(0, 6)}`;

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: { name: dto.name, slug },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId,
          role: 'OWNER',
        },
      });

      return created;
    });

    await this.audit.record({
      organizationId: org.id,
      actorType: 'user',
      actorId: userId,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: org.id,
      metadata: { name: org.name },
    });

    return org;
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });

    return memberships.map((m) => ({
      ...m.organization,
      myRole: m.role,
    }));
  }

  async getMembersIfAuthorized(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  /**
   * Invite an existing user by email — no email-delivery/signup-link flow
   * yet (that's Pilot-phase UI polish, not a data-model gap), so the person
   * being invited must already have an account. Quota-checked so a Free-
   * plan org can't silently exceed its seat limit.
   */
  async addMember(organizationId: string, inviterUserId: string, email: string, role: OrgRole) {
    const quotaExceeded = await this.billing.isTeamMemberQuotaExceeded(organizationId);
    if (quotaExceeded) {
      throw new HttpException(
        "This organization's plan has reached its team member limit. Remove a member or upgrade your plan.",
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new NotFoundException(
        'No account exists with that email yet — they need to sign up before you can add them.',
      );
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existing) throw new ConflictException('This person is already a member of this organization.');

    const member = await this.prisma.organizationMember.create({
      data: { organizationId, userId: user.id, role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    await this.audit.record({
      organizationId,
      actorType: 'user',
      actorId: inviterUserId,
      action: 'organization_member.added',
      resourceType: 'organization_member',
      resourceId: member.id,
      metadata: { addedUserId: user.id, role },
    });

    return member;
  }

  async removeMember(organizationId: string, removerUserId: string, targetUserId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!membership) throw new NotFoundException('This person is not a member of this organization.');

    if (membership.role === 'OWNER') {
      const ownerCount = await this.prisma.organizationMember.count({ where: { organizationId, role: 'OWNER' } });
      if (ownerCount <= 1) {
        throw new ForbiddenException('Cannot remove the last Owner — transfer ownership first.');
      }
    }

    await this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });

    await this.audit.record({
      organizationId,
      actorType: 'user',
      actorId: removerUserId,
      action: 'organization_member.removed',
      resourceType: 'organization_member',
      resourceId: membership.id,
      metadata: { removedUserId: targetUserId },
    });

    return { removed: true };
  }
}
