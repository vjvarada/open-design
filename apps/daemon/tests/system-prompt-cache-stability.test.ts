import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeSystemPrompt } from '../src/prompts/system.js';

// Prefix caching (Anthropic cache_control, OpenAI automatic prefix cache,
// Gemini implicit caching) only pays off when the system prompt is
// BYTE-IDENTICAL across every turn of a session. A single `Date.now()`,
// `new Date()`, or random id injected anywhere into the composed prompt would
// silently change the bytes each turn, invalidate the cached prefix on every
// provider, and re-bill the whole ~10k-30k-token prompt as fresh input — with
// no visible symptom. These tests pin that invariant: the composer must be a
// pure function of its inputs, independent of wall-clock time.
//
// If a future change makes this fail, do NOT relax the test — move the volatile
// content OUT of the cached prefix (into the per-turn message suffix) instead.

describe('composeSystemPrompt — cache-prefix stability', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // A rich, realistic single-session input that exercises the stable-prefix
  // branches: active design system, personal memory (+ its instruction blocks),
  // user- and project-level custom instructions, and a skill body.
  const input = {
    metadata: { kind: 'prototype' as const },
    designSystemBody: '# Acme\n\n## Color Palette\n\n- Primary: #0a84ff\n\n## Typography\n\nInter, 16px base.',
    designSystemTitle: 'Acme',
    memoryBody: '### Profile\n\nSenior PM at Acme.\n\n### Verified rules\n\n- Always use sentence case in headings.',
    userInstructions: 'Prefer concise copy.',
    projectInstructions: 'This project targets desktop only.',
    skillBody: '# Landing page\n\nBuild a hero + features + CTA.',
  };

  it('produces a byte-identical prompt when only the wall clock advances', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const firstTurn = composeSystemPrompt(input);

    // Simulate a later turn in the SAME session: identical inputs, but the
    // wall clock has moved on (a designer paused, then sent another message).
    vi.setSystemTime(new Date('2026-01-01T02:34:56.789Z'));
    const laterTurn = composeSystemPrompt(input);

    expect(laterTurn).toBe(firstTurn);
  });

  it('is a pure function of its inputs across repeated calls', () => {
    const a = composeSystemPrompt(input);
    const b = composeSystemPrompt(input);
    expect(b).toBe(a);
  });

  it('keeps a minimal prototype prompt stable across the clock too', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-06-15T09:00:00.000Z'));
    const first = composeSystemPrompt({ metadata: { kind: 'prototype' } });
    vi.setSystemTime(new Date('2026-06-15T23:59:59.000Z'));
    const second = composeSystemPrompt({ metadata: { kind: 'prototype' } });

    expect(second).toBe(first);
  });
});
