import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError, success } from '../lib/errors.js';
import { getWorkspaceId } from '../services/workspace.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);

  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, color: true, role: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  const developers = await Promise.all(
    members.map(async (m) => {
      const [assigned, open, inProgress, resolved, projects] = await Promise.all([
        prisma.issue.count({
          where: { assigneeId: m.userId, project: { workspaceId }, archived: false },
        }),
        prisma.issue.count({
          where: { assigneeId: m.userId, project: { workspaceId }, archived: false, status: 'OPEN' },
        }),
        prisma.issue.count({
          where: {
            assigneeId: m.userId,
            project: { workspaceId },
            archived: false,
            status: { in: ['IN_PROGRESS', 'IN_REVIEW'] },
          },
        }),
        prisma.issue.count({
          where: { assigneeId: m.userId, project: { workspaceId }, archived: false, resolvedAt: { not: null } },
        }),
        prisma.projectMembership.count({
          where: { userId: m.userId, project: { workspaceId } },
        }),
      ]);

      const criticalOpen = await prisma.issue.count({
        where: {
          assigneeId: m.userId,
          project: { workspaceId },
          archived: false,
          severity: 'CRITICAL',
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      });

      return {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        color: m.user.color,
        role: m.user.role,
        projectCount: projects,
        assigned,
        open,
        inProgress,
        resolved,
        criticalOpen,
        workload: open + inProgress,
      };
    }),
  );

  res.json(success(developers.sort((a, b) => b.workload - a.workload)));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, color: true, role: true, createdAt: true },
  });

  const isMember = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!isMember) throw new AppError(404, 'DEVELOPER_NOT_FOUND', 'Developer not found in this workspace');

  const issues = await prisma.issue.findMany({
    where: {
      assigneeId: user.id,
      project: { workspaceId },
      archived: false,
      status: { notIn: ['RESOLVED', 'CLOSED'] },
    },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      labels: { include: { label: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  res.json(success({ ...user, openIssues: issues }));
}));

export default router;
