import { secretKeyRegex, type ImportSecretEntry } from '@raaz/shared-schemas';

export interface ParsedEnvResult {
    entries: ImportSecretEntry[];
    errors: string[];
    duplicateKeys: string[];
}

export const MAX_IMPORT_ENTRIES = 100;
export const MAX_SECRET_VALUE_LENGTH = 4096;

function parseEnvValue(rawValue: string): { value: string; error?: string } {
    const trimmedStart = rawValue.trimStart();
    if (trimmedStart.length === 0) {
        return { value: '' };
    }

    const firstChar = trimmedStart[0];
    if (firstChar === '"' || firstChar === "'") {
        const quote = firstChar;
        let result = '';
        let closed = false;

        for (let i = 1; i < trimmedStart.length; i += 1) {
            const ch = trimmedStart[i];
            if (quote === '"' && ch === '\\' && i + 1 < trimmedStart.length) {
                const next = trimmedStart[i + 1];
                if (next === 'n') result += '\n';
                else if (next === 'r') result += '\r';
                else if (next === 't') result += '\t';
                else if (next === '"' || next === '\\') result += next;
                else result += `\\${next}`;
                i += 1;
                continue;
            }
            if (ch === quote) {
                closed = true;
                const rest = trimmedStart.slice(i + 1).trim();
                if (rest.length > 0 && !rest.startsWith('#')) {
                    return { value: '', error: 'unexpected characters after closing quote' };
                }
                break;
            }
            result += ch;
        }

        if (!closed) {
            return { value: '', error: 'unterminated quoted value' };
        }
        return { value: result };
    }

    // Unquoted value: strip inline comment preceded by whitespace
    const commentIndex = trimmedStart.search(/\s+#/);
    const unquoted =
        commentIndex >= 0 ? trimmedStart.slice(0, commentIndex).trimEnd() : trimmedStart.trimEnd();
    return { value: unquoted };
}

export function parseEnvContent(raw: string): ParsedEnvResult {
    const cleaned = raw.replace(/^\uFEFF/, '');
    const lines = cleaned.split(/\r?\n/);

    const entryMap = new Map<string, string>();
    const errors: string[] = [];
    const duplicateKeySet = new Set<string>();

    for (let idx = 0; idx < lines.length; idx += 1) {
        const lineNum = idx + 1;
        const line = lines[idx];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const withoutExport = trimmed.replace(/^export\s+/, '');
        const eqIndex = withoutExport.indexOf('=');
        if (eqIndex <= 0) {
            errors.push(`Line ${lineNum}: expected KEY=value format`);
            continue;
        }

        const key = withoutExport.slice(0, eqIndex).trim().toUpperCase();
        const rawVal = withoutExport.slice(eqIndex + 1);

        if (!secretKeyRegex.test(key)) {
            errors.push(
                `Line ${lineNum}: invalid key "${key}" (use 1–100 uppercase letters, digits, or underscores)`,
            );
            continue;
        }

        const parsed = parseEnvValue(rawVal);
        if (parsed.error) {
            errors.push(`Line ${lineNum} (${key}): ${parsed.error}`);
            continue;
        }

        if (parsed.value.length > MAX_SECRET_VALUE_LENGTH) {
            errors.push(`Line ${lineNum} (${key}): value exceeds 4096 character limit`);
            continue;
        }

        if (entryMap.has(key)) {
            duplicateKeySet.add(key);
        }
        entryMap.set(key, parsed.value);
    }

    const entries: ImportSecretEntry[] = Array.from(entryMap.entries()).map(([key, value]) => ({
        key,
        value,
    }));

    if (entries.length > MAX_IMPORT_ENTRIES) {
        errors.push(
            `Too many entries (${entries.length}). Maximum is ${MAX_IMPORT_ENTRIES} per import.`,
        );
    }

    return {
        entries,
        errors,
        duplicateKeys: Array.from(duplicateKeySet),
    };
}
