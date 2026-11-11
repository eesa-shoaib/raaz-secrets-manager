#!/usr/bin/env node
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

function assertDisposableDbName(uri) {
    const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
    const dbName = match?.[1] ?? '';
    const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(uri);
    const isDisposablePrefix = /^raaz_(?:test|recovery)_[a-z0-9_-]+$/i.test(dbName);

    if (!isDisposablePrefix && !isLocal) {
        throw new Error(
            `Refusing recovery rehearsal against non-disposable target database "${dbName || '(default)'}". ` +
                'Use TEST_MONGO_URI / RECOVERY_MONGO_URI pointing to localhost or a database named raaz_recovery_* / raaz_test_*.',
        );
    }
    return dbName || 'raaz_recovery_rehearsal';
}

function buildAad(projectId, secretId, environment, keyVersion) {
    return Buffer.from(`${projectId}|${secretId}|${environment}|${keyVersion}`, 'utf8');
}

function encryptSecret(masterKey, plaintext, aad) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv, { authTagLength: 16 });
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
    };
}

function decryptSecret(masterKey, record, aad) {
    const decipher = createDecipheriv(
        'aes-256-gcm',
        masterKey,
        Buffer.from(record.iv, 'base64'),
        { authTagLength: 16 },
    );
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    decipher.setAAD(aad);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(record.ciphertext, 'base64')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}

async function run() {
    const masterKeyRaw = process.env.MASTER_KEY || randomBytes(32).toString('base64');
    const masterKey = Buffer.from(masterKeyRaw, 'base64');
    if (masterKey.length !== 32) {
        throw new Error('MASTER_KEY must decode to 32 bytes');
    }
    const keyVersion = Number.parseInt(process.env.MASTER_KEY_VERSION || '1', 10);

    const syntheticSecretValue = `rehearsal_secret_${randomBytes(6).toString('hex')}`;
    const projectId = new mongoose.Types.ObjectId().toString();
    const secretId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();
    const avatarBytes = Buffer.from('PNG_SYNTHETIC_AVATAR_PLACEHOLDER');
    const avatarHash = createHash('sha256').update(avatarBytes).digest('hex');

    const aad = buildAad(projectId, secretId, 'production', keyVersion);
    const encrypted = encryptSecret(masterKey, syntheticSecretValue, aad);

    if (dryRun) {
        const restoredValue = decryptSecret(masterKey, encrypted, aad);
        if (restoredValue !== syntheticSecretValue) {
            throw new Error('Dry-run decrypt verification failed');
        }
        console.log(
            JSON.stringify({
                mode: 'dry-run',
                status: 'ok',
                keyVersion,
                avatarBytes: avatarBytes.byteLength,
                avatarSha256: avatarHash,
                ciphertextIsolatedFromPlaintext: encrypted.ciphertext !== syntheticSecretValue,
            }),
        );
        return;
    }

    const uri = process.env.RECOVERY_MONGO_URI || process.env.TEST_MONGO_URI || process.env.MONGO_URI;
    if (!uri) {
        throw new Error('Set RECOVERY_MONGO_URI or TEST_MONGO_URI (or use --dry-run)');
    }
    const sourceDbName = assertDisposableDbName(uri);
    const restoreDbName = `raaz_recovery_restore_${Date.now()}`;

    await mongoose.connect(uri, { dbName: sourceDbName });
    const client = mongoose.connection.getClient();

    try {
        const srcDb = client.db(sourceDbName);
        const dstDb = client.db(restoreDbName);

        await srcDb.collection('users').insertOne({
            _id: new mongoose.Types.ObjectId(userId),
            email: 'recovery-check@example.com',
            isPlatformAdmin: false,
            isActive: true,
        });
        await srcDb.collection('secrets').insertOne({
            _id: new mongoose.Types.ObjectId(secretId),
            projectId: new mongoose.Types.ObjectId(projectId),
            environment: 'production',
            key: 'RECOVERY_CHECK_KEY',
            encryptionKeyVersion: keyVersion,
            ...encrypted,
        });
        await srcDb.collection('useravatars').insertOne({
            userId: new mongoose.Types.ObjectId(userId),
            contentType: 'image/png',
            data: avatarBytes,
            byteLength: avatarBytes.byteLength,
        });
        await srcDb.collection('auditlogentries').insertOne({
            projectId: new mongoose.Types.ObjectId(projectId),
            userId: new mongoose.Types.ObjectId(userId),
            action: 'create',
            result: 'allowed',
            environment: 'production',
            secretKey: 'RECOVERY_CHECK_KEY',
            createdAt: new Date(),
        });

        const snapshot = {
            users: await srcDb.collection('users').find({}).toArray(),
            secrets: await srcDb.collection('secrets').find({}).toArray(),
            useravatars: await srcDb.collection('useravatars').find({}).toArray(),
            auditlogentries: await srcDb.collection('auditlogentries').find({}).toArray(),
        };

        for (const [col, docs] of Object.entries(snapshot)) {
            if (docs.length > 0) {
                await dstDb.collection(col).insertMany(docs);
            }
        }

        const restoredSecret = await dstDb.collection('secrets').findOne({ key: 'RECOVERY_CHECK_KEY' });
        const restoredAvatar = await dstDb.collection('useravatars').findOne({
            userId: new mongoose.Types.ObjectId(userId),
        });
        const restoredAuditCount = await dstDb.collection('auditlogentries').countDocuments();

        if (!restoredSecret || !restoredAvatar || restoredAuditCount !== 1) {
            throw new Error('Restored backup snapshot missing required collections');
        }

        const restoredAad = buildAad(
            restoredSecret.projectId.toString(),
            restoredSecret._id.toString(),
            restoredSecret.environment,
            restoredSecret.encryptionKeyVersion,
        );
        const plaintext = decryptSecret(masterKey, restoredSecret, restoredAad);
        if (plaintext !== syntheticSecretValue) {
            throw new Error('Decrypted secret value did not match original after restore');
        }

        const restoredAvatarBuffer = Buffer.isBuffer(restoredAvatar.data)
            ? restoredAvatar.data
            : Buffer.from(restoredAvatar.data.buffer);
        const restoredAvatarHash = createHash('sha256').update(restoredAvatarBuffer).digest('hex');
        if (restoredAvatarHash !== avatarHash) {
            throw new Error('Restored UserAvatar binary digest mismatch');
        }

        console.log(
            JSON.stringify({
                mode: 'live-rehearsal',
                status: 'ok',
                sourceDbName,
                restoreDbName,
                verifiedSecretDecryption: true,
                verifiedAvatarIntegrity: true,
                verifiedAuditCount: restoredAuditCount,
            }),
        );
    } finally {
        await client.db(sourceDbName).dropDatabase().catch(() => {});
        await client.db(restoreDbName).dropDatabase().catch(() => {});
        await mongoose.disconnect();
    }
}

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
