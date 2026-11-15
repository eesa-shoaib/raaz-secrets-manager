import { describe, expect, it } from 'vitest';
import { parseEnvContent } from './envParser';

describe('parseEnvContent', () => {
    it('parses comments, export prefixes, quoted values, escapes, and inline comments', () => {
        const input = [
            '# Header comment',
            '',
            'export DATABASE_URL=postgres://user:pass@localhost:5432/db # inline comment',
            'DOUBLE_QUOTED="line1\\nline2 \\"quoted\\"" # trailing comment',
            "SINGLE_QUOTED='literal # not a comment'",
            'EMPTY_VAL=',
            'lower_case_key=ok',
        ].join('\n');

        const result = parseEnvContent(input);
        expect(result.errors).toEqual([]);
        expect(result.duplicateKeys).toEqual([]);
        expect(result.entries).toEqual([
            { key: 'DATABASE_URL', value: 'postgres://user:pass@localhost:5432/db' },
            { key: 'DOUBLE_QUOTED', value: 'line1\nline2 "quoted"' },
            { key: 'SINGLE_QUOTED', value: 'literal # not a comment' },
            { key: 'EMPTY_VAL', value: '' },
            { key: 'LOWER_CASE_KEY', value: 'ok' },
        ]);
    });

    it('deduplicates repeated keys keeping the last value', () => {
        const result = parseEnvContent('API_KEY=first\nAPI_KEY=second');
        expect(result.errors).toEqual([]);
        expect(result.duplicateKeys).toEqual(['API_KEY']);
        expect(result.entries).toEqual([{ key: 'API_KEY', value: 'second' }]);
    });

    it('reports malformed lines, invalid keys, unterminated quotes, and entry limit overflow', () => {
        const invalid = parseEnvContent('NOT_A_PAIR\nBAD-KEY=1\nUNCLOSED="oops');
        expect(invalid.errors).toHaveLength(3);
        expect(invalid.entries).toEqual([]);

        const tooMany = Array.from({ length: 101 }, (_, i) => `KEY_${i}=val`).join('\n');
        const overflow = parseEnvContent(tooMany);
        expect(overflow.errors.some((e) => e.includes('Maximum is 100'))).toBe(true);
    });
});
