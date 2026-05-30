import {
  getAddressDisplayName,
  getBranchDisplayName,
  getCityDisplayName,
  getFacilityLabel,
} from '../../utils/displayLabels.js';

function renderRating(rating) {
  if (!rating) {
    return 'ללא דירוג';
  }

  return `${'★'.repeat(rating)} ${rating}/5`;
}

export default function AdminBranchCard({ branch, onEdit, onDeactivate, isDeactivating }) {
  return (
    <article className="data-card admin-branch-card">
      <div className="card-content admin-branch-card-content">
        <div className="card-header admin-branch-card-header">
          <div className="section-stack compact-stack">
            <div className="admin-branch-card-topline">
              <span className="card-rating admin-branch-card-rating">
                {renderRating(branch.rating)}
              </span>
              {typeof branch.isActive === 'boolean' ? (
                <span
                  className={
                    branch.isActive
                      ? 'admin-status-badge admin-status-badge-active'
                      : 'admin-status-badge'
                  }
                >
                  {branch.isActive ? 'פעיל' : 'לא פעיל'}
                </span>
              ) : null}
            </div>
            <h3 className="card-title admin-branch-card-title">
              {getBranchDisplayName(branch.name)}
            </h3>
          </div>
          <span className="card-meta admin-branch-card-city">
            {getCityDisplayName(branch.city)}
          </span>
        </div>

        <p className="card-meta admin-branch-card-address">
          {getAddressDisplayName(branch.address)}
        </p>

        <div className="chip-row admin-branch-card-chip-row">
          {branch.facilities?.map((facility) => (
            <span className="info-chip" key={facility}>
              {getFacilityLabel(facility)}
            </span>
          ))}
        </div>

        <div className="card-actions admin-branch-card-actions">
          <button type="button" className="button-link-secondary" onClick={() => onEdit(branch)}>
            עריכת מיקום
          </button>
          <button
            type="button"
            className="button-link"
            onClick={() => onDeactivate(branch)}
            disabled={isDeactivating}
          >
            {isDeactivating ? 'משבית...' : 'השבתת מיקום'}
          </button>
        </div>
      </div>
    </article>
  );
}
