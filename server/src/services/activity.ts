import { prisma } from '../lib/prisma.js';

export type ActivityType =
  | 'ISSUE_CREATED'
  | 'ISSUE_UPDATED'
  | 'ISSUE_ASSIGNED'
  | 'ISSUE_STATUS_CHANGED'
  | 'ISSUE_SEVERITY_CHANGED'
  | 'ISSUE_RESOLVED'
  | 'ISSUE_REOPENED'
  | 'ISSUE_ARCHIVED'
  | 'COMMENT_CREATED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'SPRINT_CREATED'
  | 'SPRINT_COMPLETED'
  | 'LABEL_CREATED';

export async function recordActivity(input: {
  type: ActivityType;
  workspaceId: string;
  projectId?: string | null;
  issueId?: string | null;
  actorId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await prisma.activityEvent.create({
    data: {
      type: input.type,
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      issueId: input.issueId ?? null,
      actorId: input.actorId,
      payload: input.payload ? JSON.stringify(input.payload) : null,
    },
  });
}

export async function notify(input: {
  userId: string;
  type: string;
  message: string;
  issueId?: string | null;
  projectId?: string | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      message: input.message,
      issueId: input.issueId ?? null,
      projectId: input.projectId ?? null,
    },
  });
}

export async function notifyProjectMembers(input: {
  projectId: string;
  workspaceId: string;
  excludeUserId?: string;
  type: string;
  message: string;
  issueId?: string | null;
}): Promise<void> {
  const members = await prisma.projectMembership.findMany({
    where: { projectId: input.projectId },
    select: { userId: true },
  });
  const targets = members
    .map((m) => m.userId)
    .filter((id) => id !== input.excludeUserId);
  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      type: input.type,
      message: input.message,
      issueId: input.issueId ?? null,
      projectId: input.projectId,
    })),
  });
}
