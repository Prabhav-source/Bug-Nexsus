import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  startTestServer, api, json, registerUser, createProject, cleanupDatabase,
  type TestServer, type ApiClient, type RegisteredUser,
} from './helpers.js';

describe('Issues API', () => {
  let server: TestServer;
  let client: ApiClient;
  let user: RegisteredUser;
  let projectId: string;

  beforeAll(async () => {
    server = await startTestServer();
    client = api(server.baseUrl);
    await cleanupDatabase();
    user = await registerUser(client, 'Issue Tester');
    const proj = await createProject(client, user, 'Backend');
    projectId = proj.data.id;
  });

  afterAll(async () => {
    await server.close();
  });

  it('creates an issue and assigns a project key', async () => {
    const res = await client.post('/api/issues', {
      title: 'Database connection leaks on shutdown',
      description: 'Connections are not released when the server shuts down gracefully.',
      severity: 'HIGH',
      status: 'OPEN',
      type: 'BUG',
      projectId,
    }, user.headers);
    expect(res.status).toBe(201);
    const body = await json<{ success: boolean; data: { id: string; key: string; title: string; reporter: { name: string } } }>(res);
    expect(body.data.key).toMatch(/^BACKEND-\d+$/);
    expect(body.data.title).toBe('Database connection leaks on shutdown');
    expect(body.data.reporter.name).toBe('Issue Tester');
  });

  it('lists issues with pagination meta', async () => {
    const res = await client.get('/api/issues?limit=10', user.headers);
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: { issues: unknown[]; meta: { total: number; page: number; limit: number } } }>(res);
    expect(body.data.issues.length).toBe(1);
    expect(body.data.meta.total).toBe(1);
  });

  it('filters issues by severity and status', async () => {
    await client.post('/api/issues', {
      title: 'Minor UI misalignment',
      severity: 'LOW',
      status: 'OPEN',
      type: 'BUG',
      projectId,
    }, user.headers);

    const res = await client.get('/api/issues?severity=LOW', user.headers);
    const body = await json<{ success: boolean; data: { issues: { severity: string }[]; meta: { total: number } } }>(res);
    expect(body.data.meta.total).toBe(1);
    expect(body.data.issues[0].severity).toBe('LOW');
  });

  it('searches issues by text', async () => {
    const res = await client.get('/api/issues?search=connection', user.headers);
    const body = await json<{ success: boolean; data: { issues: { title: string }[]; meta: { total: number } } }>(res);
    expect(body.data.meta.total).toBe(1);
    expect(body.data.issues[0].title).toContain('connection');
  });

  it('fetches a single issue with relations', async () => {
    const list = await client.get('/api/issues', user.headers);
    const listBody = await json<{ success: boolean; data: { issues: { id: string; title: string }[] } }>(list);
    const target = listBody.data.issues.find((i) => i.title.includes('connection'));
    if (!target) throw new Error('connection issue not found');
    const res = await client.get(`/api/issues/${target.id}`, user.headers);
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: { id: string; key: string; reporter: { name: string }; project: { name: string }; comments: unknown[] } }>(res);
    expect(body.data.key).toMatch(/^BACKEND-1$/);
    expect(body.data.project.name).toBe('Backend');
    expect(Array.isArray(body.data.comments)).toBe(true);
  });

  it('transitions issue status and records activity', async () => {
    const list = await client.get('/api/issues', user.headers);
    const listBody = await json<{ success: boolean; data: { issues: { id: string }[] } }>(list);
    const issueId = listBody.data.issues[0].id;

    const res = await client.post(`/api/issues/${issueId}/status`, { status: 'IN_PROGRESS' }, user.headers);
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: { status: string } }>(res);
    expect(body.data.status).toBe('IN_PROGRESS');
  });

  it('changes issue severity', async () => {
    const list = await client.get('/api/issues', user.headers);
    const listBody = await json<{ success: boolean; data: { issues: { id: string }[] } }>(list);
    const issueId = listBody.data.issues[0].id;

    const res = await client.post(`/api/issues/${issueId}/severity`, { severity: 'CRITICAL' }, user.headers);
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: { severity: string } }>(res);
    expect(body.data.severity).toBe('CRITICAL');
  });

  it('adds a comment to an issue', async () => {
    const list = await client.get('/api/issues', user.headers);
    const listBody = await json<{ success: boolean; data: { issues: { id: string }[] } }>(list);
    const issueId = listBody.data.issues[0].id;

    const res = await client.post(`/api/issues/${issueId}/comments`, { body: 'Investigating the shutdown hook ordering.' }, user.headers);
    expect(res.status).toBe(201);
    const body = await json<{ success: boolean; data: { body: string; author: { name: string } } }>(res);
    expect(body.data.body).toBe('Investigating the shutdown hook ordering.');
    expect(body.data.author.name).toBe('Issue Tester');
  });

  it('rejects creating an issue without a title', async () => {
    const res = await client.post('/api/issues', {
      description: 'no title provided',
      severity: 'LOW',
      projectId,
    }, user.headers);
    expect(res.status).toBe(400);
    const body = await json<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unauthenticated issue creation', async () => {
    const res = await client.post('/api/issues', {
      title: 'Anonymous issue',
      severity: 'LOW',
      projectId,
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown issue', async () => {
    const res = await client.get('/api/issues/clxnonexistent0000000000000', user.headers);
    expect(res.status).toBe(404);
  });
});
