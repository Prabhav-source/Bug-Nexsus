import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, TrendingUp, AlertTriangle, CheckCircle, Plus, Sparkles, Github } from 'lucide-react';
import api, { extractError } from '../api/client';
import type { DashboardOverview, ProjectHealth, TeamMember, TrendPoint, ActivityEvent } from '../lib/types';
import { Card, CardHeader, Badge, EmptyState, Avatar, Skeleton, SkeletonText, Button } from '../components/ui';
import { SEVERITY_COLORS } from '../lib/types';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';

const METRIC_CARDS: { key: keyof DashboardOverview; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'openIssues', label: 'Open Issues', icon: Bug, color: '#FF1744' },
  { key: 'inProgress', label: 'In Progress', icon: TrendingUp, color: '#A78BFA' },
  { key: 'resolvedThisWeek', label: 'Resolved · 7d', icon: CheckCircle, color: '#22C55E' },
  { key: 'criticalIssues', label: 'Critical', icon: AlertTriangle, color: '#FF1744' },
];

const EVENT_LABELS: Record<string, string> = {
  ISSUE_CREATED: 'created',
  ISSUE_UPDATED: 'updated',
  ISSUE_RESOLVED: 'resolved',
  ISSUE_STATUS_CHANGED: 'changed status on',
  ISSUE_SEVERITY_CHANGED: 'changed severity of',
  ISSUE_ASSIGNED: 'assigned',
  ISSUE_ARCHIVED: 'archived',
  PROJECT_CREATED: 'created project',
  SPRINT_CREATED: 'created sprint',
  COMMENT_CREATED: 'commented on',
};

function describeEvent(e: ActivityEvent): string {
  const label = EVENT_LABELS[e.type] ?? e.type.replace(/_/g, ' ').toLowerCase();
  if (e.payload && typeof e.payload === 'object') {
    const p = e.payload as Record<string, unknown>;
    if (p.key) return `${label}: ${String(p.key)}`;
    if (p.name) return `${label}: ${String(p.name)}`;
  }
  return label;
}

export default function Dashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [health, setHealth] = useState<ProjectHealth[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [sevDist, setSevDist] = useState<{ severity: string; count: number }[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // Each request resolves independently — one failing endpoint must not
      // blank the whole dashboard (this was the "blank dashboard" bug: a
      // single 404 from /analytics/activity rejected the whole Promise.all
      // and `overview` stayed null forever).
      const results = await Promise.allSettled([
        api.get('/analytics/overview'),
        api.get('/analytics/project-health'),
        api.get('/analytics/team-workload'),
        api.get('/analytics/activity?days=30'),
        api.get('/activity?limit=10'),
        api.get('/analytics/severity-distribution'),
        api.get('/projects'),
      ]);
      const val = (i: number) => (results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<{ data: { data: any } }>).value.data.data : null);
      const ov = val(0);
      if (ov) {
        setOverview(ov);
        setHealth(val(1) ?? []);
        setTeam(val(2) ?? []);
        setTrend(val(3) ?? []);
        setActivity(val(4) ?? []);
        setSevDist(val(5) ?? []);
        setProjectCount(Array.isArray(val(6)) ? (val(6) as unknown[]).length : 0);
        const failed = results.filter((r) => r.status === 'rejected').length;
        setError(failed > 0 ? 'Some dashboard sections could not be loaded.' : null);
      } else {
        const reason = results[0].status === 'rejected' ? (results[0] as PromiseRejectedResult).reason : null;
        console.error(reason);
        setError('Could not load dashboard metrics. Check your connection and try again.');
      }
      setLoading(false);
    };
    load();
  }, []);

  const healthColor = (label: string) => {
    if (label === 'HEALTHY') return '#22C55E';
    if (label === 'NEEDS_ATTENTION') return '#F59E0B';
    if (label === 'AT_RISK') return '#FB923C';
    return '#FF1744';
  };

  const severityColors = sevDist.length > 0
    ? sevDist.map((s) => ({ name: s.severity, color: SEVERITY_COLORS[s.severity as keyof typeof SEVERITY_COLORS] ?? '#71717A', count: s.count }))
    : [
        { name: 'CRITICAL', color: SEVERITY_COLORS.CRITICAL, count: overview?.criticalIssues ?? 0 },
        { name: 'HIGH', color: SEVERITY_COLORS.HIGH, count: 0 },
        { name: 'MEDIUM', color: SEVERITY_COLORS.MEDIUM, count: 0 },
        { name: 'LOW', color: SEVERITY_COLORS.LOW, count: 0 },
      ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="relative">
        <div className="absolute -top-6 right-0 w-52 h-52 rounded-full bg-primary/[0.06] blur-[70px] -z-10" />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-primary mb-1.5">
            System Overview
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary mb-1">Engineering Command Center</h1>
          <p className="text-[13px] text-text-secondary">A live pulse on bugs, velocity, and team health.</p>
        </div>
        <Link to="/issues/new">
          <Button size="sm"><Plus size={14} strokeWidth={2.5} /> New Issue</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {METRIC_CARDS.map((m) => (
              <Card key={m.key} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-6 w-12 mb-1.5" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="p-5 xl:col-span-2"><Skeleton className="h-[180px] w-full rounded-lg" /></Card>
            <Card className="p-5"><SkeletonText lines={6} /></Card>
          </div>
        </div>
      ) : error && !overview ? (
        <Card className="p-6">
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="Dashboard unavailable"
            description={error}
            action={<Button size="sm" variant="secondary" onClick={() => window.location.reload()}>Retry</Button>}
          />
        </Card>
      ) : !overview ? (
        <Card className="p-6">
          <EmptyState title="No data yet" description="Create a project to start tracking." />
        </Card>
      ) : overview.totalIssues === 0 ? (
        <GettingStarted projectCount={projectCount} />
      ) : (
        overview && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {METRIC_CARDS.map((m) => {
                const Icon = m.icon;
                const val = overview[m.key] ?? 0;
                 return (
                   <Card
                     key={m.key}
                     className="p-4 group transition-all duration-200 hover:border-border-accent hover:-translate-y-px hover:shadow-glow"
                   >
                     <div className="flex items-center gap-3">
                       <span
                         className="p-2 rounded-lg shrink-0 transition-all duration-200 group-hover:scale-105"
                         style={{ backgroundColor: `${m.color}14`, border: `1px solid ${m.color}40` }}
                       >
                         <Icon size={17} style={{ color: m.color }} />
                       </span>
                       <div className="min-w-0">
                         <div className="text-[24px] font-extrabold tracking-tight text-text-primary leading-none tabular-nums">{val}</div>
                         <div className="text-[11px] font-medium text-text-secondary mt-1 truncate">{m.label}</div>
                       </div>
                     </div>
                   </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Activity trend chart */}
              <Card className="xl:col-span-2 overflow-hidden">
                <CardHeader title="Issue Activity" subtitle="Opened vs resolved · last 30 days" />
                <div className="p-5 pt-3">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="dashGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#60A5FA" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="resGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#292638" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#71717A', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#19191F', border: '1px solid #29232A', borderRadius: '10px', fontSize: 12 }}
                      labelStyle={{ color: '#A1A1AA', fontSize: 11 }}
                      itemStyle={{ color: '#F5F5F7' }}
                      cursor={{ stroke: '#3a3440' }}
                    />
                    <Line type="monotone" dataKey="opened" stroke="#60A5FA" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Opened" />
                    <Line type="monotone" dataKey="resolved" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Resolved" />
                  </LineChart>
                </ResponsiveContainer>
                </div>
              </Card>

              {/* Severity distribution */}
              <Card className="overflow-hidden">
                <CardHeader title="By Severity" subtitle={`Resolution rate ${overview?.resolutionRate ?? 0}%`} />
                <div className="p-5 pt-4 space-y-3.5">
                  {severityColors.map((s) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge color={s.color} dot={false} className="text-[9px]">{s.name}</Badge>
                        <span className="text-xs font-mono text-text-secondary tabular-nums">{s.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-hover/70 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(s.count / Math.max(1, (overview?.totalIssues ?? 0))) * 100}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Project health */}
              <Card className="overflow-hidden">
                <CardHeader title="Project Health" subtitle="Lowest scores first" action={<Link to="/analytics" className="text-[11px] font-medium text-text-secondary hover:text-primary transition-colors">Details →</Link>} />
                <div className="p-5 pt-3">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={health.sort((a, b) => a.score - b.score)} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <defs>
                      {health.map((_, i) => {
                        const c = healthColor(health[i].label);
                        return (
                          <linearGradient key={i} id={`healthGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={c} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={c} stopOpacity={0.12} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#292638" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} interval={0} angle={-12} dy={6} height={44} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#19191F', border: '1px solid #29232A', borderRadius: '10px', fontSize: 12 }}
                      labelStyle={{ color: '#A1A1AA', fontSize: 11 }}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="score" name="Health" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {health.sort((a, b) => a.score - b.score).map((p, i) => (
                        <Cell key={i} fill={`url(#healthGrad-${i})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                </div>
                <div className="px-5 pb-5 space-y-1.5">
                  {health.sort((a, b) => b.score - a.score).slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 py-1">
                      <span className="font-mono text-[10px] text-text-muted w-12 tabular-nums">{p.score}/100</span>
                      <Badge color={healthColor(p.label)} dot={false} className="text-[9px]">{p.label.replace('_', ' ')}</Badge>
                      <span className="text-[13px] text-text-primary flex-1 truncate min-w-0">{p.name}</span>
                      <span className="text-[10px] text-text-muted font-mono tabular-nums">{p.openIssues}/{p.totalIssues} open</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Team workload */}
              <Card className="overflow-hidden">
                <CardHeader title="Team Workload" subtitle="Open vs assigned load" action={<Link to="/analytics" className="text-[11px] font-medium text-text-secondary hover:text-primary transition-colors">Full report →</Link>} />
                <div className="p-5 pt-4 space-y-3">
                  {team.slice(0, 6).map((m) => (
                    <div key={m.userId} className="flex items-center gap-2.5">
                      <Avatar name={m.name} color={m.color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text-primary truncate">{m.name}</div>
                        <div className="text-[10px] text-text-muted font-mono tabular-nums">
                          {m.open} open · {m.inProgress} in progress · {m.resolved} resolved
                        </div>
                      </div>
                      <div className="w-20 shrink-0">
                        <div className="h-1.5 rounded-full bg-surface-hover/70 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${m.assigned > 0 ? (m.open / m.assigned) * 100 : 0}%`,
                              backgroundColor: m.open > (m.assigned * 0.5) ? '#FF1744' : '#F59E0B',
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-text-muted w-14 text-right tabular-nums shrink-0">{m.assigned} total</span>
                    </div>
                  ))}
                  {team.length === 0 && <EmptyState title="No team members" />}
                </div>
              </Card>
            </div>

            {/* Activity feed */}
            <Card className="overflow-hidden">
              <CardHeader title="Recent Activity" subtitle="Latest events across the workspace" action={<Link to="/activity" className="text-[11px] font-medium text-text-secondary hover:text-primary transition-colors">View all →</Link>} />
                <div className="px-5 py-2 divide-y divide-border-subtle">
                  {activity.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex items-center gap-2.5 py-2.5">
                      <Avatar name={a.actor?.name} color={a.actor?.color} size="xs" />
                      <div className="text-xs min-w-0 flex-1 truncate">
                        <span className="font-medium text-text-primary">{a.actor?.name ?? 'System'}</span>{' '}
                        <span className="text-text-secondary">{describeEvent(a)}</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted shrink-0">{new Date(a.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  ))}
                  {activity.length === 0 && <EmptyState title="No recent activity" />}
                </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}

function GettingStarted({ projectCount }: { projectCount: number }) {
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoDone, setDemoDone] = useState<string | null>(null);

  const loadDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const res = await api.post('/projects/demo');
      setDemoDone(res.data.data?.project?.name ?? 'Demo project');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setDemoError(extractError(err));
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Open Issues', value: '0' },
          { label: 'In Progress', value: '0' },
          { label: 'Resolved · 7d', value: '0' },
          { label: 'Critical', value: '0' },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <div className="text-[22px] font-extrabold tracking-tight text-text-muted leading-none tabular-nums">{m.value}</div>
            <div className="text-[11px] font-medium text-text-muted mt-1">{m.label}</div>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="p-6 sm:p-8 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-xl border border-border bg-surface-elevated flex items-center justify-center text-primary mx-auto mb-4">
            <Bug size={22} />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-text-primary">Your workspace is ready — let's add data</h2>
          <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">
            {projectCount > 0
              ? `You have ${projectCount} project${projectCount === 1 ? '' : 's'} but no issues yet. Seed a demo project with realistic bugs or import a real GitHub repository to see live analytics.`
              : 'Create your first project manually, seed a demo project with realistic bugs, or import a real GitHub repository to see live analytics.'}
          </p>
          {demoError && <div className="mt-3 rounded-lg border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-[13px] text-danger text-left">{demoError}</div>}
          {demoDone && <div className="mt-3 rounded-lg border border-success/25 bg-success/[0.07] px-3.5 py-2.5 text-[13px] text-success text-left">Created “{demoDone}” — loading your dashboard…</div>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={loadDemo} loading={demoLoading}>
              <Sparkles size={14} /> Seed demo project
            </Button>
            <Link to="/projects?import=github"><Button size="sm" variant="secondary"><Github size={14} /> Import from GitHub</Button></Link>
            <Link to="/projects"><Button size="sm" variant="secondary">Go to Projects</Button></Link>
          </div>
          <p className="text-[11px] text-text-muted mt-4 font-mono">Demo data is clearly labeled and safe to delete afterwards.</p>
        </div>
      </Card>
    </div>
  );
}
