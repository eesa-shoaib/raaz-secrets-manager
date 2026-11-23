import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { GitHubConnectAttemptModel } from '../models/GitHubConnectAttempt.js';
import { GitHubConnectionModel, type GitHubConnectionDoc } from '../models/GitHubConnection.js';
import { AppError } from '../utils/app-error.js';
import { writeAuditEntry } from './audit.service.js';
import { decrypt, encrypt } from './encryption.service.js';
import {
    exchangeGitHubConnection,
    githubAppConfig,
    githubAuthorization,
    githubRequest,
    githubUserSchema,
    refreshGitHubConnection,
    requireGitHubApp,
    type GitHubTokens,
} from './github-provider.service.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const encrypted = (tokens: GitHubTokens, connectionId: string, userId: string) =>
    encrypt(JSON.stringify(tokens), 'github-connection', connectionId, userId);

export async function githubStatus(userId: string) {
    const config = githubAppConfig();
    const connection = await GitHubConnectionModel.findOne({ userId }).lean();
    return {
        enabled: Boolean(config),
        connected: Boolean(connection),
        login: connection?.login ?? null,
        manageUrl: config?.manageUrl ?? null,
    };
}

export async function startGitHubConnection(
    userId: string,
    sessionToken: string,
    returnTo: 'projects' | 'settings',
) {
    requireGitHubApp();
    if (!sessionToken) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const authorizationUrl = await githubAuthorization(state, verifier);
    await GitHubConnectAttemptModel.create({
        userId,
        stateHash: hash(state),
        sessionHash: hash(sessionToken),
        verifier,
        returnTo,
        expiresAt: new Date(Date.now() + 600000),
    });
    return { authorizationUrl };
}

export async function completeGitHubConnection(
    userId: string,
    sessionToken: string,
    state: string,
    query: string,
) {
    const attempt = await GitHubConnectAttemptModel.findOneAndDelete({
        userId,
        stateHash: hash(state),
        sessionHash: hash(sessionToken),
        expiresAt: { $gt: new Date() },
    })
        .select('+verifier')
        .lean();
    if (!attempt)
        throw new AppError(409, 'CONFLICT', 'GitHub connection attempt expired. Connect again.');
    const tokens = await exchangeGitHubConnection(query, state, attempt.verifier);
    const githubUser = await githubRequest(tokens.accessToken, '/user', githubUserSchema);
    await GitHubConnectionModel.init();
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const connection =
                (await GitHubConnectionModel.findOne({ userId }).session(session)) ??
                new GitHubConnectionModel({ userId });
            connection.subject = String(githubUser.id);
            connection.login = githubUser.login;
            connection.credentials = encrypted(tokens, connection._id.toString(), userId);
            connection.refreshLease = null;
            connection.refreshUntil = null;
            await connection.save({ session });
            await writeAuditEntry({
                session,
                userId,
                action: 'github_connected',
                result: 'allowed',
            });
        });
    } catch {
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to save GitHub connection');
    } finally {
        await session.endSession();
    }
    return attempt.returnTo;
}

function decryptTokens(connection: GitHubConnectionDoc): GitHubTokens {
    try {
        const { ciphertext, iv, authTag, encryptionKeyVersion } = connection.credentials;
        return JSON.parse(
            decrypt(
                ciphertext,
                iv,
                authTag,
                'github-connection',
                connection._id.toString(),
                connection.userId.toString(),
                encryptionKeyVersion,
            ),
        ) as GitHubTokens;
    } catch {
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to read GitHub connection');
    }
}

export async function githubAccessToken(userId: string) {
    requireGitHubApp();
    const connection = await GitHubConnectionModel.findOne({ userId }).select(
        '+credentials +subject',
    );
    if (!connection) throw new AppError(409, 'CONFLICT', 'Connect GitHub to import repositories');
    const tokens = decryptTokens(connection);
    if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
    if (!tokens.refreshToken || tokens.refreshExpiresAt <= Date.now())
        throw new AppError(409, 'CONFLICT', 'Reconnect GitHub to continue');
    const lease = randomBytes(16).toString('hex');
    const locked = await GitHubConnectionModel.findOneAndUpdate(
        {
            _id: connection._id,
            'credentials.iv': connection.credentials.iv,
            $or: [{ refreshUntil: null }, { refreshUntil: { $lt: new Date() } }],
        },
        { $set: { refreshLease: lease, refreshUntil: new Date(Date.now() + 30000) } },
    );
    if (!locked) throw new AppError(409, 'CONFLICT', 'GitHub connection is updating. Try again.');
    try {
        const fresh = await refreshGitHubConnection(tokens.refreshToken);
        const identity = await githubRequest(fresh.accessToken, '/user', githubUserSchema);
        if (String(identity.id) !== connection.subject)
            throw new AppError(409, 'CONFLICT', 'Reconnect GitHub to continue');
        const result = await GitHubConnectionModel.updateOne(
            { _id: connection._id, refreshLease: lease },
            {
                $set: { credentials: encrypted(fresh, connection._id.toString(), userId) },
                $unset: { refreshLease: 1, refreshUntil: 1 },
            },
        );
        if (!result.matchedCount)
            throw new AppError(409, 'CONFLICT', 'Reconnect GitHub to continue');
        return fresh.accessToken;
    } finally {
        await GitHubConnectionModel.updateOne(
            { _id: connection._id, refreshLease: lease },
            { $unset: { refreshLease: 1, refreshUntil: 1 } },
        );
    }
}

export async function disconnectGitHub(userId: string) {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const removed = await GitHubConnectionModel.deleteOne({ userId }, { session });
            await GitHubConnectAttemptModel.deleteMany({ userId }, { session });
            if (removed.deletedCount)
                await writeAuditEntry({
                    session,
                    userId,
                    action: 'github_disconnected',
                    result: 'allowed',
                });
        });
    } catch {
        throw new AppError(500, 'INTERNAL_ERROR', 'Unable to disconnect GitHub');
    } finally {
        await session.endSession();
    }
}
