import { z } from 'zod';

export const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const statuses = ['OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const;
export const issueTypes = ['BUG', 'FEATURE', 'TASK', 'IMPROVEMENT'] as const;
export const roles = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export const relationTypes = ['RELATED', 'DUPLICATE', 'BLOCKS', 'BLOCKED_BY'] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  workspaceName: z.string().trim().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional(),
  memberIds: z.array(z.string().cuid()).optional(),
  repoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (v) =>
        !v ||
        /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?(?:[?#].*)?$/.test(v) ||
        /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v),
      { message: 'Enter a valid GitHub repo URL (https://github.com/owner/repo) or owner/repo' },
    ),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

export const createIssueSchema = z.object({
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().max(10000).optional(),
  reproductionSteps: z.string().trim().max(10000).optional(),
  expectedResult: z.string().trim().max(5000).optional(),
  actualResult: z.string().trim().max(5000).optional(),
  severity: z.enum(severities).default('MEDIUM'),
  status: z.enum(statuses).default('OPEN'),
  type: z.enum(issueTypes).default('BUG'),
  projectId: z.string().cuid(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  environment: z.string().trim().max(200).optional(),
  browser: z.string().trim().max(100).optional(),
  os: z.string().trim().max(100).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  sprintId: z.string().cuid().nullable().optional(),
});

export const updateIssueSchema = z.object({
  title: z.string().trim().min(4).max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  reproductionSteps: z.string().trim().max(10000).optional(),
  expectedResult: z.string().trim().max(5000).optional(),
  actualResult: z.string().trim().max(5000).optional(),
  severity: z.enum(severities).optional(),
  type: z.enum(issueTypes).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  labelIds: z.array(z.string().cuid()).optional(),
  environment: z.string().trim().max(200).optional(),
  browser: z.string().trim().max(100).optional(),
  os: z.string().trim().max(100).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  sprintId: z.string().cuid().nullable().optional(),
});

export const issueStatusSchema = z.object({
  status: z.enum(statuses),
});

export const assignSchema = z.object({
  assigneeId: z.string().cuid().nullable(),
});

export const severitySchema = z.object({
  severity: z.enum(severities),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const relatedSchema = z.object({
  targetId: z.string().cuid(),
  type: z.enum(relationTypes).default('RELATED'),
});

export const createSprintSchema = z.object({
  name: z.string().trim().min(2).max(100),
  goal: z.string().trim().max(1000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  projectId: z.string().cuid(),
}).refine((d) => d.endDate > d.startDate, {
  message: 'Sprint end date must be after start date',
  path: ['endDate'],
});

export const updateSprintSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  goal: z.string().trim().max(1000).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional(),
}).refine((d) => !d.startDate || !d.endDate || d.endDate > d.startDate, {
  message: 'Sprint end date must be after start date',
  path: ['endDate'],
});

export const addSprintIssuesSchema = z.object({
  issueIds: z.array(z.string().cuid()).min(1).max(100),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const issueQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  sprintId: z.string().optional(),
  due: z.enum(['overdue', 'week', 'none']).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'dueDate', 'severity', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeArchived: z.coerce.boolean().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const aiTextSchema = z.object({
  text: z.string().trim().min(10).max(20000),
});

export const aiIssueSchema = z.object({
  issueId: z.string().cuid(),
});

export const aiSeveritySchema = z.object({
  title: z.string().min(4).max(200),
  description: z.string().max(10000).optional(),
  reproductionSteps: z.string().max(10000).optional(),
  actualResult: z.string().max(5000).optional(),
});
