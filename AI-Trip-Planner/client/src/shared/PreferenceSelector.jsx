// Row-based grouped preference selector (SYSTEM_DESIGN §9.1): one row per
// category, each a native radio group so keyboard/touch/screen-reader
// support comes for free. Reused for TravelerProfile preferences and, later,
// Trip Overrides (F09) — keep this component free of TravelerProfile-specific
// naming/shape.
//
// Icons are deliberately distinct shapes (not just color) between Avoid and Block —
// the design mockup uses the same circle-slash glyph for both, which reads identically
// at a glance. Avoid = minus-in-circle ("lower priority"), Block = slash-in-circle
// ("not allowed"), so the two are told apart by shape even before reading the label.
const PREFERENCE_OPTIONS = [
  {
    value: 'neutral',
    label: 'Neutral',
    icon: (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    value: 'interested',
    label: 'Interested',
    icon: (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 3l2.1 4.4 4.9.7-3.5 3.5.8 4.9-4.3-2.3-4.3 2.3.8-4.9-3.5-3.5 4.9-.7L10 3z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    value: 'avoid',
    label: 'Avoid',
    icon: (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
        <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 'block',
    label: 'Block',
    icon: (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8" />
        <line x1="5.5" y1="14.5" x2="14.5" y2="5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function PreferenceSelector({ idPrefix, categories, values, onChange }) {
  return (
    <div role="group" aria-label="Preferences" className="pref-group">
      {categories.map(({ key, label, hint }) => (
        <fieldset key={key} className="pref-row">
          <legend>
            {label}
            {hint && (
              <span className="hint-icon" tabIndex={0} title={hint} aria-label={hint}>
                <span aria-hidden="true">ⓘ</span>
              </span>
            )}
          </legend>
          <span className="pref-options">
            {PREFERENCE_OPTIONS.map((option) => {
              const inputId = `${idPrefix}-${key}-${option.value}`;
              return (
                <span key={option.value} className={`pref-option pref-option--${option.value}`}>
                  <input
                    type="radio"
                    id={inputId}
                    name={`${idPrefix}-${key}`}
                    value={option.value}
                    checked={(values[key] ?? 'neutral') === option.value}
                    onChange={() => onChange(key, option.value)}
                  />
                  <label htmlFor={inputId}>
                    {option.icon}
                    {option.label}
                  </label>
                </span>
              );
            })}
          </span>
        </fieldset>
      ))}
    </div>
  );
}

export const PREFERENCE_SELECTOR_OPTIONS = PREFERENCE_OPTIONS;
