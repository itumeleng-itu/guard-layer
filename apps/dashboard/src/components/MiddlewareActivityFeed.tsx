import type { MiddlewareActivityRow } from '../hooks/useMiddlewareActivity';

interface MiddlewareActivityFeedProps {
  entries: MiddlewareActivityRow[];
  livePolling: boolean;
}

function summarize(row: MiddlewareActivityRow): string {
  switch (row.kind) {
    case 'risk_check':
      return `${row.decision ?? '?'} · score ${row.riskScore ?? '—'}${row.scenario ? ` · ${row.scenario}` : ''}`;
    case 'payment_settled':
      return `Paid · ${row.settlement ?? 'settled'} · ${row.txn_id ?? '—'}`;
    case 'confirm_liveness_required':
      return 'Awaiting biometric / selfie';
    case 'confirm_pin_challenge':
      return 'USSD PIN challenge';
    default:
      return row.kind ?? 'event';
  }
}

/**
 * Unified feed from middleware (`/api/activity`): SendCash checks + settlements and dashboard SSE runs.
 */
export function MiddlewareActivityFeed({
  entries,
  livePolling,
}: MiddlewareActivityFeedProps): JSX.Element {
  return (
    <section className="activity-feed" aria-live="polite">
      <h2 className="panel__title">Middleware activity</h2>
      <p className="activity-feed__hint">
        {livePolling
          ? 'Polling /api/activity — SendCash transactions and dashboard checks appear here after the middleware records them.'
          : 'Turn on Live SSE (VITE_USE_LIVE_SSE=true) to poll activity from middleware.'}
      </p>
      {entries.length === 0 ? (
        <p className="activity-feed__empty">No entries yet — run a check from the dashboard or SendCash.</p>
      ) : (
        <ul className="activity-feed__list">
          {entries.slice(0, 25).map((row, i) => (
            <li key={`${row.at}-${row.transactionRef ?? i}`} className="activity-feed__row">
              <span className="activity-feed__time">{row.at?.replace('T', ' ').slice(0, 19) ?? ''}</span>
              <span className="activity-feed__tag">{row.source ?? '—'}</span>
              <span className="activity-feed__tag activity-feed__tag--kind">{row.kind}</span>
              <span className="activity-feed__phone">{row.phoneNumber ?? '—'}</span>
              {typeof row.amount === 'number' ? (
                <span className="activity-feed__amt">R{row.amount}</span>
              ) : null}
              <span className="activity-feed__summary">{summarize(row)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
