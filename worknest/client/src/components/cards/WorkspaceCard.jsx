import { useEffect, useState } from 'react';
import {
  getEquipmentLabel,
  getWorkspaceDescription,
  getWorkspaceDisplayName,
  getWorkspaceImagePaths,
} from '../../utils/displayLabels.js';

export default function WorkspaceCard({ workspace }) {
  const imageCandidates = [];
  const mappedWorkspaceImages = getWorkspaceImagePaths(workspace.name);

  imageCandidates.push(...mappedWorkspaceImages);

  if (workspace.imageUrl) {
    imageCandidates.push(workspace.imageUrl);
  }

  const uniqueImageCandidates = [...new Set(imageCandidates)];
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [workspace.imageUrl, workspace.name]);

  function handleQuickReservation() {
    window.dispatchEvent(
      new CustomEvent('worknest:reservation-request', {
        detail: {
          branchId: workspace.branchId,
          workspaceId: workspace.id,
        },
      }),
    );
  }

  function handleImageError() {
    setActiveImageIndex((currentIndex) => currentIndex + 1);
  }

  const activeImageUrl = uniqueImageCandidates[activeImageIndex] || '';

  return (
    <article className="data-card workspace-card">
      {activeImageUrl ? (
        <img
          className="card-image"
          src={activeImageUrl}
          alt={getWorkspaceDisplayName(workspace.name)}
          loading="eager"
          onError={handleImageError}
        />
      ) : (
        <div className="card-image-placeholder card-image-placeholder-workspace">
          <span className="card-image-badge">תמונה תוצג בקרוב</span>
        </div>
      )}

      <div className="card-content">
        <div className="card-header">
          <h3 className="card-title">{getWorkspaceDisplayName(workspace.name)}</h3>
        </div>

        <div className="workspace-card-metrics">
          <p className="card-meta">מתאים ל-{workspace.capacity} אנשים</p>
          <p className="card-meta workspace-card-price">מחיר ליום: ₪{workspace.pricePerDay}</p>
        </div>

        <p className="card-description">{getWorkspaceDescription(workspace.description)}</p>

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
            הזמנה
          </button>
        </div>
      </div>
    </article>
  );
}
