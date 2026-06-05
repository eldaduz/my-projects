import { getFacilityLabel } from '../../utils/displayLabels.js';

const FACILITY_OPTIONS = [
  'wifi',
  'coffee',
  'printer',
  'kitchen',
  'parking',
  'bikeStorage',
  'petFriendly',
  'accessibility',
];

export default function AdminBranchForm({
  formValues,
  isEditing,
  isSaving,
  errorMessage,
  onChange,
  onFacilityToggle,
  onSubmit,
  onCancel,
}) {
  return (
    <article className="hero-card admin-branch-form-card">
      <div className="section-stack compact-stack">
        <div>
          <p className="placeholder-label">{isEditing ? 'עריכת מיקום' : 'יצירת מיקום חדש'}</p>
          <p className="placeholder-copy">
            הטופס מציג תוויות בעברית, אבל שולח לשרת את ערכי המיקום המאושרים.
          </p>
        </div>

        <form className="auth-modal-form" onSubmit={onSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">שם מיקום</span>
            <input
              className="auth-input"
              type="text"
              value={formValues.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder="למשל WorkNest Tel Aviv"
            />
          </label>

          <div className="admin-form-grid">
            <label className="auth-field">
              <span className="auth-field-label">עיר</span>
              <input
                className="auth-input"
                type="text"
                value={formValues.city}
                onChange={(event) => onChange('city', event.target.value)}
                placeholder="למשל Tel Aviv"
              />
            </label>

            <label className="auth-field">
              <span className="auth-field-label">דירוג</span>
              <select
                className="auth-input"
                value={formValues.rating}
                onChange={(event) => onChange('rating', event.target.value)}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>
          </div>

          <label className="auth-field">
            <span className="auth-field-label">כתובת</span>
            <input
              className="auth-input"
              type="text"
              value={formValues.address}
              onChange={(event) => onChange('address', event.target.value)}
              placeholder="למשל Rothschild Boulevard 22, Tel Aviv"
            />
          </label>

          <label className="auth-field">
            <span className="auth-field-label">כתובת תמונה</span>
            <input
              className="auth-input"
              type="text"
              value={formValues.imageUrl}
              onChange={(event) => onChange('imageUrl', event.target.value)}
              placeholder="/images/branches/worknest-example.jpg"
            />
          </label>

          <div className="auth-field">
            <span className="auth-field-label">מתקנים</span>
            <div className="admin-facilities-grid">
              {FACILITY_OPTIONS.map((facility) => {
                const isAccessibility = facility === 'accessibility';
                const isChecked = formValues.facilities.includes(facility);

                return (
                  <label className="admin-checkbox" key={facility}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isAccessibility}
                      onChange={() => onFacilityToggle(facility)}
                    />
                    <span>{getFacilityLabel(facility)}</span>
                  </label>
                );
              })}
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
                  : 'יוצר מיקום...'
                : isEditing
                  ? 'שמירת שינויים'
                  : 'יצירת מיקום'}
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}
