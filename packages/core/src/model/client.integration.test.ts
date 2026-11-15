import { describe, expect, it } from 'vitest';
import { createEntraTokenProvider, createModelClient, loadModelConfig } from '../index';

// Runs only when AOAI_ENDPOINT is set (never in CI). Costs a few tokens.
describe.skipIf(!process.env.AOAI_ENDPOINT)('model client integration (real Azure OpenAI)', () => {
  it('returns structured output and token usage for a one-field schema', async () => {
    const config = loadModelConfig();
    const client = createModelClient(config, { getToken: createEntraTokenProvider() });
    const result = await client.generateStructured({
      requestId: 'integration-1',
      system: 'Answer with JSON only.',
      user: 'Set "ok" to the word yes.',
      schemaName: 'ping',
      schema: {
        type: 'object',
        required: ['ok'],
        additionalProperties: false,
        properties: { ok: { type: 'string' } },
      },
      maxOutputTokens: 50,
    });
    expect(result.output).toHaveProperty('ok');
    expect(typeof (result.output as { ok: unknown }).ok).toBe('string');
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
  });
});
