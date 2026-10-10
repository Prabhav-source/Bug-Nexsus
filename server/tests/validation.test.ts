import { describe, it, expect } from 'vitest';
import {
  createIssueSchema,
  issueQuerySchema,
  registerSchema,
  loginSchema,
  searchQuerySchema,
  aiSeveritySchema,
} from '../src/lib/validation.js';

describe('Validation schemas', () => {
  it('accepts a valid issue', () => {
    const result = createIssueSchema.safeParse({
      title: 'Login fails on mobile',
      description: 'The login button does nothing on Android.',
      severity: 'HIGH',
      status: 'OPEN',
      type: 'BUG',
      projectId: 'clx9f8a7b6c5d4e3f2a1b2c3d4',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid severity', () => {
    const result = createIssueSchema.safeParse({
      title: 'Test',
      severity: 'EXTREME',
      projectId: 'clx123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    const result = createIssueSchema.safeParse({
      title: '   ',
      severity: 'LOW',
      projectId: 'clx123',
    });
    expect(result.success).toBe(false);
  });

  it('parses issue query defaults', () => {
    const result = issueQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('coerces numeric query params', () => {
    const result = issueQuerySchema.safeParse({ page: '2', limit: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(5);
    }
  });

  it('rejects a limit above the maximum', () => {
    const result = issueQuerySchema.safeParse({ limit: '1000' });
    expect(result.success).toBe(false);
  });

  it('validates registration input', () => {
    const ok = registerSchema.safeParse({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'password123',
    });
    expect(ok.success).toBe(true);

    const bad = registerSchema.safeParse({ name: 'G', email: 'nope', password: 'x' });
    expect(bad.success).toBe(false);
  });

  it('validates login input', () => {
    const ok = loginSchema.safeParse({ email: 'a@b.co', password: 'password123' });
    expect(ok.success).toBe(true);
    const bad = loginSchema.safeParse({ email: 'a@b.co' });
    expect(bad.success).toBe(false);
  });

  it('validates search query', () => {
    const ok = searchQuerySchema.safeParse({ q: 'crash', limit: '5' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.limit).toBe(5);
    const bad = searchQuerySchema.safeParse({ q: 'x' });
    expect(bad.success).toBe(false);
  });

  it('validates AI severity input', () => {
    const ok = aiSeveritySchema.safeParse({
      title: 'App crashes on launch',
      description: 'Immediate crash on cold start.',
    });
    expect(ok.success).toBe(true);
    const bad = aiSeveritySchema.safeParse({ title: 'ab' });
    expect(bad.success).toBe(false);
  });
});
