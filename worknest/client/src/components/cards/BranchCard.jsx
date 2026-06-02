import { useEffect, useState } from 'react';
import {
  getAddressDisplayName,
  getBranchDisplayName,
  getBranchImagePaths,
  getFacilityLabel,
} from '../../utils/displayLabels.js';

function renderRating(rating) {
  if (!rating) {
    return 'ללא דירוג';
  }

  return `${rating}/5`;
}

export default function BranchCard({ branch, ctaLabel = 'לפרטי המיקום' }) {
  const detailsPath = `/locations/${branch.id}`;
  const imageCandidates = getBranchImagePaths(branch.name, branch.imageUrl);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [branch.imageUrl, branch.name]);

  function handleImageError() {
    setActiveImageIndex((currentIndex) => currentIndex + 1);
  }

  const activeImageUrl = imageCandidates[activeImageIndex] || '';

  return (
    <article className="data-card branch-card">
      <a
        className="card-media-wrap branch-card-media-link"
        href={detailsPath}
        data-link
        aria-label={`לפרטי המיקום ${getBranchDisplayName(branch.name)}`}
      >
        {activeImageUrl ? (
          <img
            className="card-image"
            src={activeImageUrl}
            alt={getBranchDisplayName(branch.name)}
            loading="eager"
            onError={handleImageError}
          />
        ) : (
          <div className="card-image-placeholder">
            <span className="card-image-badge">תמונה תוצג בקרוב</span>
          </div>
        )}

        <span className="branch-rating-badge" aria-label={`דירוג ${renderRating(branch.rating)}`}>
          <span className="branch-rating-star" aria-hidden="true">
            ★
          </span>
          <span>{renderRating(branch.rating)}</span>
        </span>
      </a>

      <div className="card-content">
        <div className="card-header">
          <h3 className="card-title">
            <a className="branch-card-title-link" href={detailsPath} data-link>
              {getBranchDisplayName(branch.name)}
            </a>
          </h3>
        </div>

        <p className="card-meta">{getAddressDisplayName(branch.address)}</p>

        <div className="chip-row branch-card-chip-row">
          {branch.facilities?.map((facility) => (
            <span className="info-chip" key={facility}>
              {getFacilityLabel(facility)}
            </span>
          ))}
        </div>

        <div className="card-actions">
          <a className="button-link" href={detailsPath} data-link>
            {ctaLabel}
          </a>
        </div>
      </div>
    </article>
  );
}
