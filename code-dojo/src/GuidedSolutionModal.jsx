import ReactMarkdown from 'react-markdown'
import ModalShell from './ModalShell'

export default function GuidedSolutionModal({
  loading,
  currentExercise,
  guidedSolution,
  onConfirm,
  onApply,
  onClose,
}) {
  return (
    <ModalShell className="guided-solution-modal panel" size="lg" onClose={onClose}>
      <div className="modal-header">
        <div className="modal-heading">
          <span className="eyebrow">Guided solution</span>
          <h2>
            {guidedSolution
              ? currentExercise?.title || 'Guided Solution'
              : 'Reveal the worked solution?'}
          </h2>
        </div>
        <button type="button" className="btn-ghost modal-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {!guidedSolution ? (
        <section className="panel subtle modal-section stack-md">
          <p className="message">
            This reveals the full AI-generated solution with an explanation of how it works.
          </p>
          <p className="message warning">
            Using a guided solution sets XP for this exercise attempt to 0, even if you submit
            afterwards.
          </p>
          <div className="inline-actions">
            <button
              id="confirm-guided-solution"
              type="button"
              className="btn-secondary accent"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Show Guided Solution'}
            </button>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <div className="modal-body stack-md">
          <section className="panel subtle guided-solution-section">
            <h3>Summary</h3>
            <p className="message guided-solution-copy">{guidedSolution.summary}</p>
          </section>

          <section className="panel subtle guided-solution-section">
            <h3>Step-by-step guide</h3>
            <ol className="guided-solution-list">
              {guidedSolution.steps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="panel subtle guided-solution-section">
            <h3>Why this works</h3>
            <div className="markdown-body">
              <ReactMarkdown>{guidedSolution.whyItWorks}</ReactMarkdown>
            </div>
          </section>

          <section className="panel subtle guided-solution-grid">
            <div>
              <h3>Complexity</h3>
              <p className="message guided-solution-copy">{guidedSolution.complexity}</p>
            </div>
            <div>
              <h3>Common pitfalls</h3>
              <ul className="guided-solution-list">
                {guidedSolution.pitfalls.map((pitfall, index) => (
                  <li key={`${pitfall}-${index}`}>{pitfall}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel subtle guided-solution-section">
            <div className="modal-subheader">
              <h3>Solution code</h3>
              <button
                id="apply-guided-solution"
                type="button"
                className="btn-secondary accent"
                onClick={onApply}
              >
                Apply to Editor
              </button>
            </div>
            <pre className="example-block guided-solution-code">
              <code>{guidedSolution.solutionCode}</code>
            </pre>
          </section>
        </div>
      )}
    </ModalShell>
  )
}
