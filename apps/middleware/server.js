import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DECISION, SSE_EVENTS, STAGE } from '@guard-layer/shared';
import { checkSimSwap } from './src/camara/simSwap.js';
import { checkDeviceSwap } from './src/camara/deviceSwap.js';
import { checkNumberVerify } from './src/camara/numberVerify.js';
import { checkLocationVerify } from './src/camara/locationVerify.js';
import { checkKycMatch } from './src/camara/kycMatch.js';
import { checkCongestionInsights } from './src/camara/congestionInsights.js';
import { computeRawRiskScore } from './src/agent/signalFusion.js';
import { evaluateWithClaude, runDecisionPipeline } from './src/agent/decisionEngine.js';
import { verifyBiometricSession } from './src/biometric/smileId.js';
import { processSTKPush } from './src/payment/paymentSimulator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

/**
 * @param {import('express').Response} res
 * @param {string} eventType
 * @param {object} data
 */
function emitSse(res, eventType, data) {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * @param {object} body
 * @returns {{ phoneNumber: string, scenario: string, location?: object }}
 */
function parseTransactionBody(body) {
  const phoneNumber = body?.phoneNumber ?? body?.test_number;
  const scenario = body?.scenario ?? 'all_clear';
  const location = body?.location;
  if (!phoneNumber) {
    const err = new Error('phoneNumber is required');
    err.statusCode = 400;
    throw err;
  }
  return { phoneNumber, scenario, location };
}

async function interrogateAll(phoneNumber, scenario, location) {
  const locArg =
    location && typeof location.latitude === 'number'
      ? { latitude: location.latitude, longitude: location.longitude, radius: location.radius ?? 10000 }
      : undefined;

  const tasks = [
    ['simSwap', () => checkSimSwap(phoneNumber, scenario)],
    ['deviceSwap', () => checkDeviceSwap(phoneNumber, scenario)],
    ['numberVerify', () => checkNumberVerify(phoneNumber, scenario)],
    ['locationVerify', () => checkLocationVerify(phoneNumber, scenario, locArg)],
    ['kycMatch', () => checkKycMatch(phoneNumber, scenario)],
    ['congestionInsights', () => checkCongestionInsights(phoneNumber, scenario)],
  ];

  /** @type {Record<string, object>} */
  const signals = {};
  await Promise.all(
    tasks.map(async ([name, fn]) => {
      const result = await fn();
      signals[name] = result;
    })
  );
  return signals;
}

/**
 * Stream interrogation: emit each signal as its CAMARA call completes (completion order may vary).
 * @param {import('express').Response} res
 */
async function interrogateAllStreaming(res, phoneNumber, scenario, location) {
  const locArg =
    location && typeof location.latitude === 'number'
      ? { latitude: location.latitude, longitude: location.longitude, radius: location.radius ?? 10000 }
      : undefined;

  const tasks = [
    ['simSwap', () => checkSimSwap(phoneNumber, scenario)],
    ['deviceSwap', () => checkDeviceSwap(phoneNumber, scenario)],
    ['numberVerify', () => checkNumberVerify(phoneNumber, scenario)],
    ['locationVerify', () => checkLocationVerify(phoneNumber, scenario, locArg)],
    ['kycMatch', () => checkKycMatch(phoneNumber, scenario)],
    ['congestionInsights', () => checkCongestionInsights(phoneNumber, scenario)],
  ];

  /** @type {Record<string, object>} */
  const signals = {};
  await Promise.all(
    tasks.map(async ([name, fn]) => {
      const result = await fn();
      signals[name] = result;
      emitSse(res, SSE_EVENTS.SIGNAL, { name, result });
    })
  );
  return signals;
}

function buildPayload(transactionRef, signals, rawScoreResult, decision) {
  return {
    transactionRef,
    signals,
    rawScore: rawScoreResult,
    decision: decision.decision,
    riskScore: decision.riskScore,
    explanation: decision.explanation,
    reasoning: decision.reasoning,
    recommendedAction: decision.recommendedAction,
    challengeAction: decision.challengeAction,
    usedFallback: decision.usedFallback,
  };
}

function statusForDecision(decision) {
  if (decision === DECISION.BLOCK) return 403;
  if (decision === DECISION.CHALLENGE) return 401;
  return 200;
}

/** POST /api/transaction/check/stream — SSE pipeline */
app.post('/api/transaction/check/stream', async (req, res) => {
  const transactionRef = randomUUID();
  try {
    const { phoneNumber, scenario, location } = parseTransactionBody(req.body);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    emitSse(res, SSE_EVENTS.STAGE, { stage: STAGE.INTERROGATION, transactionRef });

    const signals = await interrogateAllStreaming(res, phoneNumber, scenario, location);

    emitSse(res, SSE_EVENTS.STAGE, { stage: STAGE.AI_DECISION, transactionRef });

    const rawScoreResult = computeRawRiskScore(signals);
    emitSse(res, SSE_EVENTS.RAW_SCORE, { transactionRef, ...rawScoreResult });

    const decision = await evaluateWithClaude(signals, rawScoreResult);
    emitSse(res, SSE_EVENTS.DECISION, { transactionRef, ...decision });

    const payload = buildPayload(transactionRef, signals, rawScoreResult, decision);
    emitSse(res, SSE_EVENTS.COMPLETE, payload);
    res.end();
  } catch (e) {
    const status = e.statusCode || 500;
    const message = e.message || 'Internal error';
    if (!res.headersSent) {
      res.status(status).json({ error: message, transactionRef });
      return;
    }
    try {
      emitSse(res, SSE_EVENTS.ERROR, { transactionRef, status, message });
    } catch {
      /* response may be closed */
    }
    res.end();
  }
});

/** POST /api/transaction/check — single JSON (USSD / legacy) */
app.post('/api/transaction/check', async (req, res) => {
  const transactionRef = randomUUID();
  try {
    const { phoneNumber, scenario, location } = parseTransactionBody(req.body);
    const signals = await interrogateAll(phoneNumber, scenario, location);
    const { rawScoreResult, decision } = await runDecisionPipeline(signals);
    const payload = buildPayload(transactionRef, signals, rawScoreResult, decision);
    res.status(statusForDecision(decision.decision)).json(payload);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message || 'Internal error' });
  }
});

/** POST /confirm — biometric escalation + STK payment simulator */
app.post('/confirm', async (req, res) => {
  const body = req.body ?? {};

  console.log('[POST /confirm] Step 1: Incoming confirm request', {
    isFeaturePhone: body.isFeaturePhone,
    hasBioToken: Boolean(body?.bio_token),
    phoneNumber: body.phoneNumber ? '[present]' : undefined,
    amount: body.amount,
  });

  if (body.isFeaturePhone === true) {
    console.log(
      '[POST /confirm] Decision (agentic): Feature phone — USSD PIN challenge path (no selfie capability)'
    );
    return res.status(200).json({
      action: 'PIN_CHALLENGE',
      message: 'USSD PIN required',
    });
  }

  if (!body.bio_token) {
    console.log(
      '[POST /confirm] Decision (agentic): Missing bio_token — escalate to Smile ID liveness (high-risk)'
    );
    return res.status(401).json({
      action: 'SMILE_ID_LIVENESS',
      message: 'Biometric verification required due to high-risk flag',
    });
  }

  console.log(
    `[POST /confirm] Step 2: bio_token present — calling processSTKPush (${verifyBiometricSession.name} mock wired from ./src/biometric/smileId.js)`
  );
  const stk = await processSTKPush(body.phoneNumber, body.amount);
  console.log('[POST /confirm] Step 3: STK simulator completed — returning 200 with txn_id', stk);

  return res.status(200).json({
    txn_id: stk.txn_id,
    message: 'Payment completed successfully',
    status: stk.status,
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'guard-layer-middleware' });
});

app.listen(PORT, () => {
  console.log(`GuardLayer middleware listening on http://localhost:${PORT}`);
});
