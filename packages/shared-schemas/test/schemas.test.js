import assert from 'node:assert';
import {
    signupSchema,
    loginSchema,
    publicUserSchema,
    changePasswordInputSchema,
    profileUpdateInputSchema,
    avatarUploadInputSchema,
    adminUsersQuerySchema,
    createProjectSchema,
    updateProjectSchema,
    projectResponseSchema,
    projectsListQuerySchema,
    createSecretSchema,
    revealSecretSchema,
    secretResponseSchema,
    secretsListQuerySchema,
    auditLogQuerySchema,
    auditLogEntrySchema,
    auditActionEnum,
    MASKED_SECRET_VALUE,
    CANONICAL_ENVIRONMENTS,
} from '../dist/index.js';
import { internalUserSchema, internalUserAvatarSchema } from '../dist/internal/index.js';

console.log('Running shared-schemas test suite...');

// 1. User schemas
const signup = signupSchema.parse({ email: 'USER@DOMAIN.COM ', password: 'password123' });
assert.strictEqual(signup.email, 'user@domain.com');

assert.throws(() => signupSchema.parse({ email: 'bad-email', password: 'password123' }));
assert.throws(() => signupSchema.parse({ email: 'user@domain.com', password: 'short' }));
assert.throws(() => signupSchema.parse({ email: 'user@domain.com', password: 'x'.repeat(73) }));

const login = loginSchema.parse({ email: '  USER@DOMAIN.COM', password: 'password123' });
assert.strictEqual(login.email, 'user@domain.com');

const user = publicUserSchema.parse({
    id: 'usr_1',
    email: 'user@domain.com',
    isPlatformAdmin: false,
    isActive: true,
    createdAt: new Date(),
});
assert.strictEqual(user.id, 'usr_1');
assert.strictEqual(user.username, null);
assert.strictEqual(user.hasAvatar, false);
assert.strictEqual(user.avatarUpdatedAt, null);

const pwChange = changePasswordInputSchema.parse({
    currentPassword: 'oldPassword123',
    newPassword: 'newPassword456',
});
assert.strictEqual(pwChange.newPassword, 'newPassword456');
assert.throws(() =>
    changePasswordInputSchema.parse({
        currentPassword: 'samePassword123',
        newPassword: 'samePassword123',
    })
);

const profileUpdated = profileUpdateInputSchema.parse({ username: '  Ali_Dev-01 ' });
assert.strictEqual(profileUpdated.username, 'ali_dev-01');
const profileCleared = profileUpdateInputSchema.parse({ username: '' });
assert.strictEqual(profileCleared.username, null);
assert.throws(() => profileUpdateInputSchema.parse({ username: 'a!' }));
assert.throws(() =>
    profileUpdateInputSchema.parse({ username: 'ali_dev', isPlatformAdmin: true })
);

const avatarInput = avatarUploadInputSchema.parse({
    contentType: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
});
assert.strictEqual(avatarInput.contentType, 'image/png');
assert.throws(() =>
    avatarUploadInputSchema.parse({ contentType: 'image/svg+xml', data: 'PHN2Zz48L3N2Zz4=' })
);

const adminPageQuery = adminUsersQuerySchema.parse({});
assert.strictEqual(adminPageQuery.page, 1);
assert.strictEqual(adminPageQuery.limit, 20);
assert.strictEqual(adminPageQuery.mode, 'page');

const adminCursorQuery = adminUsersQuerySchema.parse({ cursor: 'abc123' });
assert.strictEqual(adminCursorQuery.page, undefined);
assert.strictEqual(adminCursorQuery.limit, 25);
assert.strictEqual(adminCursorQuery.mode, 'cursor');
assert.throws(() => adminUsersQuerySchema.parse({ page: 1, cursor: 'abc123' }));

const internalUser = internalUserSchema.parse({
    ...user,
    passwordHash: '$2b$10$hashedpassword',
    tokenVersion: 0,
});
assert.strictEqual(internalUser.passwordHash, '$2b$10$hashedpassword');

const internalAvatar = internalUserAvatarSchema.parse({
    userId: 'usr_1',
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    contentType: 'image/png',
    width: 64,
    height: 64,
    byteLength: 4,
    version: 1,
});
assert.strictEqual(internalAvatar.width, 64);

// 2. Project schemas
assert.deepStrictEqual(CANONICAL_ENVIRONMENTS, ['development', 'staging', 'production']);

const project = createProjectSchema.parse({
    name: '  My New Project  ',
    description: '  Core API secrets  ',
});
assert.strictEqual(project.name, 'My New Project');
assert.strictEqual(project.description, 'Core API secrets');
assert.throws(() => createProjectSchema.parse({ name: '' }));
assert.throws(() => createProjectSchema.parse({ name: 'Valid', description: 'x'.repeat(501) }));

const updatedProject = updateProjectSchema.parse({ description: 'Updated description' });
assert.strictEqual(updatedProject.description, 'Updated description');
assert.throws(() => updateProjectSchema.parse({}));
assert.throws(() => updateProjectSchema.parse({ name: 'Valid', environments: ['qa'] }));

const projectRes = projectResponseSchema.parse({
    id: 'proj_1',
    name: 'My New Project',
    description: 'Core API secrets',
    environments: ['development', 'staging', 'production'],
    activeAdminCount: 1,
    status: 'active',
    createdBy: 'usr_1',
    role: 'projectAdmin',
    memberCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
});
assert.strictEqual(projectRes.role, 'projectAdmin');
assert.strictEqual(projectRes.memberCount, 3);
assert.strictEqual(projectRes.description, 'Core API secrets');

const projQuery = projectsListQuerySchema.parse({ search: '  api  ' });
assert.strictEqual(projQuery.search, 'api');
assert.strictEqual(projQuery.limit, 25);

// 3. Secret schemas
assert.throws(() =>
    createSecretSchema.parse({ environment: 'invalid', key: 'TEST', value: 'val' })
);
assert.throws(() =>
    createSecretSchema.parse({ environment: 'development', key: 'invalid-key!', value: 'val' })
);
assert.throws(() =>
    createSecretSchema.parse({ environment: 'development', key: 'lower_case', value: 'val' })
);

const secret = createSecretSchema.parse({
    environment: 'production',
    key: 'DATABASE_URL_2',
    value: 'postgres://...',
});
assert.strictEqual(secret.key, 'DATABASE_URL_2');

const secretRes = secretResponseSchema.parse({
    id: 'sec_1',
    environment: 'production',
    key: 'DATABASE_URL_2',
    maskedValue: MASKED_SECRET_VALUE,
    createdAt: new Date(),
    updatedAt: new Date(),
});
assert.strictEqual(secretRes.maskedValue, MASKED_SECRET_VALUE);

const secListQuery = secretsListQuerySchema.parse({
    environment: 'development',
    search: 'DB_',
    limit: '10',
});
assert.strictEqual(secListQuery.limit, 10);
assert.strictEqual(secListQuery.search, 'DB_');

const reveal = revealSecretSchema.parse({ confirm: true });
assert.strictEqual(reveal.confirm, true);

// 4. Audit log schemas
const auditQuery = auditLogQuerySchema.parse({ limit: '50', result: 'allowed' });
assert.strictEqual(auditQuery.limit, 50);
assert.strictEqual(auditQuery.result, 'allowed');

for (const action of [
    'project_updated',
    'password_changed',
    'profile_updated',
    'avatar_updated',
    'avatar_removed',
]) {
    assert.strictEqual(auditActionEnum.parse(action), action);
}

const auditEntry = auditLogEntrySchema.parse({
    id: 'aud_1',
    action: 'reveal',
    result: 'allowed',
    createdAt: new Date(),
    user: { id: 'usr_1', email: 'user@domain.com', username: 'ali_dev' },
    secretKey: 'DATABASE_URL_2',
    environment: 'production',
});
assert.strictEqual(auditEntry.action, 'reveal');
assert.strictEqual(auditEntry.user?.username, 'ali_dev');

console.log('✓ All shared-schemas tests passed!');
