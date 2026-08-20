import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyContext } from './api-key.guard';

export const CurrentApiKeyContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.apiKeyContext;
  },
);
