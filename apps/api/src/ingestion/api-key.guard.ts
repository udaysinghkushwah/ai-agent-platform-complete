import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';

export interface ApiKeyContext {
  apiKeyId: string;
  projectId: string;
  organizationId: string;
}

/**
 * Authenticates SDK/ingestion traffic via `Authorization: Bearer <api key>`.
 * Deliberately separate from JwtAuthGuard — human sessions and machine
 * credentials should never share a code path, so a bug in one can't
 * accidentally widen the other.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }
    const rawKey = header.slice('Bearer '.length).trim();

    const apiKey = await this.apiKeys.verifyRawKey(rawKey);

    const project = await this.prisma.project.findUnique({
      where: { id: apiKey.projectId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!project || project.status !== 'active') {
      throw new UnauthorizedException('Project is not active');
    }

    const ctx: ApiKeyContext = {
      apiKeyId: apiKey.id,
      projectId: project.id,
      organizationId: project.organizationId,
    };
    request.apiKeyContext = ctx;
    return true;
  }
}
