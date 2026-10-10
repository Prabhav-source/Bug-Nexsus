import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, Tag, ExternalLink, MessageSquare, Send, Paperclip, Copy,
  Clock, User, AlertCircle, CheckCircle, PauseCircle, ChevronLeft,
} from 'lucide-react';
import api from '../api/client';
import type { Issue, Comment, User as UserType } from '../lib/types';
import { Card, Badge, Button, Textarea, Input, Avatar, Spinner, EmptyState, Modal } from '../components/ui';
import { SEVERITY_COLORS, STATUS_COLORS, timeAgo, formatDateTime, isOverdue } from '../lib/types';

const STATUS_OPTIONS: { value: Issue['status']; label: string; icon: React.ElementType }[] = [
  { value: 'OPEN', label: 'Open', icon: AlertCircle },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: Clock },
  { value: 'IN_REVIEW', label: 'In Review', icon: PauseCircle },
  { value: 'RESOLVED', label: 'Resolved', icon: CheckCircle },
  { value: 'CLOSED', label: 'Closed', icon: CheckCircle },
];

export default function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/issues/${id}`);
      setIssue(res.data.data);
      setComments(res.data.data.comments ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    setCommenting(true);
    try {
      const res = await api.post(`/issues/${id}/comments`, { body: newComment });
      setComments((c) => [...c, res.data.data]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    } finally {
      setCommenting(false);
    }
  };

  const changeStatus = async (status: string) => {
    try {
      await api.post(`/issues/${id}/status`, { status });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const suggestSummary = async () => {
    setAiLoading(true);
    try {
      const res = await api.post('/ai/summarize', { issueId: id });
      setAiSuggestion(res.data.data.summary);
      setAiOpen(true);
    } catch (err) {
      setAiSuggestion('Could not generate a summary. Try again.');
      setAiOpen(true);
    } finally {
      setAiLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShare(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in max-w-4xl">
        <div className="h-4 w-44 rounded bg-surface-hover/80 animate-pulse" />
        <Card className="p-5">
          <div className="h-6 w-2/3 rounded bg-surface-hover/80 animate-pulse mb-3" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-md bg-surface-hover/60 animate-pulse" />
            <div className="h-5 w-20 rounded-md bg-surface-hover/60 animate-pulse" />
            <div className="h-5 w-14 rounded-md bg-surface-hover/60 animate-pulse" />
          </div>
        </Card>
        <Card className="p-5"><div className="h-24 rounded-lg bg-surface-hover/50 animate-pulse" /></Card>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <EmptyState title="Issue not found" description="The issue you're looking for doesn't exist or you don't have access." action={<Link to="/issues"><Button size="sm" variant="secondary">Back to issues</Button></Link>} />
        </Card>
      </div>
    );
  }

  const severityColor = SEVERITY_COLORS[issue.severity];
  const statusColor = STATUS_COLORS[issue.status];
  const overdue = isOverdue(issue);

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">
      <div className="flex items-center gap-1.5 text-[13px]">
        <Link to="/issues" className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors">
          <ChevronLeft size={15} /> Issues
        </Link>
        <span className="text-border">/</span>
        <span className="font-mono text-text-secondary">{issue.key}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <Badge color={severityColor} className="text-[10px]">{issue.severity}</Badge>
                <Badge color={statusColor} dot={false} className="text-[10px]">{issue.status.replace('_', ' ')}</Badge>
                <span className="font-mono text-[10px] text-text-muted bg-surface-elevated border border-border-subtle px-1.5 py-0.5 rounded">
                  {issue.type}
                </span>
                {overdue && <Badge color="#FF1744" dot={false} className="text-[10px]">OVERDUE</Badge>}
              </div>
              <h1 className="text-lg font-bold tracking-tight text-text-primary leading-snug break-words">{issue.title}</h1>
              <div className="flex items-center gap-3 mt-2.5 flex-wrap text-xs text-text-muted">
                {issue.reporter && (
                  <div className="flex items-center gap-1.5">
                    <Avatar name={issue.reporter.name} color={issue.reporter.color} size="xs" />
                    <span><span className="text-text-secondary">{issue.reporter.name}</span> · {timeAgo(issue.createdAt)}</span>
                  </div>
                )}
              <div className="flex items-center gap-1.5">
                <Tag size={12} /> {formatDateTime(issue.createdAt)}
              </div>
              {issue.dueDate && (
                <div className={`flex items-center gap-1.5 ${overdue ? 'text-danger font-medium' : ''}`}>
                  <Calendar size={12} /> Due {formatDateTime(issue.dueDate)}{overdue && ' · overdue'}
                </div>
              )}
              {issue.project && (
                <Link to={`/projects/${issue.project.id}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <ExternalLink size={12} /> {issue.project.name}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-start gap-1 shrink-0">
            <button
              onClick={() => setShowShare(true)}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
              title="Copy link"
              aria-label="Copy issue link"
            >
              <Copy size={15} />
            </button>
            <button
              onClick={suggestSummary}
              disabled={aiLoading}
              className="h-8 px-2.5 rounded-lg text-[11px] font-mono border border-border text-text-muted hover:text-text-primary hover:bg-surface-hover hover:border-[#3a3440] transition-colors disabled:opacity-50"
              title="Generate AI summary"
            >
              {aiLoading ? <Spinner className="w-3.5 h-3.5" /> : 'AI ✦'}
            </button>
          </div>
        </div>
        </div>

        <div className="px-5 py-3 border-t border-border-subtle bg-background-secondary/40">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <User size={13} className="text-text-muted" />
              {issue.assignee ? (
                <span className="inline-flex items-center gap-1.5"><Avatar name={issue.assignee.name} color={issue.assignee.color} size="xs" /><span className="text-text-primary font-medium">{issue.assignee.name}</span></span>
              ) : (
                <span className="text-text-muted">Unassigned</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} className="text-text-muted" />
              Updated {formatDateTime(issue.updatedAt)}
            </span>
            {issue.sprint && (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Sprint:</span> {issue.sprint.name}
              </span>
            )}
            {issue.environment && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-text-muted">Env:</span> {issue.environment}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border-subtle flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold font-mono uppercase tracking-[0.12em] text-text-muted mr-1">Status</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => changeStatus(s.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                issue.status === s.value
                  ? 'border-primary/40 bg-primary/[0.08] text-text-primary'
                  : 'border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-[#3a3440]'
              }`}
            >
              <s.icon size={13} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border-subtle">
          <div className="flex flex-wrap gap-1.5">
            {issue.labels && issue.labels.length > 0 ? (
              issue.labels.map((il) => (
                <Badge key={il.labelId} color={il.label?.color ?? '#71717A'}>{il.label?.name ?? il.labelId}</Badge>
              ))
            ) : (
              <span className="text-[11px] text-text-muted">No labels</span>
            )}
          </div>
        </div>

        {issue.description && (
          <div className="px-5 py-4 border-t border-border-subtle">
            <h3 className="text-[10px] font-semibold font-mono uppercase tracking-[0.12em] text-text-muted mb-2">Description</h3>
            <p className="text-[13.5px] text-text-primary whitespace-pre-wrap leading-relaxed">{issue.description}</p>
          </div>
        )}
        {issue.reproductionSteps && (
          <div className="px-5 py-4 border-t border-border-subtle">
            <h3 className="text-[10px] font-semibold font-mono uppercase tracking-[0.12em] text-text-muted mb-2">Steps to Reproduce</h3>
            <p className="text-[12.5px] text-text-primary whitespace-pre-wrap font-mono bg-background border border-border-subtle p-3 rounded-lg leading-relaxed">{issue.reproductionSteps}</p>
          </div>
        )}
        {issue.expectedResult && (
          <div className="px-5 py-4 border-t border-border-subtle">
            <h3 className="text-[10px] font-semibold font-mono uppercase tracking-[0.12em] text-text-muted mb-2">Expected Result</h3>
            <p className="text-[13.5px] text-text-primary whitespace-pre-wrap leading-relaxed">{issue.expectedResult}</p>
          </div>
        )}
        {issue.actualResult && (
          <div className="px-5 py-4 border-t border-border-subtle">
            <h3 className="text-[10px] font-semibold font-mono uppercase tracking-[0.12em] text-text-muted mb-2">Actual Result</h3>
            <p className="text-[13.5px] text-text-primary whitespace-pre-wrap leading-relaxed">{issue.actualResult}</p>
          </div>
        )}
      </Card>

      {/* Comments */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle">
          <h3 className="text-[13px] font-semibold text-text-primary">
            Comments <span className="text-text-muted font-normal font-mono text-xs">({comments.length})</span>
          </h3>
        </div>
        <div className="px-5 py-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.author?.name} color={c.author?.color} size="sm" />
              <div className="flex-1 min-w-0 bg-surface-elevated/60 border border-border-subtle rounded-lg px-3 py-2.5">
                <div className="text-[11px] text-text-muted mb-1"><span className="text-text-secondary font-medium">{c.author?.name ?? 'Unknown'}</span> · {timeAgo(c.createdAt)}</div>
                <p className="text-[13px] text-text-primary whitespace-pre-wrap leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <EmptyState title="No comments yet" description="Be the first to comment." />}
        </div>
        <div className="px-5 py-3.5 border-t border-border-subtle flex items-end gap-2.5 bg-background-secondary/30">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment... (Ctrl+Enter to send)"
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && newComment.trim()) postComment(); }}
            className="flex-1 min-h-[44px] text-[13px]"
          />
          <Button onClick={postComment} loading={commenting} size="sm" disabled={!newComment.trim()}>
            <Send size={14} />
            Comment
          </Button>
        </div>
      </Card>

      {/* AI summary modal */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="AI Summary">
        {aiSuggestion && <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{aiSuggestion}</p>}
      </Modal>

      {/* Share modal */}
      <Modal open={showShare} onClose={() => setShowShare(false)} title="Copy Issue Link">
        <div className="flex items-center gap-2">
          <Input value={window.location.href} readOnly className="text-xs" />
          <Button size="sm" onClick={copyLink}>Copy</Button>
        </div>
      </Modal>
    </div>
  );
}
