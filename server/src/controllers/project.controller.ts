import { projectResponseSchema } from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import { createProject, getProject, listProjectsForUser, type ProjectView } from '../services/projects.service.js';

function response(project: ProjectView, role?: Request['projectRole']) {
  return projectResponseSchema.parse({
    id: project._id.toString(), name: project.name, environments: project.environments, status: project.status,
    createdBy: project.createdBy.toString(), createdAt: project.createdAt, updatedAt: project.updatedAt, role: role ?? project.role,
  });
}
export async function listProjectsController(req: Request, res: Response) { res.json((await listProjectsForUser(req.user!.id)).map((project) => response(project))); }
export async function createProjectController(req: Request, res: Response) { res.status(201).json(response(await createProject(req.user!.id, req.body.name), 'projectAdmin')); }
export async function getProjectController(req: Request, res: Response) { res.json(response(await getProject(req.params.projectId), req.projectRole)); }
