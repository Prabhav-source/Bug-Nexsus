export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
export type IssueType = 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'TASK';
export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  color: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role?: UserRole;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  issueCount?: number;
  memberCount?: number;
  healthScore?: number;
  healthLabel?: string;
  openIssues?: number;
  totalIssues?: number;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  projectId: string;
  createdAt: string;
  issueCount?: number;
}

export interface Issue {
  id: string;
  key: string;
  title: string;
  description: string | null;
  reproductionSteps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  severity: Severity;
  status: IssueStatus;
  type: IssueType;
  environment: string | null;
  browser: string | null;
  os: string | null;
  dueDate: string | null;
  archived: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reporterId: string;
  assigneeId: string | null;
  projectId: string;
  sprintId: string | null;
  reporter?: User;
  assignee?: User | null;
  project?: Project;
  sprint?: Sprint | null;
  labels?: IssueLabel[];
  commentCount?: number;
  _count?: { comments: number };
}

export interface IssueLabel {
  issueId: string;
  labelId: string;
  label?: Label;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  issueId: string;
  authorId: string;
  author?: User;
}

export interface ActivityEvent {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  workspaceId: string;
  projectId: string | null;
  issueId: string | null;
  actorId: string;
  actor?: User;
  project?: Project | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  userId: string;
  issueId: string | null;
  projectId: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IssueListResponse {
  issues: Issue[];
  meta: Pagination;
}

export interface DashboardOverview {
  openIssues: number;
  inProgress: number;
  resolvedThisWeek: number;
  criticalIssues: number;
  totalIssues: number;
  overdueIssues: number;
  resolutionRate: number;
}

export interface ProjectHealth {
  id: string;
  name: string;
  slug: string;
  score: number;
  label: string;
  factors: {
    unresolvedCritical: number;
    overdue: number;
    backlogGrowing: boolean;
    resolvingFasterThanOpened: boolean;
    openedLast7Days: number;
    resolvedLast7Days: number;
  };
  openIssues: number;
  totalIssues: number;
}

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  color: string;
  assigned: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export interface TrendPoint {
  date: string;
  opened: number;
  resolved: number;
}

export interface AiSuggestion<T> {
  provider: string;
  suggestion: T;
  disclaimer: string;
}

/* ----- Color system (Crimson After Dark) ----- */
export const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#FF1744',
  HIGH: '#FB923C',
  MEDIUM: '#F59E0B',
  LOW: '#60A5FA',
};

export const STATUS_COLORS: Record<IssueStatus, string> = {
  OPEN: '#60A5FA',
  IN_PROGRESS: '#F59E0B',
  IN_REVIEW: '#A78BFA',
  RESOLVED: '#22C55E',
  CLOSED: '#71717A',
};

export const STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const TYPE_LABELS: Record<IssueType, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  IMPROVEMENT: 'Improvement',
  TASK: 'Task',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function isOverdue(issue: Issue): boolean {
  if (!issue.dueDate) return false;
  if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') return false;
  return new Date(issue.dueDate).getTime() < Date.now();
}
