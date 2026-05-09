/**
 * Shared TypeScript types for the GuardLayer dashboard. Mirrors the SSE
 * payloads emitted by apps/middleware/server.js so all UI components are
 * fully typed without round-tripping through `any`.
 */

export type DecisionLabel = 'APPROVE' | 'CHALLENGE' | 'BLOCK';
export type StageLabel = 'interrogation' | 'ai_decision' | 'complete';
export type SseEventType =
  | 'stage'
  | 'signal'
  | 'raw_score'
  | 'decision'
  | 'complete'
  | 'error';

export type CongestionLevel = 'normal' | 'elevated' | 'critical';

export interface SimSwapResult {
  recentChange: boolean;
  lastSwapDate: string | null;
}

export interface DeviceSwapResult {
  deviceMatch: boolean;
}

export interface NumberVerifyResult {
  verified: boolean;
}

export interface LocationVerifyResult {
  withinGeofence: boolean;
  country: string;
}

export interface KycMatchResult {
  identitySynced: boolean;
  matchScore: number;
}

export interface CongestionInsightsResult {
  level: CongestionLevel;
}

export interface SignalsRecord {
  simSwap?: SimSwapResult;
  deviceSwap?: DeviceSwapResult;
  numberVerify?: NumberVerifyResult;
  locationVerify?: LocationVerifyResult;
  kycMatch?: KycMatchResult;
  congestionInsights?: CongestionInsightsResult;
}

export type SignalName = keyof SignalsRecord;

export type SignalResult =
  | SimSwapResult
  | DeviceSwapResult
  | NumberVerifyResult
  | LocationVerifyResult
  | KycMatchResult
  | CongestionInsightsResult;

export interface FusionBreakdownEntry {
  label: string;
  points: number;
}

export interface RawScorePayload {
  transactionRef?: string;
  score: number;
  breakdown: FusionBreakdownEntry[];
  triggerCount: number;
}

export interface StagePayload {
  transactionRef?: string;
  stage: StageLabel;
}

export interface SignalEventPayload {
  name: SignalName;
  result: SignalResult;
}

export interface DecisionPayload {
  transactionRef?: string;
  decision: DecisionLabel;
  riskScore: number;
  explanation: string;
  reasoning: string;
  recommendedAction?: string;
  challengeAction?: string;
  usedFallback?: boolean;
}

export interface CompletePayload extends DecisionPayload {
  signals: SignalsRecord;
  rawScore: RawScorePayload;
  /** Mock-only fields used by the demo UI; absent from live middleware today. */
  amountZar?: number;
  markets?: string[];
}

export interface ErrorPayload {
  transactionRef?: string;
  status: number;
  message: string;
}

/**
 * Discriminated union of every SSE frame the dashboard handles.
 * Switch on `type` to narrow `payload` automatically.
 */
export type SseEvent =
  | { type: 'stage'; payload: StagePayload }
  | { type: 'signal'; payload: SignalEventPayload }
  | { type: 'raw_score'; payload: RawScorePayload }
  | { type: 'decision'; payload: DecisionPayload }
  | { type: 'complete'; payload: CompletePayload }
  | { type: 'error'; payload: ErrorPayload };

/** Stored event row used by the timeline and the SSE buffer. */
export interface SseRecord {
  id: string;
  at: number;
  event: SseEvent;
}

export interface ImpactState {
  transactionsChecked: number;
  fraudBlocked: number;
  valueProtectedZar: number;
  markets: Set<string>;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'streaming' | 'error';

export interface StreamCheckBody {
  phoneNumber: string;
  scenario?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius?: number;
  };
}

export interface StartDemoOptions {
  /** Pass-through for live mode; ignored in mock mode. */
  phoneNumber?: string;
  /** Live mode uses NOKIA_TEST_NUMBERS keys; mock mode collapses to clear/elevated. */
  scenario?: string;
  amountZar?: number;
  location?: StreamCheckBody['location'];
}
