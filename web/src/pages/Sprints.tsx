import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Bug, Calendar, Clock, Plus } from 'lucide-react';
import api, { extractError } from '../api/client';
import type { Sprint, Issue, Project } from '../lib/types';
import { Card, Badge, Avatar, Spinner, EmptyState, Modal, Input, Select, Field, Button, Skeleton, SkeletonText } from '../components/ui';
import { SEVERITY_COLORS, STATUS_COLORS, timeAgo, isOverdue } from '../lib/types';

function SprintCard({ sprint }: { sprint: Sprint }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/issues?sprintId=${sprint.id}&limit=100`)
      .then((r) => setIssues(r.data.data.issues ?? r.data.data))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, [sprint.id]);

  const inSprint = issues.filter((i) => ['OPEN', 'IN_PROGRESS'].includes(i.status));
  const progress = issues.length > 0 ? (issues.filter((i) => ['RESOLVED', 'CLOSED'].includes(i.status)).length / issues.length) * 100 : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text-primary">{sprint.name}</h3>
        <Badge color={sprint.status === 'ACTIVE' ? '#FBBF24' : sprint.status === 'COMPLETED' ? '#34D399' : '#60A5FA'}>
          {sprint.status}
        </Badge>
      </div>
      {sprint.goal && <p className="text-xs text-text-muted mb-2 line-clamp-2">{sprint.goal}</p>}
      <div className="text-xs text-text-muted mb-3 flex items-center gap-1.5">
        <Calendar size={12} /> {new Date(sprint.startDate).toLocaleDateString()} → {new Date(sprint.endDate).toLocaleDateString()}
      </div>
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-text-muted">Progress</span>
          <span className="text-text-secondary">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden mt-0.5">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {loading ? <Spinner className="mx-auto" /> : (
        <div className="space-y-1.5">
          {inSprint.slice(0, 5).map((i) => (
            <Link key={i.id} to={`/issues/${i.id}`} className="flex items-center gap-2 text-xs">
              <Badge color={SEVERITY_COLORS[i.severity]} className="text-[8px]">{i.severity}</Badge>
              <span className="text-text-secondary truncate flex-1">{i.title}</span>
              {i.assignee && <Avatar name={i.assignee.name} color={i.assignee.color} size="xs" />}
            </Link>
          ))}
          {inSprint.length === 0 && <EmptyState title="No active issues" />}
        </div>
      )}
    </Card>
  );
}

export default function Sprints() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([api.get('/sprints'), api.get('/projects')]);
      setSprints(s.data.data);
      setProjects(p.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createSprint = async () => {
    if (!name.trim() || !projectId || !startDate || !endDate) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post('/sprints', { name: name.trim(), goal: goal.trim() || undefined, startDate, endDate, projectId });
      setSprints((prev) => [res.data.data, ...prev]);
      setModalOpen(false);
      setName(''); setGoal(''); setStartDate(''); setEndDate(''); setProjectId('');
    } catch (err) {
      setCreateError(extractError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Sprints</h1>
        <Button size="sm" onClick={() => setModalOpen(true)}><Plus size={14} />New Sprint</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <SkeletonText lines={1} className="h-4 w-3/4 mb-3" />
              <Skeleton className="h-3 w-full mb-3 rounded" />
              <SkeletonText lines={4} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sprints.map((s) => (
            <SprintCard key={s.id} sprint={s} />
          ))}
          {sprints.length === 0 && <EmptyState title="No sprints" description="Create a sprint to group issues into iterations." />}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sprint">
        <div className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-[13px] text-danger">{createError}</div>
          )}
          <Field label="Sprint name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 16 — Performance" maxLength={100} />
          </Field>
          <Field label="Project">
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={projects.length === 0}
              className="h-9.5 text-sm"
            >
              <option value="" disabled>Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Goal" hint="What does this sprint aim to accomplish?">
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What we aim to accomplish…" maxLength={1000} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={creating}>Cancel</Button>
            <Button size="sm" onClick={createSprint} loading={creating} disabled={!name.trim() || !projectId || !startDate || !endDate}>Create Sprint</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
