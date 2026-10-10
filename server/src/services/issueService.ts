import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, paginateMeta } from '../lib/errors.js';
import { recordActivity, notifyProjectMembers, notify } from './activity.js';
import { requireProjectMembership, requireIssueAccess, getWorkspaceId } from './workspace.js';
import type { AuthenticatedRequest } from '../lib/auth.js';
import {
  createIssueSchema,
  updateIssueSchema,
  issueStatusSchema,
  assignSchema,
  severitySchema,
  commentSchema,
  relatedSchema,
  issueQuerySchema,
} from '../lib/validation.js';

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function parseIssueQuery(query: Record<string, unknown>) {
  return issueQuerySchema.parse(query);
}

function buildWhere(filters: ReturnType<typeof parseIssueQuery>, workspaceId: string) {
  const where: Record<string, unknown> = {
    project: { workspaceId },
    archived: filters.includeArchived ? undefined : false,
  };
  if (filters.search) {
    // SQLite LIKE is case-insensitive for ASCII by default, so no `mode` option.
    where.OR = [
      { title: { contains: filters.search } },
      { key: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];
  }
  if (filters.severity) where.severity = { in: filters.severity.split(',') };
  if (filters.status) where.status = { in: filters.status.split(',') };
  if (filters.type) where.type = { in: filters.type.split(',') };
  if (filters.assigneeId) where.assigneeId = filters.assigneeId === 'unassigned' ? null : filters.assigneeId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.sprintId) where.sprintId = filters.sprintId;
  if (filters.label) {
    where.labels = { some: { label: { name: { in: filters.label.split(',') } } } };
  }
  if (filters.due === 'overdue') {
    where.dueDate = { lt: new Date() };
    where.status = { notIn: ['RESOLVED', 'CLOSED'] };
  } else if (filters.due === 'week') {
    const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    where.dueDate = { lte: inWeek };
    where.status = { notIn: ['RESOLVED', 'CLOSED'] };
  }
  return where;
}

function buildOrder(sort: string, order: 'asc' | 'desc'): Prisma.IssueOrderByWithRelationInput[] {
  const dir: 'asc' | 'desc' = order === 'asc' ? 'asc' : 'desc';
  switch (sort) {
    case 'severity':
      // SQLite cannot order by enum rank directly; sort in memory for small pages
      return [{ createdAt: dir }];
    case 'dueDate':
      return [{ dueDate: dir }, { createdAt: 'desc' }];
    case 'updatedAt':
      return [{ updatedAt: dir }];
    case 'title':
      return [{ title: dir }];
    default:
      return [{ createdAt: dir }];
  }
}

export async function listIssues(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const filters = parseIssueQuery(req.query as Record<string, unknown>);
  const where = buildWhere(filters, workspaceId);

  const [total, rawIssues] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.findMany({
      where,
      orderBy: buildOrder(filters.sort, filters.order),
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        reporter: { select: { id: true, name: true, email: true, color: true } },
        assignee: { select: { id: true, name: true, email: true, color: true } },
        project: { select: { id: true, name: true, slug: true } },
        labels: { include: { label: true } },
        sprint: { select: { id: true, name: true, status: true } },
        _count: { select: { comments: true } },
      },
    }),
  ]);

  let issues = rawIssues;
  if (filters.sort === 'severity') {
    issues = [...rawIssues].sort((a, b) => {
      const diff = SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] - SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER];
      return filters.order === 'asc' ? diff : -diff;
    });
  }

  return {
    issues,
    meta: paginateMeta(filters.page, filters.limit, total),
  };
}

export async function getIssue(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const issue = await requireIssueAccess(workspaceId, issueId, req.user!.userId);

  const full = await prisma.issue.findUniqueOrThrow({
    where: { id: issue.id },
    include: {
      reporter: { select: { id: true, name: true, email: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, color: true } },
      project: { select: { id: true, name: true, slug: true, workspaceId: true } },
      labels: { include: { label: true } },
      sprint: { select: { id: true, name: true, status: true, endDate: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true, color: true } } },
        orderBy: { createdAt: 'asc' },
      },
      relatedFrom: { include: { target: { select: { id: true, key: true, title: true, severity: true, status: true } } } },
      relatedTo: { include: { source: { select: { id: true, key: true, title: true, severity: true, status: true } } } },
      attachments: true,
    },
  });
  return full;
}

export async function createIssue(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const data = createIssueSchema.parse(req.body);

  await requireProjectMembership(workspaceId, data.projectId, req.user!.userId);

  const project = await prisma.project.findUniqueOrThrow({ where: { id: data.projectId } });
  const count = await prisma.issue.count({ where: { projectId: data.projectId } });
  // Derive a clean, stable key prefix from the project name's first word
  // (e.g. "Web Client" -> "WEB"), not from the slug which carries a
  // random suffix that would produce keys like "WEBMV2JCUSS-1".
  const prefix = (project.name.match(/[A-Za-z]+/)?.[0] ?? 'ISS').toUpperCase().slice(0, 8);
  const key = `${prefix}-${count + 1}`;

  if (data.assigneeId) {
    const isMember = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: data.assigneeId, projectId: data.projectId } },
    });
    if (!isMember) throw new AppError(400, 'ASSIGNEE_NOT_MEMBER', 'Assignee is not a member of this project');
  }

  if (data.labelIds && data.labelIds.length > 0) {
    const labels = await prisma.label.findMany({
      where: { id: { in: data.labelIds }, workspaceId },
      select: { id: true },
    });
    if (labels.length !== data.labelIds.length) {
      throw new AppError(400, 'LABEL_NOT_FOUND', 'One or more labels do not exist in this workspace');
    }
  }

  const issue = await prisma.issue.create({
    data: {
      key,
      title: data.title,
      description: data.description,
      reproductionSteps: data.reproductionSteps,
      expectedResult: data.expectedResult,
      actualResult: data.actualResult,
      severity: data.severity,
      status: data.status,
      type: data.type,
      environment: data.environment,
      browser: data.browser,
      os: data.os,
      dueDate: data.dueDate ?? null,
      reporterId: req.user!.userId,
      assigneeId: data.assigneeId ?? null,
      projectId: data.projectId,
      sprintId: data.sprintId ?? null,
      labels: data.labelIds?.length
        ? { create: data.labelIds.map((labelId) => ({ labelId })) }
        : undefined,
    },
    include: {
      reporter: { select: { id: true, name: true, email: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, color: true } },
      project: { select: { id: true, name: true, slug: true } },
      labels: { include: { label: true } },
    },
  });

  await recordActivity({
    type: 'ISSUE_CREATED',
    workspaceId,
    projectId: data.projectId,
    issueId: issue.id,
    actorId: req.user!.userId,
    payload: { key: issue.key, title: issue.title, severity: issue.severity },
  });

  if (data.assigneeId && data.assigneeId !== req.user!.userId) {
    await notifyProjectMembers({
      projectId: data.projectId,
      workspaceId,
      excludeUserId: req.user!.userId,
      type: 'ISSUE_ASSIGNED',
      message: `${issue.key} was assigned to ${issue.assignee?.name ?? 'a developer'}`,
      issueId: issue.id,
    });
  }

  return issue;
}

export async function updateIssue(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const data = updateIssueSchema.parse(req.body);

  if (data.assigneeId !== undefined && data.assigneeId !== null) {
    const isMember = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: data.assigneeId, projectId: existing.projectId } },
    });
    if (!isMember) throw new AppError(400, 'ASSIGNEE_NOT_MEMBER', 'Assignee is not a member of this project');
  }

  if (data.labelIds) {
    const labels = await prisma.label.findMany({
      where: { id: { in: data.labelIds }, workspaceId },
      select: { id: true },
    });
    if (labels.length !== data.labelIds.length) {
      throw new AppError(400, 'LABEL_NOT_FOUND', 'One or more labels do not exist in this workspace');
    }
  }

  const changes: Record<string, unknown> = {};
  for (const field of ['title', 'description', 'reproductionSteps', 'expectedResult', 'actualResult', 'severity', 'type', 'environment', 'browser', 'os'] as const) {
    if (data[field] !== undefined) changes[field] = data[field];
  }
  if (data.assigneeId !== undefined) changes.assigneeId = data.assigneeId;
  if (data.dueDate !== undefined) changes.dueDate = data.dueDate;
  if (data.sprintId !== undefined) changes.sprintId = data.sprintId;

  const issue = await prisma.issue.update({
    where: { id: existing.id },
    data: {
      ...changes,
      labels: data.labelIds
        ? { deleteMany: {}, create: data.labelIds.map((labelId) => ({ labelId })) }
        : undefined,
    },
    include: {
      reporter: { select: { id: true, name: true, email: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, color: true } },
      project: { select: { id: true, name: true, slug: true } },
      labels: { include: { label: true } },
    },
  });

  await recordActivity({
    type: 'ISSUE_UPDATED',
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key, changes: Object.keys(changes) },
  });

  if (data.assigneeId && data.assigneeId !== existing.assigneeId && data.assigneeId !== req.user!.userId) {
    await notifyProjectMembers({
      projectId: existing.projectId,
      workspaceId,
      excludeUserId: req.user!.userId,
      type: 'ISSUE_ASSIGNED',
      message: `${existing.key} was assigned to ${issue.assignee?.name ?? 'a developer'}`,
      issueId: existing.id,
    });
  }

  return issue;
}

export async function changeIssueStatus(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const { status } = issueStatusSchema.parse(req.body);

  if (existing.status === status) return getIssue(req, issueId);

  const isResolution = (s: string) => s === 'RESOLVED' || s === 'CLOSED';
  const wasResolved = isResolution(existing.status);
  const nowResolved = isResolution(status);

  const issue = await prisma.issue.update({
    where: { id: existing.id },
    data: {
      status,
      resolvedAt: nowResolved && !wasResolved ? new Date() : !nowResolved ? null : existing.resolvedAt,
    },
    include: {
      reporter: { select: { id: true, name: true, email: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, color: true } },
      project: { select: { id: true, name: true, slug: true } },
      labels: { include: { label: true } },
    },
  });

  const type = nowResolved && !wasResolved
    ? 'ISSUE_RESOLVED'
    : !nowResolved && wasResolved
      ? 'ISSUE_REOPENED'
      : 'ISSUE_STATUS_CHANGED';

  await recordActivity({
    type,
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key, from: existing.status, to: status },
  });

  if (existing.reporterId !== req.user!.userId) {
    await notify({
      userId: existing.reporterId,
      type: 'ISSUE_STATUS_CHANGED',
      message: `${existing.key} moved to ${status.replace('_', ' ').toLowerCase()}`,
      issueId: existing.id,
      projectId: existing.projectId,
    });
  }

  return issue;
}

export async function changeIssueSeverity(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const { severity } = severitySchema.parse(req.body);

  if (existing.severity === severity) return getIssue(req, issueId);

  const issue = await prisma.issue.update({
    where: { id: existing.id },
    data: { severity },
    include: {
      reporter: { select: { id: true, name: true, email: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, color: true } },
      project: { select: { id: true, name: true, slug: true } },
      labels: { include: { label: true } },
    },
  });

  await recordActivity({
    type: 'ISSUE_SEVERITY_CHANGED',
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key, from: existing.severity, to: severity },
  });

  return issue;
}

export async function assignIssue(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const { assigneeId } = assignSchema.parse(req.body);

  if (assigneeId) {
    const isMember = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: assigneeId, projectId: existing.projectId } },
    });
    if (!isMember) throw new AppError(400, 'ASSIGNEE_NOT_MEMBER', 'Assignee is not a member of this project');
  }

  const issue = await prisma.issue.update({
    where: { id: existing.id },
    data: { assigneeId },
    include: {
      reporter: { select: { id: true, name: true, email: true, color: true } },
      assignee: { select: { id: true, name: true, email: true, color: true } },
      project: { select: { id: true, name: true, slug: true } },
      labels: { include: { label: true } },
    },
  });

  await recordActivity({
    type: 'ISSUE_ASSIGNED',
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key, assigneeId: assigneeId ?? 'unassigned' },
  });

  if (assigneeId && assigneeId !== req.user!.userId) {
    await notify({
      userId: assigneeId,
      type: 'ISSUE_ASSIGNED',
      message: `${existing.key} was assigned to you`,
      issueId: existing.id,
      projectId: existing.projectId,
    });
  }

  return issue;
}

export async function addComment(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const { body } = commentSchema.parse(req.body);

  const comment = await prisma.comment.create({
    data: {
      body,
      issueId: existing.id,
      authorId: req.user!.userId,
    },
    include: { author: { select: { id: true, name: true, email: true, color: true } } },
  });

  await prisma.issue.update({ where: { id: existing.id }, data: { updatedAt: new Date() } });

  await recordActivity({
    type: 'COMMENT_CREATED',
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key },
  });

  const watchers = new Set<string>([existing.reporterId, existing.assigneeId ?? '']);
  watchers.delete(req.user!.userId);
  watchers.delete('');
  for (const userId of watchers) {
    await notify({
      userId,
      type: 'COMMENT_CREATED',
      message: `New comment on ${existing.key}`,
      issueId: existing.id,
      projectId: existing.projectId,
    });
  }

  return comment;
}

export async function archiveIssue(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);

  const issue = await prisma.issue.update({
    where: { id: existing.id },
    data: { archived: !existing.archived },
  });

  await recordActivity({
    type: 'ISSUE_ARCHIVED',
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key, archived: issue.archived },
  });

  return issue;
}

export async function addRelatedIssue(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const existing = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const { targetId, type } = relatedSchema.parse(req.body);

  if (targetId === existing.id) throw new AppError(400, 'INVALID_RELATION', 'An issue cannot relate to itself');

  const target = await requireIssueAccess(workspaceId, targetId, req.user!.userId);

  const relation = await prisma.issueRelation.create({
    data: { sourceId: existing.id, targetId: target.id, type },
    include: { target: { select: { id: true, key: true, title: true, severity: true, status: true } } },
  });

  await recordActivity({
    type: 'ISSUE_UPDATED',
    workspaceId,
    projectId: existing.projectId,
    issueId: existing.id,
    actorId: req.user!.userId,
    payload: { key: existing.key, relation: type, targetKey: target.key },
  });

  return relation;
}

export async function listIssueActivity(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  await requireIssueAccess(workspaceId, issueId, req.user!.userId);

  return prisma.activityEvent.findMany({
    where: { issueId },
    include: { actor: { select: { id: true, name: true, email: true, color: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
