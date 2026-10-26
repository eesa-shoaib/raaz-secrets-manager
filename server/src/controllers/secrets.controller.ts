import type { Request, Response } from 'express';
import { secretResponseSchema } from '@raaz/shared-schemas';
import { listSecretsForUser, createSecret, editSecret, deleteSecret, getSecretMetadata, revealSecret } from '../services/secrets.service.js';

export async function listSecretsController(req: Request, res: Response): Promise<void> {
  const secrets = await listSecretsForUser(req.user!.id, req.params.projectId);
  res.json(secrets);
}

export async function createSecretController(req: Request, res: Response): Promise<void> {
  const { key, environment, value, confirm } = req.body;

  // Require confirm for production reveals
  if (environment === 'production' && !confirm) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Confirmation required for production reveal' },
    });
    return;
  }

  const secret = await createSecret(req.user!.id, req.params.projectId, key, environment, value);
  res.status(201).json({
    id: secret._id.toString(),
    key: secret.key,
    environment: secret.environment,
    maskedValue: '••••••••',
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  });
}

export async function editSecretController(req: Request, res: Response): Promise<void> {
  const { key, environment, value } = req.body;
  await editSecret(req.user!.id, req.params.projectId, req.params.secretId, key, environment, value);

  const secret = await getSecretMetadata(req.params.secretId);
  if (!secret) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Secret not found' } });
    return;
  }
  res.json({
    id: secret._id.toString(),
    key: secret.key,
    environment: secret.environment,
    maskedValue: '••••••••',
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  });
}

export async function deleteSecretController(req: Request, res: Response): Promise<void> {
  await deleteSecret(req.user!.id, req.params.projectId, req.params.secretId);
  res.status(204).send();
}

export async function getSecretMetadataController(req: Request, res: Response): Promise<void> {
  const secret = await getSecretMetadata(req.params.secretId);
  if (!secret) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Secret not found' } });
    return;
  }
  res.json({
    id: secret._id.toString(),
    key: secret.key,
    environment: secret.environment,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  });
}

export async function revealSecretController(req: Request, res: Response): Promise<void> {
  const result = await revealSecret(req.user!.id, req.params.projectId, req.params.secretId);

  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Secret not found' } });
    return;
  }

  res.json({ value: result.value });
}