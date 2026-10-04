import type { Request, Response, NextFunction } from 'express';
import { ProjectModel } from '../models/Project.js';

export async function requireProjectStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  const projectId = req.params.projectId;
  const project = await ProjectModel.findById(projectId).select('status').lean();
  if (project?.status === 'archived') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Project is archived' } });
    return;
  }
  next();
}