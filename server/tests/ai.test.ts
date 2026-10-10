import { describe, it, expect } from 'vitest';
import { getAiProvider } from '../src/lib/ai.js';

describe('Rule-based AI provider', () => {
  const provider = getAiProvider();

  it('identifies as the rule-based provider by default', () => {
    expect(provider.name).toBe('rule-based');
  });

  it('summarizes text into a non-empty suggestion', async () => {
    const result = await provider.summarize(
      'The API returns 500 errors under load. The database pool is exhausted. Users see timeouts. This happens during peak hours.',
    );
    expect(result.provider).toBe('rule-based');
    expect(result.suggestion.length).toBeGreaterThan(0);
    expect(result.disclaimer.length).toBeGreaterThan(0);
  });

  it('improves rough text into a structured report', async () => {
    const result = await provider.improve('login page is broken and crashes sometimes');
    expect(result.suggestion).toContain('Login page is broken');
    expect(result.suggestion).toContain('Steps to reproduce');
    expect(result.suggestion).toContain('Expected result');
  });

  it('suggests CRITICAL severity for crash reports', async () => {
    const result = await provider.suggestSeverity({
      title: 'App crashes and data is corrupted on startup',
      description: 'Complete outage for all users, security exploit possible.',
    });
    expect(result.suggestion.severity).toBe('CRITICAL');
    expect(result.suggestion.confidence).toBeGreaterThan(0.5);
    expect(result.suggestion.reasons.length).toBeGreaterThan(0);
  });

  it('suggests LOW severity for cosmetic reports', async () => {
    const result = await provider.suggestSeverity({
      title: 'Minor typo on the settings label',
      description: 'Cosmetic alignment issue with a color label.',
    });
    expect(result.suggestion.severity).toBe('LOW');
  });

  it('produces debug steps', async () => {
    const result = await provider.debugSteps({
      title: 'Blank screen after update',
      reproductionSteps: '1. Update the app\n2. Open it',
      actualResult: 'Blank white screen',
    });
    expect(result.suggestion.length).toBeGreaterThanOrEqual(5);
    expect(result.suggestion[0]).toContain('Update the app');
  });

  it('finds duplicate issues by similarity', async () => {
    const result = await provider.findDuplicates(
      { title: 'Websocket reconnect returns 500', description: 'Concurrent reconnects cause gateway 500 errors under load.' },
      [
        { id: 'a', title: 'Websocket reconnect returns 500', description: 'Concurrent reconnects cause gateway 500 errors under load.' },
        { id: 'b', title: 'Typo in settings page label', description: 'Cosmetic label issue.' },
        { id: 'c', title: 'Slow dashboard rendering', description: 'Charts render slowly on big datasets.' },
      ],
    );
    expect(result.suggestion.length).toBeGreaterThan(0);
    expect(result.suggestion[0].id).toBe('a');
    expect(result.suggestion[0].score).toBeGreaterThan(0.5);
    // results are sorted by descending similarity
    for (let i = 1; i < result.suggestion.length; i++) {
      expect(result.suggestion[i - 1].score).toBeGreaterThanOrEqual(result.suggestion[i].score);
    }
  });
});
