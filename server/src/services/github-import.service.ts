import {
    secretKeyRegex,
    type GitHubImportInput,
    type GitHubRepositoriesQuery,
} from '@raaz/shared-schemas';
import { parse as parseDotenv } from 'dotenv';
import { z } from 'zod';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { AppError } from '../utils/app-error.js';
import { githubAccessToken } from './github-connection.service.js';
import {
    githubRequest,
    rawInstallationsSchema,
    rawRepositoriesSchema,
    rawRepositorySchema,
} from './github-provider.service.js';
import { createProject, getProject } from './projects.service.js';

function repository(data: z.infer<typeof rawRepositorySchema>) {
    return {
        id: data.id,
        owner: data.owner.login,
        name: data.name,
        description: data.description ?? '',
        private: data.private,
        url: `https://github.com/${data.owner.login}/${data.name}`,
    };
}

export async function githubInstallations(userId: string, page: number, limit: number) {
    const token = await githubAccessToken(userId);
    const result = await githubRequest(
        token,
        `/user/installations?per_page=${limit}&page=${page}`,
        rawInstallationsSchema,
    );
    return {
        data: result.installations.map((item) => ({
            id: item.id,
            account: item.account.login,
            selection: item.repository_selection,
        })),
        page,
        limit,
        total: result.total_count,
    };
}

async function accessibleRepositories(userId: string, installationId: number) {
    const token = await githubAccessToken(userId);
    const all: z.infer<typeof rawRepositorySchema>[] = [];
    for (let page = 1; page <= 20; page++) {
        const result = await githubRequest(
            token,
            `/user/installations/${installationId}/repositories?per_page=100&page=${page}`,
            rawRepositoriesSchema,
        );
        if (result.total_count > 2000)
            throw new AppError(
                422,
                'VALIDATION_ERROR',
                'Limit GitHub App access to 2000 selected repositories or fewer to import',
            );
        all.push(...result.repositories);
        if (result.repositories.length < 100 || all.length >= result.total_count)
            return all.map(repository);
    }
    throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Too many repositories. Narrow GitHub App access and refresh.',
    );
}

export async function githubRepositories(userId: string, query: GitHubRepositoriesQuery) {
    const repositories = await accessibleRepositories(userId, query.installationId);
    const search = query.search.toLowerCase();
    const matches = repositories.filter((repo) =>
        `${repo.owner}/${repo.name} ${repo.description}`.toLowerCase().includes(search),
    );
    matches.sort((a, b) => `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`));
    return {
        data: matches.slice((query.page - 1) * query.limit, query.page * query.limit),
        total: matches.length,
        page: query.page,
        limit: query.limit,
    };
}

async function existingImport(userId: string, repositoryId: number) {
    const project = await ProjectModel.findOne({
        createdBy: userId,
        'githubRepository.id': repositoryId,
    }).lean();
    if (!project) return null;
    const member = await ProjectMembershipModel.findOne({ userId, projectId: project._id }).lean();
    if (!member)
        throw new AppError(
            409,
            'CONFLICT',
            'Unable to import this repository. Contact a project administrator.',
        );
    if (project.status !== 'active')
        throw new AppError(409, 'CONFLICT', 'This project is archived');
    return { ...(await getProject(project._id.toString())), role: member.role };
}

const exampleFileSchema = z.object({
    type: z.literal('file'),
    encoding: z.literal('base64'),
    size: z.number().int().min(0),
    content: z.string().max(1400000),
});

async function exampleKeys(userId: string, owner: string, name: string): Promise<string[]> {
    const token = await githubAccessToken(userId);
    for (const path of ['.env.example', 'env.example']) {
        let file;
        try {
            file = await githubRequest(
                token,
                `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${path}`,
                exampleFileSchema,
            );
        } catch (error) {
            if (error instanceof AppError && error.status === 404) continue;
            if (error instanceof AppError && error.status === 403)
                throw new AppError(
                    403,
                    'FORBIDDEN',
                    'Grant Contents read-only access to the GitHub App, or disable mock secrets',
                );
            throw error;
        }
        if (file.size > 65536 || file.content.length > 90000)
            throw new AppError(422, 'VALIDATION_ERROR', 'Example file exceeds the 64 KiB limit');
        const content = Buffer.from(file.content, 'base64');
        if (content.length > 65536)
            throw new AppError(422, 'VALIDATION_ERROR', 'Example file exceeds the 64 KiB limit');
        const keys = [
            ...new Set(Object.keys(parseDotenv(content)).map((key) => key.toUpperCase())),
        ];
        if (keys.length > 100 || keys.some((key) => !secretKeyRegex.test(key)))
            throw new AppError(
                422,
                'VALIDATION_ERROR',
                'Example file must contain at most 100 valid environment keys',
            );
        return keys;
    }
    return [];
}

export async function importGitHubRepository(userId: string, input: GitHubImportInput) {
    const repositories = await accessibleRepositories(userId, input.installationId);
    const source = repositories.find((repo) => repo.id === input.repositoryId);
    if (!source) throw new AppError(404, 'NOT_FOUND', 'GitHub resource is unavailable');
    const previous = await existingImport(userId, source.id);
    if (previous) return { project: previous, created: false, mockSecretsCreated: 0 };
    const keys = input.seedExampleSecrets
        ? await exampleKeys(userId, source.owner, source.name)
        : [];
    try {
        return {
            project: await createProject(
                userId,
                input.name,
                input.description,
                {
                    id: source.id,
                    owner: source.owner,
                    name: source.name,
                    url: source.url,
                },
                keys,
            ),
            created: true,
            mockSecretsCreated: keys.length,
        };
    } catch (error) {
        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 11000
        ) {
            const duplicate = await existingImport(userId, source.id);
            if (duplicate) return { project: duplicate, created: false, mockSecretsCreated: 0 };
        }
        if (error instanceof AppError) throw error;
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to import repository');
    }
}
