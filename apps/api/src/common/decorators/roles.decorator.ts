import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export const MIN_ROLE_KEY = 'minRole';

/**
 * @MinRole('ADMIN') on a controller method means: the caller's role in the
 * organization being acted on must be ADMIN or OWNER. Must be used alongside
 * TenantGuard, which is what actually resolves "the caller's role in the
 * organization being acted on".
 */
export const MinRole = (role: OrgRole) => SetMetadata(MIN_ROLE_KEY, role);
