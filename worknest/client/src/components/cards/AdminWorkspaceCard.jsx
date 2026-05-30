import { getEquipmentLabel, getWorkspaceTypeLabel } from '../../utils/displayLabels.js';

export default function AdminWorkspaceCard({ workspace, onEdit, onDeactivate, isDeactivating }) {
  return (
    <article className="data-card admin-workspace-card">
      <div className="card-content admin-workspace-card-content">
        <div className="card-header admin-workspace-card-header">
          <div className="section-stack compact-stack">
            <div className="admin-workspace-card-topline">
              <span className="card-rating admin-workspace-card-type">
                {getWorkspaceTypeLabel(workspace.type)}
              </span>
              {typeof workspace.isActive === 'boolean' ? (
                <span
                  className={
                    workspace.isActive
                      ? 'admin-status-badge admin-status-badge-active'
                      : 'admin-status-badge'
                  }
                >
                  {workspace.isActive ? 'פעיל' : 'לא פעיל'}
                </span>
              ) : null}
            </div>
            <h3 className="card-title admin-workspace-card-title">{workspace.name}</h3>
          </div>
          <div className="admin-workspace-card-metrics">
            <span className="card-meta admin-workspace-card-metric">
              קיבולת: {workspace.capacity}
            </span>
            <span className="card-meta admin-workspace-card-metric">
              ₪{workspace.pricePerDay} ליום
            </span>
          </div>
        </div>

        <p className="card-description admin-workspace-card-description">{workspace.description}</p>

        <div className="chip-row admin-workspace-card-chip-row">
          {workspace.equipment?.length ? (
            workspace.equipment.map((equipment) => (
              <span className="info-chip" key={equipment}>
                {getEquipmentLabel(equipment)}
              </span>
            ))
          ) : (
            <span className="info-chip">ללא ציוד נוסף</span>
          )}
        </div>

        <div className="card-actions admin-workspace-card-actions">
          <button type="button" className="button-link-secondary" onClick={() => onEdit(workspace)}>
            עריכת חלל
          </button>
          <button
            type="button"
            className="button-link"
            onClick={() => onDeactivate(workspace)}
            disabled={isDeactivating}
          >
            {isDeactivating ? 'משבית...' : 'השבתת חלל'}
          </button>
        </div>
      </div>
    </article>
  );
}
