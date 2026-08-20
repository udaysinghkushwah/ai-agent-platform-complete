import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership, RequestMembership } from '../common/decorators/membership.decorator';
import { MinRole } from '../common/decorators/roles.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('projects/:projectId/api-keys')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @MinRole('ADMIN')
  async create(
    @Param('projectId') projectId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeys.create(membership.organizationId, projectId, user.id, dto);
  }

  @Get()
  @MinRole('DEVELOPER')
  async list(@Param('projectId') projectId: string) {
    return this.apiKeys.listForProject(projectId);
  }

  @Delete(':keyId')
  @MinRole('ADMIN')
  async revoke(
    @Param('projectId') projectId: string,
    @Param('keyId') keyId: string,
    @CurrentMembership() membership: RequestMembership,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.apiKeys.revoke(membership.organizationId, projectId, keyId, user.id);
  }
}
