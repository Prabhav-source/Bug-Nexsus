import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, api, json, registerUser, cleanupDatabase, type TestServer, type ApiClient } from './helpers.js';

describe('Auth API', () => {
  let server: TestServer;
  let client: ApiClient;

  beforeAll(async () => {
    server = await startTestServer();
    client = api(server.baseUrl);
    await cleanupDatabase();
  });

  afterAll(async () => {
    await server.close();
  });

  it('registers a new user and creates a workspace', async () => {
    const res = await client.post('/api/auth/register', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'securepass123',
      workspaceName: 'Ada Team',
    });
    expect(res.status).toBe(201);
    const body = await json<{ success: boolean; data: { user: { name: string; role: string }; workspace: { name: string }; token: string } }>(res);
    expect(body.success).toBe(true);
    expect(body.data.user.name).toBe('Ada Lovelace');
    expect(body.data.user.role).toBe('OWNER');
    expect(body.data.workspace.name).toBe('Ada Team');
    expect(typeof body.data.token).toBe('string');
  });

  it('rejects duplicate email registration', async () => {
    const res = await client.post('/api/auth/register', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'securepass123',
    });
    expect(res.status).toBe(409);
    const body = await json<{ success: boolean; error: { code: string } }>(res);
    expect(body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in with valid credentials', async () => {
    const res = await client.post('/api/auth/login', {
      email: 'ada@example.com',
      password: 'securepass123',
    });
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: { user: { email: string }; token: string } }>(res);
    expect(body.data.user.email).toBe('ada@example.com');
    expect(typeof body.data.token).toBe('string');
  });

  it('rejects invalid password', async () => {
    const res = await client.post('/api/auth/login', {
      email: 'ada@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    const body = await json<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('AUTH_FAILED');
  });

  it('rejects unknown email', async () => {
    const res = await client.post('/api/auth/login', {
      email: 'nobody@example.com',
      password: 'whatever123',
    });
    expect(res.status).toBe(401);
  });

  it('returns current user from /me with token', async () => {
    const user = await registerUser(client, 'Me User');
    const res = await client.get('/api/auth/me', user.headers);
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean; data: { user: { name: string }; workspaces: { id: string }[] } }>(res);
    expect(body.data.user.name).toBe('Me User');
    expect(body.data.workspaces.length).toBeGreaterThan(0);
  });

  it('rejects /me without a token', async () => {
    const res = await client.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects /me with a malformed token', async () => {
    const res = await client.get('/api/auth/me', { Authorization: 'Bearer not-a-real-token' });
    expect(res.status).toBe(401);
  });

  it('validates registration input', async () => {
    const res = await client.post('/api/auth/register', {
      name: 'X',
      email: 'not-an-email',
      password: 'short',
    });
    expect(res.status).toBe(400);
    const body = await json<{ error: { code: string } }>(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
