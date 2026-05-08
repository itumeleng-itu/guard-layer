interface DualScoreBarProps {
  /** Pre-AI weighted fusion score (0-100). Null when no raw_score has arrived. */
  fusionScore: number | null | undefined;
  /** Final AI-adjudicated risk score (0-100). Null when no decision has arrived. */
  aiScore: number | null | undefined;
}

/**
 * Horizontal dual-bar comparison: fused (pre-AI) score vs final AI risk score.
 * Bar widths are clamped 0-100 so the component is safe for any payload.
 */
export function DualScoreBar({ fusionScore, aiScore }: DualScoreBarProps): JSX.Element {
  const f = typeof fusionScore === 'number' ? Math.max(0, Math.min(100, fusionScore)) : null;
  const a = typeof aiScore === 'number' ? Math.max(0, Math.min(100, aiScore)) : null;

  return (
    <section className="dual-score" aria-label="Risk score comparison">
      <header className="dual-score__head">
        <span>Signal fusion (pre-AI)</span>
        <span>AI risk (final)</span>
      </header>
      <div className="dual-score__row" role="presentation">
        <div className="dual-score__track">
          <div
            className="dual-score__fill dual-score__fill--fusion"
            style={{ width: f === null ? '0%' : `${f}%` }}
            title={f === null ? 'No fusion score yet' : `Fusion ${f}`}
          />
        </div>
        <div className="dual-score__value">{f === null ? '—' : f}</div>
      </div>
      <div className="dual-score__row" role="presentation">
        <div className="dual-score__track">
          <div
            className="dual-score__fill dual-score__fill--ai"
            style={{ width: a === null ? '0%' : `${a}%` }}
            title={a === null ? 'No AI score yet' : `AI ${a}`}
          />
        </div>
        <div className="dual-score__value">{a === null ? '—' : a}</div>
      </div>
    </section>
  );
}

DualScoreBar.displayName = 'DualScoreBar';
