import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export interface RequestMembership {
  organizationId: string;
  role: OrgRole;
}

// Populated by TenantGuard. Only meaningful on routes that use TenantGuard.
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestMembership => {
    const request = ctx.switchToHttp().getRequest();
    return request.membership;
  },
);
