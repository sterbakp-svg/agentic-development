import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createEntraTokenProvider, createModelClient, loadModelConfig } from '../index';

function liveClient() {
  const config = loadModelConfig();
  return createModelClient(config, {
    getToken: createEntraTokenProvider({
      mode: config.authMode,
      clientId: config.managedIdentityClientId,
    }),
  });
}

// Runs only when AOAI_ENDPOINT is set (never in CI). Costs a few tokens.
describe.skipIf(!process.env.AOAI_ENDPOINT)('model client integration (real Azure OpenAI)', () => {
  it('returns structured output and token usage for a one-field schema', async () => {
    const result = await liveClient().generateStructured({
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

  it('accepts the generator output schema in strict mode (R-9)', async () => {
    const schema: unknown = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../../../../schemas/generator-output.schema.json', import.meta.url)),
        'utf8',
      ),
    );
    // Only the schema is under test: the call must not fail with an HTTP 400 schema error.
    // A truncated answer with a tiny token budget is fine.
    const outcome = await liveClient()
      .generateStructured({
        requestId: 'integration-2',
        system: 'Fill the schema with short placeholder text.',
        user: 'Example agent for a test.',
        schemaName: 'generator_output',
        schema,
        maxOutputTokens: 100,
      })
      .then(
        () => 'ok',
        (e: unknown) => (e as { code?: string }).code,
      );
    expect(['ok', 'truncated']).toContain(outcome);
  });
});
