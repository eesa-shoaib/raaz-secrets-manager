import { avatarContentTypeEnum, avatarUploadInputSchema } from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import {
    getAuthorizedAvatar,
    removeAvatar,
    uploadAvatar,
    updateProfile,
} from '../services/profile.service.js';
import { AppError } from '../utils/app-error.js';

export async function updateProfileController(req: Request, res: Response): Promise<void> {
    const user = await updateProfile(req.user!.id, req.body.username);
    res.json(user);
}

export async function uploadAvatarController(req: Request, res: Response): Promise<void> {
    if (Buffer.isBuffer(req.body)) {
        const headerType = req.get('content-type')?.split(';')[0]?.trim().toLowerCase();
        const parsedType = avatarContentTypeEnum.safeParse(headerType);
        if (!parsedType.success) {
            throw new AppError(
                422,
                'VALIDATION_ERROR',
                'Unsupported avatar content type; use image/png, image/jpeg, or image/webp',
            );
        }
        const user = await uploadAvatar(req.user!.id, req.body, parsedType.data);
        res.json(user);
        return;
    }

    const parsedBody = avatarUploadInputSchema.safeParse(req.body);
    if (!parsedBody.success) {
        throw new AppError(
            422,
            'VALIDATION_ERROR',
            parsedBody.error.issues[0]?.message ?? 'Invalid avatar upload payload',
        );
    }

    const rawBytes = decodeStrictBase64(parsedBody.data.data);
    const user = await uploadAvatar(req.user!.id, rawBytes, parsedBody.data.contentType);
    res.json(user);
}

export async function removeAvatarController(req: Request, res: Response): Promise<void> {
    const user = await removeAvatar(req.user!.id);
    res.json(user);
}

export async function getUserAvatarController(req: Request, res: Response): Promise<void> {
    const avatar = await getAuthorizedAvatar(
        req.user!.id,
        req.user!.isPlatformAdmin,
        req.params.userId,
    );

    res.setHeader('Content-Type', avatar.contentType);
    res.setHeader('Content-Length', String(avatar.byteLength));
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.status(200).send(avatar.data);
}

function decodeStrictBase64(input: string): Buffer {
    const stripped = input.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(stripped) || stripped.length % 4 !== 0) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Avatar data must be valid base64');
    }
    const buf = Buffer.from(stripped, 'base64');
    if (buf.byteLength === 0) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Avatar data cannot be empty');
    }
    return buf;
}
