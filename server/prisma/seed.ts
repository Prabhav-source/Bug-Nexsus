import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth.js';

const prisma = new PrismaClient();

const AVATAR_COLORS = ['#FF1744', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#FB923C', '#2DD4BF'];

interface SeedUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  color: string;
}

async function main() {
  const existingWorkspace = await prisma.workspace.findFirst();
  if (existingWorkspace) {
    console.log('[seed] Database already contains data — skipping seed to preserve existing data.');
    console.log('[seed] To reseed, delete the database file (server/prisma/dev.db) and run `npm run db:push && npm run db:seed`.');
    return;
  }

  console.log('[seed] Creating workspace and seed data…');

  const workspace = await prisma.workspace.create({
    data: { name: 'BugNexus Labs', slug: 'bugnexus-labs' },
  });

  const userSeeds: Omit<SeedUser, 'id' | 'color'>[] = [
    { name: 'Ava Chen', email: 'ava@bugnexus.dev', password: 'devpassword123', role: 'OWNER' },
    { name: 'Marcus Webb', email: 'marcus@bugnexus.dev', password: 'devpassword123', role: 'ADMIN' },
    { name: 'Priya Sharma', email: 'priya@bugnexus.dev', password: 'devpassword123', role: 'MEMBER' },
    { name: 'Diego Torres', email: 'diego@bugnexus.dev', password: 'devpassword123', role: 'MEMBER' },
    { name: 'Lena Fischer', email: 'lena@bugnexus.dev', password: 'devpassword123', role: 'MEMBER' },
    { name: 'Sam Okafor', email: 'sam@bugnexus.dev', password: 'devpassword123', role: 'MEMBER' },
    { name: 'Yuki Tanaka', email: 'yuki@bugnexus.dev', password: 'devpassword123', role: 'MEMBER' },
    { name: 'Noah Williams', email: 'noah@bugnexus.dev', password: 'devpassword123', role: 'MEMBER' },
  ];

  const users: SeedUser[] = [];
  for (let i = 0; i < userSeeds.length; i++) {
    const u = userSeeds[i];
    const created = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash: await hashPassword(u.password),
        role: u.role,
        color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      },
    });
    users.push({ ...u, id: created.id, color: created.color });
    await prisma.workspaceMembership.create({
      data: { userId: created.id, workspaceId: workspace.id, role: u.role },
    });
  }

  const [ava, marcus, priya, diego, lena, sam, yuki, noah] = users;

  const projectSeeds = [
    { name: 'Nexus API', slug: 'nexus-api', description: 'Core REST and realtime API services powering the platform.' },
    { name: 'Web Client', slug: 'web-client', description: 'The BugNexus single-page application and design system.' },
    { name: 'Mobile App', slug: 'mobile-app', description: 'iOS and Android companion application.' },
    { name: 'Infrastructure', slug: 'infrastructure', description: 'CI/CD pipelines, observability, and cloud operations.' },
  ];

  const projects: { id: string; slug: string; name: string }[] = [];
  for (const p of projectSeeds) {
    const created = await prisma.project.create({
      data: { ...p, workspaceId: workspace.id },
    });
    projects.push({ id: created.id, slug: created.slug, name: created.name });
  }

  const [nexusApi, webClient, mobileApp, infra] = projects;

  // Project memberships: everyone on web-client + nexus-api, subsets elsewhere
  const membershipMap: Record<string, string[]> = {
    [nexusApi.id]: [ava.id, marcus.id, priya.id, diego.id, sam.id],
    [webClient.id]: [ava.id, marcus.id, lena.id, yuki.id, noah.id, priya.id],
    [mobileApp.id]: [marcus.id, diego.id, yuki.id, noah.id],
    [infra.id]: [ava.id, sam.id, marcus.id],
  };
  for (const [projectId, userIds] of Object.entries(membershipMap)) {
    for (const userId of userIds) {
      await prisma.projectMembership.create({ data: { projectId, userId } });
    }
  }

  const labelSeeds: { name: string; color: string }[] = [
    { name: 'bug', color: '#FF1744' },
    { name: 'regression', color: '#D90429' },
    { name: 'feature', color: '#60A5FA' },
    { name: 'ui', color: '#A78BFA' },
    { name: 'backend', color: '#2DD4BF' },
    { name: 'security', color: '#FBBF24' },
    { name: 'performance', color: '#FB923C' },
    { name: 'docs', color: '#34D399' },
    { name: 'good-first-issue', color: '#4ADE80' },
    { name: 'needs-triage', color: '#F472B6' },
  ];
  const labels: { id: string; name: string }[] = [];
  for (const l of labelSeeds) {
    const created = await prisma.label.create({ data: { ...l, workspaceId: workspace.id } });
    labels.push({ id: created.id, name: created.name });
  }
  const labelId = (name: string) => labels.find((l) => l.name === name)!.id;

  // Sprints
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  const sprint1 = await prisma.sprint.create({
    data: {
      name: 'Sprint 14 — Stability',
      goal: 'Eliminate critical API failures and close the release-blocking backlog.',
      startDate: daysAgo(21),
      endDate: daysAgo(7),
      status: 'COMPLETED',
      projectId: nexusApi.id,
    },
  });
  const sprint2 = await prisma.sprint.create({
    data: {
      name: 'Sprint 15 — Release 2.0',
      goal: 'Ship the new dashboard, kanban drag-and-drop, and notification center.',
      startDate: daysAgo(6),
      endDate: daysFromNow(8),
      status: 'ACTIVE',
      projectId: webClient.id,
    },
  });

  interface IssueSeed {
    key: string;
    title: string;
    description: string;
    reproductionSteps?: string;
    expectedResult?: string;
    actualResult?: string;
    severity: string;
    status: string;
    type: string;
    projectId: string;
    reporterId: string;
    assigneeId?: string;
    labelNames?: string[];
    environment?: string;
    browser?: string;
    os?: string;
    dueDate?: Date | null;
    sprintId?: string | null;
    createdDaysAgo: number;
    resolvedDaysAgo?: number;
    comments?: { authorId: string; body: string; daysAgo: number }[];
  }

  const issueSeeds: IssueSeed[] = [
    // ---- Nexus API ----
    {
      key: 'NEXUS-1', title: 'API returns 500 on concurrent websocket reconnects',
      description: 'Under load, simultaneous websocket reconnects from the same user cause the gateway to return 500s. Observed during the load test with 2,000 concurrent sessions.',
      reproductionSteps: '1. Open two browser tabs authenticated as the same user.\n2. Disable network for 5 seconds, then re-enable.\n3. Both tabs reconnect at the same time.\n4. Observe gateway logs.',
      expectedResult: 'Both connections are re-established with a fresh session token.',
      actualResult: 'One or both reconnects fail with HTTP 500 and the session is invalidated.',
      severity: 'CRITICAL', status: 'IN_PROGRESS', type: 'BUG',
      projectId: nexusApi.id, reporterId: sam.id, assigneeId: marcus.id,
      labelNames: ['bug', 'backend', 'security'],
      environment: 'production', dueDate: daysFromNow(1), sprintId: sprint1.id,
      createdDaysAgo: 9,
      comments: [
        { authorId: marcus.id, body: 'Reproduced locally. The race is in the session refresh path — two reconnects share the same refresh token and the second one invalidates the first.', daysAgo: 8 },
        { authorId: sam.id, body: 'Load test results attached to the internal report. Failure rate is ~12% at 2k sessions.', daysAgo: 7 },
      ],
    },
    {
      key: 'NEXUS-2', title: 'Rate limiter blocks legitimate traffic after deploy',
      description: 'After the last deploy, the rate limiter resets buckets incorrectly, blocking legitimate clients for up to 10 minutes.',
      reproductionSteps: '1. Deploy the current main branch.\n2. Send 50 requests within a minute from a single client.\n3. Wait 60 seconds.\n4. Send another request.',
      expectedResult: 'The counter resets after the window and requests succeed.',
      actualResult: 'Requests are rejected with 429 for ~10 minutes after the window elapses.',
      severity: 'HIGH', status: 'OPEN', type: 'BUG',
      projectId: nexusApi.id, reporterId: priya.id, assigneeId: sam.id,
      labelNames: ['bug', 'backend', 'regression'],
      environment: 'staging', dueDate: daysFromNow(2),
      createdDaysAgo: 4,
    },
    {
      key: 'NEXUS-3', title: 'Pagination cursor skips records on filtered queries',
      description: 'When filtering issues by severity and paginating with a cursor, some records are skipped entirely.',
      reproductionSteps: '1. GET /api/issues?severity=HIGH&limit=20\n2. Follow the nextPage cursor.\n3. Compare total count with returned records.',
      expectedResult: 'All matching records are returned exactly once across pages.',
      actualResult: 'Roughly 5% of matching records never appear in any page.',
      severity: 'HIGH', status: 'IN_REVIEW', type: 'BUG',
      projectId: nexusApi.id, reporterId: diego.id, assigneeId: priya.id,
      labelNames: ['bug', 'backend'],
      environment: 'production', dueDate: daysFromNow(3),
      createdDaysAgo: 12, resolvedDaysAgo: undefined,
      comments: [
        { authorId: priya.id, body: 'Fix is up: the cursor must include the sort tiebreaker column. Added a regression test covering 10k rows.', daysAgo: 2 },
      ],
    },
    {
      key: 'NEXUS-4', title: 'Health check endpoint reports false negatives',
      description: 'The /health endpoint intermittently reports unhealthy even when all dependencies are reachable.',
      severity: 'MEDIUM', status: 'OPEN', type: 'BUG',
      projectId: nexusApi.id, reporterId: marcus.id, assigneeId: sam.id,
      labelNames: ['bug', 'backend'],
      environment: 'production',
      createdDaysAgo: 6,
    },
    {
      key: 'NEXUS-5', title: 'Add request ID propagation to all services',
      description: 'Request IDs should be generated at the edge and propagated to every downstream service for traceability.',
      severity: 'LOW', status: 'OPEN', type: 'FEATURE',
      projectId: nexusApi.id, reporterId: ava.id, assigneeId: diego.id,
      labelNames: ['feature', 'backend'],
      createdDaysAgo: 15,
    },
    {
      key: 'NEXUS-6', title: 'Database connection pool exhausted under burst traffic',
      description: 'Connection pool maxes out during traffic bursts, causing queued requests to time out.',
      severity: 'CRITICAL', status: 'RESOLVED', type: 'BUG',
      projectId: nexusApi.id, reporterId: sam.id, assigneeId: marcus.id,
      labelNames: ['bug', 'performance', 'backend'],
      environment: 'production',
      createdDaysAgo: 20, resolvedDaysAgo: 18,
      comments: [
        { authorId: marcus.id, body: 'Increased pool size and added connection acquisition timeout with proper backpressure. Monitoring shows stable pool usage during burst tests.', daysAgo: 18 },
      ],
    },
    {
      key: 'NEXUS-7', title: 'Webhook retries deliver duplicate events',
      description: 'Webhook delivery retries can send the same event twice when the receiver is slow to acknowledge.',
      severity: 'MEDIUM', status: 'OPEN', type: 'BUG',
      projectId: nexusApi.id, reporterId: priya.id, assigneeId: undefined,
      labelNames: ['bug', 'backend'],
      createdDaysAgo: 3,
    },
    {
      key: 'NEXUS-8', title: 'Update API documentation for v2 endpoints',
      description: 'The v2 endpoint docs are missing the new filter parameters and error response codes.',
      severity: 'LOW', status: 'OPEN', type: 'TASK',
      projectId: nexusApi.id, reporterId: ava.id, assigneeId: priya.id,
      labelNames: ['docs'],
      createdDaysAgo: 11,
    },

    // ---- Web Client ----
    {
      key: 'WEB-1', title: 'Dashboard charts render blank on first load',
      description: 'The analytics charts on the dashboard are blank until the window is resized. Suspected race between chart initialization and data fetch.',
      reproductionSteps: '1. Log in with a fresh session.\n2. Navigate to the dashboard.\n3. Observe the chart area.',
      expectedResult: 'Charts render with data immediately after loading completes.',
      actualResult: 'Chart containers are empty until a resize event forces a re-render.',
      severity: 'HIGH', status: 'IN_PROGRESS', type: 'BUG',
      projectId: webClient.id, reporterId: lena.id, assigneeId: yuki.id,
      labelNames: ['bug', 'ui', 'regression'],
      browser: 'Chrome 128', os: 'Windows 11',
      environment: 'staging', dueDate: daysFromNow(2), sprintId: sprint2.id,
      createdDaysAgo: 5,
      comments: [
        { authorId: yuki.id, body: 'Confirmed: the chart library measures container size before the data promise resolves. Wrapping in a ResizeObserver fixes it.', daysAgo: 4 },
      ],
    },
    {
      key: 'WEB-2', title: 'Kanban drag-and-drop drops cards on rapid drags',
      description: 'Dragging a card quickly between columns sometimes drops it in the wrong column or loses the card entirely until refresh.',
      reproductionSteps: '1. Open the board.\n2. Drag a card from Open to Resolved quickly.\n3. Repeat rapidly 5-6 times.',
      expectedResult: 'Each card lands in the target column and the status persists.',
      actualResult: 'Occasionally the card reverts or lands in an adjacent column.',
      severity: 'HIGH', status: 'OPEN', type: 'BUG',
      projectId: webClient.id, reporterId: noah.id, assigneeId: lena.id,
      labelNames: ['bug', 'ui'],
      browser: 'Firefox 130', os: 'macOS 15',
      environment: 'staging', dueDate: daysFromNow(4), sprintId: sprint2.id,
      createdDaysAgo: 2,
    },
    {
      key: 'WEB-3', title: 'Command palette does not close on Escape',
      description: 'Pressing Escape while the command palette is open does not dismiss it. The palette also steals focus from inputs.',
      severity: 'MEDIUM', status: 'OPEN', type: 'BUG',
      projectId: webClient.id, reporterId: yuki.id, assigneeId: noah.id,
      labelNames: ['bug', 'ui'],
      browser: 'Chrome 128', os: 'macOS 15',
      createdDaysAgo: 1,
    },
    {
      key: 'WEB-4', title: 'Dark mode contrast fails WCAG AA on muted text',
      description: 'Muted text (#71717A) on surface backgrounds fails WCAG AA contrast requirements at small sizes.',
      severity: 'MEDIUM', status: 'IN_REVIEW', type: 'IMPROVEMENT',
      projectId: webClient.id, reporterId: lena.id, assigneeId: yuki.id,
      labelNames: ['ui', 'feature'],
      browser: 'All', os: 'All',
      createdDaysAgo: 8,
      comments: [
        { authorId: yuki.id, body: 'Bumped muted text to #8B8B93 which passes AA at 4.6:1. Visual diff attached for review.', daysAgo: 1 },
      ],
    },
    {
      key: 'WEB-5', title: 'Notification center shows stale unread count',
      description: 'The unread badge in the top navigation does not decrement after marking notifications as read until a full page reload.',
      severity: 'MEDIUM', status: 'RESOLVED', type: 'BUG',
      projectId: webClient.id, reporterId: priya.id, assigneeId: lena.id,
      labelNames: ['bug', 'ui'],
      browser: 'Chrome 128', os: 'Windows 11',
      createdDaysAgo: 14, resolvedDaysAgo: 12,
    },
    {
      key: 'WEB-6', title: 'Add skeleton loaders to dashboard metric cards',
      description: 'Metric cards should render skeleton placeholders while dashboard data loads instead of appearing empty.',
      severity: 'LOW', status: 'OPEN', type: 'FEATURE',
      projectId: webClient.id, reporterId: ava.id, assigneeId: yuki.id,
      labelNames: ['feature', 'ui', 'good-first-issue'],
      sprintId: sprint2.id,
      createdDaysAgo: 7,
    },
    {
      key: 'WEB-7', title: 'Issue list filter state lost on back navigation',
      description: 'Applied filters on the issue list are lost when navigating to an issue and pressing back.',
      severity: 'LOW', status: 'OPEN', type: 'BUG',
      projectId: webClient.id, reporterId: noah.id, assigneeId: undefined,
      labelNames: ['bug', 'ui'],
      browser: 'Chrome 128', os: 'Windows 11',
      createdDaysAgo: 3,
    },
    {
      key: 'WEB-8', title: 'Login page flashes unstyled content',
      description: 'A brief flash of unstyled content is visible on the login page before Tailwind styles apply.',
      severity: 'LOW', status: 'CLOSED', type: 'BUG',
      projectId: webClient.id, reporterId: lena.id, assigneeId: yuki.id,
      labelNames: ['bug', 'ui'],
      browser: 'Safari 18', os: 'macOS 15',
      createdDaysAgo: 25, resolvedDaysAgo: 24,
    },
    {
      key: 'WEB-9', title: 'Implement AI suggestion review workflow',
      description: 'AI-generated suggestions (summaries, severity, debug steps) must be presented as reviewable suggestions with accept/reject actions, never auto-applied.',
      severity: 'MEDIUM', status: 'OPEN', type: 'FEATURE',
      projectId: webClient.id, reporterId: ava.id, assigneeId: lena.id,
      labelNames: ['feature'],
      sprintId: sprint2.id,
      createdDaysAgo: 4,
    },

    // ---- Mobile App ----
    {
      key: 'MOB-1', title: 'Push notifications delayed by up to 15 minutes',
      description: 'Push notifications arrive with significant delay on Android 15, even when the app is in the foreground.',
      severity: 'HIGH', status: 'OPEN', type: 'BUG',
      projectId: mobileApp.id, reporterId: diego.id, assigneeId: yuki.id,
      labelNames: ['bug'],
      environment: 'production', os: 'Android 15',
      createdDaysAgo: 6,
    },
    {
      key: 'MOB-2', title: 'App crashes when opening issue with 50+ comments',
      description: 'Opening an issue with more than 50 comments causes an out-of-memory crash on older devices.',
      severity: 'CRITICAL', status: 'IN_PROGRESS', type: 'BUG',
      projectId: mobileApp.id, reporterId: noah.id, assigneeId: diego.id,
      labelNames: ['bug'],
      environment: 'production', os: 'Android 14',
      dueDate: daysAgo(1),
      createdDaysAgo: 10,
      comments: [
        { authorId: diego.id, body: 'Root cause identified: comments are rendered as a single unvirtualized list. Switching to a virtualized list fixes the memory spike.', daysAgo: 5 },
      ],
    },
    {
      key: 'MOB-3', title: 'Offline mode does not queue comment drafts',
      description: 'Comments typed while offline are lost instead of being queued for delivery when connectivity returns.',
      severity: 'MEDIUM', status: 'OPEN', type: 'FEATURE',
      projectId: mobileApp.id, reporterId: marcus.id, assigneeId: undefined,
      labelNames: ['feature'],
      createdDaysAgo: 8,
    },
    {
      key: 'MOB-4', title: 'Biometric login fails after app update',
      description: 'After updating the app, biometric login fails until the user re-enters their password once.',
      severity: 'HIGH', status: 'RESOLVED', type: 'BUG',
      projectId: mobileApp.id, reporterId: yuki.id, assigneeId: diego.id,
      labelNames: ['bug', 'security'],
      environment: 'production',
      createdDaysAgo: 18, resolvedDaysAgo: 16,
    },

    // ---- Infrastructure ----
    {
      key: 'INFRA-1', title: 'CI pipeline flaky: e2e tests time out intermittently',
      description: 'The end-to-end test suite times out roughly 1 in 5 runs with no code changes, blocking merges.',
      severity: 'HIGH', status: 'OPEN', type: 'BUG',
      projectId: infra.id, reporterId: sam.id, assigneeId: ava.id,
      labelNames: ['bug', 'performance'],
      environment: 'ci',
      createdDaysAgo: 4,
    },
    {
      key: 'INFRA-2', title: 'Database migration lock during peak hours',
      description: 'Schema migrations acquire a lock that blocks reads for several seconds during peak traffic.',
      severity: 'CRITICAL', status: 'OPEN', type: 'BUG',
      projectId: infra.id, reporterId: ava.id, assigneeId: sam.id,
      labelNames: ['bug', 'backend'],
      environment: 'production', dueDate: daysFromNow(1),
      createdDaysAgo: 2,
    },
    {
      key: 'INFRA-3', title: 'Alert noise: 40% of PagerDuty alerts are auto-resolved',
      description: 'Nearly half of the alerts that page on-call resolve themselves within two minutes, causing alert fatigue.',
      severity: 'MEDIUM', status: 'IN_PROGRESS', type: 'IMPROVEMENT',
      projectId: infra.id, reporterId: marcus.id, assigneeId: sam.id,
      labelNames: ['performance'],
      createdDaysAgo: 9,
    },
    {
      key: 'INFRA-4', title: 'Set up error tracking for the worker fleet',
      description: 'Background workers currently have no error tracking; failures are only visible in raw logs.',
      severity: 'MEDIUM', status: 'OPEN', type: 'TASK',
      projectId: infra.id, reporterId: ava.id, assigneeId: marcus.id,
      labelNames: ['feature'],
      createdDaysAgo: 13,
    },
    {
      key: 'INFRA-5', title: 'Staging environment certificate expired',
      description: 'The staging environment TLS certificate expired, causing certificate warnings in all browsers.',
      severity: 'LOW', status: 'CLOSED', type: 'BUG',
      projectId: infra.id, reporterId: lena.id, assigneeId: ava.id,
      labelNames: ['bug'],
      environment: 'staging',
      createdDaysAgo: 30, resolvedDaysAgo: 29,
    },
  ];

  // Create issues with realistic spread of createdAt dates
  const createdIssues: { id: string; key: string; projectId: string; title: string; severity: string; status: string; reporterId: string; assigneeId: string | null }[] = [];
  for (const seed of issueSeeds) {
    const created = await prisma.issue.create({
      data: {
        key: seed.key,
        title: seed.title,
        description: seed.description,
        reproductionSteps: seed.reproductionSteps,
        expectedResult: seed.expectedResult,
        actualResult: seed.actualResult,
        severity: seed.severity,
        status: seed.status,
        type: seed.type,
        environment: seed.environment,
        browser: seed.browser,
        os: seed.os,
        dueDate: seed.dueDate ?? null,
        archived: false,
        resolvedAt: seed.resolvedDaysAgo !== undefined ? daysAgo(seed.resolvedDaysAgo) : null,
        createdAt: daysAgo(seed.createdDaysAgo),
        reporterId: seed.reporterId,
        assigneeId: seed.assigneeId ?? null,
        projectId: seed.projectId,
        sprintId: seed.sprintId ?? null,
        labels: seed.labelNames
          ? { create: seed.labelNames.map((name) => ({ labelId: labelId(name) })) }
          : undefined,
      },
    });
    createdIssues.push({
      id: created.id,
      key: created.key,
      projectId: created.projectId,
      title: created.title,
      severity: created.severity,
      status: created.status,
      reporterId: created.reporterId,
      assigneeId: created.assigneeId,
    });

    for (const c of seed.comments ?? []) {
      await prisma.comment.create({
        data: {
          body: c.body,
          issueId: created.id,
          authorId: c.authorId,
          createdAt: daysAgo(c.daysAgo),
        },
      });
    }

    // Record creation activity
    await prisma.activityEvent.create({
      data: {
        type: 'ISSUE_CREATED',
        workspaceId: workspace.id,
        projectId: seed.projectId,
        issueId: created.id,
        actorId: seed.reporterId,
        payload: JSON.stringify({ key: created.key, title: created.title, severity: created.severity }),
        createdAt: daysAgo(seed.createdDaysAgo),
      },
    });
  }

  // Add some issue relations
  const byKey = (k: string) => createdIssues.find((i) => i.key === k)!;
  await prisma.issueRelation.create({
    data: { sourceId: byKey('WEB-1').id, targetId: byKey('WEB-6').id, type: 'RELATED' },
  });
  await prisma.issueRelation.create({
    data: { sourceId: byKey('NEXUS-2').id, targetId: byKey('NEXUS-6').id, type: 'RELATED' },
  });
  await prisma.issueRelation.create({
    data: { sourceId: byKey('MOB-2').id, targetId: byKey('WEB-2').id, type: 'BLOCKS' },
  });

  // Notifications for the first user
  for (const n of [
    {
      userId: ava.id,
      type: 'ISSUE_ASSIGNED',
      message: 'INFRA-1 was assigned to you',
      issueId: byKey('INFRA-1').id,
      projectId: infra.id,
      read: false,
      createdAt: daysAgo(1),
    },
    {
      userId: ava.id,
      type: 'COMMENT_CREATED',
      message: 'New comment on MOB-2',
      issueId: byKey('MOB-2').id,
      projectId: mobileApp.id,
      read: false,
      createdAt: daysAgo(0.2),
    },
    {
      userId: ava.id,
      type: 'ISSUE_STATUS_CHANGED',
      message: 'WEB-5 moved to resolved',
      issueId: byKey('WEB-5').id,
      projectId: webClient.id,
      read: true,
      createdAt: daysAgo(12),
    },
  ]) {
    await prisma.notification.create({ data: n });
  }

  // Extra activity events for a richer feed
  const extraEvents: { type: string; actorId: string; projectId: string; issueId: string; payload: Record<string, unknown>; daysAgo: number }[] = [
    { type: 'ISSUE_STATUS_CHANGED', actorId: lena.id, projectId: webClient.id, issueId: byKey('WEB-5').id, payload: { key: 'WEB-5', from: 'IN_REVIEW', to: 'RESOLVED' }, daysAgo: 12 },
    { type: 'ISSUE_SEVERITY_CHANGED', actorId: marcus.id, projectId: nexusApi.id, issueId: byKey('NEXUS-1').id, payload: { key: 'NEXUS-1', from: 'HIGH', to: 'CRITICAL' }, daysAgo: 7 },
    { type: 'ISSUE_ASSIGNED', actorId: ava.id, projectId: infra.id, issueId: byKey('INFRA-2').id, payload: { key: 'INFRA-2', assigneeId: sam.id }, daysAgo: 2 },
    { type: 'SPRINT_CREATED', actorId: ava.id, projectId: webClient.id, issueId: undefined as unknown as string, payload: { name: 'Sprint 15 — Release 2.0' }, daysAgo: 6 },
    { type: 'ISSUE_CREATED', actorId: noah.id, projectId: webClient.id, issueId: byKey('WEB-2').id, payload: { key: 'WEB-2', title: 'Kanban drag-and-drop drops cards on rapid drags' }, daysAgo: 2 },
    { type: 'ISSUE_RESOLVED', actorId: diego.id, projectId: mobileApp.id, issueId: byKey('MOB-4').id, payload: { key: 'MOB-4' }, daysAgo: 16 },
  ];
  for (const e of extraEvents) {
    await prisma.activityEvent.create({
      data: {
        type: e.type,
        workspaceId: workspace.id,
        projectId: e.projectId,
        issueId: e.issueId || null,
        actorId: e.actorId,
        payload: JSON.stringify(e.payload),
        createdAt: daysAgo(e.daysAgo),
      },
    });
  }

  console.log(`[seed] Created workspace "${workspace.name}"`);
  console.log(`[seed] Created ${users.length} users, ${projects.length} projects, ${labels.length} labels`);
  console.log(`[seed] Created ${createdIssues.length} issues with comments, relations, activity, and notifications`);
  console.log('[seed]');
  console.log('[seed] Demo login credentials (password for all: devpassword123):');
  for (const u of users) {
    console.log(`[seed]   ${u.email}  (${u.name}, ${u.role})`);
  }
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
