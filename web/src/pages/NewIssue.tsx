import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Sparkles } from 'lucide-react';
import api from '../api/client';
import type { Project, Severity, IssueType } from '../lib/types';
import { Card, Button, Input, Textarea, Select, Field, Badge, Spinner } from '../components/ui';
import { extractError } from '../api/client';

export default function NewIssue() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repro, setRepro] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [type, setType] = useState<IssueType>('BUG');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labels, setLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [p, l] = await Promise.all([api.get('/projects'), api.get('/labels')]);
      setProjects(p.data.data);
      setLabels(l.data.data);
      if (p.data.data.length > 0) setProjectId(p.data.data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, []);

  const suggestSeverity = async () => {
    if (!title.trim()) return;
    setSuggesting(true);
    try {
      const res = await api.post('/ai/severity-suggest', { title, description, reproductionSteps: repro, actualResult: actual });
      const suggestion = res.data.data.suggestion;
      setSeverity(suggestion.severity);
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/issues', {
        title, description: description || undefined, reproductionSteps: repro || undefined,
        expectedResult: expected || undefined, actualResult: actual || undefined,
        severity, type, projectId, labelIds: labelIds.length ? labelIds : undefined,
      });
      navigate(`/issues/${res.data.data.id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div>
        <Link to="/issues" className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-primary transition-colors">
          <ChevronLeft size={15} /> Back to issues
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight text-text-primary mt-1.5">New Issue</h1>
        <p className="text-[13px] text-text-secondary mt-1">Describe the bug clearly — good reports get fixed faster.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-lg border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-[13px] text-danger">{error}</div>}

        <Card className="overflow-hidden">
          <div className="p-4 sm:p-5">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarize the problem concisely" required maxLength={200} />
          </Field>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={suggestSeverity} loading={suggesting} disabled={!title.trim() || suggesting}>
              <Sparkles size={13} /> {suggesting ? 'Analyzing…' : 'Suggest Severity'}
            </Button>
            <Badge color="#FB923C">{severity}</Badge>
            <span className="text-[11px] text-text-muted">AI suggestion is a starting point — adjust as needed.</span>
          </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4">
          <Field label="Description" hint="What's happening? Include context, links, screenshots.">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening? Be specific." />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Steps to Reproduce">
              <Textarea value={repro} onChange={(e) => setRepro(e.target.value)} placeholder={'1. Go to…\n2. Click…\n3. Observe…'} className="font-mono text-[13px]" />
            </Field>
            <Field label="Expected Result">
              <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="What should happen?" />
            </Field>
          </div>
          <Field label="Actual Result">
            <Textarea value={actual} onChange={(e) => setActual(e.target.value)} placeholder="What actually happened?" />
          </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as IssueType)}>
                <option value="BUG">Bug</option>
                <option value="FEATURE">Feature</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="TASK">Task</option>
              </Select>
            </Field>
            <Field label="Severity">
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </Field>
            <Field label="Project">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                <option value="" disabled>Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </div>
          {labels.length > 0 && (
            <Field label="Labels" className="mt-4">
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const active = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLabelIds(active ? labelIds.filter((id) => id !== l.id) : [...labelIds, l.id])}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all duration-150 ${
                        active ? 'border-transparent text-white' : 'border-border text-text-secondary hover:border-[#3a3440] hover:text-text-primary'
                      }`}
                      style={active ? { backgroundColor: `${l.color}26`, borderColor: `${l.color}55`, color: l.color } : undefined}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-2 pb-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/issues')}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!title.trim() || !projectId}>Create Issue</Button>
        </div>
      </form>
    </div>
  );
}
