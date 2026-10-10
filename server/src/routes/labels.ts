import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError, success } from '../lib/errors.js';
import { getWorkspaceId } from '../services/workspace.js';
import { recordActivity } from '../services/activity.js';
import { createLabelSchema } from '../lib/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const labels = await prisma.label.findMany({
    where: { workspaceId },
    include: { _count: { select: { issues: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(success(labels.map((l) => ({ ...l, issueCount: l._count.issues }))));
}));

router.post('/', validate(createLabelSchema), asyncHandler(async (req, res) => {
  const workspaceId = await getWorkspaceId(req);
  const { name, color } = req.body;

  const existing = await prisma.label.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
  if (existing) throw new AppError(409, 'LABEL_EXISTS', 'A label with this name already exists');

  const label = await prisma.label.create({
    data: { name, color: color ?? '#FF1744', workspaceId },
  });

  await recordActivity({
    type: 'LABEL_CREATED',
    workspaceId,
    actorId: req.user!.userId,
    payload: { name: label.name },
  });

  res.status(201).json(success(label));
}));

export default router;
