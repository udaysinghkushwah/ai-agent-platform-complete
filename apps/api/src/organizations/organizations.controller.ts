import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgs.create(user.id, dto);
  }

  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.orgs.listForUser(user.id);
  }

  // :orgId param is what makes TenantGuard resolve and enforce membership.
  @Get(':orgId/members')
  @UseGuards(TenantGuard)
  @MinRole('ADMIN')
  async listMembers(@Param('orgId') orgId: string) {
    return this.orgs.getMembersIfAuthorized(orgId);
  }

  @Post(':orgId/members')
  @UseGuards(TenantGuard)
  @MinRole('ADMIN')
  async addMember(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.orgs.addMember(orgId, user.id, dto.email, dto.role);
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(TenantGuard)
  @MinRole('ADMIN')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.orgs.removeMember(orgId, user.id, targetUserId);
  }
}
