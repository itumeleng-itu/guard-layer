import { useMemo } from 'react';
import { useGuardLayerSse } from './hooks/useGuardLayerSse';
import { SignalTimeline, buildTimelineItems } from './components/SignalTimeline';
import { PipelineFlow } from './components/PipelineFlow';
import { DualScoreBar } from './components/DualScoreBar';
import { DecisionOutput } from './components/DecisionOutput';
import { ImpactCounter } from './components/ImpactCounter';
import { MiddlewareActivityFeed } from './components/MiddlewareActivityFeed';
import { useMiddlewareActivity } from './hooks/useMiddlewareActivity';

/**
 * Standalone monitor UI for the GuardLayer SSE pipeline. Mock playback is
 * the default so the dashboard runs without any backend; flip
 * VITE_USE_LIVE_SSE=true to proxy the middleware POST stream during a
 * judge demo.
 */
export function App(): JSX.Element {
  const {
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
  } = useGuardLayerSse();

  const timelineItems = useMemo(() => buildTimelineItems(records), [records]);
  const busy = status === 'connecting' || status === 'streaming';
  const liveMode = import.meta.env.VITE_USE_LIVE_SSE === 'true';
  const activityEntries = useMiddlewareActivity(liveMode);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>GuardLayer API monitor</h1>
          <p className="app-header__sub">
            Live visualization of the transaction stream. Mock playback is default; set
            VITE_USE_LIVE_SSE=true to proxy the middleware POST stream.
          </p>
        </div>
        <div className="app-header__actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              void startDemo({ scenario: 'all_clear' });
            }}
          >
            Run clear scenario
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              void startDemo({ scenario: 'elevated' });
            }}
          >
            Run elevated scenario
          </button>
          <button type="button" className="btn btn--ghost" disabled={!busy} onClick={stop}>
            Stop
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={resetSession}
          >
            Reset session
          </button>
        </div>
      </header>

      <div className="app-meta">
        <span className={`pill pill--${status}`}>Status: {status}</span>
        {liveMode ? (
          <span className="pill pill--live">Live SSE</span>
        ) : (
          <span className="pill">Mock SSE</span>
        )}
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <main className="app-grid">
        <section className="panel panel--span">
          <PipelineFlow currentStage={currentStage} />
        </section>

        <section className="panel">
          <h2 className="panel__title">Scores</h2>
          <DualScoreBar
            fusionScore={latestFusion?.score ?? null}
            aiScore={latestAi?.riskScore ?? null}
          />
        </section>

        <section className="panel">
          <h2 className="panel__title">Outcome</h2>
          <DecisionOutput
            decision={latestDecision?.decision ?? null}
            explanation={latestDecision?.explanation ?? null}
            reasoning={latestDecision?.reasoning ?? null}
          />
        </section>

        <section className="panel panel--wide">
          <ImpactCounter
            transactionsChecked={impact.transactionsChecked}
            fraudBlocked={impact.fraudBlocked}
            valueProtectedZar={impact.valueProtectedZar}
            marketsCount={impact.markets.size}
          />
        </section>

        <section className="panel panel--timeline">
          <SignalTimeline items={timelineItems} />
        </section>

        <section className="panel panel--span">
          <MiddlewareActivityFeed entries={activityEntries} livePolling={liveMode} />
        </section>
      </main>

      <footer className="app-footer">
        <span>GuardLayer P4 dashboard</span>
        <span>Stream shape matches POST /api/transaction/check/stream</span>
      </footer>
    </div>
  );
}
