import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import type { ProjectHealth, TeamMember, TrendPoint } from '../lib/types';
import { Card, CardHeader, Badge, Skeleton, SkeletonText, EmptyState, Avatar } from '../components/ui';
import { SEVERITY_COLORS } from '../lib/types';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  LineChart, Line,
} from 'recharts';

function scoreColor(score: number) {
  if (score >= 70) return '#34D399';
  if (score >= 40) return '#FBBF24';
  return '#FF1744';
}

function labelColor(label: string) {
  if (label === 'HEALTHY') return '#34D399';
  if (label === 'NEEDS_ATTENTION') return '#FBBF24';
  return '#FF1744';
}

export default function Analytics() {
  const [health, setHealth] = useState<ProjectHealth[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [needsAttention, setNeedsAttention] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [h, t, tr, na] = await Promise.all([
          api.get('/analytics/project-health'),
          api.get('/analytics/team-workload'),
          api.get('/analytics/activity?days=30'),
          api.get('/analytics/needs-attention'),
        ]);
        setHealth(h.data.data);
        setTeam(t.data.data);
        setTrend(tr.data.data);
        setNeedsAttention(na.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <SkeletonText lines={1} className="h-6 w-40" />
          <SkeletonText lines={1} className="h-5 w-28" />
        </div>
        <Card className="p-5"><Skeleton className="h-[240px] w-full rounded-lg" /></Card>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="p-5"><Skeleton className="h-[220px] w-full rounded-lg" /></Card>
          <Card className="p-5"><Skeleton className="h-[220px] w-full rounded-lg" /></Card>
        </div>
        <Card className="p-5"><Skeleton className="h-[180px] w-full rounded-lg" /></Card>
      </div>
    );
  }

  const avgHealth = Math.round(health.reduce((a, p) => a + p.score, 0) / Math.max(1, health.length));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary">Analytics</h1>
          <p className="text-[13px] text-text-secondary mt-1">Project health, team velocity, and resolution trends.</p>
        </div>
        <Badge color={scoreColor(avgHealth)} dot={false} className="text-[11px] font-mono">
          {health.length > 0 ? `${avgHealth} avg health` : 'No data'}
        </Badge>
      </div>

      {/* Project health bar chart */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Project Health"
          subtitle="Lowest scores first"
        />
        <div className="p-5 pt-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={health.sort((a, b) => a.score - b.score)} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <defs>
                {health.map((_, i) => {
                  const c = scoreColor(health[i].score);
                  return (
                    <linearGradient key={i} id={`aphGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.12} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#221f24" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#71717A', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-12}
                dy={6}
                height={44}
              />
              <YAxis domain={[0, 100]} tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ backgroundColor: '#19191F', border: '1px solid #29232A', borderRadius: '10px', fontSize: 12 }}
                labelStyle={{ color: '#A1A1AA', fontSize: 11 }}
                itemStyle={{ color: '#F5F5F7' }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="score" name="Health" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {health.sort((a, b) => a.score - b.score).map((p, i) => (
                  <Cell key={i} fill={`url(#aphGrad-${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {health.sort((a, b) => b.score - a.score).map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 py-1">
                <span className="font-mono text-[10px] text-text-muted w-12 tabular-nums">{p.score}/100</span>
                <Badge color={labelColor(p.label)} dot={false} className="text-[9px]">{p.label.replace('_', ' ')}</Badge>
                <span className="text-[13px] text-text-primary flex-1 truncate min-w-0">{p.name}</span>
                <span className="text-[10px] text-text-muted font-mono tabular-nums">{p.openIssues}/{p.totalIssues} open</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Resolution trends */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Resolution Trend"
            subtitle="Opened vs resolved · last 30 days"
          />
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="aDashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="aResGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#221f24" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#71717A', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
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

        {/* Team workload */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Team Workload"
            subtitle="Open vs assigned load"
          />
          <div className="p-5 pt-4 space-y-3">
            {team.map((m) => (
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
                        backgroundColor: m.open > m.assigned * 0.5 ? '#FF1744' : '#F59E0B',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-mono text-text-muted w-14 text-right tabular-nums shrink-0">{m.assigned} total</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Needs attention */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Issues Needing Attention"
          subtitle="Critical, high-severity, and overdue issues"
        />
        <div className="px-5 py-3 divide-y divide-border">
          {needsAttention.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={20} />}
              title="All caught up"
              description="No issues currently need urgent attention."
            />
          ) : (
            needsAttention.map((i, idx) => (
              <div key={i.id ?? idx} className="flex items-center gap-2.5 py-2.5">
                <Badge color={SEVERITY_COLORS[i.severity as keyof typeof SEVERITY_COLORS]} className="text-[9px] min-w-[52px] justify-center">{i.severity}</Badge>
                <span className="font-mono text-[10px] text-text-muted">{i.key}</span>
                <span className="text-sm text-text-primary flex-1 truncate">{i.title}</span>
                {i.overdue && <Badge color="#FF1744" dot={false} className="text-[9px] ml-auto">overdue</Badge>}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
