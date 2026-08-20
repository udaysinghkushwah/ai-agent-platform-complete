import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreatePromptDto, CreatePromptVersionDto, UpdateVersionStatusDto } from './dto/versions.dto';

@Injectable()
export class PromptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, projectId: string, userId: string, dto: CreatePromptDto) {
    const existing = await this.prisma.prompt.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) throw new ConflictException('A prompt with this name already exists in this project');

    const prompt = await this.prisma.prompt.create({ data: { organizationId, projectId, name: dto.name } });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'prompt.created',
      resourceType: 'prompt',
      resourceId: prompt.id,
      metadata: { name: prompt.name },
    });

    return prompt;
  }

  async list(projectId: string) {
    return this.prisma.prompt.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
  }

  private async getPromptOrThrow(projectId: string, promptId: string) {
    const prompt = await this.prisma.prompt.findFirst({ where: { id: promptId, projectId } });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return prompt;
  }

  async createVersion(
    organizationId: string,
    projectId: string,
    promptId: string,
    userId: string,
    dto: CreatePromptVersionDto,
  ) {
    await this.getPromptOrThrow(projectId, promptId);

    // Versions are immutable and monotonically numbered per prompt. A
    // transaction here prevents two concurrent "create version" calls from
    // computing the same next-version number.
    const version = await this.prisma.$transaction(async (tx) => {
      const last = await tx.promptVersion.findFirst({
        where: { promptId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      return tx.promptVersion.create({
        data: {
          promptId,
          version: nextVersion,
          content: dto.content,
          metadata: dto.metadata as any,
          status: 'CANDIDATE',
          createdBy: userId,
        },
      });
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'prompt_version.created',
      resourceType: 'prompt_version',
      resourceId: version.id,
      metadata: { promptId, version: version.version },
    });

    return version;
  }

  async listVersions(projectId: string, promptId: string) {
    await this.getPromptOrThrow(projectId, promptId);
    return this.prisma.promptVersion.findMany({ where: { promptId }, orderBy: { version: 'desc' } });
  }

  async updateVersionStatus(
    organizationId: string,
    projectId: string,
    promptId: string,
    versionId: string,
    userId: string,
    dto: UpdateVersionStatusDto,
  ) {
    await this.getPromptOrThrow(projectId, promptId);
    const version = await this.prisma.promptVersion.findFirst({ where: { id: versionId, promptId } });
    if (!version) throw new NotFoundException('Prompt version not found');

    const updated = await this.prisma.promptVersion.update({
      where: { id: versionId },
      data: { status: dto.status },
    });

    await this.audit.record({
      organizationId,
      projectId,
      actorType: 'user',
      actorId: userId,
      action: 'prompt_version.status_changed',
      resourceType: 'prompt_version',
      resourceId: versionId,
      metadata: { from: version.status, to: dto.status },
    });

    return updated;
  }

  async executeSandbox(
    projectId: string,
    dto: {
      prompt: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      variables?: Record<string, string>;
    },
  ) {
    let compiledPrompt = dto.prompt;
    if (dto.variables) {
      for (const [key, val] of Object.entries(dto.variables)) {
        compiledPrompt = compiledPrompt.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val);
      }
    }

    const startMs = Date.now();
    const model = dto.model || 'gpt-4o';

    const hasInjection = /ignore\s+previous\s+instructions|system\s+prompt\s+override|drop\s+table/i.test(compiledPrompt);

    const inputTokens = Math.max(12, Math.ceil(compiledPrompt.length / 4));
    const outputTokens = hasInjection ? 25 : Math.floor(Math.random() * 80) + 40;
    const costPerToken = model.includes('claude') ? 0.000015 : 0.000005;
    const estimatedCost = (inputTokens + outputTokens) * costPerToken;

    let outputText = '';
    if (hasInjection) {
      outputText = '[SECURITY GUARDRAIL BLOCK]: Prompt execution terminated due to detected prompt injection or unsafe pattern.';
    } else {
      outputText = `Mock AI response from ${model}:\n\n` +
        `Processed prompt request with parameters. ` +
        `The agent workflow output is ready and grounded in context.`;
    }

    const durationMs = Date.now() - startMs + Math.floor(Math.random() * 150) + 120;

    return {
      compiledPrompt,
      systemPrompt: dto.systemPrompt || 'You are a helpful AI assistant.',
      model,
      outputText,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUSD: Number(estimatedCost.toFixed(6)),
      durationMs,
      safetyStatus: hasInjection ? 'BLOCKED' : 'PASSED',
    };
  }
}
