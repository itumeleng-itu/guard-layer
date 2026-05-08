import { DECISION, SSE_EVENTS, STAGE } from '@guard-layer/shared';
import type {
  CompletePayload,
  DecisionLabel,
  DecisionPayload,
  FusionBreakdownEntry,
  RawScorePayload,
  SignalEventPayload,
  SignalsRecord,
  SseEvent,
} from '../types/guardLayer';

/**
 * Deterministic mock playback for offline judge demos. The event ordering
 * mirrors apps/middleware/server.js so swapping mock for live SSE produces
 * an identical UI sequence.
 */

type MockScenario = 'clear' | 'elevated';

const MOCK_SIGNALS_CLEAR: SignalEventPayload[] = [
  { name: 'simSwap', result: { recentChange: false, lastSwapDate: null } },
  { name: 'deviceSwap', result: { deviceMatch: true } },
  { name: 'numberVerify', result: { verified: true } },
  { name: 'locationVerify', result: { withinGeofence: true, country: 'ZA' } },
  { name: 'kycMatch', result: { identitySynced: true, matchScore: 94 } },
  { name: 'congestionInsights', result: { level: 'elevated' } },
];

const MOCK_SIGNALS_ELEVATED: SignalEventPayload[] = [
  { name: 'simSwap', result: { recentChange: true, lastSwapDate: new Date().toISOString() } },
  { name: 'deviceSwap', result: { deviceMatch: false } },
  { name: 'numberVerify', result: { verified: false } },
  { name: 'locationVerify', result: { withinGeofence: false, country: 'NG' } },
  { name: 'kycMatch', result: { identitySynced: false, matchScore: 42 } },
  { name: 'congestionInsights', result: { level: 'critical' } },
];

/**
 * Lightweight client-side mirror of apps/middleware/src/agent/signalFusion.js.
 * Used for the demo UI only; the live pipeline always recomputes server-side.
 */
function fusionFromSignals(signals: SignalsRecord): RawScorePayload {
  let raw = 0;
  let triggers = 0;
  const breakdown: FusionBreakdownEntry[] = [];
  const add = (points: number, label: string): void => {
    raw += points;
    triggers += 1;
    breakdown.push({ label, points });
  };

  if (signals.simSwap?.recentChange) add(35, 'sim_swap');
  if (signals.deviceSwap && !signals.deviceSwap.deviceMatch) add(25, 'device_mismatch');
  if (signals.numberVerify && !signals.numberVerify.verified) add(20, 'number_spoof');
  if (signals.locationVerify && !signals.locationVerify.withinGeofence) add(15, 'location_mismatch');

  const kycFail =
    signals.kycMatch && (!signals.kycMatch.identitySynced || signals.kycMatch.matchScore < 80);
  if (kycFail) add(10, 'kyc_mismatch');

  const level = signals.congestionInsights?.level ?? 'normal';
  if (level === 'elevated') add(8, 'congestion_elevated');
  else if (level === 'critical') add(15, 'congestion_critical');

  let score = raw;
  if (triggers >= 3) score = raw * 1.2;
  score = Math.min(100, Math.round(score));

  return { score, breakdown, triggerCount: triggers };
}

function decisionFromFusion(score: number): DecisionPayload {
  let decision: DecisionLabel = DECISION.APPROVE;
  if (score > 61) decision = DECISION.BLOCK;
  else if (score >= 31) decision = DECISION.CHALLENGE;

  const explanation =
    decision === DECISION.BLOCK
      ? 'Network and identity signals exceed the automatic trust threshold. Transaction is held for security review.'
      : decision === DECISION.CHALLENGE
        ? 'Some signals diverge from the customer baseline. Step-up verification is required before release.'
        : 'Signals are consistent with the enrolled device and identity profile.';

  return {
    decision,
    riskScore: Math.min(100, Math.max(score, score + (decision === DECISION.APPROVE ? -5 : 8))),
    explanation,
    reasoning: `Mock pipeline fused ${score}/100 pre-AI; final risk reflects correlation rules.`,
    recommendedAction:
      decision === DECISION.BLOCK
        ? 'block_and_notify_user'
        : decision === DECISION.CHALLENGE
          ? 'device_biometric'
          : 'proceed_frictionless',
    challengeAction: decision === DECISION.CHALLENGE ? 'DEVICE_BIOMETRIC' : undefined,
    usedFallback: true,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface MockPlaybackOptions {
  signal?: AbortSignal;
  scenario?: MockScenario;
  amountZar?: number;
}

/**
 * Run one mock transaction through the same logical SSE sequence as the
 * middleware. Emits events through onEvent with delays between frames so
 * the UI animation has time to play.
 */
export async function playMockTransactionStream(
  onEvent: (evt: SseEvent) => void,
  opts: MockPlaybackOptions = {}
): Promise<void> {
  const scenario: MockScenario = opts.scenario ?? 'clear';
  const rows = scenario === 'elevated' ? MOCK_SIGNALS_ELEVATED : MOCK_SIGNALS_CLEAR;
  const transactionRef = `mock-${Date.now()}`;
  const amountZar = typeof opts.amountZar === 'number' ? opts.amountZar : 1250;

  const guardAbort = (): void => {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };

  guardAbort();
  onEvent({ type: SSE_EVENTS.STAGE, payload: { stage: STAGE.INTERROGATION, transactionRef } });
  await sleep(320);

  const signals: SignalsRecord = {};
  for (const row of rows) {
    guardAbort();
    // Index assignment on a typed record requires a small narrowing cast.
    (signals as Record<string, unknown>)[row.name] = row.result;
    onEvent({ type: SSE_EVENTS.SIGNAL, payload: row });
    await sleep(260);
  }

  guardAbort();
  onEvent({ type: SSE_EVENTS.STAGE, payload: { stage: STAGE.AI_DECISION, transactionRef } });
  await sleep(320);

  const rawScoreResult: RawScorePayload = { transactionRef, ...fusionFromSignals(signals) };
  onEvent({ type: SSE_EVENTS.RAW_SCORE, payload: rawScoreResult });
  await sleep(320);

  const decision = decisionFromFusion(rawScoreResult.score);
  onEvent({ type: SSE_EVENTS.DECISION, payload: { transactionRef, ...decision } });
  await sleep(320);

  const completePayload: CompletePayload = {
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
    amountZar,
    markets: ['ZA', 'KE', 'NG'],
  };
  onEvent({ type: SSE_EVENTS.COMPLETE, payload: completePayload });
}
