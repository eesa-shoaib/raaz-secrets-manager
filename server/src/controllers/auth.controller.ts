import { publicUserSchema } from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import { clearAuthCookie, login, setAuthCookie, signup } from '../services/auth.service.js';

export async function signupController(req: Request, res: Response): Promise<void> {
    const user = await signup(req.body.email, req.body.password);
    res.status(201).json(toPublicUser(user));
}

export async function loginController(req: Request, res: Response): Promise<void> {
    const result = await login(req.body.email, req.body.password);
    if (!result) {
        res.status(401).json({
            error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
        });
        return;
    }

    setAuthCookie(res, result.token);
    res.json(toPublicUser(result.user));
}

export function logoutController(_req: Request, res: Response): void {
    clearAuthCookie(res);
    res.status(204).send();
}

export function currentUserController(req: Request, res: Response): void {
    res.json(publicUserSchema.parse(req.user));
}

function toPublicUser(user: {
    _id?: { toString(): string };
    id?: string;
    email: string;
    isPlatformAdmin: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}) {
    return publicUserSchema.parse({
        id: user._id?.toString() ?? user.id,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    });
}
