import {
    githubImportResponseSchema,
    githubInstallationsResponseSchema,
    githubRepositoriesResponseSchema,
    githubStatusSchema,
    oauthStartResponseSchema,
    projectResponseSchema,
    type GitHubImportInput,
    type GitHubRepositoriesQuery,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import { getClientOrigin } from '../config/index.js';
import {
    completeGitHubConnection,
    disconnectGitHub,
    githubStatus,
    startGitHubConnection,
} from '../services/github-connection.service.js';
import {
    githubInstallations,
    githubRepositories,
    importGitHubRepository,
} from '../services/github-import.service.js';
import { AppError } from '../utils/app-error.js';

export async function githubStatusController(req: Request, res: Response) {
    res.json(githubStatusSchema.parse(await githubStatus(req.user!.id)));
}
export async function githubStartController(req: Request, res: Response) {
    res.json(
        oauthStartResponseSchema.parse(
            await startGitHubConnection(req.user!.id, req.cookies.token, req.body.returnTo),
        ),
    );
}
export async function githubDisconnectController(req: Request, res: Response) {
    await disconnectGitHub(req.user!.id);
    res.sendStatus(204);
}
export async function githubInstallationsController(req: Request, res: Response) {
    res.json(
        githubInstallationsResponseSchema.parse(
            await githubInstallations(
                req.user!.id,
                Number(req.query.page),
                Number(req.query.limit),
            ),
        ),
    );
}
export async function githubRepositoriesController(req: Request, res: Response) {
    res.json(
        githubRepositoriesResponseSchema.parse(
            await githubRepositories(req.user!.id, req.query as unknown as GitHubRepositoriesQuery),
        ),
    );
}
export async function githubImportController(req: Request, res: Response) {
    const result = await importGitHubRepository(req.user!.id, req.body as GitHubImportInput);
    const project = projectResponseSchema.parse({
        ...result.project,
        id: result.project._id.toString(),
        createdBy: result.project.createdBy.toString(),
        role: result.project.role ?? 'projectAdmin',
    });
    res.status(result.created ? 201 : 200).json(
        githubImportResponseSchema.parse({ ...result, project }),
    );
}
export async function githubCallbackController(req: Request, res: Response) {
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
        const returnTo = await completeGitHubConnection(
            req.user!.id,
            req.cookies.token,
            String(req.query.state),
            req.originalUrl.split('?').slice(1).join('?'),
        );
        res.redirect(
            303,
            `${getClientOrigin()}/${returnTo === 'settings' ? 'settings' : 'projects'}?github=connected`,
        );
    } catch (error) {
        if (error instanceof AppError && error.status >= 500) throw error;
        res.redirect(303, `${getClientOrigin()}/settings?github=failed`);
    }
}
