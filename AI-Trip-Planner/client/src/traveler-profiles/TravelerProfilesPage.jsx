import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';
import { GroupedPreferenceSelector } from '../shared/GroupedPreferenceSelector';
import { PREFERENCE_GROUPS } from '../shared/preferenceCategories';
import { EmptyState } from '../shared/EmptyState';

const AGE_GROUPS = ['teen', 'adult', 'senior'];
const PACE_OPTIONS = ['relaxed', 'balanced', 'intensive'];
const WALKING_TOLERANCE_OPTIONS = ['low', 'moderate', 'high'];
const INDOOR_OUTDOOR_OPTIONS = ['indoor', 'balanced', 'outdoor'];
// ATP-86: common allergies/dietary needs, offered as a structured multi-select
// alongside the free-text "other" fallback below.
const DIETARY_OPTIONS = [
  { value: 'nuts', label: 'Nuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'egg', label: 'Egg' },
  { value: 'soy', label: 'Soy' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
];

const EMPTY_FORM = {
  profileName: '',
  travelerName: '',
  ageGroup: '',
  pace: '',
  preferences: {},
  foodCuisineInterests: '',
  dietaryRestrictions: [],
  dietaryRequirements: '',
  indoorOutdoorTendency: '',
  walkingTolerance: '',
  hardConstraints: '',
  travelStyleNote: '',
};

export function TravelerProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reload after create/edit/delete; not called from the mount effect below,
  // which fetches inline the same way AuthContext does.
  const refreshProfiles = useCallback(async () => {
    try {
      const { profiles } = await apiClient.get('/traveler-profiles');
      setProfiles(profiles);
      setLoadStatus('ready');
    } catch {
      setLoadStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    apiClient
      .get('/traveler-profiles', { signal: controller.signal })
      .then(({ profiles }) => {
        if (!active) return;
        setProfiles(profiles);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setLoadStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function startEdit(profile) {
    setEditingId(profile.id);
    setForm({
      profileName: profile.profileName,
      travelerName: profile.travelerName ?? '',
      ageGroup: profile.ageGroup ?? '',
      pace: profile.pace ?? '',
      preferences: profile.preferences ?? {},
      foodCuisineInterests: profile.foodCuisineInterests ?? '',
      dietaryRestrictions: profile.dietaryRestrictions ?? [],
      dietaryRequirements: profile.dietaryRequirements ?? '',
      indoorOutdoorTendency: profile.indoorOutdoorTendency ?? '',
      walkingTolerance: profile.walkingTolerance ?? '',
      hardConstraints: profile.hardConstraints ?? '',
      travelStyleNote: profile.travelStyleNote ?? '',
    });
    setFormError(null);
  }

  function toggleDietaryRestriction(value) {
    setForm((current) => {
      const has = current.dietaryRestrictions.includes(value);
      return {
        ...current,
        dietaryRestrictions: has
          ? current.dietaryRestrictions.filter((v) => v !== value)
          : [...current.dietaryRestrictions, value],
      };
    });
  }

  function handlePreferenceChange(category, value) {
    setForm((current) => ({
      ...current,
      preferences: { ...current.preferences, [category]: value },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await apiClient.patch(`/traveler-profiles/${editingId}`, form);
      } else {
        await apiClient.post('/traveler-profiles', form);
      }
      startCreate();
      await refreshProfiles();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(profile) {
    const confirmed = window.confirm(`Delete "${profile.profileName}"? This can't be undone.`);
    if (!confirmed) return;

    await apiClient.delete(`/traveler-profiles/${profile.id}`);
    if (editingId === profile.id) startCreate();
    await refreshProfiles();
  }

  return (
    <main className="page">
      <h1>Traveler Profiles</h1>

      <section aria-labelledby="profiles-list-heading" className="card">
        <h2 id="profiles-list-heading">Your profiles</h2>
        {loadStatus === 'loading' && <p>Loading…</p>}
        {loadStatus === 'error' && (
          <p role="alert" className="form-error">
            Couldn&rsquo;t load your profiles. Try refreshing.
          </p>
        )}
        {loadStatus === 'ready' && profiles.length === 0 && (
          <EmptyState>No traveler profiles yet — add one below to start planning.</EmptyState>
        )}
        {loadStatus === 'ready' && profiles.length > 0 && (
          <ul className="list-reset">
            {profiles.map((profile) => (
              <li key={profile.id} className="item-row">
                <span className="item-row-label">
                  {profile.profileName}
                  {(profile.travelerName || profile.ageGroup) && (
                    <span className="item-row-sub">
                      {profile.travelerName}
                      {profile.travelerName && profile.ageGroup ? ' · ' : ''}
                      {profile.ageGroup}
                    </span>
                  )}
                </span>
                <span className="item-row-actions">
                  <button type="button" className="btn btn-sm" onClick={() => startEdit(profile)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(profile)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="profile-form-heading" className="card">
        <h2 id="profile-form-heading">{editingId ? 'Edit profile' : 'Create a profile'}</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="profile-name">Profile name (required)</label>
            <input
              id="profile-name"
              className="input"
              required
              maxLength={100}
              value={form.profileName}
              onChange={(event) =>
                setForm((current) => ({ ...current, profileName: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="traveler-name">Traveler name (optional)</label>
            <input
              id="traveler-name"
              className="input"
              maxLength={100}
              value={form.travelerName}
              onChange={(event) =>
                setForm((current) => ({ ...current, travelerName: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="age-group">Age group (optional)</label>
            <select
              id="age-group"
              className="input"
              value={form.ageGroup}
              onChange={(event) =>
                setForm((current) => ({ ...current, ageGroup: event.target.value }))
              }
            >
              <option value="">Not specified</option>
              {AGE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pace">
              Pace (optional) <span className="hint">— how full should each day feel?</span>
            </label>
            <select
              id="pace"
              className="input"
              value={form.pace}
              onChange={(event) => setForm((current) => ({ ...current, pace: event.target.value }))}
            >
              <option value="">Not specified</option>
              {PACE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="walking-tolerance">Walking tolerance (optional)</label>
            <select
              id="walking-tolerance"
              className="input"
              value={form.walkingTolerance}
              onChange={(event) =>
                setForm((current) => ({ ...current, walkingTolerance: event.target.value }))
              }
            >
              <option value="">Not specified</option>
              {WALKING_TOLERANCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="indoor-outdoor">Indoor/outdoor tendency (optional)</label>
            <select
              id="indoor-outdoor"
              className="input"
              value={form.indoorOutdoorTendency}
              onChange={(event) =>
                setForm((current) => ({ ...current, indoorOutdoorTendency: event.target.value }))
              }
            >
              <option value="">Not specified</option>
              {INDOOR_OUTDOOR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="food-cuisine-interests">Food/cuisine interests (optional)</label>
            <input
              id="food-cuisine-interests"
              className="input"
              maxLength={500}
              value={form.foodCuisineInterests}
              onChange={(event) =>
                setForm((current) => ({ ...current, foodCuisineInterests: event.target.value }))
              }
            />
          </div>
          <fieldset className="field">
            <legend>Allergies / dietary requirements (optional)</legend>
            <span className="pref-options">
              {DIETARY_OPTIONS.map((option) => {
                const inputId = `dietary-restriction-${option.value}`;
                return (
                  <span key={option.value} className="pref-option">
                    <input
                      type="checkbox"
                      id={inputId}
                      checked={form.dietaryRestrictions.includes(option.value)}
                      onChange={() => toggleDietaryRestriction(option.value)}
                    />
                    <label htmlFor={inputId}>{option.label}</label>
                  </span>
                );
              })}
            </span>
          </fieldset>
          <div className="field">
            <label htmlFor="dietary-requirements">Other allergies/dietary notes (optional)</label>
            <input
              id="dietary-requirements"
              className="input"
              maxLength={500}
              value={form.dietaryRequirements}
              onChange={(event) =>
                setForm((current) => ({ ...current, dietaryRequirements: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="hard-constraints">
              Hard constraints (optional){' '}
              <span className="hint">— mobility, accessibility, allergies, must-respect limits</span>
            </label>
            <input
              id="hard-constraints"
              className="input"
              maxLength={500}
              value={form.hardConstraints}
              onChange={(event) =>
                setForm((current) => ({ ...current, hardConstraints: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="travel-style-note">Travel-style note (optional)</label>
            <input
              id="travel-style-note"
              className="input"
              maxLength={500}
              value={form.travelStyleNote}
              onChange={(event) =>
                setForm((current) => ({ ...current, travelStyleNote: event.target.value }))
              }
            />
          </div>

          <GroupedPreferenceSelector
            idPrefix="profile-pref"
            groups={PREFERENCE_GROUPS}
            values={form.preferences}
            onChange={handlePreferenceChange}
          />

          {formError && (
            <p role="alert" className="form-error">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create profile'}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={startCreate} disabled={submitting}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
