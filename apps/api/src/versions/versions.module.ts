import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { AgentVersionsController } from './agent-versions.controller';
import { AgentVersionsService } from './agent-versions.service';

@Module({
  controllers: [PromptsController, AgentVersionsController],
  providers: [PromptsService, AgentVersionsService],
})
export class VersionsModule {}
