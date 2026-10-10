import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Bug, Calendar, TrendingUp, Users } from 'lucide-react';
import api from '../api/client';
import type { Project, Issue, ProjectHealth } from '../lib/types';
import { Card, Badge, Button, Avatar, Spinner, Modal, Input, Field, EmptyState } from '../components/ui';
import { SEVERITY_COLORS, STATUS_COLORS, timeAgo, formatDate, isOverdue } from '../lib/types';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, issuesRes, h] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/issues?limit=50`),
        api.get(`/analytics/project-health`),
      ]);
      const allHealth: ProjectHealth[] = h.data.data;
      setProject(p.data.data);
      setIssues(issuesRes.data.data.issues ?? issuesRes.data.data);
      setHealth(allHealth.find((ph) => ph.id === id) ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <Spinner className="mx-auto mt-8" />;
  if (!project) return <EmptyState title="Project not found" />;

  const severityDist = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({
    severity: s,
    count: issues.filter((i) => i.severity === s).length,
    color: SEVERITY_COLORS[s as keyof typeof SEVERITY_COLORS],
  }));

  const statusDist = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED'].map((s) => ({
    status: s,
    count: issues.filter((i) => i.status === s).length,
    color: STATUS_COLORS[s as keyof typeof STATUS_COLORS],
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/projects" className="text-xs text-text-muted">Projects</Link>
          <h1 className="text-2xl font-bold text-text-primary mt-1">{project.name}</h1>
          <p className="text-sm text-text-muted mt-1">{project.description}</p>
        </div>
        <Link to="/issues/new">
          <Button size="sm"><Plus size={14} />New Issue</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3 mb-3">Health</h3>
          {health ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge color="#34D399">{health.label.replace('_', ' ')}</Badge>
                <span className="text-2xl font-bold text-text-primary">{health.score}/100</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-text-muted">Unresolved critical</div><div className="text-text-secondary text-right">{health.factors.unresolvedCritical}</div>
                <div className="text-text-muted">Overdue</div><div className="text-text-secondary text-right">{health.factors.overdue}</div>
                <div className="text-text-muted">Backlog growing</div><div className="text-text-secondary text-right">{health.factors.backlogGrowing ? 'Yes' : 'No'}</div>
                <div className="text-text-muted">Resolving faster</div><div className="text-text-secondary text-right">{health.factors.resolvingFasterThanOpened ? 'Yes' : 'No'}</div>
              </div>
            </div>
          ) : <EmptyState title="Health data unavailable" />}
        </Card>

          <Card className="p-5 overflow-hidden">
            <h3 className="text-sm font-semibold text-text-primary mb-3">By Severity</h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={severityDist} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#221f24" vertical={false} />
                <XAxis dataKey="severity" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#19191F', border: '1px solid #29232A', borderRadius: '10px', fontSize: 12 }}
                  labelStyle={{ color: '#A1A1AA', fontSize: 11 }}
                  itemStyle={{ color: '#F5F5F7' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                  {severityDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5 overflow-hidden">
            <h3 className="text-sm font-semibold text-text-primary mb-3">By Status</h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={statusDist} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#221f24" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="status" tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#19191F', border: '1px solid #29232A', borderRadius: '10px', fontSize: 12 }}
                  labelStyle={{ color: '#A1A1AA', fontSize: 11 }}
                  itemStyle={{ color: '#F5F5F7' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" name="Issues" radius={[0, 4, 4, 0]}>
                  {statusDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Recent Issues</h3>
          <Link to="/issues" className="text-[11px] text-text-secondary hover:text-primary">View all →</Link>
        </div>
        <div className="divide-y divide-border">
          {issues.slice(0, 8).map((i) => (
            <Link key={i.id} to={`/issues/${i.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
              <Badge color={SEVERITY_COLORS[i.severity]} className="text-[10px] min-w-[48px] justify-center">{i.severity}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary line-clamp-1">{i.title}</div>
                <div className="text-[10px] text-text-muted font-mono">{i.key}</div>
              </div>
              <div className="w-24 text-right">
                <Badge color={STATUS_COLORS[i.status]} className="text-[10px]">{i.status}</Badge>
                {i.dueDate && isOverdue(i) && <div className="text-[10px] text-danger mt-1">overdue</div>}
              </div>
              <div className="w-16 text-right">
                {i.assignee ? <Avatar name={i.assignee.name} color={i.assignee.color} size="xs" /> : <span className="text-xs text-text-muted">—</span>}
              </div>
            </Link>
          ))}
          {issues.length === 0 && <EmptyState title="No issues in this project" />}
        </div>
      </Card>
    </div>
  );
}
