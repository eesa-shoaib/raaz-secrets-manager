import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const baseUrl = (process.env.MOCK_API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '');
const origin = process.env.MOCK_CLIENT_ORIGIN ?? 'http://localhost:5173';
const password = process.env.MOCK_USER_PASSWORD;
const domain = process.env.MOCK_EMAIL_DOMAIN ?? 'example.com';

if (!password || password.length < 8 || password.length > 72) {
  console.error('Set MOCK_USER_PASSWORD to a password of 8–72 characters.');
  process.exit(1);
}

const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`;
const users = ['owner', 'developer', 'auditor'].map((role) => ({
  role,
  email: `mock-${role}-${runId}@${domain}`,
}));
const created = { users: [], projects: [] };

async function request(method, path, body, cookie) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    });
  } catch (error) {
    const code = error?.cause?.code;
    throw new Error(`Could not connect to the API${code ? ` (${code})` : ''}. Check that the server is running and MOCK_API_URL is correct.`);
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} returned HTTP ${response.status}`);
  }
  const data = response.status === 204 ? null : await response.json();
  return { data, cookie: response.headers.getSetCookie().find((value) => value.startsWith('token='))?.split(';', 1)[0] };
}

try {
  for (const user of users) {
    await request('POST', '/auth/signup', { email: user.email, password });
    created.users.push(user.email);
  }
  const login = await request('POST', '/auth/login', { email: users[0].email, password });
  if (!login.cookie) throw new Error('Login did not return a token cookie');

  for (const label of ['Alpha', 'Beta']) {
    const { data: project } = await request('POST', '/projects', { name: `Mock ${label} ${runId}` }, login.cookie);
    if (!project?.id || !/^[a-f\d]{24}$/i.test(project.id)) throw new Error('Project creation returned an invalid project ID');
    created.projects.push({ id: project.id, name: project.name, secretsCreated: 0 });
    const path = `/projects/${project.id}`;
    for (const user of users.slice(1)) {
      await request('POST', `${path}/members`, { email: user.email, role: user.role }, login.cookie);
    }
    for (const environment of ['development', 'staging', 'production']) {
      await request('POST', `${path}/secrets`, { key: 'MOCK_API_KEY', environment, value: `mock-${randomBytes(16).toString('hex')}` }, login.cookie);
      created.projects.at(-1).secretsCreated++;
    }
  }
  console.log('Mock data created:', JSON.stringify(created, null, 2));
} catch (error) {
  console.error('Mock data creation stopped:', error instanceof Error ? error.message : 'Unknown error');
  console.error('Already created (no automatic cleanup):', JSON.stringify(created, null, 2));
  process.exitCode = 1;
}
