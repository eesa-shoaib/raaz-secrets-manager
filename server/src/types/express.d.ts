import type { PublicUser } from '@raaz/shared-schemas';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        isPlatformAdmin: boolean;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
      projectRole?: 'projectAdmin' | 'developer' | 'auditor';
      projectId?: string;
    }
  }
}

export {};