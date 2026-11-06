import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getMasterKey, getMasterKeyVersion } from './boot-validation.service.js';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function buildAAD(
    projectId: string,
    secretId: string,
    environment: string,
    keyVersion: number,
): Buffer {
    return Buffer.from(`${projectId}|${secretId}|${environment}|${keyVersion}`);
}

export function encrypt(
    plaintext: string,
    projectId: string,
    secretId: string,
    environment: string,
): {
    ciphertext: Buffer;
    iv: Buffer;
    authTag: Buffer;
    encryptionKeyVersion: number;
} {
    const masterKey = getMasterKey();
    const keyVersion = getMasterKeyVersion();
    const iv = randomBytes(IV_LENGTH);
    const aad = buildAAD(projectId, secretId, environment, keyVersion);

    const cipher = createCipheriv('aes-256-gcm', masterKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return { ciphertext, iv, authTag, encryptionKeyVersion: keyVersion };
}

function toBuffer(val: unknown): Buffer {
    if (Buffer.isBuffer(val)) return val;
    if (val && typeof val === 'object' && 'buffer' in val) {
        const buf = (val as { buffer: unknown }).buffer;
        if (Buffer.isBuffer(buf)) return buf;
        if (buf instanceof ArrayBuffer || ArrayBuffer.isView(buf)) {
            return Buffer.from(buf as ArrayBuffer);
        }
    }
    return Buffer.from(val as any);
}

export function decrypt(
    ciphertext: Buffer,
    iv: Buffer,
    authTag: Buffer,
    projectId: string,
    secretId: string,
    environment: string,
    storedKeyVersion: number,
): string {
    const masterKey = getMasterKey();
    const currentKeyVersion = getMasterKeyVersion();

    if (storedKeyVersion !== currentKeyVersion) {
        throw new Error(
            `Encryption key version mismatch: stored ${storedKeyVersion}, current ${currentKeyVersion}`,
        );
    }

    const ivBuf = toBuffer(iv);
    const cipherBuf = toBuffer(ciphertext);
    const tagBuf = toBuffer(authTag);

    const aad = buildAAD(projectId, secretId, environment, storedKeyVersion);
    const decipher = createDecipheriv('aes-256-gcm', masterKey, ivBuf, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAAD(aad);
    decipher.setAuthTag(tagBuf);

    const plaintext = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
    return plaintext.toString('utf8');
}
