import { useCallback, useEffect, useRef, useState } from 'react';
import { DECISION, SSE_EVENTS, STAGE } from '@guard-layer/shared';
import { consumePostSse } from '../lib/consumePostSse';
import { playMockTransactionStream } from '../lib/mockSsePlayback';
import type {
  ConnectionStatus,
  DecisionPayload,
  ImpactState,
  RawScorePayload,
  SseEvent,
  SseRecord,
  StageLabel,
  StartDemoOptions,
  StreamCheckBody,
} from '../types/guardLayer';

interface LatestAi {
  riskScore: number;
  decision: DecisionPayload['decision'];
  explanation: string;
  reasoning: string;
}

export interface UseGuardLayerSseResult {
  records: SseRecord[];
  status: ConnectionStatus;
  error: string | null;
  currentStage: StageLabel | null;
  latestFusion: RawScorePayload | null;
  latestAi: LatestAi | null;
  latestDecision: DecisionPayload | null;
  impact: ImpactState;
  startDemo: (opts?: StartDemoOptions) => Promise<void>;
  stop: () => void;
  resetSession: () => void;
  runLive: (body: StreamCheckBody) => Promise<void>;
  runMock: (opts?: { scenario?: 'clear' | 'elevated'; amountZar?: number }) => Promise<void>;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyImpact(): ImpactState {
  return {
    transactionsChecked: 0,
    fraudBlocked: 0,
    valueProtectedZar: 0,
    markets: new Set<string>(),
  };
}

/**
 * Subscribe to a GuardLayer transaction stream. Live SSE is enabled when
 * VITE_USE_LIVE_SSE === 'true' (proxied to the middleware via vite.config);
 * otherwise the hook plays a deterministic mock that mirrors the server
 * event ordering so judges can demo without P2/P3 running.
 */
export function useGuardLayerSse(): UseGuardLayerSseResult {
  const [records, setRecords] = useState<SseRecord[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<StageLabel | null>(null);
  const [latestFusion, setLatestFusion] = useState<RawScorePayload | null>(null);
  const [latestAi, setLatestAi] = useState<LatestAi | null>(null);
  const [latestDecision, setLatestDecision] = useState<DecisionPayload | null>(null);
  const [impact, setImpact] = useState<ImpactState>(() => emptyImpact());

  const abortRef = useRef<AbortController | null>(null);

  const append = useCallback((evt: SseEvent): void => {
    setRecords((prev) => [...prev, { id: newId(), at: Date.now(), event: evt }]);

    switch (evt.type) {
      case SSE_EVENTS.STAGE:
        setCurrentStage(evt.payload.stage);
        return;

      case SSE_EVENTS.RAW_SCORE:
        setLatestFusion({
          score: evt.payload.score,
          breakdown: evt.payload.breakdown,
          triggerCount: evt.payload.triggerCount,
        });
        return;

      case SSE_EVENTS.DECISION:
        setLatestAi({
          riskScore: evt.payload.riskScore,
          decision: evt.payload.decision,
          explanation: evt.payload.explanation,
          reasoning: evt.payload.reasoning,
        });
        setLatestDecision(evt.payload);
        return;

      case SSE_EVENTS.COMPLETE: {
        setCurrentStage(STAGE.COMPLETE);
        const p = evt.payload;
        setImpact((prev) => {
          const markets = new Set(prev.markets);
          if (Array.isArray(p.markets)) {
            for (const m of p.markets) markets.add(String(m));
          }
          const blocked =
            p.decision === DECISION.BLOCK ? prev.fraudBlocked + 1 : prev.fraudBlocked;
          const amt = typeof p.amountZar === 'number' ? p.amountZar : 0;
          return {
            transactionsChecked: prev.transactionsChecked + 1,
            fraudBlocked: blocked,
            valueProtectedZar: prev.valueProtectedZar + amt,
            markets,
          };
        });
        return;
      }

      case SSE_EVENTS.ERROR:
        setError(evt.payload.message || `Stream error (${evt.payload.status})`);
        return;

      case SSE_EVENTS.SIGNAL:
        // No aggregate state to update beyond the records buffer; the
        // SignalTimeline component derives its rows from records[].
        return;
    }
  }, []);

  const stop = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((s) => (s === 'streaming' || s === 'connecting' ? 'idle' : s));
  }, []);

  const runMock = useCallback(
    async (opts: { scenario?: 'clear' | 'elevated'; amountZar?: number } = {}): Promise<void> => {
      setError(null);
      setStatus('connecting');
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setStatus('streaming');
        await playMockTransactionStream((evt) => append(evt), {
          signal: controller.signal,
          scenario: opts.scenario ?? 'clear',
          amountZar: opts.amountZar,
        });
        setStatus('idle');
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setStatus('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [append]
  );

  const runLive = useCallback(
    async (body: StreamCheckBody): Promise<void> => {
      setError(null);
      setStatus('connecting');
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        setStatus('streaming');
        await consumePostSse('/api/transaction/check/stream', body, (evt) => append(evt), {
          signal: controller.signal,
        });
        setStatus('idle');
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setStatus('error');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [append]
  );

  const startDemo = useCallback(
    async (opts: StartDemoOptions = {}): Promise<void> => {
      const useLive = import.meta.env.VITE_USE_LIVE_SSE === 'true';
      if (useLive) {
        await runLive({
          phoneNumber: opts.phoneNumber ?? '+358401234567',
          scenario: opts.scenario ?? 'all_clear',
          location: opts.location,
        });
      } else {
        const elevated =
          opts.scenario === 'full_attack' ||
          opts.scenario === 'elevated' ||
          opts.scenario === 'recent_sim_swap';
        await runMock({
          scenario: elevated ? 'elevated' : 'clear',
          amountZar: opts.amountZar,
        });
      }
    },
    [runLive, runMock]
  );

  const resetSession = useCallback((): void => {
    stop();
    setRecords([]);
    setError(null);
    setCurrentStage(null);
    setLatestFusion(null);
    setLatestAi(null);
    setLatestDecision(null);
    setImpact(emptyImpact());
    setStatus('idle');
  }, [stop]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    records,
    status,
    error,
    currentStage,
    latestFusion,
    latestAi,
    latestDecision,
    impact,
    startDemo,
    stop,
    resetSession,
    runLive,
    runMock,
  };
}
