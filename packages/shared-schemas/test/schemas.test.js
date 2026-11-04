import assert from 'node:assert';
import {
  signupSchema,
  loginSchema,
  publicUserSchema,
  createProjectSchema,
  projectResponseSchema,
  createSecretSchema,
  editSecretSchema,
  revealSecretSchema,
  secretResponseSchema,
  auditLogQuerySchema,
  auditLogEntrySchema,
  MASKED_SECRET_VALUE,
  CANONICAL_ENVIRONMENTS,
} from '../dist/index.js';
import { internalUserSchema, internalSecretSchema } from '../dist/internal/index.js';

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

const internalUser = internalUserSchema.parse({
  ...user,
  passwordHash: '$2b$10$hashedpassword',
  tokenVersion: 0,
});
assert.strictEqual(internalUser.passwordHash, '$2b$10$hashedpassword');

// 2. Project schemas
assert.deepStrictEqual(CANONICAL_ENVIRONMENTS, ['development', 'staging', 'production']);

const project = createProjectSchema.parse({ name: '  My New Project  ' });
assert.strictEqual(project.name, 'My New Project');
assert.throws(() => createProjectSchema.parse({ name: '' }));

const projectRes = projectResponseSchema.parse({
  id: 'proj_1',
  name: 'My New Project',
  environments: ['development', 'staging', 'production'],
  activeAdminCount: 1,
  status: 'active',
  createdBy: 'usr_1',
  role: 'projectAdmin',
  createdAt: new Date(),
  updatedAt: new Date(),
});
assert.strictEqual(projectRes.role, 'projectAdmin');

// 3. Secret schemas
assert.throws(() => createSecretSchema.parse({ environment: 'invalid', key: 'TEST', value: 'val' }));
assert.throws(() => createSecretSchema.parse({ environment: 'development', key: 'invalid-key!', value: 'val' }));
assert.throws(() => createSecretSchema.parse({ environment: 'development', key: 'lower_case', value: 'val' }));

const secret = createSecretSchema.parse({
  environment: 'production',
  key: 'DATABASE_URL_2',
  value: 'postgres://...',
});
assert.strictEqual(secret.key, 'DATABASE_URL_2');

const secretRes = secretResponseSchema.parse({
  id: 'sec_1',
  projectId: 'proj_1',
  environment: 'production',
  key: 'DATABASE_URL_2',
  createdAt: new Date(),
});
assert.strictEqual(secretRes.value, MASKED_SECRET_VALUE);

const reveal = revealSecretSchema.parse({ confirm: true });
assert.strictEqual(reveal.confirm, true);

// 4. Audit log schemas
const auditQuery = auditLogQuerySchema.parse({ limit: '50', result: 'allowed' });
assert.strictEqual(auditQuery.limit, 50);
assert.strictEqual(auditQuery.result, 'allowed');

const auditEntry = auditLogEntrySchema.parse({
  id: 'aud_1',
  action: 'reveal',
  result: 'allowed',
  createdAt: new Date(),
  user: { id: 'usr_1', email: 'user@domain.com' },
  secretKey: 'DATABASE_URL_2',
  environment: 'production',
});
assert.strictEqual(auditEntry.action, 'reveal');

console.log('✓ All shared-schemas tests passed!');
