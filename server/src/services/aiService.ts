import { getAiProvider } from '../lib/ai.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { getWorkspaceId } from './workspace.js';
import { requireIssueAccess } from './workspace.js';
import type { AuthenticatedRequest } from '../lib/auth.js';
import { aiTextSchema, aiIssueSchema, aiSeveritySchema } from '../lib/validation.js';

export async function summarizeIssue(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const { issueId } = aiIssueSchema.parse(req.body);
  const issue = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const text = [
    `Title: ${issue.title}`,
    issue.description ? `Description: ${issue.description}` : '',
    issue.reproductionSteps ? `Steps: ${issue.reproductionSteps}` : '',
    issue.actualResult ? `Actual: ${issue.actualResult}` : '',
  ].filter(Boolean).join('\n');
  const provider = getAiProvider();
  return provider.summarize(text);
}

export async function improveText(req: AuthenticatedRequest) {
  const { text } = aiTextSchema.parse(req.body);
  const provider = getAiProvider();
  return provider.improve(text);
}

export async function suggestSeverity(req: AuthenticatedRequest) {
  const input = aiSeveritySchema.parse(req.body);
  const provider = getAiProvider();
  return provider.suggestSeverity(input);
}

export async function debugSteps(req: AuthenticatedRequest) {
  const workspaceId = await getWorkspaceId(req);
  const { issueId } = aiIssueSchema.parse(req.body);
  const issue = await requireIssueAccess(workspaceId, issueId, req.user!.userId);
  const provider = getAiProvider();
  return provider.debugSteps({
    title: issue.title,
    description: issue.description ?? undefined,
    reproductionSteps: issue.reproductionSteps ?? undefined,
    actualResult: issue.actualResult ?? undefined,
  });
}

export async function findDuplicates(req: AuthenticatedRequest, issueId: string) {
  const workspaceId = await getWorkspaceId(req);
  const issue = await requireIssueAccess(workspaceId, issueId, req.user!.userId);

  const candidates = await prisma.issue.findMany({
    where: {
      project: { workspaceId },
      id: { not: issue.id },
      archived: false,
      status: { notIn: ['CLOSED'] },
    },
    select: { id: true, title: true, description: true },
    take: 200,
  });

  const provider = getAiProvider();
  const result = await provider.findDuplicates(
    { title: issue.title, description: issue.description ?? undefined },
    candidates.map((c) => ({ id: c.id, title: c.title, description: c.description ?? undefined })),
  );
  return result;
}

export function aiConfig() {
  const provider = getAiProvider();
  return {
    provider: provider.name,
    configured: provider.name === 'rule-based' || Boolean(process.env.OPENAI_API_KEY),
    message:
      provider.name === 'rule-based'
        ? 'Rule-based AI assistant active. Set AI_PROVIDER=openai and OPENAI_API_KEY in the server .env to enable the OpenAI-compatible provider.'
        : 'OpenAI-compatible provider active.',
  };
}

export function assertAiAvailable() {
  const provider = getAiProvider();
  if (provider.name === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new AppError(400, 'AI_NOT_CONFIGURED', 'AI provider is not configured');
  }
}
