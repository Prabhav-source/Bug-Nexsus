import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError, success } from '../lib/errors.js';
import { getWorkspaceId, requireProjectMembership } from '../services/workspace.js';
import { recordActivity } from '../services/activity.js';
import {
  createSprintSchema,
  updateSprintSchema,
  addSprintIssuesSchema,
} from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;

  const sprints = await prisma.sprint.findMany({
    where: {
      project: { workspaceId },
      ...(projectId ? { projectId } : {}),
    },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      _count: { select: { issues: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const enriched = await Promise.all(
    sprints.map(async (s) => {
      const issues = await prisma.issue.findMany({
        where: { sprintId: s.id },
        select: { status: true },
      });
      const total = issues.length;
      const done = issues.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
      return {
        ...s,
        issueCount: s._count.issues,
        completedCount: done,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    }),
  );

  res.json(success(enriched));
}));

router.post('/', validate(createSprintSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const data = req.body;

  await requireProjectMembership(workspaceId, data.projectId, req.user!.userId);

  const sprint = await prisma.sprint.create({
    data,
    include: { project: { select: { id: true, name: true, slug: true } } },
  });

  await recordActivity({
    type: 'SPRINT_CREATED',
    workspaceId,
    projectId: data.projectId,
    actorId: req.user!.userId,
    payload: { name: sprint.name, goal: sprint.goal },
  });

  res.status(201).json(success(sprint));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const sprint = await prisma.sprint.findFirstOrThrow({
    where: { id: req.params.id, project: { workspaceId } },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      issues: {
        include: {
          assignee: { select: { id: true, name: true, color: true } },
          labels: { include: { label: true } },
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      },
    },
  });

  const total = sprint.issues.length;
  const done = sprint.issues.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  res.json(success({
    ...sprint,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    completedCount: done,
    remainingCount: total - done,
  }));
}));

router.patch('/:id', validate(updateSprintSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const sprint = await prisma.sprint.findFirstOrThrow({
    where: { id: req.params.id, project: { workspaceId } },
  });

  const updated = await prisma.sprint.update({
    where: { id: sprint.id },
    data: req.body,
  });

  res.json(success(updated));
}));

router.post('/:id/issues', validate(addSprintIssuesSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const sprint = await prisma.sprint.findFirstOrThrow({
    where: { id: req.params.id, project: { workspaceId } },
  });
  const { issueIds } = req.body;

  const issues = await prisma.issue.findMany({
    where: { id: { in: issueIds }, projectId: sprint.projectId },
    select: { id: true },
  });
  if (issues.length !== issueIds.length) {
    throw new AppError(400, 'ISSUE_NOT_IN_PROJECT', 'One or more issues are not in this sprint\'s project');
  }

  await prisma.issue.updateMany({
    where: { id: { in: issueIds } },
    data: { sprintId: sprint.id },
  });

  res.json(success({ added: issues.length }));
}));

router.delete('/:id/issues/:issueId', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const sprint = await prisma.sprint.findFirstOrThrow({
    where: { id: req.params.id, project: { workspaceId } },
  });

  await prisma.issue.updateMany({
    where: { id: req.params.issueId, sprintId: sprint.id },
    data: { sprintId: null },
  });

  res.json(success({ removed: true }));
}));

router.post('/:id/complete', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const sprint = await prisma.sprint.findFirstOrThrow({
    where: { id: req.params.id, project: { workspaceId } },
  });

  const incomplete = await prisma.issue.count({
    where: {
      sprintId: sprint.id,
      status: { notIn: ['RESOLVED', 'CLOSED'] },
    },
  });

  const updated = await prisma.sprint.update({
    where: { id: sprint.id },
    data: { status: 'COMPLETED' },
  });

  await recordActivity({
    type: 'SPRINT_COMPLETED',
    workspaceId,
    projectId: sprint.projectId,
    actorId: req.user!.userId,
    payload: { name: sprint.name, incompleteIssues: incomplete },
  });

  res.json(success({ ...updated, incompleteIssuesCarriedOver: incomplete }));
}));

export default router;
