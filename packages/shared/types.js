// GuardLayer Shared Types & Constants

// Decision Constants
export const DECISION = {
  APPROVE: 'APPROVE',
  CHALLENGE: 'CHALLENGE',
  BLOCK: 'BLOCK'
};

// Stage Constants
export const STAGE = {
  INTERROGATION: 'interrogation',
  AI_DECISION: 'ai_decision',
  COMPLETE: 'complete'
};

// SSE Event Types
export const SSE_EVENTS = {
  STAGE: 'stage',
  SIGNAL: 'signal',
  RAW_SCORE: 'raw_score',
  DECISION: 'decision',
  COMPLETE: 'complete',
  ERROR: 'error'
};

// Scenario to Sandbox Number Mapping
// Documenting the exact Nokia sandbox test phone numbers for different scenarios
export const NOKIA_TEST_NUMBERS = {
  all_clear: '+358401234567',
  recent_sim_swap: '+358407654321',
  device_mismatch: '+358409999999',
  location_anomaly: '+358408888888',
  network_attack_window: '+358407777777',
  full_attack: '+358406666666'
};

/**
 * Signal Response Shape Schema
 * All 6 CAMARA APIs must return this consistent shape to P2.
 */
export const SIGNAL_SCHEMA = {
  simSwap: { recentChange: Boolean, lastSwapDate: String /* ISO Date or null */ },
  deviceSwap: { deviceMatch: Boolean },
  numberVerify: { verified: Boolean },
  locationVerify: { withinGeofence: Boolean, country: String },
  kycMatch: { identitySynced: Boolean, matchScore: Number },
  congestionInsights: { level: String /* 'normal', 'elevated', 'critical' */ }
};

/**
 * Transaction Request Payload Shape
 */
export const TRANSACTION_PAYLOAD = {
  phoneNumber: String,
  amount: Number,
  recipientNumber: String,
  deviceId: String,
  location: {
    latitude: Number,
    longitude: Number
  },
  scenario: String
};
