import { PreferenceSelector } from './PreferenceSelector';

// Thin wrapper that renders one PreferenceSelector per named group (design/Questionnaire.dc.html),
// instead of PreferenceSelector's own flat category list — keeps PreferenceSelector's tested,
// flat-array contract untouched.
export function GroupedPreferenceSelector({ idPrefix, groups, values, onChange }) {
  return (
    <div>
      {groups.map((group) => (
        <div key={group.name}>
          <h3 className="pref-group-heading">{group.name}</h3>
          <PreferenceSelector
            idPrefix={idPrefix}
            categories={group.categories}
            values={values}
            onChange={onChange}
          />
        </div>
      ))}
    </div>
  );
}
