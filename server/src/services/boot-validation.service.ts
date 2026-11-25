import { Writable } from 'node:stream';
import { config } from 'dotenv';
import pino from 'pino';

config();

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'MASTER_KEY', 'MASTER_KEY_VERSION'] as const;

export function validateBootConfig(): void {
    for (const key of requiredEnvVars) {
        if (!process.env[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
        }
    }

    const masterKey = Buffer.from(process.env.MASTER_KEY!, 'base64');
    if (masterKey.length !== 32) {
        throw new Error('MASTER_KEY must be 32 bytes (base64-encoded)');
    }

    if (!/^\d+$/.test(process.env.MASTER_KEY_VERSION!)) {
        throw new Error('MASTER_KEY_VERSION must be a positive integer');
    }

    const masterKeyVersion = Number.parseInt(process.env.MASTER_KEY_VERSION!, 10);
    if (!Number.isInteger(masterKeyVersion) || masterKeyVersion <= 0) {
        throw new Error('MASTER_KEY_VERSION must be a positive integer');
    }

    if (process.env.JWT_SECRET!.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters');
    }

    const sameSite = process.env.COOKIE_SAMESITE;
    if (sameSite && !['Strict', 'Lax', 'None'].includes(sameSite)) {
        throw new Error('COOKIE_SAMESITE must be one of: Strict, Lax, None');
    }

    if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
        throw new Error('CLIENT_ORIGIN is required in production');
    }

    if (process.env.TRUST_PROXY !== undefined && !/^\d+$/.test(process.env.TRUST_PROXY)) {
        throw new Error('TRUST_PROXY must be a non-negative integer hop count');
    }
}

export const getMasterKey = (): Buffer => {
    return Buffer.from(process.env.MASTER_KEY!, 'base64');
};

export const getMasterKeyVersion = (): number => {
    return Number.parseInt(process.env.MASTER_KEY_VERSION!, 10);
};

export const getJwtSecret = (): string => {
    return process.env.JWT_SECRET!;
};

export const getCookieOptions = () => {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite =
        (process.env.COOKIE_SAMESITE?.toLowerCase() as 'strict' | 'lax' | 'none') ||
        (isProd ? 'none' : 'lax');

    return {
        httpOnly: true,
        secure: isProd,
        sameSite,
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
};

const LEVEL_LABELS: Record<number, string> = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO ',
    40: 'WARN ',
    50: 'ERROR',
    60: 'FATAL',
};

const LEVEL_COLORS: Record<number, string> = {
    10: '90',
    20: '34',
    30: '32',
    40: '33',
    50: '31',
    60: '35',
};

const RESET = '\x1b[0m';

function paint(value: string, ansi: string, enabled: boolean): string {
    return enabled ? `\x1b[${ansi}m${value}${RESET}` : value;
}

function statusColor(statusCode: number): string {
    if (statusCode >= 500) return '31';
    if (statusCode >= 400) return '33';
    if (statusCode >= 300) return '36';
    return '32';
}

function timestamp(time: unknown): string {
    const date = typeof time === 'number' ? new Date(time) : new Date();
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
        .map((part) => String(part).padStart(2, '0'))
        .join(':');
}

function renderedValue(value: unknown): string {
    if (typeof value === 'string') return value.includes(' ') ? JSON.stringify(value) : value;
    if (value === null) return 'null';
    return JSON.stringify(value);
}

export function formatDevLog(log: Record<string, unknown>, useColor = false): string {
    const level = typeof log.level === 'number' ? log.level : 30;
    const label = LEVEL_LABELS[level] ?? String(level);
    const method = typeof log.method === 'string' ? log.method : null;
    const path = typeof log.path === 'string' ? log.path : null;
    const statusCode = typeof log.statusCode === 'number' ? log.statusCode : null;

    const parts = [
        paint(timestamp(log.time), '90', useColor),
        paint(label, LEVEL_COLORS[level] ?? '0', useColor),
    ];

    if (method && path && statusCode !== null) {
        const duration = typeof log.durationMs === 'number' ? ` ${log.durationMs}ms` : '';
        parts.push(
            `${method.padEnd(6)} ${path} ${paint(String(statusCode), statusColor(statusCode), useColor)}${duration}`,
        );
    } else if (typeof log.msg === 'string') {
        parts.push(log.msg);
    }

    const ignored = new Set([
        'level',
        'time',
        'pid',
        'hostname',
        'msg',
        'err',
        'method',
        'path',
        'statusCode',
        'durationMs',
    ]);
    const extras = Object.entries(log)
        .filter(([key]) => !ignored.has(key))
        .map(([key, value]) => `${key}=${renderedValue(value)}`);
    if (extras.length > 0) parts.push(paint(extras.join(' '), '90', useColor));

    const error = log.err as { stack?: unknown; message?: unknown } | undefined;
    if (error) {
        const detail =
            typeof error.stack === 'string'
                ? error.stack
                : typeof error.message === 'string'
                  ? error.message
                  : String(error);
        parts.push(`\n  ${detail.replace(/\n/g, '\n  ')}`);
    }

    return parts.join(' ').replace(/ +\n/g, '\n');
}

function createDevLogStream(): Writable {
    const useColor = Boolean(process.stdout.isTTY);
    return new Writable({
        write(chunk: Buffer | string, _encoding, callback) {
            for (const line of chunk.toString().split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
                    process.stdout.write(`${formatDevLog(parsed, useColor)}\n`);
                } catch {
                    process.stdout.write(`${line}\n`);
                }
            }
            callback();
        },
    });
}

const loggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    redact: {
        paths: [
            'password',
            'currentPassword',
            'newPassword',
            'value',
            'entries',
            'entries[*].value',
            'content',
            'description',
            'data',
            'body.password',
            'body.currentPassword',
            'body.newPassword',
            'body.value',
            'body.entries',
            'body.entries[*].value',
            'body.content',
            'body.description',
            'body.data',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.value',
            'req.body.entries',
            'req.body.entries[*].value',
            'req.body.content',
            'req.body.description',
            'req.body.data',
        ],
        censor: '[Redacted]',
    },
};

const prettyLogs = process.env.NODE_ENV !== 'production' && process.env.LOG_FORMAT !== 'json';

const logger = prettyLogs
    ? pino.default(loggerOptions, createDevLogStream())
    : pino.default(loggerOptions);
export { logger };
