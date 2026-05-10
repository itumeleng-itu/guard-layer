/**
 * GuardLayer middleware HTTP smoke tests.
 * Expects MOCK_MODE=true in .env for stable scenario outcomes (default in repo).
 *
 * Usage: from repo root, with middleware listening (default PORT=3000):
 *   node scripts/test-middleware-api.js
 *
 * Or: npm run test:api
 *
 * Troubleshooting:
 * - ECONNREFUSED → start middleware: npm run dev --workspace=@guard-layer/middleware
 * - Wrong port → set PORT in .env or GUARD_LAYER_TEST_BASE=http://127.0.0.1:PORT
 * - recent_sim_swap / full_attack flaky → ensure MOCK_MODE=true and ANTHROPIC_API_KEY unset
 *   (or placeholder) so tests hit the deterministic fallback, not Claude.
 */
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 3000;
const BASE = process.env.GUARD_LAYER_TEST_BASE ?? `http://127.0.0.1:${PORT}`;

const SANDBOX = '+358401234567';

function fail(message) {
  console.error(`\nFAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`  OK — ${message}`);
}

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${BASE}${path}`;
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { res, json, text };
}

async function testHealth() {
  const { res, json } = await request('/health');
  if (!res.ok) fail(`/health returned ${res.status}`);
  if (!json?.ok || json.service !== 'guard-layer-middleware') {
    fail(`/health unexpected body: ${JSON.stringify(json)}`);
  }
  ok('/health');
}

async function testCheckJson(scenario, expectedStatus, expectedDecision) {
  const { res, json } = await request('/api/transaction/check', {
    method: 'POST',
    body: { phoneNumber: SANDBOX, scenario },
  });
  if (res.status !== expectedStatus) {
    fail(`POST /api/transaction/check scenario=${scenario} expected status ${expectedStatus}, got ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json.decision !== expectedDecision) {
    fail(`scenario=${scenario} expected decision ${expectedDecision}, got ${json.decision}: ${JSON.stringify(json)}`);
  }
  if (!json.transactionRef || !json.signals) {
    fail(`scenario=${scenario} missing transactionRef or signals`);
  }
  ok(`POST /api/transaction/check (${scenario}) → ${res.status} ${json.decision}`);
}

async function testCheckValidation() {
  const { res, json } = await request('/api/transaction/check', {
    method: 'POST',
    body: { scenario: 'all_clear' },
  });
  if (res.status !== 400) fail(`expected 400 without phoneNumber, got ${res.status}`);
  if (!json.error) fail('expected error message in body');
  ok('POST /api/transaction/check rejects missing phoneNumber (400)');
}

async function testSseStream() {
  const res = await fetch(`${BASE}/api/transaction/check/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ phoneNumber: SANDBOX, scenario: 'all_clear' }),
  });
  if (!res.ok) fail(`SSE stream returned ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) fail(`expected text/event-stream, got ${ct}`);
  const text = await res.text();
  const need = ['event: stage', 'event: signal', 'event: raw_score', 'event: decision', 'event: complete'];
  for (const n of need) {
    if (!text.includes(n)) fail(`SSE body missing ${n}`);
  }
  ok('POST /api/transaction/check/stream (all_clear) contains expected SSE events');
}

async function testConfirm() {
  const { res, json } = await request('/confirm', {
    method: 'POST',
    body: {
      phoneNumber: SANDBOX,
      amount: 100,
      bio_token: 'test-script-token',
    },
  });
  if (res.status !== 200) fail(`POST /confirm expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  if (!json.txn_id) fail('POST /confirm missing txn_id');
  ok('POST /confirm with bio_token returns txn_id');
}

async function testActivityFeed() {
  const { res, json } = await request('/api/activity');
  if (!res.ok) fail(`GET /api/activity expected 200, got ${res.status}`);
  if (!Array.isArray(json.entries)) fail('GET /api/activity missing entries[]');
  ok('GET /api/activity returns entries array');
}

/** Frictionless STK after APPROVE (matches SendCash live flow). */
async function testFrictionlessSettlement() {
  const { res: r1, json: j1 } = await request('/api/transaction/check', {
    method: 'POST',
    body: {
      phoneNumber: SANDBOX,
      scenario: 'all_clear',
      amount: 77,
      source: 'test-script',
    },
  });
  if (r1.status !== 200 || j1.decision !== 'APPROVE') {
    fail(`frictionless precondition: expected APPROVE, got ${r1.status} ${JSON.stringify(j1)}`);
  }
  if (!j1.transactionRef) fail('transactionRef required for frictionless');
  const { res: r2, json: j2 } = await request('/confirm', {
    method: 'POST',
    body: {
      phoneNumber: SANDBOX,
      amount: 77,
      bio_token: 'GUARD_LAYER_FRICTIONLESS',
      transactionRef: j1.transactionRef,
      source: 'test-script',
    },
  });
  if (r2.status !== 200) {
    fail(`frictionless POST /confirm expected 200, got ${r2.status}: ${JSON.stringify(j2)}`);
  }
  if (!j2.txn_id) fail('frictionless settle missing txn_id');
  ok('POST /confirm frictionless settle after APPROVE');
}

async function testConfirmNoToken() {
  const { res, json } = await request('/confirm', {
    method: 'POST',
    body: { phoneNumber: SANDBOX, amount: 50 },
  });
  if (res.status !== 401) fail(`POST /confirm without token expected 401, got ${res.status}`);
  if (json.action !== 'SMILE_ID_LIVENESS') fail(`unexpected confirm body: ${JSON.stringify(json)}`);
  ok('POST /confirm without bio_token → 401 SMILE_ID_LIVENESS');
}

async function main() {
  console.log(`GuardLayer API tests → ${BASE}`);
  console.log(`MOCK_MODE=${process.env.MOCK_MODE ?? '(unset)'}\n`);

  try {
    await testHealth();
    await testActivityFeed();
    await testCheckValidation();

    // With MOCK_MODE=true, scenarios drive CAMARA fixtures; decision uses fallback unless a real Anthropic key is set.
    await testCheckJson('all_clear', 200, 'APPROVE');
    await testCheckJson('recent_sim_swap', 403, 'BLOCK');
    await testCheckJson('full_attack', 403, 'BLOCK');

    await testSseStream();
    await testConfirmNoToken();
    await testFrictionlessSettlement();
    await testConfirm();
  } catch (e) {
    if (e?.cause?.code === 'ECONNREFUSED' || e?.code === 'ECONNREFUSED') {
      console.error('\nCannot reach middleware. Start it from repo root:');
      console.error('  npm run dev --workspace=@guard-layer/middleware\n');
      process.exit(1);
    }
    throw e;
  }

  console.log('\nAll middleware API tests passed.');
}

main();
