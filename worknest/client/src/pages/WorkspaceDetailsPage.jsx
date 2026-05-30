import { useEffect, useState } from 'react';
import { getWorkspaceById } from '../api/workspacesApi.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import {
  getEquipmentLabel,
  getWorkspaceDescription,
  getWorkspaceDisplayName,
  getWorkspaceTypeLabel,
} from '../utils/displayLabels.js';

export default function WorkspaceDetailsPage({ workspaceId }) {
  const [workspace, setWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadWorkspace() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await getWorkspaceById(workspaceId);
        setWorkspace(response.data.workspace);
      } catch (error) {
        setErrorMessage('משהו השתבש. נסו שוב בעוד רגע.');
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, [workspaceId]);

  function handleQuickReservation() {
    if (!workspace) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent('worknest:reservation-request', {
        detail: {
          branchId: workspace.branchId,
          workspaceId: workspace.id,
        },
      }),
    );
  }

  return (
    <section className="page-section section-stack public-page-layout">
      <div className="page-header">
        <span className="eyebrow">חלל עבודה</span>
        <h1 className="page-title">
          {workspace ? getWorkspaceDisplayName(workspace.name) : 'פרטי חלל העבודה'}
        </h1>
        <p className="page-description">
          כל הפרטים שצריך לפני הזמנה מהירה: סוג החלל, קיבולת, ציוד ומחיר ליום.
        </p>
      </div>

      {isLoading ? <LoadingState message="טוען את פרטי חלל העבודה..." /> : null}
      {!isLoading && errorMessage ? <ErrorMessage message={errorMessage} /> : null}
      {!isLoading && !errorMessage && !workspace ? (
        <EmptyState message="חלל העבודה לא נמצא." />
      ) : null}

      {!isLoading && !errorMessage && workspace ? (
        <article className="hero-card location-summary-card">
          <div className="location-summary-grid">
            {workspace.imageUrl ? (
              <img
                className="card-image card-image-detail"
                src={workspace.imageUrl}
                alt={getWorkspaceDisplayName(workspace.name)}
                loading="eager"
              />
            ) : (
              <div className="card-image-placeholder card-image-placeholder-workspace">
                <span className="card-image-badge">תמונה תוצג בקרוב</span>
              </div>
            )}

            <div className="section-stack compact-stack">
              <p className="info-copy">סוג חלל: {getWorkspaceTypeLabel(workspace.type)}</p>
              <p className="info-copy">קיבולת: {workspace.capacity}</p>
              <p className="info-copy">מחיר ליום: ₪{workspace.pricePerDay}</p>
              <p className="placeholder-copy">{getWorkspaceDescription(workspace.description)}</p>

              <div className="chip-row">
                {workspace.equipment?.length ? (
                  workspace.equipment.map((item) => (
                    <span className="info-chip" key={item}>
                      {getEquipmentLabel(item)}
                    </span>
                  ))
                ) : (
                  <span className="info-chip">ללא ציוד נוסף</span>
                )}
              </div>

              <div className="card-actions">
                <button type="button" className="button-link" onClick={handleQuickReservation}>
                  הזמן עכשיו
                </button>
              </div>
            </div>
          </div>
        </article>
      ) : null}
    </section>
  );
}
