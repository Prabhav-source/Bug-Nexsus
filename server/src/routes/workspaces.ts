import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError, success } from '../lib/errors.js';
import { getWorkspaceId } from '../services/workspace.js';
import { createWorkspaceSchema } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const workspaces = await prisma.workspaceMembership.findMany({
    where: { userId: req.user!.userId },
    include: {
      workspace: {
        include: {
          _count: { select: { projects: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
  res.json(success(
    workspaces.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      projectCount: m.workspace._count.projects,
    })),
  ));
}));

router.post('/', validate(createWorkspaceSchema), asyncHandler(async (req, res) => {
  const { name } = req.body;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
  const workspace = await prisma.workspace.create({ data: { name, slug } });
  await prisma.workspaceMembership.create({
    data: { userId: req.user!.userId, workspaceId: workspace.id, role: 'OWNER' },
  });
  res.status(201).json(success({ id: workspace.id, name: workspace.name, slug: workspace.slug }));
}));

router.get('/:id/members', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  if (req.params.id !== workspaceId) {
    // Verify membership of the requested workspace
    const membership = await prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: req.user!.userId, workspaceId: req.params.id } },
    });
    if (!membership) throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'Not a member of this workspace');
  }
  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, color: true, role: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  res.json(success(members.map((m) => ({ ...m.user, membershipRole: m.role, joinedAt: m.joinedAt }))));
}));

export default router;
