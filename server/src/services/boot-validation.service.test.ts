import { describe, expect, it } from 'vitest';
import { formatDevLog } from './boot-validation.service.js';

describe('formatDevLog', () => {
    it('renders request logs as a single readable line', () => {
        const line = formatDevLog({
            level: 30,
            time: new Date('2026-01-01T10:11:12').getTime(),
            method: 'GET',
            path: '/api/admin/users',
            statusCode: 200,
            durationMs: 140,
            msg: 'Request completed',
        });

        expect(line).toBe('10:11:12 INFO  GET    /api/admin/users 200 140ms');
    });

    it('keeps extra fields on generic logs and omits pino noise', () => {
        const line = formatDevLog({
            level: 30,
            time: new Date('2026-01-01T10:11:12').getTime(),
            pid: 123,
            hostname: 'host',
            port: 5000,
            msg: 'Server listening',
        });

        expect(line).toBe('10:11:12 INFO  Server listening port=5000');
    });

    it('appends error details on following indented lines', () => {
        const line = formatDevLog({
            level: 50,
            time: new Date('2026-01-01T10:11:12').getTime(),
            err: { message: 'boom', stack: 'Error: boom\n    at handler' },
            msg: 'Unhandled request error',
        });

        expect(line).toBe(
            '10:11:12 ERROR Unhandled request error\n  Error: boom\n      at handler',
        );
    });
});
