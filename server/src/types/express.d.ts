declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                hasPassword?: boolean;
                oauthProvider?: 'google' | 'github' | null;
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
