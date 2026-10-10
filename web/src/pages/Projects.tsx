import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, FolderKanban, Github, Sparkles, ExternalLink } from 'lucide-react';
import api, { extractError } from '../api/client';
import type { Project } from '../lib/types';
import { Card, Button, Badge, EmptyState, Modal, Input, Field, Textarea } from '../components/ui';

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(searchParams.get('import') === 'github');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [importName, setImportName] = useState('');
  const [importIssues, setImportIssues] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ name: string; issues: number; prs: number; url: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects');
      setProjects(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (searchParams.get('import') === 'github') setImportOpen(true);
  }, [searchParams]);

  const closeImport = () => {
    setImportOpen(false);
    setImportError(null);
    setImportResult(null);
    if (searchParams.get('import')) {
      const next = new URLSearchParams(searchParams);
      next.delete('import');
      setSearchParams(next);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/projects', { name: name.trim(), description: description.trim() || undefined });
      setModalOpen(false);
      setName('');
      setDescription('');
      load();
    } catch (err) {
      setCreateError(extractError(err));
    } finally {
      setCreating(false);
    }
  };

  const seedDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await api.post('/projects/demo');
      load();
    } catch (err) {
      setDemoError(extractError(err));
    } finally {
      setDemoLoading(false);
    }
  };

  const importRepo = async () => {
    if (!repoUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await api.post('/projects/import/github', {
        repoUrl: repoUrl.trim(),
        name: importName.trim() || undefined,
        importIssues,
        maxIssues: 20,
      });
      const d = res.data.data;
      setImportResult({
        name: d.name,
        issues: d.imported?.issues ?? 0,
        prs: d.imported?.pullRequestsSkipped ?? 0,
        url: d.repo?.url ?? '',
      });
      setRepoUrl('');
      setImportName('');
      load();
    } catch (err) {
      setImportError(extractError(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary">Projects</h1>
          <p className="text-[13px] text-text-secondary mt-1">Organize issues by codebase, team, or initiative.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
            <Github size={14} /> Import from GitHub
          </Button>
          <Button size="sm" variant="secondary" onClick={seedDemo} loading={demoLoading}>
            <Sparkles size={14} /> Demo project
          </Button>
          <Button size="sm" onClick={() => { setCreateError(null); setModalOpen(true); }}>
            <Plus size={14} strokeWidth={2.5} /> New Project
          </Button>
        </div>
      </div>

      {demoError && (
        <div className="rounded-lg border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-[13px] text-danger">{demoError}</div>
      )}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <div className="h-5 w-1/2 rounded bg-surface-hover/80 animate-pulse mb-2" />
              <div className="h-3 w-3/4 rounded bg-surface-hover/50 animate-pulse mb-4" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 rounded-lg bg-surface-hover/50 animate-pulse" />
                <div className="h-12 rounded-lg bg-surface-hover/50 animate-pulse" />
                <div className="h-12 rounded-lg bg-surface-hover/50 animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-6 sm:p-8">
          <EmptyState
            icon={<FolderKanban size={22} />}
            title="No projects yet"
            description="Create one manually, seed a demo project with sample bugs, or import a real GitHub repository."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setModalOpen(true)}><Plus size={14} strokeWidth={2.5} /> New Project</Button>
                <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}><Github size={14} /> Import from GitHub</Button>
                <Button size="sm" variant="secondary" onClick={seedDemo} loading={demoLoading}><Sparkles size={14} /> Demo project</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="group block min-w-0">
              <Card className="p-5 transition-all duration-150 hover:border-[#3a3440] hover:-translate-y-px h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-text-primary group-hover:text-white transition-colors truncate">{p.name}</h3>
                    <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">{p.description || 'No description'}</p>
                  </div>
                  <Badge color={p.status === 'ACTIVE' ? '#22C55E' : '#71717A'} dot={false} className="text-[9px] shrink-0">{p.status}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center rounded-lg border border-border-subtle bg-background-secondary/40 py-2.5">
                  <div>
                    <div className="text-lg font-extrabold text-text-primary tabular-nums leading-none">{p.totalIssues ?? 0}</div>
                    <div className="text-[10px] text-text-muted mt-1 font-mono uppercase tracking-wide">Issues</div>
                  </div>
                  <div className="border-x border-border-subtle">
                    <div className="text-lg font-extrabold text-text-primary tabular-nums leading-none">{p.openIssues ?? 0}</div>
                    <div className="text-[10px] text-text-muted mt-1 font-mono uppercase tracking-wide">Open</div>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-text-primary tabular-nums leading-none">{p.memberCount ?? 0}</div>
                    <div className="text-[10px] text-text-muted mt-1 font-mono uppercase tracking-wide">Members</div>
                  </div>
                </div>
                {p.healthScore !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2.5">
                      <div className="text-[11px] font-mono text-text-muted w-12 tabular-nums">{p.healthScore}/100</div>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-hover/70 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${p.healthScore}%`, backgroundColor: p.healthScore > 70 ? '#22C55E' : p.healthScore > 40 ? '#F59E0B' : '#FF1744' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Project">
        <div className="space-y-4">
          {createError && <div className="rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2 text-xs text-danger">{createError}</div>}
          <Field label="Project name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nexus API" maxLength={100} />
          </Field>
          <Field label="Description" hint="What does this project cover?">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description…" className="min-h-[70px] text-[13px]" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={create} loading={creating} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={closeImport} title="Import from GitHub" wide>
        <div className="space-y-4">
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Paste a public repository URL. BugNexus reads the repo metadata plus its open issues and mirrors them into a new project.
          </p>
          {importError && <div className="rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2 text-xs text-danger">{importError}</div>}
          {importResult && (
            <div className="rounded-lg border border-success/25 bg-success/[0.07] px-3.5 py-3 text-[13px] text-text-primary">
              Imported <strong>{importResult.name}</strong> — {importResult.issues} issue{importResult.issues === 1 ? '' : 's'} mirrored
              {importResult.prs > 0 ? ` (${importResult.prs} PR${importResult.prs === 1 ? '' : 's'} skipped)` : ''}.
              {importResult.url && (
                <a href={importResult.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:text-primary-hover ml-1">
                  View repo <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
          <Field label="GitHub repository URL" hint="e.g. https://github.com/facebook/react or owner/repo">
            <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" inputMode="url" />
          </Field>
          <Field label="Project name (optional)" hint="Defaults to the repository name">
            <Input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="My imported project" maxLength={100} />
          </Field>
          <label className="flex items-center gap-2.5 text-[13px] text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={importIssues}
              onChange={(e) => setImportIssues(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            Import open GitHub issues as BugNexus issues (up to 20)
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={closeImport}>Close</Button>
            <Button size="sm" onClick={importRepo} loading={importing} disabled={!repoUrl.trim()}>
              <Github size={14} /> Import repository
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
