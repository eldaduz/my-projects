import { describe, expect, test, vi } from 'vitest';
import { createGeminiAdapter } from '../../src/modules/ai/geminiAdapter.js';
import { createFakeGeminiAdapter } from '../../src/modules/ai/fakeGeminiAdapter.js';

const context = { trip: { destination: 'Rome' }, notes: 'untrusted notes' };

function implementations({ error = null } = {}) {
  const generateContent = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue({ text: 'raw itinerary' });
  return {
    real: {
      adapter: createGeminiAdapter({ client: { models: { generateContent } } }),
      calls: generateContent,
    },
    fake: { adapter: createFakeGeminiAdapter({ responseText: 'raw itinerary', error }) },
  };
}

describe.each(['real', 'fake'])('AI adapter contract: %s', (name) => {
  test('returns success text and calls asynchronously', async () => {
    const { adapter, calls } = implementations()[name];
    const promise = adapter.generateItinerary(context);
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).resolves.toBe('raw itinerary');
    if (calls) expect(calls).toHaveBeenCalledOnce();
  });

  test('propagates configured provider errors', async () => {
    await expect(implementations({ error: new Error('provider unavailable') })[name].adapter.generateItinerary(context)).rejects.toThrow(
      'provider unavailable',
    );
  });

  test('does not mutate input', async () => {
    const input = structuredClone(context);
    const { adapter } = implementations()[name];
    await adapter.generateItinerary(input);
    expect(input).toEqual(context);
  });

  test('supports one corrective operation with detached inputs', async () => {
    const invalidOutput = '{"days":[]}';
    const errors = [{ code: 'SCHEMA_INVALID', message: 'invalid', path: 'days' }];
    const { adapter, calls } = implementations()[name];
    await expect(adapter.correctInvalidItinerary(context, invalidOutput, errors)).resolves.toBe(
      'raw itinerary',
    );
    if (calls) expect(calls).toHaveBeenCalledOnce();
  });

});

test('fake keeps received calls detached from caller input', async () => {
  const input = structuredClone(context);
  const fake = createFakeGeminiAdapter({ responseText: 'raw itinerary' });
  await fake.generateItinerary(input);
  input.notes = 'mutated after call';
  expect(fake.receivedCalls).toEqual([context]);
});

test('fake independently configures initial and corrective responses', async () => {
  const fake = createFakeGeminiAdapter({
    generateResponseText: 'initial',
    correctionResponseText: 'corrected',
  });

  await expect(fake.generateItinerary(context)).resolves.toBe('initial');
  await expect(fake.correctInvalidItinerary(context, 'invalid', [{ code: 'BAD' }])).resolves.toBe(
    'corrected',
  );
  expect(fake.generateCalls).toEqual([context]);
  expect(fake.correctionCalls).toEqual([
    { context, invalidOutput: 'invalid', validationErrors: [{ code: 'BAD' }] },
  ]);
});
