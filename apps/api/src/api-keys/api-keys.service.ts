import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const BCRYPT_ROUNDS = 10; // lower than password hashing — keys are high-entropy already
const PREFIX_LENGTH = 12;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: CreateApiKeyDto,
  ) {
    const rawKey = `aap_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, PREFIX_LENGTH);
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

    const created = await this.prisma.apiKey.create({
      data: {
        projectId,
        name: dto.name ?? 'default',
        keyPrefix,
        keyHash,
        scopes: dto.scopes ?? [],
      },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'api_key.created',
      resourceType: 'api_key',
      resourceId: created.id,
      metadata: { projectId, keyPrefix },
    });

    return {
      id: created.id,
      name: created.name,
      keyPrefix,
      scopes: created.scopes,
      createdAt: created.createdAt,
      // Raw key is returned exactly once. Nothing about it is stored
      // anywhere — only the bcrypt hash and the prefix persist.
      key: rawKey,
    };
  }

  async listForProject(projectId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    // Never return keyHash to a client, ever.
    return keys.map(({ keyHash, ...safe }) => safe);
  }

  async revoke(organizationId: string, projectId: string, keyId: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, projectId },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    if (key.revokedAt) {
      return key;
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'api_key.revoked',
      resourceType: 'api_key',
      resourceId: keyId,
      metadata: { projectId },
    });

    const { keyHash, ...safe } = updated;
    return safe;
  }

  /**
   * Used by the ingestion module (MVP-1) to authenticate SDK traffic.
   * Looks up candidates by prefix (indexed, cheap) then bcrypt-compares —
   * never does a full-table hash comparison.
   */
  async verifyRawKey(rawKey: string) {
    const prefix = rawKey.slice(0, PREFIX_LENGTH);
    const candidates = await this.prisma.apiKey.findMany({
      where: { keyPrefix: prefix, revokedAt: null },
    });

    for (const candidate of candidates) {
      const matches = await bcrypt.compare(rawKey, candidate.keyHash);
      if (matches) {
        if (candidate.expiresAt && candidate.expiresAt < new Date()) {
          throw new ForbiddenException('API key expired');
        }
        return candidate;
      }
    }

    throw new ForbiddenException('Invalid API key');
  }
}
