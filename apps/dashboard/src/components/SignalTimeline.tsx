import { SSE_EVENTS } from '@guard-layer/shared';
import type {
  CongestionInsightsResult,
  DeviceSwapResult,
  KycMatchResult,
  LocationVerifyResult,
  NumberVerifyResult,
  SignalName,
  SignalResult,
  SimSwapResult,
  SseRecord,
} from '../types/guardLayer';

export type TimelineTone = 'good' | 'bad' | 'neutral';

export interface TimelineItem {
  id: string;
  title: string;
  body: string;
  tone: TimelineTone;
}

interface SignalTimelineProps {
  items: TimelineItem[];
}

/**
 * Build a human-readable summary for one CAMARA signal payload. Kept as a
 * pure helper so the component itself can stay focused on rendering.
 */
function summarizeSignal(name: SignalName, result: SignalResult): string {
  switch (name) {
    case 'simSwap': {
      const r = result as SimSwapResult;
      return r.recentChange ? 'Recent SIM change flagged' : 'No recent SIM change';
    }
    case 'deviceSwap': {
      const r = result as DeviceSwapResult;
      return r.deviceMatch ? 'Device matches profile' : 'Device mismatch';
    }
    case 'numberVerify': {
      const r = result as NumberVerifyResult;
      return r.verified ? 'Number verified to device' : 'Number verification failed';
    }
    case 'locationVerify': {
      const r = result as LocationVerifyResult;
      return r.withinGeofence
        ? `Within geofence (${r.country || 'n/a'})`
        : `Outside geofence (${r.country || 'n/a'})`;
    }
    case 'kycMatch': {
      const r = result as KycMatchResult;
      return `Identity sync ${r.identitySynced ? 'ok' : 'gap'}; score ${r.matchScore ?? 'n/a'}`;
    }
    case 'congestionInsights': {
      const r = result as CongestionInsightsResult;
      return `Congestion: ${r.level ?? 'unknown'}`;
    }
    default:
      return JSON.stringify(result);
  }
}

/**
 * Apply the same negative-signal heuristics the fusion engine cares about
 * so timeline cards visually flag the signals that drove a higher score.
 */
function isAdverseSignal(name: SignalName, result: SignalResult): boolean {
  switch (name) {
    case 'simSwap':
      return (result as SimSwapResult).recentChange === true;
    case 'deviceSwap':
      return (result as DeviceSwapResult).deviceMatch === false;
    case 'numberVerify':
      return (result as NumberVerifyResult).verified === false;
    case 'locationVerify':
      return (result as LocationVerifyResult).withinGeofence === false;
    case 'kycMatch': {
      const r = result as KycMatchResult;
      return r.identitySynced === false || (typeof r.matchScore === 'number' && r.matchScore < 80);
    }
    case 'congestionInsights': {
      const lvl = (result as CongestionInsightsResult).level;
      return lvl === 'elevated' || lvl === 'critical';
    }
    default:
      return false;
  }
}

/**
 * Live list of interrogation events; newest entries animate in via CSS.
 * Items are reversed at render time so callers can keep records[] in
 * insertion order.
 */
export function SignalTimeline({ items }: SignalTimelineProps): JSX.Element {
  return (
    <section className="signal-timeline" aria-label="Live API signal timeline">
      <header className="signal-timeline__head">
        <h2>Signal timeline</h2>
        <p className="signal-timeline__hint">
          Each CAMARA completion emits a card as the stream arrives.
        </p>
      </header>
      <ol className="signal-timeline__list">
        {items
          .slice()
          .reverse()
          .map((it) => (
            <li key={it.id} className={`signal-timeline__card signal-timeline__card--${it.tone}`}>
              <div className="signal-timeline__card-title">{it.title}</div>
              <div className="signal-timeline__card-body">{it.body}</div>
            </li>
          ))}
      </ol>
      {items.length === 0 ? <p className="signal-timeline__empty">No signals yet.</p> : null}
    </section>
  );
}

SignalTimeline.displayName = 'SignalTimeline';

/**
 * Project the raw SSE record buffer into renderable timeline items. Pure so
 * it can be unit-tested or memoized at the call site.
 */
export function buildTimelineItems(records: SseRecord[]): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const r of records) {
    const evt = r.event;
    switch (evt.type) {
      case SSE_EVENTS.SIGNAL: {
        const { name, result } = evt.payload;
        const bad = isAdverseSignal(name, result);
        out.push({
          id: r.id,
          title: name,
          body: summarizeSignal(name, result),
          tone: bad ? 'bad' : 'good',
        });
        break;
      }
      case SSE_EVENTS.STAGE:
        out.push({
          id: r.id,
          title: 'Pipeline stage',
          body: String(evt.payload.stage),
          tone: 'neutral',
        });
        break;
      case SSE_EVENTS.RAW_SCORE:
        out.push({
          id: r.id,
          title: 'Fusion score',
          body: `Pre-AI score ${evt.payload.score} (${evt.payload.triggerCount} contributors)`,
          tone: 'neutral',
        });
        break;
      case SSE_EVENTS.DECISION:
        out.push({
          id: r.id,
          title: 'AI decision',
          body: `${evt.payload.decision} at risk ${evt.payload.riskScore}`,
          tone: 'neutral',
        });
        break;
      case SSE_EVENTS.COMPLETE:
      case SSE_EVENTS.ERROR:
        // Terminal frames are surfaced via DecisionOutput / banner instead.
        break;
    }
  }
  return out;
}
