import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { success } from '../lib/errors.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(success(notifications));
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.userId, read: false },
  });
  res.json(success({ count }));
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirstOrThrow({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  res.json(success(updated));
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.userId, read: false },
    data: { read: true },
  });
  res.json(success({ readAll: true }));
}));

export default router;
