import {
  getBranchDisplayName,
  getEquipmentLabel,
  getWorkspaceTypeLabel,
} from '../../utils/displayLabels.js';

const WORKSPACE_TYPE_OPTIONS = ['office', 'smallMeetingRoom', 'largeMeetingRoom', 'managedSuite'];

const EQUIPMENT_OPTIONS = ['projector', 'largeTv'];

export default function AdminWorkspaceForm({
  branches,
  formValues,
  isEditing,
  isSaving,
  errorMessage,
  onChange,
  onEquipmentToggle,
  onSubmit,
  onCancel,
}) {
  return (
    <article className="hero-card admin-branch-form-card">
      <div className="section-stack compact-stack">
        <div>
          <p className="placeholder-label">
            {isEditing ? 'עריכת חלל עבודה' : 'יצירת חלל עבודה חדש'}
          </p>
          <p className="placeholder-copy">
            הטופס מציג תוויות בעברית, אבל שולח לשרת את ערכי חלל העבודה המאושרים.
          </p>
        </div>

        <form className="auth-modal-form" onSubmit={onSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">מיקום</span>
            <select
              className="auth-input"
              value={formValues.branchId}
              onChange={(event) => onChange('branchId', event.target.value)}
            >
              <option value="">בחירת מיקום</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {getBranchDisplayName(branch.name)}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span className="auth-field-label">שם חלל עבודה</span>
            <input
              className="auth-input"
              type="text"
              value={formValues.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder="למשל Office A"
            />
          </label>

          <div className="admin-form-grid">
            <label className="auth-field">
              <span className="auth-field-label">סוג חלל</span>
              <select
                className="auth-input"
                value={formValues.type}
                onChange={(event) => onChange('type', event.target.value)}
              >
                {WORKSPACE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {getWorkspaceTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-field">
              <span className="auth-field-label">קיבולת</span>
              <input
                className="auth-input"
                type="number"
                min="1"
                value={formValues.capacity}
                onChange={(event) => onChange('capacity', event.target.value)}
              />
            </label>
          </div>

          <div className="admin-form-grid">
            <label className="auth-field">
              <span className="auth-field-label">מחיר ליום</span>
              <input
                className="auth-input"
                type="number"
                min="1"
                value={formValues.pricePerDay}
                onChange={(event) => onChange('pricePerDay', event.target.value)}
              />
            </label>

            <label className="auth-field">
              <span className="auth-field-label">כתובת תמונה</span>
              <input
                className="auth-input"
                type="text"
                value={formValues.imageUrl}
                onChange={(event) => onChange('imageUrl', event.target.value)}
                placeholder="/images/workspaces/office-a.png"
              />
            </label>
          </div>

          <label className="auth-field">
            <span className="auth-field-label">תיאור</span>
            <textarea
              className="auth-input auth-textarea"
              value={formValues.description}
              onChange={(event) => onChange('description', event.target.value)}
              placeholder="תיאור קצר של חלל העבודה"
            />
          </label>

          <div className="auth-field">
            <span className="auth-field-label">ציוד</span>
            <div className="admin-facilities-grid">
              {EQUIPMENT_OPTIONS.map((equipment) => (
                <label className="admin-checkbox" key={equipment}>
                  <input
                    type="checkbox"
                    checked={formValues.equipment.includes(equipment)}
                    onChange={() => onEquipmentToggle(equipment)}
                  />
                  <span>{getEquipmentLabel(equipment)}</span>
                </label>
              ))}
            </div>
          </div>

          {errorMessage ? <p className="auth-error-message">{errorMessage}</p> : null}

          <div className="card-actions">
            <button
              type="button"
              className="button-link-secondary"
              onClick={onCancel}
              disabled={isSaving}
            >
              {isEditing ? 'ביטול עריכה' : 'סגירת הטופס'}
            </button>

            <button type="submit" className="auth-submit-button" disabled={isSaving}>
              {isSaving
                ? isEditing
                  ? 'שומר שינויים...'
                  : 'יוצר חלל...'
                : isEditing
                  ? 'שמירת שינויים'
                  : 'יצירת חלל'}
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}
