import {
    createCursorPaginatedResponseSchema,
    projectResponseSchema,
    type ProjectsListQuery,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import {
    createProject,
    getProject,
    listProjectsCursor,
    listProjectsForUser,
    updateProjectDetails,
    type ProjectView,
} from '../services/projects.service.js';

const paginatedProjectsSchema = createCursorPaginatedResponseSchema(projectResponseSchema);

function response(project: ProjectView, role?: Request['projectRole']) {
    return projectResponseSchema.parse({
        id: project._id.toString(),
        name: project.name,
        description: project.description ?? '',
        environments: project.environments,
        status: project.status,
        createdBy: project.createdBy.toString(),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        role: role ?? project.role,
        memberCount: project.memberCount,
    });
}
export async function listProjectsController(req: Request, res: Response) {
    const query = req.query as unknown as ProjectsListQuery;
    if (query.cursor !== undefined || query.mode === 'cursor') {
        const result = await listProjectsCursor(req.user!.id, {
            cursor: query.cursor,
            limit: query.limit,
            search: query.search,
        });
        res.json(
            paginatedProjectsSchema.parse({
                data: result.data.map((project) => response(project)),
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                limit: result.limit,
            }),
        );
        return;
    }
    res.json(
        (await listProjectsForUser(req.user!.id, query.search)).map((project) =>
            response(project),
        ),
    );
}
export async function createProjectController(req: Request, res: Response) {
    res.status(201).json(
        response(
            await createProject(req.user!.id, req.body.name, req.body.description),
            'projectAdmin',
        ),
    );
}
export async function getProjectController(req: Request, res: Response) {
    res.json(response(await getProject(req.params.projectId), req.projectRole));
}
export async function updateProjectController(req: Request, res: Response) {
    res.json(
        response(
            await updateProjectDetails(req.params.projectId, req.user!.id, req.body),
            req.projectRole,
        ),
    );
}
