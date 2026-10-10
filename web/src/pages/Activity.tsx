import { useEffect, useState } from 'react';
import { Activity, Filter, Search, User } from 'lucide-react';
import api from '../api/client';
import type { ActivityEvent } from '../lib/types';
import { Card, Badge, Spinner, Avatar, EmptyState, Input } from '../components/ui';

const EVENT_LABELS: Record<string, string> = {
  ISSUE_CREATED: 'created issue',
  ISSUE_UPDATED: 'updated issue',
  ISSUE_RESOLVED: 'resolved issue',
  ISSUE_STATUS_CHANGED: 'changed status',
  ISSUE_SEVERITY_CHANGED: 'changed severity',
  ISSUE_ASSIGNED: 'assigned issue',
  ISSUE_ARCHIVED: 'archived issue',
  PROJECT_CREATED: 'created project',
  SPRINT_CREATED: 'created sprint',
  COMMENT_CREATED: 'added a comment',
};

function describeEvent(e: ActivityEvent): string {
  if (e.payload && typeof e.payload === 'object') {
    const p = e.payload as Record<string, unknown>;
    if (p.key && p.title) return `${EVENT_LABELS[e.type] ?? e.type}: "${p.key as string}"`;
    if (p.name) return `${EVENT_LABELS[e.type] ?? e.type}: ${p.name as string}`;
    if (p.key) return `${EVENT_LABELS[e.type] ?? e.type}: ${p.key as string}`;
  }
  return EVENT_LABELS[e.type] ?? e.type.replace('_', ' ').toLowerCase();
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/activity?limit=100');
        setEvents(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = search.trim()
    ? events.filter((e) => describeEvent(e).toLowerCase().includes(search.toLowerCase()))
    : events;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Activity</h1>
        <div className="relative w-56">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter activity…" className="pr-8 text-sm h-8" />
          <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      <Card>
        <div className="divide-y divide-border">
          {loading ? <Spinner className="mx-auto my-8" /> : (
            filtered.length === 0 ? (
              <EmptyState title="No activity" description="Activity events appear here once you start working." />
            ) : (
              filtered.map((e) => (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <Avatar name={e.actor?.name} color={e.actor?.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium text-text-primary">{e.actor?.name ?? 'System'}</span>
                      <span className="text-text-secondary"> {describeEvent(e)}</span>
                    </div>
                    <div className="text-[10px] text-text-muted font-mono mt-0.5">
                      {new Date(e.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <Badge color="#29292F" className="text-[9px]">{e.type.replace(/_/g, ' ')}</Badge>
                </div>
              ))
            )
          )}
        </div>
      </Card>
    </div>
  );
}
