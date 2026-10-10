import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { success } from '../lib/errors.js';
import { getWorkspaceId } from '../services/workspace.js';
import { searchQuerySchema } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate(searchQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const { q, limit } = req.query as unknown as { q: string; limit: number };

  const [issues, projects, developers, labels] = await Promise.all([
    prisma.issue.findMany({
      where: {
        project: { workspaceId },
        archived: false,
        OR: [
          { title: { contains: q } },
          { key: { contains: q.toUpperCase() } },
          { description: { contains: q } },
        ],
      },
      select: {
        id: true, key: true, title: true, severity: true, status: true,
        project: { select: { id: true, name: true, slug: true } },
        assignee: { select: { id: true, name: true, color: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.findMany({
      where: {
        workspaceId,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, slug: true, description: true },
      take: limit,
    }),
    prisma.user.findMany({
      where: {
        memberships: { some: { workspaceId } },
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, name: true, email: true, color: true },
      take: limit,
    }),
    prisma.label.findMany({
      where: { workspaceId, name: { contains: q } },
      select: { id: true, name: true, color: true },
      take: limit,
    }),
  ]);

  res.json(success({ issues, projects, developers, labels }));
}));

export default router;
