import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, success, paginateMeta } from '../lib/errors.js';
import { getWorkspaceId, requireProjectMembership } from '../services/workspace.js';
import { recordActivity, notifyProjectMembers } from '../services/activity.js';
import {
  createProjectSchema,
  updateProjectSchema,
  issueQuerySchema,
} from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

type ProjectWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { issues: number; members: number };
};

function shapeProject(p: ProjectWithCount) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    issueCount: p._count?.issues ?? 0,
    memberCount: p._count?.members ?? 0,
  };
}

const DEMO_SEED: {
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
  type: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'TASK';
  daysAgoCreated: number;
  daysAgoResolved?: number;
  overdue?: boolean;
}[] = [
  { title: 'Login session expires immediately after sign-in', description: 'Users report being logged out seconds after signing in on Safari. Reproducible with "Remember me" unchecked.', severity: 'CRITICAL', status: 'OPEN', type: 'BUG', daysAgoCreated: 1 },
  { title: 'API returns 500 on large CSV export', description: 'POST /api/reports/export fails with 500 when rows exceed ~50k. Likely an unstreamed buffer write.', severity: 'HIGH', status: 'IN_PROGRESS', type: 'BUG', daysAgoCreated: 3 },
  { title: 'Webhook deliveries retry forever on 429', description: 'Webhook worker ignores Retry-After and hammers the endpoint. Add exponential backoff with jitter.', severity: 'HIGH', status: 'OPEN', type: 'IMPROVEMENT', daysAgoCreated: 2 },
  { title: 'Dashboard chart overflows on 1280px viewports', description: 'Activity trend chart clips the Y axis on smaller laptop screens.', severity: 'MEDIUM', status: 'IN_REVIEW', type: 'BUG', daysAgoCreated: 5 },
  { title: 'Add dark-mode aware email templates', description: 'Transactional emails render with white background in dark inboxes.', severity: 'MEDIUM', status: 'OPEN', type: 'FEATURE', daysAgoCreated: 6 },
  { title: 'Search ignores hyphens in issue keys', description: 'Searching "WEB-12" returns no results while "WEB12" works.', severity: 'MEDIUM', status: 'RESOLVED', type: 'BUG', daysAgoCreated: 9, daysAgoResolved: 2 },
  { title: 'Avatar colors collide for similar names', description: 'Two users named "Sam" get identical avatar hues.', severity: 'LOW', status: 'CLOSED', type: 'IMPROVEMENT', daysAgoCreated: 14, daysAgoResolved: 8 },
  { title: 'Mobile offline queue drops attachments', description: 'Queued offline issues lose attachments larger than 5MB on retry.', severity: 'CRITICAL', status: 'IN_PROGRESS', type: 'BUG', daysAgoCreated: 2, overdue: true },
  { title: 'Audit log missing actor for API keys', description: 'Events created via API key show "System" instead of the key owner.', severity: 'HIGH', status: 'OPEN', type: 'BUG', daysAgoCreated: 7 },
  { title: 'Add keyboard shortcut to jump between issues', description: 'Power users want j/k navigation on the issues list.', severity: 'LOW', status: 'OPEN', type: 'FEATURE', daysAgoCreated: 8 },
  { title: 'Stripe webhook signature check fails on retries', description: 'Second delivery attempt fails signature verification.', severity: 'MEDIUM', status: 'RESOLVED', type: 'BUG', daysAgoCreated: 12, daysAgoResolved: 4 },
  { title: 'Overdue sprint banner copy repeats itself', description: 'Tighten the overdue banner copy and link to the sprint.', severity: 'LOW', status: 'OPEN', type: 'TASK', daysAgoCreated: 4, overdue: true },
];

/**
 * Seed a demo project with realistic issues so a fresh workspace instantly
 * shows dashboard analytics.
 */
router.post('/demo', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);

  const existing = await prisma.project.findFirst({
    where: { workspaceId, name: { contains: 'Demo' } },
  });
  if (existing) {
    const found = await prisma.project.findUniqueOrThrow({
      where: { id: existing.id },
      include: { _count: { select: { issues: true, members: true } } },
    });
    res.json(success({ project: shapeProject(found), seeded: false, message: 'Demo project already exists' }));
    return;
  }

  const slug = `demo-showcase-${Date.now().toString(36)}`;
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name: 'Demo Showcase',
        description: 'Sample project with realistic bugs for exploring analytics. Safe to delete.',
        slug,
        workspaceId,
      },
      include: { _count: { select: { issues: true, members: true } } },
    });
    await tx.projectMembership.create({
      data: { projectId: p.id, userId: req.user!.userId, role: 'ADMIN' },
    });
    return p;
  });

  await recordActivity({
    type: 'PROJECT_CREATED',
    workspaceId,
    projectId: project.id,
    actorId: req.user!.userId,
    payload: { name: project.name, source: 'demo-seed' },
  });

  let n = 0;
  for (const seed of DEMO_SEED) {
    n += 1;
    const createdAt = new Date(Date.now() - seed.daysAgoCreated * 24 * 60 * 60 * 1000);
    const resolvedAt = seed.daysAgoResolved !== undefined
      ? new Date(Date.now() - seed.daysAgoResolved * 24 * 60 * 60 * 1000)
      : null;
    const issue = await prisma.issue.create({
      data: {
        key: `DEMO-${n}`,
        title: seed.title,
        description: seed.description,
        severity: seed.severity,
        status: seed.status,
        type: seed.type,
        reporterId: req.user!.userId,
        projectId: project.id,
        createdAt,
        updatedAt: resolvedAt ?? createdAt,
        resolvedAt,
        dueDate: seed.overdue ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : null,
      },
    });
    await recordActivity({
      type: seed.status === 'RESOLVED' || seed.status === 'CLOSED' ? 'ISSUE_RESOLVED' : 'ISSUE_CREATED',
      workspaceId,
      projectId: project.id,
      issueId: issue.id,
      actorId: req.user!.userId,
      payload: { key: issue.key, title: issue.title, source: 'demo-seed' },
    });
  }

  const full = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { _count: { select: { issues: true, members: true } } },
  });
  res.status(201).json(success({ project: shapeProject(full), seeded: true, issues: n }));
}));

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const projects = await prisma.project.findMany({
    where: { workspaceId },
    include: {
      _count: { select: { issues: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(success(projects.map(shapeProject)));
}));

router.post('/', validate(createProjectSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const { name, description, memberIds, repoUrl } = req.body as {
    name: string;
    description?: string;
    memberIds?: string[];
    repoUrl?: string;
  };

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: { name, description, slug, workspaceId },
      include: { _count: { select: { issues: true, members: true } } },
    });
    await tx.projectMembership.create({
      data: { projectId: created.id, userId: req.user!.userId, role: 'ADMIN' },
    });
    if (memberIds?.length) {
      const uniqueIds = [...new Set(memberIds.filter((id: string) => id !== req.user!.userId))];
      for (const id of uniqueIds) {
        await tx.projectMembership.create({ data: { projectId: created.id, userId: id } });
      }
    }
    return created;
  });

  await recordActivity({
    type: 'PROJECT_CREATED',
    workspaceId,
    projectId: project.id,
    actorId: req.user!.userId,
    payload: { name: project.name },
  });

  res.status(201).json(success(shapeProject(project)));
}));

const importRepoSchema = z.object({
  repoUrl: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .refine(
      (v) =>
        /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?(?:[?#].*)?$/.test(v) ||
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v),
      { message: 'Enter a valid GitHub repo URL (https://github.com/owner/repo) or owner/repo' },
    ),
  name: z.string().trim().min(2).max(100).optional(),
  importIssues: z.coerce.boolean().optional().default(true),
  maxIssues: z.coerce.number().int().min(1).max(50).optional().default(20),
});

function parseRepoRef(repoUrl: string): { owner: string; repo: string } {
  const short = repoUrl.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (short) return { owner: short[1], repo: short[2].replace(/\.git$/, '') };
  const m = repoUrl.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/|[?#]|$)/);
  if (!m) throw new AppError(400, 'INVALID_REPO_URL', 'Could not parse a GitHub owner/repo from that URL');
  return { owner: m[1], repo: m[2] };
}

async function githubJson(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bugnexus-2.0',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (res.status === 404) throw new AppError(404, 'REPO_NOT_FOUND', 'Repository not found on GitHub. Check the URL and that the repo is public.');
  if (res.status === 403 || res.status === 429) {
    throw new AppError(429, 'GITHUB_RATE_LIMITED', 'GitHub API rate limit reached. Set a GITHUB_TOKEN on the server or try again later.');
  }
  if (!res.ok) throw new AppError(502, 'GITHUB_ERROR', `GitHub request failed (${res.status})`);
  return res.json() as Promise<any>;
}

type GhLabel = { name?: string };

function mapSeverity(labels: GhLabel[] = []): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const names = labels.map((l) => (l.name ?? '').toLowerCase());
  if (names.some((n) => /critical|p0|blocker|urgent|security/.test(n))) return 'CRITICAL';
  if (names.some((n) => /high|p1|major|bug/.test(n))) return 'HIGH';
  if (names.some((n) => /medium|p2|enhancement|help/.test(n))) return 'MEDIUM';
  return 'LOW';
}

type GhIssue = {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  labels?: GhLabel[];
  pull_request?: unknown;
  user?: { login?: string };
  created_at: string;
};

/**
 * Import a project from a public GitHub repository. The repo becomes the
 * project; each open GitHub issue becomes a BugNexus issue (severity mapped
 * from labels, PRs skipped) so the dashboard immediately shows real analysis.
 */
router.post('/import/github', validate(importRepoSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const { repoUrl, name, importIssues, maxIssues } = req.body as {
    repoUrl: string;
    name?: string;
    importIssues: boolean;
    maxIssues: number;
  };

  const { owner, repo } = parseRepoRef(repoUrl);
  const meta = await githubJson(`https://api.github.com/repos/${owner}/${repo}`);

  const projectName = (name?.trim() || meta.name || repo).slice(0, 100);
  const description = [
    meta.description ?? null,
    `Imported from GitHub: https://github.com/${owner}/${repo}`,
    meta.language ? `Primary language: ${meta.language}` : null,
    typeof meta.stargazers_count === 'number'
      ? `Stars ${meta.stargazers_count} / Forks ${meta.forks_count ?? 0} / Open ${meta.open_issues_count ?? 0}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const slug = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'repo'}-${Date.now().toString(36)}`;

  const created = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: { name: projectName, description, slug, workspaceId },
      include: { _count: { select: { issues: true, members: true } } },
    });
    await tx.projectMembership.create({
      data: { projectId: p.id, userId: req.user!.userId, role: 'ADMIN' },
    });
    return p;
  });

  await recordActivity({
    type: 'PROJECT_CREATED',
    workspaceId,
    projectId: created.id,
    actorId: req.user!.userId,
    payload: { name: created.name, source: 'github', repo: `${owner}/${repo}` },
  });

  let imported = 0;
  let prsSkipped = 0;
  if (importIssues) {
    const items = (await githubJson(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=${maxIssues}&sort=created&direction=desc`,
    )) as GhIssue[];
    const prefix = (projectName.match(/[A-Za-z]+/)?.[0] ?? 'ISS').toUpperCase().slice(0, 8);
    let n = 0;
    for (const item of items.slice(0, maxIssues)) {
      if (item.pull_request) { prsSkipped += 1; continue; }
      n += 1;
      const severity = mapSeverity(item.labels ?? []);
      const labelText = (item.labels ?? []).map((l) => l.name).filter(Boolean).join(', ');
      await prisma.issue.create({
        data: {
          key: `${prefix}-${n}`,
          title: item.title.slice(0, 200),
          description: [
            item.body ? item.body.slice(0, 8000) : null,
            '',
            `GitHub #${item.number} by ${item.user?.login ?? 'unknown'} on ${item.created_at?.slice(0, 10) ?? ''}`,
            item.html_url,
            labelText ? `Labels: ${labelText}` : null,
          ]
            .filter((x) => x !== null)
            .join('\n'),
          severity,
          status: 'OPEN',
          type: /feature|enhancement|proposal/i.test(labelText) ? 'FEATURE' : 'BUG',
          reporterId: req.user!.userId,
          projectId: created.id,
        },
      });
    }
    imported = n;
  }

  const full = await prisma.project.findUniqueOrThrow({
    where: { id: created.id },
    include: { _count: { select: { issues: true, members: true } } },
  });

  res.status(201).json(
    success({
      ...shapeProject(full),
      repo: {
        owner,
        name: repo,
        url: `https://github.com/${owner}/${repo}`,
        stars: meta.stargazers_count ?? 0,
        forks: meta.forks_count ?? 0,
        openIssues: meta.open_issues_count ?? 0,
        language: meta.language ?? null,
      },
      imported: { issues: imported, pullRequestsSkipped: prsSkipped },
    }),
  );
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const project = await requireProjectMembership(workspaceId, req.params.id, req.user!.userId);

  const full = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: {
      _count: { select: { issues: true, members: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, color: true, role: true } } },
      },
      sprints: { orderBy: { startDate: 'desc' }, take: 5 },
    },
  });

  const [open, inProgress, resolved, critical] = await Promise.all([
    prisma.issue.count({ where: { projectId: project.id, archived: false, status: 'OPEN' } }),
    prisma.issue.count({ where: { projectId: project.id, archived: false, status: 'IN_PROGRESS' } }),
    prisma.issue.count({ where: { projectId: project.id, archived: false, resolvedAt: { not: null } } }),
    prisma.issue.count({
      where: { projectId: project.id, archived: false, severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } },
    }),
  ]);

  res.json(success({
    ...shapeProject(full),
    stats: { open, inProgress, resolved, critical },
    members: full.members.map((m) => ({ ...m.user, membershipRole: m.role })),
    sprints: full.sprints,
  }));
}));

router.patch('/:id', validate(updateProjectSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const project = await requireProjectMembership(workspaceId, req.params.id, req.user!.userId);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: req.body,
    include: { _count: { select: { issues: true, members: true } } },
  });

  await recordActivity({
    type: 'PROJECT_UPDATED',
    workspaceId,
    projectId: project.id,
    actorId: req.user!.userId,
    payload: { name: updated.name },
  });

  res.json(success(shapeProject(updated)));
}));

router.post('/:id/members', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const project = await requireProjectMembership(workspaceId, req.params.id, req.user!.userId);
  const { userId } = req.body as { userId: string };
  if (!userId) throw new AppError(400, 'VALIDATION_ERROR', 'userId is required');

  const isWorkspaceMember = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!isWorkspaceMember) throw new AppError(400, 'NOT_WORKSPACE_MEMBER', 'User is not in this workspace');

  await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId, projectId: project.id } },
    create: { userId, projectId: project.id },
    update: {},
  });

  res.status(201).json(success({ added: true }));
}));

router.delete('/:id/members/:userId', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const project = await requireProjectMembership(workspaceId, req.params.id, req.user!.userId);

  await prisma.projectMembership.deleteMany({
    where: { projectId: project.id, userId: req.params.userId },
  });

  res.json(success({ removed: true }));
}));

router.get('/:id/issues', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  await requireProjectMembership(workspaceId, req.params.id, req.user!.userId);

  const filters = issueQuerySchema.parse({ ...req.query, projectId: req.params.id });
  const where: Record<string, unknown> = {
    projectId: req.params.id,
    archived: filters.includeArchived ? undefined : false,
  };
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { key: { contains: filters.search } },
    ];
  }
  if (filters.severity) where.severity = { in: filters.severity.split(',') };
  if (filters.status) where.status = { in: filters.status.split(',') };

  const [total, issues] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.findMany({
      where,
      orderBy: { createdAt: filters.order === 'asc' ? 'asc' : 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        reporter: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, color: true } },
        labels: { include: { label: true } },
      },
    }),
  ]);

  res.json(success({ issues, meta: paginateMeta(filters.page, filters.limit, total) }));
}));

export default router;
