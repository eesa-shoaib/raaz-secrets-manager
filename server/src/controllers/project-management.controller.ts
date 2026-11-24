import {
    adminProjectResponseSchema,
    createCursorPaginatedResponseSchema,
    type adminProjectsQuerySchema,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import {
    deleteProject,
    listAdminProjects,
    setProjectStatus,
} from '../services/project-management.service.js';
const page = createCursorPaginatedResponseSchema(adminProjectResponseSchema);
export async function listAdminProjectsController(req: Request, res: Response) {
    res.json(
        page.parse(
            await listAdminProjects(
                req.query as unknown as z.infer<typeof adminProjectsQuerySchema>,
            ),
        ),
    );
}
export async function setProjectStatusController(req: Request, res: Response) {
    await setProjectStatus(req.user!.id, req.params.projectId, req.body.status);
    res.sendStatus(204);
}
export async function deleteProjectController(req: Request, res: Response) {
    await deleteProject(req.user!.id, req.params.projectId, req.body.confirmName);
    res.sendStatus(204);
}
