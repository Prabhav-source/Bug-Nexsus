import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../lib/auth.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { AppError, success } from '../lib/errors.js';
import { registerSchema, loginSchema, createWorkspaceSchema } from '../lib/validation.js';

const router = Router();

function publicUser(u: { id: string; name: string; email: string; role: string; color: string; createdAt: Date }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, createdAt: u.createdAt };
}

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, workspaceName } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

  const passwordHash = await hashPassword(password);
  const slug = workspaceName
    ? workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : `workspace-${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash, role: 'OWNER', color: '#FF1744' },
    });
    const workspace = await tx.workspace.create({
      data: { name: workspaceName ?? `${name}'s Workspace`, slug: `${slug}-${user.id.slice(0, 6)}` },
    });
    await tx.workspaceMembership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
    });
    return { user, workspace };
  });

  const token = signToken({ userId: result.user.id, email: result.user.email, role: result.user.role });

  res.cookie('bugnexus_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json(success({
    user: publicUser(result.user),
    workspace: { id: result.workspace.id, name: result.workspace.name, slug: result.workspace.slug },
    token,
  }));
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, 'AUTH_FAILED', 'Invalid email or password');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AppError(401, 'AUTH_FAILED', 'Invalid email or password');

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  res.cookie('bugnexus_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json(success({
    user: publicUser(user),
    workspace: membership
      ? { id: membership.workspace.id, name: membership.workspace.name, slug: membership.workspace.slug }
      : null,
    token,
  }));
}));

router.post('/logout', requireAuth, (_req, res) => {
  res.clearCookie('bugnexus_token');
  res.json(success({ loggedOut: true }));
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const payload = verifyToken(req.headers.authorization!.slice(7));
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: payload.userId },
    include: {
      memberships: { include: { workspace: true } },
    },
  });
  res.json(success({
    user: publicUser(user),
    workspaces: user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  }));
}));

export default router;
