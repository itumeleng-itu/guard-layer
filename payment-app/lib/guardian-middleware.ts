/**
 * Guardian Middleware (Mock)
 * 
 * Simulates the full security pipeline:
 *   1. Parallel interrogation of 6 Nokia CAMARA Network Signals
 *   2. Claude AI risk evaluation
 *   3. Decision: APPROVE | CHALLENGE | BLOCK
 * 
 * In production, this would be a Node.js backend hitting real APIs.
 */

export type Decision = 'APPROVE' | 'CHALLENGE' | 'BLOCK';

export interface NetworkSignals {
  simSwap: { recentChange: boolean; lastSwapDate: string | null };
  numberVerification: { deviceMatch: boolean };
  deviceStatus: { imeiValid: boolean; isRooted: boolean };
  locationVerification: { withinGeofence: boolean; country: string };
  kycMatch: { identitySynced: boolean; matchScore: number };
  qualityOfService: { latencyMs: number; stable: boolean };
}

export interface GuardianResult {
  decision: Decision;
  signals: NetworkSignals;
  riskScore: number;           // 0-100 (higher = more risky)
  reason: string;              // Machine-readable reason code
  humanMessage: string;        // Claude-generated user-friendly explanation
  txnId: string | null;        // Transaction ID if approved
  challengeAction?: string;    // e.g. 'FACE_BIOMETRIC'
}

// Simulated delay for realistic UX
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate a mock transaction ID
function generateTxnId(): string {
  return `TXN_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Phase 1: Simulate the 6 parallel Nokia CAMARA network signal checks
 */
async function interrogateNetworkSignals(phoneNumber: string): Promise<NetworkSignals> {
  // Simulate network latency
  await delay(800);

  // Use the phone number to deterministically pick a scenario for demo purposes
  // Numbers ending in 0 = BLOCK, ending in 5 = CHALLENGE, anything else = APPROVE
  const lastDigit = parseInt(phoneNumber.slice(-1)) || 0;

  if (lastDigit === 0) {
    // Scenario C: Critical failure — SIM was recently swapped
    return {
      simSwap: { recentChange: true, lastSwapDate: new Date().toISOString() },
      numberVerification: { deviceMatch: false },
      deviceStatus: { imeiValid: true, isRooted: false },
      locationVerification: { withinGeofence: true, country: 'ZA' },
      kycMatch: { identitySynced: true, matchScore: 92 },
      qualityOfService: { latencyMs: 45, stable: true },
    };
  }

  if (lastDigit === 5) {
    // Scenario A: Ambiguous risk — new location detected
    return {
      simSwap: { recentChange: false, lastSwapDate: null },
      numberVerification: { deviceMatch: true },
      deviceStatus: { imeiValid: true, isRooted: false },
      locationVerification: { withinGeofence: false, country: 'NG' },
      kycMatch: { identitySynced: true, matchScore: 78 },
      qualityOfService: { latencyMs: 120, stable: true },
    };
  }

  // Scenario B: All clear — baseline match
  return {
    simSwap: { recentChange: false, lastSwapDate: null },
    numberVerification: { deviceMatch: true },
    deviceStatus: { imeiValid: true, isRooted: false },
    locationVerification: { withinGeofence: true, country: 'ZA' },
    kycMatch: { identitySynced: true, matchScore: 97 },
    qualityOfService: { latencyMs: 32, stable: true },
  };
}

/**
 * Phase 2: Simulate Claude AI risk evaluation
 */
async function evaluateRisk(signals: NetworkSignals): Promise<Omit<GuardianResult, 'signals'>> {
  // Simulate AI thinking time
  await delay(600);

  // BLOCK: SIM Swap detected
  if (signals.simSwap.recentChange) {
    return {
      decision: 'BLOCK',
      riskScore: 95,
      reason: 'SIM_SWAP_DETECTED',
      humanMessage: "We've detected that your SIM card was recently changed. For your protection, this transaction has been blocked. If this was you, please visit your nearest branch to verify your identity.",
      txnId: null,
    };
  }

  // CHALLENGE: Location mismatch or low KYC score
  if (!signals.locationVerification.withinGeofence || signals.kycMatch.matchScore < 80) {
    return {
      decision: 'CHALLENGE',
      riskScore: 62,
      reason: 'DYNAMIC_VAR_CHANGE',
      humanMessage: "We noticed you're transacting from an unusual location. For your safety, please verify your identity with a quick face scan.",
      txnId: null,
      challengeAction: 'DEVICE_BIOMETRIC',
    };
  }

  // APPROVE: All signals green
  return {
    decision: 'APPROVE',
    riskScore: 8,
    reason: 'BASELINE_MATCH',
    humanMessage: 'All security checks passed. Your payment is being processed.',
    txnId: generateTxnId(),
  };
}

/**
 * Main entry point: Initiate a payment through the Guardian pipeline
 */
export async function initiatePayment(
  amount: string,
  phoneNumber: string
): Promise<GuardianResult> {
  // Phase 1: Parallel network interrogation
  const signals = await interrogateNetworkSignals(phoneNumber);

  // Phase 2: AI risk evaluation
  const evaluation = await evaluateRisk(signals);

  return {
    ...evaluation,
    signals,
  };
}

/**
 * Confirm a challenged payment after biometric verification
 */
export async function confirmPayment(bioToken: string): Promise<GuardianResult> {
  await delay(500);

  return {
    decision: 'APPROVE',
    signals: {} as NetworkSignals,
    riskScore: 12,
    reason: 'BIOMETRIC_VERIFIED',
    humanMessage: 'Identity verified. Your payment has been processed successfully.',
    txnId: generateTxnId(),
  };
}
