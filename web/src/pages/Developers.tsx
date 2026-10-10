import { useEffect, useState } from 'react';
import { Badge, Card, Spinner, EmptyState, Avatar } from '../components/ui';
import { SEVERITY_COLORS } from '../lib/types';
import api from '../api/client';

interface Developer {
  id: string;
  name: string;
  email: string;
  color: string;
  assigned: number;
  open: number;
  inProgress: number;
  resolved: number;
  workload: number;
  criticalOpen: number;
  projectCount: number;
}

interface DevIssue { id: string; key: string; title: string; severity: string; status: string; project: { name: string } }

export default function Developers() {
  const [members, setMembers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssues, setShowIssues] = useState<Record<string, DevIssue[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/developers');
      setMembers(res.data.data as Developer[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const loadIssues = async (userId: string) => {
    if (showIssues[userId]) {
      setShowIssues((s) => { const n = { ...s }; delete n[userId]; return n; });
      return;
    }
    try {
      const res = await api.get(`/developers/${userId}`);
      setShowIssues((s) => ({ ...s, [userId]: (res.data.data.openIssues ?? []) }));
    } catch {
      setShowIssues((s) => ({ ...s, [userId]: [] }));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Developers</h1>

      {loading ? <Spinner className="mx-auto" /> : (
        <div className="space-y-3">
          {members.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.name} color={m.color} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{m.name}</div>
                    <div className="text-[11px] text-text-muted">{m.email}</div>
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <div><span className="text-lg font-bold text-text-primary">{m.assigned}</span><div className="text-[10px] text-text-muted">Assigned</div></div>
                  <div><span className="text-lg font-bold text-primary">{m.open}</span><div className="text-[10px] text-text-muted">Open</div></div>
                  <div><span className="text-lg font-bold text-warning">{m.inProgress}</span><div className="text-[10px] text-text-muted">In Progress</div></div>
                  <div><span className="text-lg font-bold text-success">{m.resolved}</span><div className="text-[10px] text-text-muted">Done</div></div>
                  {m.criticalOpen > 0 && <div><span className="text-lg font-bold text-danger">{m.criticalOpen}</span><div className="text-[10px] text-text-muted">Critical</div></div>}
                </div>
                <button
                  onClick={() => loadIssues(m.id)}
                  className="text-xs text-text-muted hover:text-primary font-mono"
                >
                  {showIssues[m.id] !== undefined ? 'Hide' : 'Issues'}
                </button>
              </div>
              {showIssues[m.id] !== undefined && (
                <div className="mt-3 divide-y divide-border">
                  {(showIssues[m.id] ?? []).map((i) => (
                    <div key={i.id} className="flex items-center gap-2 py-1.5 text-xs">
                      <Badge color={SEVERITY_COLORS[i.severity as keyof typeof SEVERITY_COLORS]} className="text-[9px]">{i.severity}</Badge>
                      <span className="text-text-secondary font-mono">{i.key}</span>
                      <span className="text-text-primary flex-1">{i.title}</span>
                      <Badge color="#60A5FA" className="text-[9px]">{i.status}</Badge>
                    </div>
                  ))}
                  {showIssues[m.id]?.length === 0 && <EmptyState title="No issues assigned" />}
                </div>
              )}
            </Card>
          ))}
          {members.length === 0 && <EmptyState title="No developers found" />}
        </div>
      )}
    </div>
  );
}
