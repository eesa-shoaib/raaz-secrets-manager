declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                username?: string | null;
                hasAvatar?: boolean;
                avatarUpdatedAt?: Date | null;
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
