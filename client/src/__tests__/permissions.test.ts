import { describe, it, expect } from 'vitest';
import { can, type Action, type Environment, type Role } from '../lib/permissions';

describe('Permissions matrix conformance', () => {
    const environments: Environment[] = ['development', 'staging', 'production'];

    describe('Project Admin', () => {
        const role: Role = 'projectAdmin';

        it('can perform all secret actions in all environments', () => {
            const secretActions: Action[] = [
                'secrets.list',
                'secrets.create',
                'secrets.reveal',
                'secrets.edit',
                'secrets.delete',
            ];

            for (const env of environments) {
                for (const action of secretActions) {
                    expect(can(role, action, env), `admin ${action} in ${env}`).toBe('enabled');
                }
            }
        });

        it('can perform member management and view audit log', () => {
            expect(can(role, 'members.list')).toBe('enabled');
            expect(can(role, 'members.add')).toBe('enabled');
            expect(can(role, 'members.change-role')).toBe('enabled');
            expect(can(role, 'members.remove')).toBe('enabled');
            expect(can(role, 'audit.list')).toBe('enabled');
        });
    });

    describe('Developer', () => {
        const role: Role = 'developer';

        it('can create and edit ONLY in development environment', () => {
            expect(can(role, 'secrets.create', 'development')).toBe('enabled');
            expect(can(role, 'secrets.create', 'staging')).toBe('disabled');
            expect(can(role, 'secrets.create', 'production')).toBe('disabled');

            expect(can(role, 'secrets.edit', 'development')).toBe('enabled');
            expect(can(role, 'secrets.edit', 'staging')).toBe('disabled');
            expect(can(role, 'secrets.edit', 'production')).toBe('disabled');
        });

        it('can reveal secrets in all environments', () => {
            for (const env of environments) {
                expect(can(role, 'secrets.reveal', env)).toBe('enabled');
            }
        });

        it('cannot delete secrets in any environment (hidden)', () => {
            for (const env of environments) {
                expect(can(role, 'secrets.delete', env)).toBe('hidden');
            }
        });

        it('can view members and audit log, but cannot add/modify members (hidden)', () => {
            expect(can(role, 'members.list')).toBe('enabled');
            expect(can(role, 'audit.list')).toBe('enabled');

            expect(can(role, 'members.add')).toBe('hidden');
            expect(can(role, 'members.change-role')).toBe('hidden');
            expect(can(role, 'members.remove')).toBe('hidden');
        });
    });

    describe('Auditor', () => {
        const role: Role = 'auditor';

        it('can list secrets but can NEVER reveal, create, edit, or delete (all hidden)', () => {
            for (const env of environments) {
                expect(can(role, 'secrets.list', env)).toBe('enabled');
                expect(can(role, 'secrets.reveal', env)).toBe('hidden');
                expect(can(role, 'secrets.create', env)).toBe('hidden');
                expect(can(role, 'secrets.edit', env)).toBe('hidden');
                expect(can(role, 'secrets.delete', env)).toBe('hidden');
            }
        });

        it('can view members and audit log, but cannot manage members', () => {
            expect(can(role, 'members.list')).toBe('enabled');
            expect(can(role, 'audit.list')).toBe('enabled');

            expect(can(role, 'members.add')).toBe('hidden');
            expect(can(role, 'members.change-role')).toBe('hidden');
            expect(can(role, 'members.remove')).toBe('hidden');
        });
    });

    describe('Anonymous or unassigned', () => {
        it('returns hidden for all actions when role is null', () => {
            const actions: Action[] = [
                'secrets.list',
                'secrets.create',
                'secrets.reveal',
                'secrets.edit',
                'secrets.delete',
                'members.list',
                'members.add',
                'audit.list',
            ];

            for (const action of actions) {
                expect(can(null, action)).toBe('hidden');
            }
        });
    });
});
