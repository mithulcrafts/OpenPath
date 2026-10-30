import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ActionSchema, callTool, connectionStatus, createModelSession, modelEndpoint, readableModelError, reviewAudit, verifyConnection } from '../server/model.js';
import type { Audit, InferenceRecord } from '../shared/types.js';

// Exercise the actual SDK against a local fake provider. These tests never use
// real credentials, credits, or claim live NVIDIA/Nebius verification.
type RequestBody = { model: string; tools: { function: { name: string } }[]; tool_choice: { function: { name: string } }; messages: unknown[] };
let server: http.Server;
let endpoint: string;
let requests: { body: RequestBody; authorization?: string }[] = [];
let respond: (body: RequestBody, response: http.ServerResponse) => void;
const environment = { NEBIUS_API_KEY: process.env.NEBIUS_API_KEY, NEBIUS_BASE_URL: process.env.NEBIUS_BASE_URL, NEBIUS_MODEL: process.env.NEBIUS_MODEL };
const fakeKey = 'test-only-not-a-real-nebius-key';

function completion(body: RequestBody, response: http.ServerResponse, args: unknown = { ok: true }) {
  response.writeHead(200, { 'Content-Type': 'application/json', 'x-request-id': 'local-test-request' });
  response.end(JSON.stringify({
    id: 'local-test-completion', object: 'chat.completion', created: 1, model: body.model,
    choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'local-test-tool', type: 'function', function: { name: body.tools[0].function.name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } }] } }],
    usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
  }));
}

before(async () => {
  server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    assert.equal(request.url, '/v1/chat/completions');
    const body = JSON.parse(Buffer.concat(chunks).toString()) as RequestBody;
    requests.push({ body, authorization: request.headers.authorization });
    respond(body, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  endpoint = `http://127.0.0.1:${address.port}/v1/`;
});
beforeEach(() => {
  process.env.NEBIUS_API_KEY = fakeKey;
  process.env.NEBIUS_BASE_URL = endpoint;
  process.env.NEBIUS_MODEL = 'nvidia/local-test-model';
  requests = [];
  respond = completion;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test('the SDK sends a named tool and records response metadata without prompts or credentials', async () => {
  const result = await verifyConnection();
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.tool_choice.function.name, 'check_connection');
  assert.equal(requests[0].authorization, `Bearer ${fakeKey}`);
  const record = result.inference[0];
  assert.equal(record.provider, 'custom');
  assert.equal(record.status, 'succeeded');
  assert.equal(record.responseId, 'local-test-completion');
  assert.equal(record.requestId, 'local-test-request');
  assert.deepEqual(record.usage, { inputTokens: 12, outputTokens: 5, totalTokens: 17 });
  assert(record.durationMs >= 0);
  assert(!JSON.stringify(record).includes(fakeKey));
  assert(!JSON.stringify(record).includes('Verify the tool-calling connection'));
  assert.match(connectionStatus().aiMessage, /custom endpoint/);
});

test('a frozen session keeps the queued model and cannot verify later credentials', async () => {
  const records: InferenceRecord[] = [];
  const session = createModelSession('nvidia/queued-model', record => records.push(record));
  respond = (body, response) => {
    process.env.NEBIUS_API_KEY = 'a-different-test-key';
    completion(body, response, { action: 'finish' });
  };
  process.env.NEBIUS_MODEL = 'nvidia/newly-configured-model';
  await callTool('Private test prompt', 'Private test task', 'browser_action', {}, value => ActionSchema.parse(value), { session });
  assert.equal(requests[0].body.model, 'nvidia/queued-model');
  assert.equal(requests[0].authorization, `Bearer ${fakeKey}`);
  assert.equal(records[0].requestedModel, 'nvidia/queued-model');
  assert.equal(records[0].responseModel, 'nvidia/queued-model');
  assert.equal(connectionStatus().ai, 'configured');
  assert(!JSON.stringify(records).includes('Private test'));
});

test('provider classification requires an observed official HTTPS origin', () => {
  const settings = createModelSession().settings;
  for (const baseURL of ['https://api.tokenfactory.nebius.com/v1/', 'https://api.tokenfactory.eu-north1.nebius.com/v1/']) {
    assert.equal(modelEndpoint({ ...settings, baseURL }).provider, 'nebius');
  }
  for (const baseURL of [endpoint, 'http://api.tokenfactory.nebius.com/v1/', 'https://api.tokenfactory.nebius.com.attacker.example/v1/']) {
    assert.equal(modelEndpoint({ ...settings, baseURL }).provider, 'custom');
  }
});

test('an unpriced external endpoint is blocked before dispatch and cannot produce inference evidence', async () => {
  process.env.NEBIUS_BASE_URL = 'https://unpriced.invalid/v1/';
  const records: InferenceRecord[] = [];
  await assert.rejects(callTool('test', 'test', 'check_connection', {}, value => value, { session: createModelSession(undefined, record => records.push(record)) }), /Unpriced/);
  assert.equal(requests.length, 0);
  assert.equal(records.length, 0);
});

test('malformed tool JSON is an explicit failure rather than verified analysis', async () => {
  respond = (body, response) => completion(body, response, '{bad json');
  await assert.rejects(verifyConnection(), SyntaxError);
  assert.equal(connectionStatus().ai, 'error');
  assert.match(connectionStatus().aiMessage, /required structure/);
});

test('text-only completions cannot pass a tool-calling connection test', async () => {
  respond = (body, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ id: 'text-only', model: body.model, choices: [{ message: { role: 'assistant', content: 'Success' }, finish_reason: 'stop', index: 0 }] }));
  };
  await assert.rejects(verifyConnection(), /structured tool output/);
  assert.equal(connectionStatus().ai, 'error');
});

test('invented finding references fail evidence validation and leave a failed call record', async () => {
  respond = (body, response) => completion(body, response, { overview: 'A plausible sounding but unsupported review.', suggestedTask: '', recommendations: [{ findingId: 'invented', impact: 'Unsupported', fix: 'Invented change', verification: 'Not observed' }] });
  const audit = { pages: [], findings: [], evidence: [], limitations: [], model: { name: 'nvidia/local-test-model' } } as unknown as Audit;
  await assert.rejects(reviewAudit(audit), /not observed/);
  assert.equal(audit.inference?.[0].status, 'failed');
  assert.equal(audit.inference?.[0].usage?.totalTokens, 17);
  assert.equal(connectionStatus().ai, 'error');
});

for (const status of [401, 429]) {
  test(`HTTP ${status} is not retried or exposed with provider secrets`, async () => {
    respond = (_body, response) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: `Provider echoed ${fakeKey}`, type: 'test_error' } }));
    };
    const records: InferenceRecord[] = [];
    await assert.rejects(callTool('test', 'test', 'check_connection', {}, value => value, { session: createModelSession(undefined, record => records.push(record)) }));
    assert.equal(requests.length, 1);
    assert.equal(records[0].status, 'failed');
    assert(!JSON.stringify(records).includes(fakeKey));
    assert(!connectionStatus().aiMessage.includes(fakeKey));
  });
}

test('the SDK timeout ends a stalled inference and records a readable failure', async () => {
  respond = () => { /* Deliberately leave the local response pending. */ };
  const records: InferenceRecord[] = [];
  await assert.rejects(callTool('test', 'test', 'check_connection', {}, value => value, { timeoutMs: 100, session: createModelSession(undefined, record => records.push(record)) }), error => /timed out/.test(readableModelError(error)));
  assert.equal(requests.length, 1);
  assert.equal(records[0].status, 'failed');
  assert.match(records[0].error!, /timed out/);
});
