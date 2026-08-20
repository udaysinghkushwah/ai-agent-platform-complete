import { IsEmail, IsIn } from 'class-validator';

export const INVITABLE_ROLES = ['ADMIN', 'DEVELOPER', 'ANALYST', 'SECURITY_REVIEWER', 'VIEWER'] as const;

export class AddMemberDto {
  @IsEmail()
  email!: string;

  // OWNER excluded deliberately — ownership transfer should be its own
  // explicit, harder-to-misclick action, not a value in a role dropdown.
  @IsIn(INVITABLE_ROLES)
  role!: (typeof INVITABLE_ROLES)[number];
}
