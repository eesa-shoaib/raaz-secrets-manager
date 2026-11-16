import type { AuditLogEntryResponse } from '@raaz/shared-schemas';

const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(raw: unknown): string {
    if (raw === null || raw === undefined) {
        return '';
    }
    const text = raw instanceof Date ? raw.toISOString() : String(raw);
    const neutralized = FORMULA_TRIGGER_RE.test(text) ? `'${text}` : text;

    if (/[",\r\n]/.test(neutralized)) {
        return `"${neutralized.replace(/"/g, '""')}"`;
    }
    return neutralized;
}

const AUDIT_CSV_HEADERS = [
    'id',
    'createdAt',
    'action',
    'result',
    'actorEmail',
    'actorUsername',
    'environment',
    'secretKey',
    'targetUserEmail',
    'previousRole',
    'newRole',
] as const;

export function formatAuditEntriesAsCsv(entries: AuditLogEntryResponse[]): string {
    const headerLine = AUDIT_CSV_HEADERS.join(',');
    const rows = entries.map((entry) => {
        const createdAt =
            entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt;
        const cells = [
            entry.id,
            createdAt,
            entry.action,
            entry.result,
            entry.user?.email ?? '',
            entry.user?.username ?? '',
            entry.environment ?? '',
            entry.secretKey ?? '',
            entry.targetUser?.email ?? '',
            entry.previousRole ?? '',
            entry.newRole ?? '',
        ];
        return cells.map(sanitizeCsvCell).join(',');
    });

    return `${[headerLine, ...rows].join('\n')}\n`;
}
