/**
 * Routes SendCash to either the real GuardLayer middleware or the local mock.
 * Set `EXPO_PUBLIC_GUARD_LAYER_URL` (e.g. http://192.168.1.10:3000) for device/LAN testing.
 *
 * Must match `FRICTIONLESS_BIO_TOKEN` in `apps/middleware/src/activity/transactionLog.js`.
 */
export const GUARD_LAYER_FRICTIONLESS_TOKEN = 'GUARD_LAYER_FRICTIONLESS';
import {
  confirmPayment as mockConfirmPayment,
  initiatePayment as mockInitiatePayment,
  type GuardianResult,
} from '@/lib/guardian-middleware';

export type { Decision, GuardianResult } from '@/lib/guardian-middleware';

function normalizeBaseUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim().replace(/\/$/, '');
  return t.length > 0 ? t : null;
}

export function isLiveGuardianEnabled(): boolean {
  return Boolean(normalizeBaseUrl(process.env.EXPO_PUBLIC_GUARD_LAYER_URL));
}

function baseUrl(): string {
  const b = normalizeBaseUrl(process.env.EXPO_PUBLIC_GUARD_LAYER_URL);
  if (!b) throw new Error('EXPO_PUBLIC_GUARD_LAYER_URL is not set');
  return b;
}

interface CheckPayload {
  transactionRef?: string;
  signals?: unknown;
  rawScore?: unknown;
  decision?: string;
  riskScore?: number;
  explanation?: string;
  reasoning?: string;
  recommendedAction?: string;
  challengeAction?: string;
  usedFallback?: boolean;
  error?: string;
}

function mapCheckPayload(body: CheckPayload, status: number): GuardianResult {
  const decisionRaw = String(body.decision ?? '').toUpperCase();
  const decision: GuardianResult['decision'] =
    decisionRaw === 'BLOCK' || decisionRaw === 'CHALLENGE' || decisionRaw === 'APPROVE'
      ? (decisionRaw as GuardianResult['decision'])
      : status === 401
        ? 'CHALLENGE'
        : status === 403
          ? 'BLOCK'
          : 'APPROVE';

  const explanation = String(body.explanation ?? '').trim();
  const reasoning = String(body.reasoning ?? '').trim();
  const recommended = String(body.recommendedAction ?? '').trim();

  return {
    decision,
    signals: body.signals ?? null,
    riskScore: typeof body.riskScore === 'number' ? body.riskScore : 0,
    transactionRef: body.transactionRef ?? null,
    reason: recommended || reasoning || 'GUARD_LAYER',
    humanMessage:
      explanation ||
      (decision === 'BLOCK'
        ? 'This transaction cannot proceed for security reasons.'
        : decision === 'CHALLENGE'
          ? 'Additional verification is required on your device.'
          : 'Security checks passed.'),
    txnId: decision === 'APPROVE' ? (body.transactionRef ?? null) : null,
    challengeAction: body.challengeAction,
  };
}

/**
 * POST /api/transaction/check — same contract as the dashboard JSON pipeline.
 */
export async function initiateGuardianCheck(amount: string, phoneNumber: string): Promise<GuardianResult> {
  if (!isLiveGuardianEnabled()) {
    return mockInitiatePayment(amount, phoneNumber);
  }

  const scenario = process.env.EXPO_PUBLIC_GUARD_SCENARIO ?? 'all_clear';
  const url = `${baseUrl()}/api/transaction/check`;
  const amt = Number.parseFloat(amount);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      phoneNumber,
      scenario,
      amount: Number.isFinite(amt) ? amt : undefined,
      source: 'sendcash',
    }),
  });

  const body = (await res.json().catch(() => ({}))) as CheckPayload;

  if (!res.ok && res.status !== 401 && res.status !== 403) {
    const msg = body.error || `GuardLayer check failed (${res.status})`;
    throw new Error(msg);
  }

  return mapCheckPayload(body, res.status);
}

/**
 * After native biometrics succeed, complete payment via POST /confirm (STK simulator).
 */
export async function settleFrictionlessPayment(
  amount: string,
  phoneNumber: string,
  transactionRef: string
): Promise<GuardianResult> {
  if (!isLiveGuardianEnabled()) {
    return mockConfirmPayment('bio-verified');
  }
  const numericAmount = Number.parseFloat(amount);
  const amt = Number.isFinite(numericAmount) ? numericAmount : 0;
  const res = await fetch(`${baseUrl()}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      phoneNumber,
      amount: amt,
      bio_token: GUARD_LAYER_FRICTIONLESS_TOKEN,
      transactionRef,
      source: 'sendcash',
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    txn_id?: string;
    message?: string;
    status?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || body.message || `Frictionless settle failed (${res.status})`);
  }
  return {
    decision: 'APPROVE',
    signals: null,
    riskScore: 10,
    reason: 'FRICTIONLESS_SETTLED',
    humanMessage: body.message ?? 'Payment completed successfully.',
    txnId: body.txn_id ?? null,
    transactionRef,
  };
}

export async function confirmGuardianAfterBio(
  amount: string,
  phoneNumber: string,
  transactionRef?: string | null
): Promise<GuardianResult> {
  if (!isLiveGuardianEnabled()) {
    return mockConfirmPayment('bio-verified');
  }

  const numericAmount = Number.parseFloat(amount);
  const amt = Number.isFinite(numericAmount) ? numericAmount : 0;

  // Opaque attestation that local biometric UI completed (middleware mock accepts any token).
  const bio_token = `expo-local-auth:${Date.now()}`;

  const res = await fetch(`${baseUrl()}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      phoneNumber,
      amount: amt,
      bio_token,
      transactionRef: transactionRef ?? undefined,
      source: 'sendcash',
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    txn_id?: string;
    message?: string;
    status?: string;
    action?: string;
    error?: string;
  };

  if (res.status === 401 && body.action === 'SMILE_ID_LIVENESS') {
    return {
      decision: 'CHALLENGE',
      signals: null,
      riskScore: 70,
      reason: 'SMILE_ID_LIVENESS',
      humanMessage: body.message ?? 'Biometric verification required.',
      txnId: null,
      challengeAction: 'SMILE_ID_LIVENESS',
    };
  }

  if (!res.ok) {
    throw new Error(body.message || body.error || `Confirm failed (${res.status})`);
  }

  return {
    decision: 'APPROVE',
    signals: null,
    riskScore: 15,
    reason: 'BIOMETRIC_VERIFIED',
    humanMessage: body.message ?? 'Payment completed successfully.',
    txnId: body.txn_id ?? null,
  };
}
