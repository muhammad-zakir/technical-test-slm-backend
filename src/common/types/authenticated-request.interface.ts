import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
