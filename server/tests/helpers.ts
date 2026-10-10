import { createServer, type Server } from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export function startTestServer(): Promise<TestServer> {
  const app = createApp();
  const server: Server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

export interface ApiClient {
  get: (path: string, headers?: Record<string, string>) => Promise<Response>;
  post: (path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  patch: (path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  del: (path: string, headers?: Record<string, string>) => Promise<Response>;
}

export function api(baseUrl: string): ApiClient {
  const request = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  };
  return {
    get: (path, headers) => request('GET', path, undefined, headers),
    post: (path, body, headers) => request('POST', path, body, headers),
    patch: (path, body, headers) => request('PATCH', path, body, headers),
    del: (path, headers) => request('DELETE', path, undefined, headers),
  };
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export interface RegisteredUser {
  name: string;
  email: string;
  password: string;
  token: string;
  workspaceId: string;
  headers: Record<string, string>;
}

let counter = 0;

export async function registerUser(client: ApiClient, base = 'Test User'): Promise<RegisteredUser> {
  counter += 1;
  const email = `test-${counter}-${Date.now()}@example.com`;
  const password = 'testpassword123';
  const res = await client.post('/api/auth/register', {
    name: base,
    email,
    password,
    workspaceName: 'Test Workspace',
  });
  const body = await json<{ success: boolean; data: { token: string; workspace: { id: string } } }>(res);
  if (!body.success) throw new Error('registration failed');
  return {
    name: base,
    email,
    password,
    token: body.data.token,
    workspaceId: body.data.workspace.id,
    headers: {
      Authorization: `Bearer ${body.data.token}`,
      'X-Workspace-Id': body.data.workspace.id,
    },
  };
}

export async function createProject(client: ApiClient, user: RegisteredUser, name: string) {
  const res = await client.post('/api/projects', { name, description: `${name} description` }, user.headers);
  return json<{ success: boolean; data: { id: string; slug: string } }>(res);
}

export async function cleanupDatabase() {
  const tables = [
    'IssueLabel', 'IssueRelation', 'Comment', 'ActivityEvent', 'Notification',
    'AttachmentMetadata', 'ProjectMembership', 'WorkspaceMembership',
    'Issue', 'Sprint', 'Label', 'Project', 'Workspace', 'User',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}
