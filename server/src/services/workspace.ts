import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import type { AuthenticatedRequest } from '../lib/auth.js';

/**
 * Resolves the workspace context for a request.
 * Uses the x-workspace-id header when present and the user is a member;
 * otherwise falls back to the user's first workspace membership.
 */
export async function getWorkspaceId(req: AuthenticatedRequest): Promise<string> {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');

  const headerWorkspace = req.headers['x-workspace-id'];
  if (typeof headerWorkspace === 'string') {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: req.user.userId, workspaceId: headerWorkspace } },
    });
    if (membership) return headerWorkspace;
    throw new AppError(403, 'WORKSPACE_ACCESS_DENIED', 'You are not a member of this workspace');
  }

  const first = await prisma.workspaceMembership.findFirst({
    where: { userId: req.user.userId },
    orderBy: { joinedAt: 'asc' },
  });
  if (!first) throw new AppError(403, 'NO_WORKSPACE', 'You do not belong to any workspace');
  return first.workspaceId;
}

export async function requireProjectMembership(workspaceId: string, projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
  });
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) {
    throw new AppError(403, 'PROJECT_ACCESS_DENIED', 'You are not a member of this project');
  }
  return project;
}

export async function requireIssueAccess(workspaceId: string, issueId: string, userId: string) {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, project: { workspaceId } },
    include: { project: true },
  });
  if (!issue || issue.archived) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId: issue.projectId } },
  });
  if (!membership) {
    throw new AppError(403, 'ISSUE_ACCESS_DENIED', 'You do not have access to this issue');
  }
  return issue;
}
