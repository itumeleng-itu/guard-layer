interface ImpactCounterProps {
  transactionsChecked: number;
  fraudBlocked: number;
  valueProtectedZar: number;
  marketsCount: number;
}

/**
 * Session-level counters used as the demo storytelling headline:
 * transactions checked, blocked fraud, protected value (ZAR), market count.
 */
export function ImpactCounter({
  transactionsChecked,
  fraudBlocked,
  valueProtectedZar,
  marketsCount,
}: ImpactCounterProps): JSX.Element {
  const fmtMoney = (n: number): string =>
    new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(n) ? n : 0);

  return (
    <section className="impact-counter" aria-label="Session impact statistics">
      <div className="impact-counter__grid">
        <article>
          <h3>Transactions checked</h3>
          <p className="impact-counter__num">{transactionsChecked}</p>
        </article>
        <article>
          <h3>Fraud blocked</h3>
          <p className="impact-counter__num">{fraudBlocked}</p>
        </article>
        <article>
          <h3>Value protected</h3>
          <p className="impact-counter__num">{fmtMoney(valueProtectedZar)}</p>
        </article>
        <article>
          <h3>Markets</h3>
          <p className="impact-counter__num">{marketsCount}</p>
        </article>
      </div>
    </section>
  );
}

ImpactCounter.displayName = 'ImpactCounter';
