import { DECISION } from '@guard-layer/shared';
import { computeRawRiskScore } from './signalFusion.js';

const SYSTEM_PROMPT = `You are GuardLayer, an agentic fraud detection engine for mobile money in Sub-Saharan Africa. You receive signals from Nokia CAMARA APIs and a pre-computed weighted risk score. Correlate all signals together — a SIM swap alone might be legitimate (new phone), but SIM swap + device change + location mismatch + KYC failure together is almost certainly fraud. Return ONLY valid JSON: { "decision": "APPROVE"|"CHALLENGE"|"BLOCK", "riskScore": number 0-100, "explanation": string in plain English a user can understand, "reasoning": string explaining which signals triggered the decision, "recommendedAction": string }`;

/**
 * Map raw fused score to decision when Claude is unavailable (never fail open on errors).
 * @param {{ score: number, breakdown?: unknown[], triggerCount?: number }} raw
 */
export function fallbackDecision(raw) {
  console.warn('[decisionEngine] fallbackDecision (no Claude or API/parse failure), raw score:', raw?.score);
  const score = typeof raw?.score === 'number' ? raw.score : 0;
  let decision = DECISION.APPROVE;
  if (score > 61) decision = DECISION.BLOCK;
  else if (score >= 31) decision = DECISION.CHALLENGE;

  const explanation =
    decision === DECISION.BLOCK
      ? 'Multiple security checks indicate elevated risk. This transaction cannot proceed automatically.'
      : decision === DECISION.CHALLENGE
        ? 'Some checks need extra confirmation. Please verify your identity on your device.'
        : 'Security checks are within normal range for your profile.';

  const reasoning = `Fallback engine (score ${score}/100). ${
    raw?.breakdown?.length
      ? `Contributors: ${raw.breakdown.map((b) => `${b.label}:${b.points}`).join(', ')}.`
      : 'No elevated signal contributors.'
  }`;

  return normalizeDecisionPayload({
    decision,
    riskScore: score,
    explanation,
    reasoning,
    recommendedAction:
      decision === DECISION.BLOCK
        ? 'block_and_notify_user'
        : decision === DECISION.CHALLENGE
          ? 'device_biometric'
          : 'proceed_frictionless',
    _fallback: true,
  });
}

/**
 * @param {object} payload
 */
function normalizeDecisionPayload(payload) {
  const rawD = String(payload.decision ?? '').trim().toUpperCase();
  const decision =
    rawD === DECISION.BLOCK || rawD === DECISION.CHALLENGE || rawD === DECISION.APPROVE
      ? rawD
      : DECISION.CHALLENGE;

  let riskScore = Number(payload.riskScore);
  if (Number.isNaN(riskScore)) riskScore = 50;
  riskScore = Math.max(0, Math.min(100, riskScore));

  const out = {
    decision,
    riskScore,
    explanation: String(payload.explanation ?? '').slice(0, 2000),
    reasoning: String(payload.reasoning ?? '').slice(0, 2000),
    recommendedAction: String(payload.recommendedAction ?? 'review'),
    challengeAction:
      decision === DECISION.CHALLENGE ? 'DEVICE_BIOMETRIC' : undefined,
    usedFallback: Boolean(payload._fallback),
  };
  return out;
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Call Claude for final decision; on failure or missing key, use fallbackDecision.
 * @param {object} signals — six CAMARA results
 * @param {{ score: number, breakdown: object[], triggerCount: number }} rawScoreResult
 */
export async function evaluateWithClaude(signals, rawScoreResult) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return fallbackDecision(rawScoreResult);
  }

  const model =
    process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  const userPayload = {
    signals,
    rawRiskScore: rawScoreResult.score,
    fusionBreakdown: rawScoreResult.breakdown,
    triggerCount: rawScoreResult.triggerCount,
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Evaluate this transaction profile and respond with JSON only.\n\n${JSON.stringify(
              userPayload,
              null,
              2
            )}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[decisionEngine] Claude API error:', res.status, errText);
      return fallbackDecision(rawScoreResult);
    }

    const data = await res.json();
    const textBlock = data.content?.find((c) => c.type === 'text');
    const text = textBlock?.text ?? '';
    const parsed = extractJsonObject(text);
    return normalizeDecisionPayload({ ...parsed, _fallback: false });
  } catch (e) {
    console.error('[decisionEngine] Claude call failed:', e);
    return fallbackDecision(rawScoreResult);
  }
}

/**
 * Run fusion + Claude (or fallback).
 * @param {object} signals
 */
export async function runDecisionPipeline(signals) {
  const rawScoreResult = computeRawRiskScore(signals);
  const decision = await evaluateWithClaude(signals, rawScoreResult);
  return { rawScoreResult, decision };
}
