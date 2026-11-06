import type { Request, Response } from 'express';
import { listUsers, updateUser } from '../services/admin.service.js';

export async function listUsersController(req: Request, res: Response): Promise<void> {
    res.json(await listUsers(Number(req.query.page ?? 1), Number(req.query.limit ?? 20)));
}
export async function updateUserController(req: Request, res: Response): Promise<void> {
    res.json(await updateUser(req.user!.id, req.params.userId, req.body));
}
