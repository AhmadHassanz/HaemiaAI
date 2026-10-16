import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('./predict.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { predictImage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const result = { risk: 'lower', message: 'Research signal', disclaimer: 'Research only' };

test('waits through startup and sends the photo only once', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push([url, options.method]);
    if (calls.length === 1) return Response.json({ model_ready: false });
    if (url.endsWith('/health')) return Response.json({ model_ready: true, inference_mode: 'tensorflow' });
    return Response.json(result);
  };
  try {
    assert.deepEqual(await predictImage('https://example.test', new File(['test'], 'eye.png'), { retryDelayMs: 1 }), result);
    assert.equal(calls.filter(([, method]) => method === 'POST').length, 1);
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = original; }
});

test('failed model startup never uploads a photo or returns mock results', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ model_ready: true, model_loading: false, inference_mode: 'mock' });
  };
  try {
    await assert.rejects(predictImage('', new File(['test'], 'eye.png')), /model could not start/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('unavailable service has a bounded startup wait', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  try {
    await assert.rejects(predictImage('', new File(['test'], 'eye.png'), {
      startupTimeoutMs: 15, retryDelayMs: 1,
    }), /still starting or is unavailable/);
  } finally { globalThis.fetch = original; }
});
