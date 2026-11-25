import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMembershipModel } from '../models/ProjectMembership.js';
import { UserModel } from '../models/User.js';
import { connectDisposableTestDb, type TestDbHandle } from './test-db.js';
let db: TestDbHandle;
const app = createApp();
const origin = 'http://localhost:5173';
beforeAll(async () => {
    process.env.CLIENT_ORIGIN = origin;
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    process.env.MASTER_KEY = randomBytes(32).toString('base64');
    process.env.MASTER_KEY_VERSION = '1';
    db = await connectDisposableTestDb('candidates');
}, 30000);
afterAll(async () => {
    await db?.disconnect();
}, 30000);
it('searches active non-members with literal matching and scoped pagination, and enforces membership permissions', async (context) => {
    if (!db.connected) context.skip();
    const users = await UserModel.create(
        Array.from({ length: 15 }, (_, index) => ({
            email: `candidate${index}@example.test`,
            username: `candidate_${index}`,
            passwordHash: 'unused-synthetic-hash',
            isActive: index !== 14,
        })),
    );
    const cookie = (index: number) =>
        `token=${jwt.sign({ sub: users[index]._id.toString(), tv: 0, pa: false }, process.env.JWT_SECRET!, { algorithm: 'HS256' })}`;
    const project = await request(app)
        .post('/api/projects')
        .set('Origin', origin)
        .set('Cookie', cookie(0))
        .send({ name: 'Candidates' })
        .expect(201);
    const url = `/api/projects/${project.body.id}/members/candidates`;
    await ProjectMembershipModel.create({
        projectId: project.body.id,
        userId: users[1]._id,
        role: 'developer',
    });
    const search = (index: number, query: Record<string, string>) =>
        request(app).get(url).query(query).set('Cookie', cookie(index));
    const first = await search(0, { search: 'CANDIDATE_' }).expect(200);
    expect(first.body.data).toHaveLength(10);
    expect(first.body.nextCursor).toBeTruthy();
    expect(Object.keys(first.body.data[0]).sort()).toEqual(['email', 'id', 'username']);
    const next = await search(0, { search: 'CANDIDATE_', cursor: first.body.nextCursor }).expect(
        200,
    );
    expect(next.body.data).toHaveLength(2);
    expect(next.body.nextCursor).toBeNull();
    expect(
        new Set([...first.body.data, ...next.body.data].map((user: { id: string }) => user.id))
            .size,
    ).toBe(12);
    const byEmail = await search(0, { search: 'candidate13@' }).expect(200);
    expect(byEmail.body.data.map((user: { username: string }) => user.username)).toEqual([
        'candidate_13',
    ]);
    const literal = await search(0, { search: '.*' }).expect(200);
    expect(literal.body.data).toEqual([]);
    await search(0, { search: 'other', cursor: first.body.nextCursor }).expect(422);
    await search(0, { search: 'a' }).expect(422);
    await search(2, { search: 'candidate' }).expect(404);
    await search(1, { search: 'candidate' }).expect(403);
    await UserModel.updateOne({ _id: users[2]._id }, { isPlatformAdmin: true });
    await search(2, { search: 'candidate' }).expect(404);
    await ProjectModel.updateOne({ _id: project.body.id }, { status: 'archived' });
    await search(0, { search: 'candidate' }).expect(403);
}, 30000);
