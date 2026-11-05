import type { Request, Response, NextFunction } from 'express';
import { getProjectStatus } from '../services/projects.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export const requireProjectStatus = asyncHandler(async function requireProjectStatus(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const projectId = req.params.projectId;
    const project = await getProjectStatus(projectId);
    if (!project) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
        return;
    }
    if (project?.status === 'archived') {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Project is archived' } });
        return;
    }
    next();
});
