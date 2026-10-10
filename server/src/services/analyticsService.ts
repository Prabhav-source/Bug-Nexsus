import { prisma } from '../lib/prisma.js';
import { getWorkspaceId } from './workspace.js';
import type { AuthenticatedRequest } from '../lib/auth.js';

/**
 * Project health score (0-100), computed from documented factors:
 *
 *   Base score: 100
 *   - 15 points per unresolved CRITICAL issue (max -45)
 *   -  5 points per overdue unresolved issue (max -25)
 *   - 10 points if the backlog grew over the last 14 days
 *   + 5 points if resolutions in the last 7 days exceed issues opened
 *     in the last 7 days (max +10)
 *
 * The final score is clamped to [0, 100]. It is a triage signal,
 * not a verdict: it highlights projects that need attention.
 */
export async function projectHealth(workspaceId: string, projectId: string) {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [unresolvedCritical, overdue, openedRecent, openedPrior, resolvedRecent] =
    await Promise.all([
      prisma.issue.count({
        where: { projectId, severity: 'CRITICAL', archived: false, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      prisma.issue.count({
        where: {
          projectId,
          archived: false,
          dueDate: { lt: now },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
      }),
      prisma.issue.count({ where: { projectId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.issue.count({
        where: { projectId, createdAt: { gte: twoWeeksAgo, lt: sevenDaysAgo } },
      }),
      prisma.issue.count({
        where: { projectId, resolvedAt: { gte: sevenDaysAgo } },
      }),
    ]);

  let score = 100;
  score -= Math.min(unresolvedCritical * 15, 45);
  score -= Math.min(overdue * 5, 25);
  if (openedRecent > openedPrior) score -= 10;
  if (resolvedRecent > openedRecent) score += 10;
  score = Math.max(0, Math.min(100, score));

  let label = 'HEALTHY';
  if (score < 40) label = 'AT_RISK';
  else if (score < 70) label = 'NEEDS_ATTENTION';

  return {
    score,
    label,
    factors: {
      unresolvedCritical,
      overdue,
      backlogGrowing: openedRecent > openedPrior,
      resolvingFasterThanOpened: resolvedRecent > openedRecent,
      openedLast7Days: openedRecent,
      resolvedLast7Days: resolvedRecent,
    },
  };
}

export async function dashboardOverview(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const base = { project: { workspaceId }, archived: false };

  const [open, inProgress, resolvedThisWeek, critical, total, overdue] = await Promise.all([
    prisma.issue.count({ where: { ...base, status: 'OPEN' } }),
    prisma.issue.count({ where: { ...base, status: 'IN_PROGRESS' } }),
    prisma.issue.count({ where: { ...base, resolvedAt: { gte: weekAgo } } }),
    prisma.issue.count({
      where: { ...base, severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } },
    }),
    prisma.issue.count({ where: base }),
    prisma.issue.count({
      where: { ...base, dueDate: { lt: now }, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    }),
  ]);

  return {
    openIssues: open,
    inProgress,
    resolvedThisWeek,
    criticalIssues: critical,
    totalIssues: total,
    overdueIssues: overdue,
    resolutionRate: total > 0 ? Math.round((resolvedThisWeek / Math.max(1, total)) * 100) : 0,
  };
}

export async function issueActivityTrend(req: AuthenticatedRequest, days: number) {
  const workspaceId = await getWorkspaceId(req);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [opened, resolved] = await Promise.all([
    prisma.issue.findMany({
      where: { project: { workspaceId }, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.issue.findMany({
      where: { project: { workspaceId }, resolvedAt: { gte: since } },
      select: { resolvedAt: true },
    }),
  ]);

  const buckets = new Map<string, { date: string; opened: number; resolved: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, opened: 0, resolved: 0 });
  }
  for (const i of opened) {
    const key = i.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.opened++;
  }
  for (const i of resolved) {
    const key = i.resolvedAt!.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.resolved++;
  }
  return [...buckets.values()];
}

export async function severityDistribution(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const rows = await prisma.issue.groupBy({
    by: ['severity'],
    where: { project: { workspaceId }, archived: false },
    _count: { _all: true },
  });
  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const map = new Map(rows.map((r) => [r.severity, r._count._all]));
  return order.map((severity) => ({ severity, count: map.get(severity) ?? 0 }));
}

export async function projectHealthList(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const projects = await prisma.project.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    select: { id: true, name: true, slug: true },
  });
  const results = await Promise.all(
    projects.map(async (p) => {
      const health = await projectHealth(workspaceId, p.id);
      const [open, total] = await Promise.all([
        prisma.issue.count({
          where: { projectId: p.id, archived: false, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        }),
        prisma.issue.count({ where: { projectId: p.id, archived: false } }),
      ]);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        ...health,
        openIssues: open,
        totalIssues: total,
      };
    }),
  );
  return results.sort((a, b) => a.score - b.score);
}

export async function resolutionTrends(req: AuthenticatedRequest, days: number) {
  const workspaceId = await getWorkspaceId(req);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const resolved = await prisma.issue.findMany({
    where: { project: { workspaceId }, resolvedAt: { gte: since } },
    select: { resolvedAt: true, severity: true },
  });
  const buckets = new Map<string, Record<string, number>>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
  }
  for (const i of resolved) {
    const key = i.resolvedAt!.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b[i.severity] = (b[i.severity] ?? 0) + 1;
  }
  return [...buckets.entries()].map(([date, counts]) => ({ date, ...counts }));
}

export async function teamWorkload(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const members = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, color: true } } },
  });

  const rows = await Promise.all(
    members.map(async (m) => {
      const [assigned, open, inProgress, resolved] = await Promise.all([
        prisma.issue.count({
          where: { assigneeId: m.userId, project: { workspaceId }, archived: false },
        }),
        prisma.issue.count({
          where: {
            assigneeId: m.userId,
            project: { workspaceId },
            archived: false,
            status: 'OPEN',
          },
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
      ]);
      return {
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        color: m.user.color,
        assigned,
        open,
        inProgress,
        resolved,
      };
    }),
  );
  return rows.sort((a, b) => b.open + b.inProgress - (a.open + a.inProgress));
}

export async function needsAttention(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const now = new Date();
  const issues = await prisma.issue.findMany({
    where: {
      project: { workspaceId },
      archived: false,
      OR: [
        { severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } },
        { dueDate: { lt: now }, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        { status: 'IN_REVIEW' },
      ],
    },
    include: {
      project: { select: { id: true, name: true, slug: true } },
      assignee: { select: { id: true, name: true, color: true } },
      reporter: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ severity: 'asc' }, { dueDate: 'asc' }],
    take: 10,
  });
  return issues.map((i) => ({
    ...i,
    reasons: [
      ...(i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'CLOSED' ? ['critical-severity'] : []),
      ...(i.dueDate && i.dueDate < now && i.status !== 'RESOLVED' && i.status !== 'CLOSED' ? ['overdue'] : []),
      ...(i.status === 'IN_REVIEW' ? ['awaiting-review'] : []),
    ],
  }));
}
