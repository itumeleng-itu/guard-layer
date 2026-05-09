import { DECISION } from '@guard-layer/shared';
import type { DecisionLabel } from '../types/guardLayer';

interface DecisionOutputProps {
  decision: DecisionLabel | null | undefined;
  explanation: string | null | undefined;
  reasoning?: string | null;
}

/**
 * Final tri-state outcome (APPROVE / CHALLENGE / BLOCK) with the
 * plain-language explanation produced by Claude or the fallback engine.
 */
export function DecisionOutput({
  decision,
  explanation,
  reasoning,
}: DecisionOutputProps): JSX.Element {
  const d = String(decision ?? '').toUpperCase();
  const badgeClass =
    d === DECISION.BLOCK
      ? 'is-block'
      : d === DECISION.CHALLENGE
        ? 'is-challenge'
        : d === DECISION.APPROVE
          ? 'is-approve'
          : 'is-unknown';

  const label =
    d === DECISION.BLOCK || d === DECISION.CHALLENGE || d === DECISION.APPROVE ? d : 'PENDING';

  return (
    <section className="decision-output" aria-live="polite">
      <div className={`decision-output__badge ${badgeClass}`}>{label}</div>
      <p className="decision-output__explain">
        {explanation || 'Awaiting decision stream. Run a transaction to populate this panel.'}
      </p>
      {reasoning ? (
        <details className="decision-output__details">
          <summary>Technical reasoning</summary>
          <p>{reasoning}</p>
        </details>
      ) : null}
    </section>
  );
}

DecisionOutput.displayName = 'DecisionOutput';
