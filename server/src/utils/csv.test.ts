import { describe, expect, it } from 'vitest';
import { formatAuditEntriesAsCsv, sanitizeCsvCell } from './csv.js';

describe('CSV formula-injection sanitization', () => {
    it('prefixes cells starting with =, +, -, @, tab, or CR with a single quote', () => {
        expect(sanitizeCsvCell('=CMD("calc")')).toBe(`"'=CMD(""calc"")"`);
        expect(sanitizeCsvCell('+1+2')).toBe(`'+1+2`);
        expect(sanitizeCsvCell('-2+3')).toBe(`'-2+3`);
        expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe(`'@SUM(A1:A2)`);
        expect(sanitizeCsvCell('\t=HYPERLINK("http://evil")')).toBe(
            `"'\t=HYPERLINK(""http://evil"")"`,
        );
        expect(sanitizeCsvCell('\r1+1')).toBe(`"'\r1+1"`);
    });

    it('leaves safe values untouched and quotes commas, quotes, and newlines per RFC 4180', () => {
        expect(sanitizeCsvCell('DATABASE_URL')).toBe('DATABASE_URL');
        expect(sanitizeCsvCell(null)).toBe('');
        expect(sanitizeCsvCell(undefined)).toBe('');
        expect(sanitizeCsvCell('a,b')).toBe('"a,b"');
        expect(sanitizeCsvCell('say "hi"')).toBe('"say ""hi"""');
        expect(sanitizeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    });

    it('formats audit log entries with sanitized CSV headers and rows', () => {
        const csv = formatAuditEntriesAsCsv([
            {
                id: 'entry-1',
                createdAt: '2026-11-16T10:00:00.000Z',
                action: 'reveal',
                result: 'denied',
                user: {
                    id: 'u1',
                    email: '=evil@example.com',
                    username: '-bad_handle',
                    hasAvatar: false,
                    avatarUpdatedAt: null,
                },
                environment: 'production',
                secretKey: 'PROD_KEY',
            },
        ]);

        const lines = csv.trim().split('\n');
        expect(lines[0]).toBe(
            'id,createdAt,action,result,actorEmail,actorUsername,environment,secretKey,targetUserEmail,previousRole,newRole',
        );
        expect(lines[1]).toBe(
            "entry-1,2026-11-16T10:00:00.000Z,reveal,denied,'=evil@example.com,'-bad_handle,production,PROD_KEY,,,",
        );
    });
});
