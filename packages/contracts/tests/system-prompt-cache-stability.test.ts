import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeSystemPrompt } from '../src/prompts/system.js';

// Mirror of apps/daemon/tests/system-prompt-cache-stability.test.ts for the
// contracts copy of the composer. The web app and the BYOK/API (`plain`
// stream) path build their system prompt from THIS module, so leaving it
// unguarded would let a time-dependent prompt silently defeat OpenAI's
// automatic prefix cache and Gemini's implicit cache on the web-originated
// chat path — exactly where the daemon's cache_control breakpoint can't help.
//
// Invariant: composeSystemPrompt is a pure function of its inputs, independent
// of wall-clock time, so the cached prefix stays byte-identical across turns.

describe('composeSystemPrompt (contracts) — cache-prefix stability', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const input = {
    metadata: { kind: 'prototype' as const },
    // `plain` is the BYOK/API stream path — the one that most needs a stable
    // prefix because those providers cache the leading prefix automatically.
    streamFormat: 'plain' as const,
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

    vi.setSystemTime(new Date('2026-01-01T02:34:56.789Z'));
    const laterTurn = composeSystemPrompt(input);

    expect(laterTurn).toBe(firstTurn);
  });

  it('is a pure function of its inputs across repeated calls', () => {
    const a = composeSystemPrompt(input);
    const b = composeSystemPrompt(input);
    expect(b).toBe(a);
  });
});
