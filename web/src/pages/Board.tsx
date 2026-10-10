import { useEffect, useState } from 'react';
import { DndContext, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bug, GripVertical } from 'lucide-react';
import api from '../api/client';
import type { Issue } from '../lib/types';
import { Card, Badge, Avatar, EmptyState, Spinner } from '../components/ui';
import { SEVERITY_COLORS, STATUS_COLORS, timeAgo } from '../lib/types';

const COLUMNS = [
  { id: 'OPEN', title: 'Open', color: STATUS_COLORS.OPEN },
  { id: 'IN_PROGRESS', title: 'In Progress', color: STATUS_COLORS.IN_PROGRESS },
  { id: 'IN_REVIEW', title: 'In Review', color: STATUS_COLORS.IN_REVIEW },
  { id: 'RESOLVED', title: 'Resolved', color: STATUS_COLORS.RESOLVED },
  { id: 'CLOSED', title: 'Closed', color: STATUS_COLORS.CLOSED },
] as const;

type IssueWithRelations = Issue & {
  reporter?: { id: string; name: string; email: string; color: string };
  assignee?: { id: string; name: string; email: string; color: string } | null;
  project?: { id: string; name: string; slug: string };
};

function SortableIssue({ issue }: { issue: IssueWithRelations }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });
  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing rounded-lg border border-border bg-surface-elevated p-3 mb-2 hover:border-border-accent group"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={13} className="text-text-muted mt-0.5 group-hover:text-primary" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-text-muted mb-1">{issue.key}</div>
          <div className="text-sm font-medium text-text-primary line-clamp-2 break-words">{issue.title}</div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <Badge color={SEVERITY_COLORS[issue.severity]} className="text-[9px]">{issue.severity}</Badge>
            {issue.assignee && <Avatar name={issue.assignee.name} color={issue.assignee.color} size="xs" />}
          </div>
          <div className="text-[10px] text-text-muted mt-1.5 font-mono">{timeAgo(issue.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

export default function Board() {
  const [columns, setColumns] = useState<Record<string, IssueWithRelations[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/issues?limit=100');
      const issues: IssueWithRelations[] = res.data.data.issues;
      const cols: Record<string, IssueWithRelations[]> = {};
      for (const c of COLUMNS) cols[c.id] = [];
      issues.forEach((i) => {
        (cols[i.status as string] ??= []).push(i);
      });
      setColumns(cols);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const fromCol = Object.keys(columns).find((k) => columns[k].some((i) => i.id === active.id));
    const toCol = over.id as string;

    if (fromCol !== toCol) {
      setColumns((prev) => {
        const oldCol = prev[fromCol!] ?? [];
        const newCol = prev[toCol] ?? [];
        const moved = oldCol.find((i) => i.id === active.id);
        if (!moved) return prev;
        const updated = {
          ...prev,
          [fromCol!]: oldCol.filter((i) => i.id !== active.id),
          [toCol]: [...newCol, { ...moved, status: toCol as Issue['status'] }],
        };
        // Optimistically persist
        api.post(`/issues/${active.id}/status`, { status: toCol }).catch((err) => {
          console.error(err);
          // revert
          setColumns(prev);
        });
        return updated;
      });
    } else {
      // reorder within same column
      setColumns((prev) => {
        const col = prev[fromCol!] ?? [];
        const oldIndex = col.findIndex((i) => i.id === active.id);
        const newIndex = col.findIndex((i) => i.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, [fromCol!]: arrayMove(col, oldIndex, newIndex) };
      });
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex flex-col w-80 shrink-0">
            <div
              className="rounded-t-lg border-b border-border px-3 py-1.5 text-sm font-medium"
              style={{ color: col.color }}
            >
              {col.title} <span className="text-text-muted font-normal text-xs">({columns[col.id]?.length ?? 0})</span>
            </div>
            <div className="flex-1 min-h-[400px] bg-surface-elevated/30 rounded-b-lg p-2 overflow-y-auto">
              {loading ? (
                <Spinner className="mx-auto mt-4" />
              ) : (
                <SortableContext items={columns[col.id]?.map((i) => i.id) ?? []} strategy={verticalListSortingStrategy}>
                  {columns[col.id]?.map((issue) => (
                    <SortableIssue key={issue.id} issue={issue} />
                  ))}
                </SortableContext>
              )}
              {columns[col.id]?.length === 0 && !loading && (
                <div className="py-8 text-center">
                  <EmptyState title="No issues" description="Drop issues here to move them into this column." />
                </div>
              )}
            </div>
          </div>
        ))}
      </DndContext>
    </div>
  );
}
