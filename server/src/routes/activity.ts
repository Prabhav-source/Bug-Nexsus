import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { success } from '../lib/errors.js';
import { getWorkspaceId } from '../services/workspace.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const issueId = typeof req.query.issueId === 'string' ? req.query.issueId : undefined;

  const where: Record<string, unknown> = { workspaceId };
  if (issueId) where.issueId = issueId;

  const events = await prisma.activityEvent.findMany({
    where,
    include: {
      actor: { select: { id: true, name: true, email: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // ActivityEvent stores projectId as a plain string (no relation), so
  // project names are resolved in a second query.
  const projectIds = [...new Set(events.map((e) => e.projectId).filter(Boolean))] as string[];
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  res.json(success(
    events.map((e) => ({
      ...e,
      project: e.projectId ? projectById.get(e.projectId) ?? null : null,
      payload: e.payload ? JSON.parse(e.payload) : null,
    })),
  ));
}));

export default router;
