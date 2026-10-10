import { getEnv } from '../config/env.js';

/**
 * AI Provider abstraction.
 *
 * The application ships with a transparent rule-based provider that works
 * offline with zero configuration. When an OpenAI-compatible API key is
 * configured via environment variables, the OpenAI provider is used instead.
 * No AI credentials are ever exposed to the frontend; all calls happen
 * server-side. All AI output is a SUGGESTION and must be reviewed by a
 * human before being applied.
 */

export interface AiSuggestion<T> {
  provider: 'rule-based' | 'openai';
  suggestion: T;
  disclaimer: string;
}

export interface AiProvider {
  readonly name: 'rule-based' | 'openai';
  summarize(input: string): Promise<AiSuggestion<string>>;
  improve(input: string): Promise<AiSuggestion<string>>;
  suggestSeverity(input: { title: string; description?: string; reproductionSteps?: string; actualResult?: string }): Promise<AiSuggestion<{ severity: string; confidence: number; reasons: string[] }>>;
  debugSteps(input: { title: string; description?: string; reproductionSteps?: string; actualResult?: string }): Promise<AiSuggestion<string[]>>;
  findDuplicates(issue: { title: string; description?: string }, candidates: { id: string; title: string; description?: string }[]): Promise<AiSuggestion<{ id: string; title: string; score: number }[]>>;
}

const DISCLAIMER =
  'AI-generated suggestion. Review carefully before applying — it does not represent a definitive diagnosis.';

/* ------------------------------------------------------------------ */
/* Rule-based provider (default, no external calls)                    */
/* ------------------------------------------------------------------ */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

const SEVERITY_SIGNALS: Record<string, number> = {
  crash: 3, down: 3, outage: 3, corrupt: 3, 'data loss': 3, security: 3, exploit: 3,
  fail: 2, broken: 2, error: 1, exception: 2, blank: 2, freeze: 2, hang: 2, leak: 2,
  slow: 1, typo: 0, cosmetic: 0, alignment: 0, 'minor': 0, label: 0, color: 0,
};

function scoreSeverityText(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const [signal, weight] of Object.entries(SEVERITY_SIGNALS)) {
    if (lower.includes(signal)) score += weight;
  }
  return score;
}

class RuleBasedProvider implements AiProvider {
  readonly name = 'rule-based' as const;

  async summarize(input: string): Promise<AiSuggestion<string>> {
    const sentences = input.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    const words = tokenize(input);
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

    const scored = sentences.map((s, i) => {
      const sWords = tokenize(s);
      const sScore = sWords.reduce((acc, w) => acc + (freq.get(w) ?? 0), 0) / Math.max(1, sWords.length);
      return { s, i, sScore };
    });
    scored.sort((a, b) => b.sScore - a.sScore);
    const top = scored.slice(0, Math.min(3, scored.length)).sort((a, b) => a.i - b.i);
    const summary = top.length > 0
      ? top.map((t) => t.s).join(' ')
      : 'No summary available — the input text is too short.';

    return {
      provider: this.name,
      suggestion: summary.length > 600 ? summary.slice(0, 597) + '…' : summary,
      disclaimer: DISCLAIMER,
    };
  }

  async improve(input: string): Promise<AiSuggestion<string>> {
    const trimmed = input.trim().replace(/\s+/g, ' ');
    const sentences = trimmed.split(/(?<=[.!?])\s+/).map((s) => {
      const t = s.trim();
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
    });
    const improved = sentences.join(' ');
    const sections: string[] = [];
    sections.push(improved);
    sections.push('');
    sections.push('Steps to reproduce:');
    sections.push('1. Open the affected area of the application.');
    sections.push('2. Perform the action described above.');
    sections.push('3. Observe the result.');
    sections.push('');
    sections.push('Expected result: The application behaves as documented.');
    sections.push('Actual result: The behavior described above occurs.');
    return {
      provider: this.name,
      suggestion: sections.join('\n'),
      disclaimer: DISCLAIMER,
    };
  }

  async suggestSeverity(input: { title: string; description?: string; reproductionSteps?: string; actualResult?: string }): Promise<AiSuggestion<{ severity: string; confidence: number; reasons: string[] }>> {
    const text = `${input.title} ${input.description ?? ''} ${input.actualResult ?? ''} ${input.reproductionSteps ?? ''}`;
    const score = scoreSeverityText(text);
    const reasons: string[] = [];
    const lower = text.toLowerCase();
    if (/(crash|outage|down|corrupt|security|exploit)/.test(lower)) reasons.push('Mentions crashes, outages, data corruption, or security impact');
    if (/(fail|broken|exception|freeze|hang|leak)/.test(lower)) reasons.push('Mentions failures, exceptions, freezes, or resource leaks');
    if (/(error|slow|minor|typo|cosmetic)/.test(lower)) reasons.push('Mentions errors or cosmetic concerns');
    if (reasons.length === 0) reasons.push('No strong severity signals detected in the report');

    let severity = 'LOW';
    let confidence = 0.55;
    if (score >= 5) { severity = 'CRITICAL'; confidence = 0.8; }
    else if (score >= 3) { severity = 'HIGH'; confidence = 0.7; }
    else if (score >= 1) { severity = 'MEDIUM'; confidence = 0.6; }

    return { provider: this.name, suggestion: { severity, confidence, reasons }, disclaimer: DISCLAIMER };
  }

  async debugSteps(input: { title: string; description?: string; reproductionSteps?: string; actualResult?: string }): Promise<AiSuggestion<string[]>> {
    const steps = [
      `Reproduce the issue consistently: ${input.reproductionSteps?.split('\n').filter(Boolean)[0] ?? 'follow the reported reproduction steps'}.`,
      'Check the browser console and server logs for stack traces or error codes at the time of failure.',
      'Isolate variables: try a different browser, OS, account, and a clean session to rule out environment-specific causes.',
      'Verify the most recent changes to the affected code paths (recent commits, deployments, and configuration changes).',
      `Inspect the actual result ("${input.actualResult?.slice(0, 80) ?? 'as reported'}") against the expected behavior to identify the divergence point.`,
      'Write a minimal failing test case that captures the divergence, then bisect recent changes to locate the regression.',
    ];
    return { provider: this.name, suggestion: steps, disclaimer: DISCLAIMER };
  }

  async findDuplicates(issue: { title: string; description?: string }, candidates: { id: string; title: string; description?: string }[]): Promise<AiSuggestion<{ id: string; title: string; score: number }[]>> {
    const aTokens = tokenize(`${issue.title} ${issue.description ?? ''}`);
    const scored = candidates
      .map((c) => {
        const cTokens = tokenize(`${c.title} ${c.description ?? ''}`);
        const sim = jaccardSimilarity(aTokens, cTokens);
        const titleSim = jaccardSimilarity(tokenize(issue.title), tokenize(c.title));
        return { id: c.id, title: c.title, score: Math.round((sim * 0.6 + titleSim * 0.4) * 100) / 100 };
      })
      .filter((c) => c.score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { provider: this.name, suggestion: scored, disclaimer: DISCLAIMER };
  }
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible provider (optional, env-configured)               */
/* ------------------------------------------------------------------ */

class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.OPENAI_API_KEY ?? '';
    this.baseUrl = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  private async chat(system: string, user: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI provider request failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? '';
  }

  async summarize(input: string): Promise<AiSuggestion<string>> {
    const out = await this.chat(
      'You are a concise bug-report summarizer for an engineering team. Summarize in 2-4 sentences. Do not invent details.',
      `Summarize this bug report:\n\n${input.slice(0, 8000)}`,
    );
    return { provider: this.name, suggestion: out, disclaimer: DISCLAIMER };
  }

  async improve(input: string): Promise<AiSuggestion<string>> {
    const out = await this.chat(
      'You improve rough bug reports into clear, structured reports with reproduction steps, expected and actual results. Preserve all facts; do not invent details.',
      `Improve this bug report:\n\n${input.slice(0, 8000)}`,
    );
    return { provider: this.name, suggestion: out, disclaimer: DISCLAIMER };
  }

  async suggestSeverity(input: { title: string; description?: string; reproductionSteps?: string; actualResult?: string }): Promise<AiSuggestion<{ severity: string; confidence: number; reasons: string[] }>> {
    const out = await this.chat(
      'You suggest a bug severity: CRITICAL, HIGH, MEDIUM, or LOW. Respond with ONLY a JSON object: {"severity":"...","confidence":0.0-1.0,"reasons":["..."]}. Base it only on user impact and evidence provided.',
      `Title: ${input.title}\nDescription: ${input.description ?? ''}\nSteps: ${input.reproductionSteps ?? ''}\nActual: ${input.actualResult ?? ''}`,
    );
    try {
      const parsed = JSON.parse(out.replace(/```json|```/g, '').trim());
      return { provider: this.name, suggestion: parsed, disclaimer: DISCLAIMER };
    } catch {
      throw new Error('AI provider returned an unparseable severity suggestion');
    }
  }

  async debugSteps(input: { title: string; description?: string; reproductionSteps?: string; actualResult?: string }): Promise<AiSuggestion<string[]>> {
    const out = await this.chat(
      'You suggest concrete debugging investigation steps for a bug. Respond with ONLY a JSON array of 5-7 short strings.',
      `Title: ${input.title}\nDescription: ${input.description ?? ''}\nSteps: ${input.reproductionSteps ?? ''}\nActual: ${input.actualResult ?? ''}`,
    );
    try {
      const parsed = JSON.parse(out.replace(/```json|```/g, '').trim());
      return { provider: this.name, suggestion: parsed, disclaimer: DISCLAIMER };
    } catch {
      throw new Error('AI provider returned an unparseable debug-steps suggestion');
    }
  }

  async findDuplicates(issue: { title: string; description?: string }, candidates: { id: string; title: string; description?: string }[]): Promise<AiSuggestion<{ id: string; title: string; score: number }[]>> {
    const out = await this.chat(
      'Given a bug report and a list of candidate reports, identify likely duplicates. Respond with ONLY a JSON array of {"id","title","score"} objects (score 0-1), most similar first, max 5.',
      `Report: ${issue.title}\n${issue.description ?? ''}\n\nCandidates:\n${JSON.stringify(candidates.slice(0, 30))}`,
    );
    try {
      const parsed = JSON.parse(out.replace(/```json|```/g, '').trim());
      return { provider: this.name, suggestion: parsed, disclaimer: DISCLAIMER };
    } catch {
      throw new Error('AI provider returned an unparseable duplicate list');
    }
  }
}

/* ------------------------------------------------------------------ */

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    cached = new OpenAiProvider();
  } else {
    cached = new RuleBasedProvider();
  }
  return cached;
}
