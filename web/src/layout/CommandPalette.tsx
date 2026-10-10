import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bug, FolderKanban, User, Tag, CornerDownLeft } from 'lucide-react';
import api from '../api/client';
import type { Issue, Project, User as UserType, Label } from '../lib/types';
import { SEVERITY_COLORS, STATUS_COLORS } from '../lib/types';
import { Badge } from '../components/ui';

interface Result {
  kind: 'issue' | 'project' | 'developer' | 'label';
  id: string;
  title: string;
  subtitle?: string;
  color?: string;
  to: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await api.get('/search', { params: { q: query, limit: 8 } });
        const data = res.data.data;
        const out: Result[] = [
          ...(data.issues ?? []).map((i: Issue) => ({
            kind: 'issue' as const,
            id: i.id,
            title: i.title,
            subtitle: `${i.key} · ${i.severity}`,
            color: SEVERITY_COLORS[i.severity as keyof typeof SEVERITY_COLORS],
            to: `/issues/${i.id}`,
          })),
          ...(data.projects ?? []).map((p: Project) => ({
            kind: 'project' as const,
            id: p.id,
            title: p.name,
            subtitle: 'Project',
            to: `/projects/${p.id}`,
          })),
          ...(data.developers ?? []).map((u: UserType) => ({
            kind: 'developer' as const,
            id: u.id,
            title: u.name,
            subtitle: u.email,
            color: u.color,
            to: `/developers`,
          })),
          ...(data.labels ?? []).map((l: Label) => ({
            kind: 'label' as const,
            id: l.id,
            title: l.name,
            subtitle: 'Label',
            color: l.color,
            to: `/issues?label=${encodeURIComponent(l.name)}`,
          })),
        ];
        setResults(out);
        setSelected(0);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const icons = useMemo(
    () => ({
      issue: Bug,
      project: FolderKanban,
      developer: User,
      label: Tag,
    }),
    [],
  );

  if (!open) return null;

  const go = (r: Result) => {
    onClose();
    navigate(r.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      go(results[selected]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-surface-elevated shadow-elevated overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={17} className="text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search issues, projects, developers, labels…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-text-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {query.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-text-muted">
              Type at least 2 characters to search across your workspace
            </div>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-text-muted">No results for "{query}"</div>
          )}
          {results.map((r, i) => {
            const Icon = icons[r.kind];
            return (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-primary/10' : ''
                }`}
              >
                <span className="text-text-muted"><Icon size={16} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-text-primary truncate">{r.title}</span>
                  {r.subtitle && <span className="block text-[11px] text-text-muted truncate">{r.subtitle}</span>}
                </span>
                {r.color && <Badge color={r.color}>{r.kind}</Badge>}
                {i === selected && <CornerDownLeft size={14} className="text-text-muted" />}
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted font-mono">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
