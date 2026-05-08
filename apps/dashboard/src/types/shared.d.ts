/**
 * Local ambient declarations for the @guard-layer/shared workspace package.
 * Kept inside apps/dashboard so we do not modify the shared package and
 * avoid cross-team merge conflicts.
 */
declare module '@guard-layer/shared' {
  export const DECISION: {
    readonly APPROVE: 'APPROVE';
    readonly CHALLENGE: 'CHALLENGE';
    readonly BLOCK: 'BLOCK';
  };

  export const STAGE: {
    readonly INTERROGATION: 'interrogation';
    readonly AI_DECISION: 'ai_decision';
    readonly COMPLETE: 'complete';
  };

  export const SSE_EVENTS: {
    readonly STAGE: 'stage';
    readonly SIGNAL: 'signal';
    readonly RAW_SCORE: 'raw_score';
    readonly DECISION: 'decision';
    readonly COMPLETE: 'complete';
    readonly ERROR: 'error';
  };

  export const NOKIA_TEST_NUMBERS: Readonly<Record<string, string>>;
}
