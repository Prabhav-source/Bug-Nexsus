import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Bug, ArrowUpDown, RotateCcw } from 'lucide-react';
import api from '../api/client';
import type { Issue, Project, Pagination } from '../lib/types';
import { Card, Badge, Button, Input, Select, Avatar, EmptyState } from '../components/ui';
import { SEVERITY_COLORS, STATUS_COLORS, timeAgo, formatDate, isOverdue } from '../lib/types';

interface ListResponse {
  issues: Issue[];
  meta: Pagination;
}

const SEVERITY_OPTIONS = [{ value: '', label: 'All Severities' }, { value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }];
const STATUS_OPTIONS = [{ value: '', label: 'All Statuses' }, { value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'IN_REVIEW', label: 'In Review' }, { value: 'RESOLVED', label: 'Resolved' }, { value: 'CLOSED', label: 'Closed' }];
const TYPE_OPTIONS = [{ value: '', label: 'All Types' }, { value: 'BUG', label: 'Bug' }, { value: 'FEATURE', label: 'Feature' }, { value: 'IMPROVEMENT', label: 'Improvement' }, { value: 'TASK', label: 'Task' }];

export default function Issues() {
  const [urlParams, setUrlParams] = useSearchParams();
  const initial: Record<string, string> = {};
  for (const k of ['severity', 'status', 'type', 'project', 'search', 'assignee', 'label', 'due', 'sort', 'order', 'page']) {
    const v = urlParams.get(k);
    if (v) initial[k] = v;
  }
  const [search, setSearch] = useState(initial.search ?? '');
  const [params, setParams] = useState<Record<string, string>>(initial);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const severity = params.severity ?? '';
  const status = params.status ?? '';
  const type = params.type ?? '';
  const project = params.project ?? '';
  const sort = params.sort ?? 'createdAt';
  const order = (params.order ?? 'desc') as 'asc' | 'desc';
  const page = Number(params.page ?? '1');

  // Debounce the free-text search before it hits the URL / API.
  useEffect(() => {
    const t = setTimeout(() => {
      setUrlParams((prev) => {
        const next = new URLSearchParams(prev);
        if (search.trim()) next.set('search', search.trim());
        else next.delete('search');
        next.set('page', '1');
        return next;
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const p: Record<string, string> = {};
    for (const k of ['severity', 'status', 'type', 'project', 'search', 'assignee', 'label', 'due', 'sort', 'order', 'page']) {
      const v = urlParams.get(k);
      if (v) p[k] = v;
    }
    setParams(p);
  }, [urlParams]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (severity) q.set('severity', severity);
      if (status) q.set('status', status);
      if (project) q.set('projectId', project);
      if (type) q.set('type', type);
      if (params.search) q.set('search', params.search);
      q.set('sort', sort);
      q.set('order', order);
      q.set('page', String(page));
      q.set('limit', '25');

      const [issuesRes, projectsRes] = await Promise.all([
        api.get(`/issues?${q.toString()}`),
        api.get('/projects'),
      ]);
      const data: ListResponse = issuesRes.data.data;
      setIssues(data.issues);
      setMeta(data.meta);
      setProjects(projectsRes.data.data);
    } catch (err) {
      console.error(err);
      setError('Could not load issues. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const syncUrl = (np: Record<string, string>) => {
    setParams(np);
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(np)) if (v) u.set(k, v);
    setUrlParams(u);
  };

  const setParam = (key: string, value: string) => {
    const np = { ...params, page: '1' } as Record<string, string>;
    if (value) np[key] = value;
    else delete np[key];
    // Sensible default direction per sort key
    if (key === 'sort') {
      np.order = value === 'createdAt' ? 'desc' : value === 'updatedAt' ? 'desc' : value === 'dueDate' ? 'asc' : value === 'severity' ? 'desc' : 'asc';
    }
    syncUrl(np);
  };

  const setSort = (sortValue: string, orderValue: string) => {
    syncUrl({ ...params, sort: sortValue, order: orderValue, page: '1' });
  };

  const removeParam = (key: string) => {
    const np = { ...params } as Record<string, string>;
    delete np[key];
    np.page = '1';
    if (key === 'search') setSearch('');
    syncUrl(np);
  };

  const clearAll = () => {
    setSearch('');
    syncUrl({});
  };

  const activeFilters = Object.entries(params).filter(([k]) => ['severity', 'status', 'type', 'project', 'search'].includes(k));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold tracking-tight text-text-primary">Issues</h1>
            {meta && !loading && (
              <span className="text-xs font-mono text-text-muted bg-surface-elevated border border-border rounded-md px-2 py-0.5">
                {meta.total}
              </span>
            )}
          </div>
          <p className="text-[13px] text-text-secondary mt-1">Track, prioritize, and resolve bugs across your projects.</p>
        </div>
        <Link to="/issues/new">
          <Button size="sm"><Plus size={14} strokeWidth={2.5} /> New Issue</Button>
        </Link>
      </div>

      {/* Filter toolbar */}
      <Card className="p-3.5 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-2.5 items-end">
          <div className="col-span-2 sm:col-span-6 lg:col-span-4 relative">
            <Input
              placeholder="Search by title, key, or description…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              className="pr-8 h-9"
              aria-label="Search issues"
            />
            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
          <Select aria-label="Severity filter" className="col-span-1 sm:col-span-3 lg:col-span-2 h-9 text-[13px]" value={severity} onChange={(e) => setParam('severity', e.target.value)}>
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select aria-label="Status filter" className="col-span-1 sm:col-span-3 lg:col-span-2 h-9 text-[13px]" value={status} onChange={(e) => setParam('status', e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select aria-label="Sort issues" className="col-span-1 sm:col-span-3 lg:col-span-2 h-9 text-[13px]" value={`${sort}:${order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); setSort(s, o); }}>
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="updatedAt:desc">Recently updated</option>
            <option value="dueDate:asc">Due soonest</option>
            <option value="severity:desc">Highest severity</option>
          </Select>
          <div className="col-span-1 sm:col-span-3 lg:col-span-2 flex gap-2">
            <Select aria-label="Type filter" className="h-9 text-[13px] flex-1" value={type} onChange={(e) => setParam('type', e.target.value)}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <button
              onClick={() => setParam('order', order === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${order === 'asc' ? 'ascending' : 'descending'} — click to flip`}
              aria-label="Toggle sort direction"
              className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-muted hover:text-text-primary hover:border-[#3a3440] transition-colors duration-150"
            >
              <ArrowUpDown size={14} className={order === 'asc' ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Select aria-label="Project filter" className="h-8 text-xs w-auto min-w-[150px] max-w-[220px]" value={project} onChange={(e) => setParam('project', e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          {activeFilters.length > 0 && (
            <>
              <span className="w-px h-4 bg-border hidden sm:block" />
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilters.map(([k, v]) => {
                  const label = k === 'project'
                    ? projects.find((p) => p.id === v)?.name ?? v
                    : k === 'search'
                      ? `"${v}"`
                      : (SEVERITY_OPTIONS.find((o) => o.value === v) ?? STATUS_OPTIONS.find((o) => o.value === v) ?? TYPE_OPTIONS.find((o) => o.value === v) ?? { label: v }).label;
                  return (
                    <span key={k} className="inline-flex items-center gap-1.5 text-xs text-text-secondary bg-surface-elevated border border-border rounded-md pl-2 pr-1.5 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{k}</span>
                      <span className="max-w-[180px] truncate">{label}</span>
                      <button onClick={() => removeParam(k)} aria-label={`Remove ${k} filter`} className="hover:text-text-primary hover:bg-surface-hover rounded px-0.5 transition-colors">×</button>
                    </span>
                  );
                })}
                <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors ml-1">
                  <RotateCcw size={11} /> Clear all
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

      {error && (
        <Card className="p-4 border-danger/30 bg-danger/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-danger">{error}</p>
            <Button size="sm" variant="secondary" onClick={loadData}>Retry</Button>
          </div>
        </Card>
      )}

      {/* List */}
      <Card className="overflow-hidden">
        <div className="hidden md:grid grid-cols-[64px_minmax(0,1fr)_110px_120px_96px] gap-3 px-4 py-2 border-b border-border-subtle bg-background-secondary/40 text-[10px] font-semibold font-mono uppercase tracking-[0.12em] text-text-muted">
          <span>Key</span>
          <span>Issue</span>
          <span className="text-right">Status</span>
          <span className="text-right">Assignee</span>
          <span className="text-right">Updated</span>
        </div>
        {loading ? (
          <div className="divide-y divide-border-subtle">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-[13px]">
                <div className="space-y-1.5 shrink-0 w-14">
                  <div className="h-2.5 w-10 rounded bg-surface-hover/80 animate-pulse" />
                  <div className="h-4 w-14 rounded bg-surface-hover/80 animate-pulse" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-3.5 rounded bg-surface-hover/80 animate-pulse" style={{ width: `${62 - i * 6}%` }} />
                  <div className="h-2.5 w-1/4 rounded bg-surface-hover/50 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="p-6"><EmptyState icon={<Bug size={22} />} title={activeFilters.length > 0 ? 'No issues match your filters' : 'No issues yet'} description={activeFilters.length > 0 ? 'Try clearing filters or adjusting your search.' : 'Create your first issue to start tracking work.'} action={activeFilters.length > 0 ? <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button> : <Link to="/issues/new"><Button size="sm"><Plus size={14} strokeWidth={2.5} /> New Issue</Button></Link>} /></div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {issues.map((issue) => {
              const overdue = isOverdue(issue);
              const critical = issue.severity === 'CRITICAL' && issue.status !== 'CLOSED' && issue.status !== 'RESOLVED';
              return (
              <Link
                key={issue.id}
                 to={`/issues/${issue.id}`}
                 className="relative grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[64px_minmax(0,1fr)_110px] md:grid-cols-[64px_minmax(0,1fr)_110px_120px_96px] gap-3 items-center px-4 py-3 hover:bg-surface-hover/40 hover:border-l-2 hover:border-primary/20 transition-all duration-200 group"
              >
                {critical && <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full bg-primary" />}
                <div className="shrink-0 min-w-0">
                  <span className="block text-[10px] font-mono text-text-muted truncate">{issue.key}</span>
                  <Badge color={severityColor(issue.severity)} dot={false} className="mt-1 text-[9px] justify-center px-1">{issue.severity.slice(0, 4)}</Badge>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-[13.5px] leading-snug text-text-primary group-hover:text-white transition-colors truncate" title={issue.title}>{issue.title}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap min-w-0">
                    {issue.project && <span className="text-[10px] text-text-muted font-mono bg-surface-elevated border border-border-subtle px-1.5 py-px rounded truncate max-w-[130px]">{issue.project.name}</span>}
                    <span className="text-[10px] text-text-muted/80 font-mono">{issue.type}</span>
                    {issue.labels?.slice(0, 2).map((il) => (
                      <Badge key={il.labelId} color={il.label?.color ?? '#71717A'} className="text-[9px]">{il.label?.name ?? il.labelId}</Badge>
                    ))}
                    {overdue && <span className="sm:hidden text-[10px] text-danger font-mono font-medium">● overdue</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right hidden sm:block">
                  <Badge color={statusColor(issue.status)} dot={false} className="text-[9px]">{issue.status.replace('_', ' ')}</Badge>
                  {overdue && <div className="text-[10px] text-danger mt-1 font-mono font-medium">● overdue</div>}
                  {issue.dueDate && !overdue && <div className="text-[10px] text-text-muted mt-1 font-mono">{formatDate(issue.dueDate)}</div>}
                </div>
                <div className="shrink-0 hidden md:flex justify-end">
                  {issue.assignee ? <Avatar name={issue.assignee.name} color={issue.assignee.color} size="sm" /> : <span className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center text-[10px] text-text-muted">–</span>}
                </div>
                <div className="shrink-0 text-right hidden md:block text-[11px] text-text-muted font-mono">{timeAgo(issue.updatedAt ?? issue.createdAt)}</div>
              </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 py-1">
          <span className="text-xs text-text-muted font-mono">
            {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setParam('page', String(Math.max(1, page - 1)))}
              disabled={page <= 1 || loading}
              className="h-8 px-3 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-text-muted px-2 font-mono">
              {meta.page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setParam('page', String(page + 1))}
              disabled={page >= meta.totalPages || loading}
              className="h-8 px-3 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function severityColor(s: string): string {
  return SEVERITY_COLORS[s as keyof typeof SEVERITY_COLORS] ?? '#71717A';
}
function statusColor(s: string): string {
  return STATUS_COLORS[s as keyof typeof STATUS_COLORS] ?? '#71717A';
}
