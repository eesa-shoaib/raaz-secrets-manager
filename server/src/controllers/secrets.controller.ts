import {
    createCursorPaginatedResponseSchema,
    secretResponseSchema,
    type SecretsListQuery,
} from '@raaz/shared-schemas';
import type { Request, Response } from 'express';
import {
    listSecretsCursor,
    listSecretsForUser,
    createSecret,
    editSecret,
    deleteSecret,
    getSecretMetadata,
    revealSecret,
} from '../services/secrets.service.js';

const paginatedSecretsSchema = createCursorPaginatedResponseSchema(secretResponseSchema);

export async function listSecretsController(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as SecretsListQuery;
    if (query.cursor !== undefined || query.mode === 'cursor') {
        const result = await listSecretsCursor(req.user!.id, req.params.projectId, {
            environment: query.environment,
            cursor: query.cursor,
            limit: query.limit,
            search: query.search,
        });
        res.json(
            paginatedSecretsSchema.parse({
                data: result.data.map((secret) => secretResponseSchema.parse(secret)),
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
                limit: result.limit,
            }),
        );
        return;
    }
    const secrets = await listSecretsForUser(
        req.user!.id,
        req.params.projectId,
        query.environment,
        query.search,
    );
    res.json(secrets.map((secret) => secretResponseSchema.parse(secret)));
}

export async function createSecretController(req: Request, res: Response): Promise<void> {
    const { key, environment, value } = req.body;

    const secret = await createSecret(req.user!.id, req.params.projectId, key, environment, value);
    res.status(201).json(
        secretResponseSchema.parse({
            id: secret._id.toString(),
            key: secret.key,
            environment: secret.environment,
            maskedValue: '••••••••',
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
        }),
    );
}

export async function editSecretController(req: Request, res: Response): Promise<void> {
    const { value } = req.body;
    await editSecret(req.user!.id, req.params.projectId, req.params.secretId, value);

    const secret = await getSecretMetadata(req.params.projectId, req.params.secretId);
    if (!secret) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Secret not found' } });
        return;
    }
    res.json(
        secretResponseSchema.parse({
            id: secret._id.toString(),
            key: secret.key,
            environment: secret.environment,
            maskedValue: '••••••••',
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
        }),
    );
}

export async function deleteSecretController(req: Request, res: Response): Promise<void> {
    await deleteSecret(req.user!.id, req.params.projectId, req.params.secretId);
    res.status(204).send();
}

export async function getSecretMetadataController(req: Request, res: Response): Promise<void> {
    const secret = await getSecretMetadata(req.params.projectId, req.params.secretId);
    if (!secret) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Secret not found' } });
        return;
    }
    res.json(
        secretResponseSchema.parse({
            id: secret._id.toString(),
            key: secret.key,
            environment: secret.environment,
            maskedValue: '••••••••',
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
        }),
    );
}

export async function revealSecretController(req: Request, res: Response): Promise<void> {
    const result = await revealSecret(
        req.user!.id,
        req.params.projectId,
        req.params.secretId,
        req.body?.confirm === true,
    );

    if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Secret not found' } });
        return;
    }

    res.set('Cache-Control', 'no-store').json({ value: result.value });
}
