import { STAGE } from '@guard-layer/shared';
import type { StageLabel } from '../types/guardLayer';

interface PipelineFlowProps {
  currentStage: StageLabel | null;
}

/**
 * Two-stage pipeline indicator: triage (parallel CAMARA interrogation) then
 * investigation (fusion + AI adjudication). Stage 1 stays "done" once stage 2
 * begins; both render as "done" when the terminal complete event arrives.
 */
export function PipelineFlow({ currentStage }: PipelineFlowProps): JSX.Element {
  const highlight1 = currentStage === STAGE.INTERROGATION;
  const highlight2 = currentStage === STAGE.AI_DECISION;
  const done = currentStage === STAGE.COMPLETE;

  return (
    <section className="pipeline-flow" aria-label="Decision pipeline stages">
      <div
        className={`pipeline-flow__node ${highlight1 ? 'is-active' : ''} ${
          done || highlight2 ? 'is-done' : ''
        }`}
      >
        <div className="pipeline-flow__badge">1</div>
        <div>
          <div className="pipeline-flow__title">Stage 1: Triage</div>
          <div className="pipeline-flow__sub">Parallel CAMARA interrogation</div>
        </div>
      </div>
      <div className={`pipeline-flow__rail ${highlight2 || done ? 'is-active' : ''}`} aria-hidden />
      <div className={`pipeline-flow__node ${highlight2 ? 'is-active' : ''} ${done ? 'is-done' : ''}`}>
        <div className="pipeline-flow__badge">2</div>
        <div>
          <div className="pipeline-flow__title">Stage 2: Investigation</div>
          <div className="pipeline-flow__sub">Fusion scoring and AI adjudication</div>
        </div>
      </div>
    </section>
  );
}

PipelineFlow.displayName = 'PipelineFlow';
