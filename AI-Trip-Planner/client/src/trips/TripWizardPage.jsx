import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { GroupedPreferenceSelector } from '../shared/GroupedPreferenceSelector';
import { PREFERENCE_GROUPS, PREFERENCE_CATEGORIES } from '../shared/preferenceCategories';
import { formatDate } from '../shared/dateFormat';
import { ItineraryView } from './ItineraryView';

const BASICS_COMPLETE_STEP = 2;
const TRAVELERS_COMPLETE_STEP = 3;
const QUESTIONNAIRE_COMPLETE_STEP = 4;
const AGE_GROUPS = ['teen', 'adult', 'senior'];
const CHILD_MIN_AGE = 0;
const CHILD_MAX_AGE = 17;
const PACE_OPTIONS = ['relaxed', 'balanced', 'intensive'];
const MUST_DO_MAX_LENGTH = 200;
const REPLAN_INSTRUCTION_MAX_LENGTH = 1000;

// PRD §6.5: each budget level needs short user-facing explanatory text.
const BUDGET_LEVELS = [
  { value: 'budget', label: 'Budget', description: 'Cost-conscious choices where possible.' },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'A balance of comfort and cost — the default assumption.',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Comfort and quality prioritized over cost.',
  },
];


// F10.1: the review step must summarize preferences too — only list the
// categories the user actually expressed an opinion on (non-neutral).
function formatPreferencesSummary(preferences) {
  const expressed = PREFERENCE_CATEGORIES.filter(
    ({ key }) => preferences?.[key] && preferences[key] !== 'neutral',
  ).map(({ key, label }) => `${label} (${preferences[key]})`);
  return expressed.length > 0 ? expressed.join(', ') : 'No preferences set.';
}

function toQuestionnaireForm(tripProfile) {
  const accommodation = tripProfile?.accommodation ?? {};
  return {
    hotelBooked:
      accommodation.hotelBooked === true ? 'yes' : accommodation.hotelBooked === false ? 'no' : '',
    hotelName: accommodation.hotelName ?? '',
    hotelArea: accommodation.hotelArea ?? '',
    budgetLevel: tripProfile?.budgetLevel ?? '',
    paceOverride: tripProfile?.paceOverride ?? '',
    preferences: tripProfile?.preferences ?? {},
    hardConstraints: tripProfile?.hardConstraints ?? '',
    notes: tripProfile?.notes ?? '',
  };
}

function toFormState(trip) {
  return {
    destination: trip.destination ?? '',
    startDate: trip.startDate ? trip.startDate.slice(0, 10) : '',
    endDate: trip.endDate ? trip.endDate.slice(0, 10) : '',
    tripTitle: trip.tripTitle ?? '',
  };
}

// F06 only delivers the trip-basics wizard step (destination/dates/title);
// later Features add steps after it. wizardStep >= BASICS_COMPLETE_STEP means
// this step was already saved, so reopening the trip resumes on a summary
// rather than re-showing the form (SYSTEM_DESIGN §4).
export function TripWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [editingBasics, setEditingBasics] = useState(false);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [editingTravelers, setEditingTravelers] = useState(false);
  const [travelersError, setTravelersError] = useState(null);
  const [travelersBusy, setTravelersBusy] = useState(false);
  const [tripOnlyForm, setTripOnlyForm] = useState({ travelerName: '', ageGroup: '' });
  const [childAge, setChildAge] = useState('');
  const [editingQuestionnaire, setEditingQuestionnaire] = useState(false);
  const [questionnaireForm, setQuestionnaireForm] = useState(null);
  const [questionnaireError, setQuestionnaireError] = useState(null);
  const [questionnaireBusy, setQuestionnaireBusy] = useState(false);
  const [mustDoInput, setMustDoInput] = useState('');
  const [readinessError, setReadinessError] = useState(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [replanInstruction, setReplanInstruction] = useState('');
  const [replanError, setReplanError] = useState(null);
  const [replanBusy, setReplanBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    apiClient
      .get(`/trips/${id}`, { signal: controller.signal })
      .then(({ trip }) => {
        if (!active) return;
        setTrip(trip);
        if (trip.wizardStep < BASICS_COMPLETE_STEP) setForm(toFormState(trip));
        if (trip.wizardStep < QUESTIONNAIRE_COMPLETE_STEP) {
          setQuestionnaireForm(toQuestionnaireForm(trip.tripProfile));
        }
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
  }, [id]);

  // Travelers can only be selected once basics are saved (F07.2 depends on
  // the F06 wizard's basics step); fetch the reusable profiles to choose from.
  const travelersUnlocked = Boolean(trip && trip.wizardStep >= BASICS_COMPLETE_STEP);
  useEffect(() => {
    if (!travelersUnlocked) return;
    let active = true;
    const controller = new AbortController();

    apiClient
      .get('/traveler-profiles', { signal: controller.signal })
      .then(({ profiles }) => {
        if (active) setProfiles(profiles);
      })
      .catch(() => {});

    return () => {
      active = false;
      controller.abort();
    };
  }, [travelersUnlocked]);

  async function handleAddTraveler(travelerProfileId) {
    setTravelersError(null);
    setTravelersBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        addTravelerProfileId: travelerProfileId,
      });
      setTrip(updated);
    } catch (err) {
      setTravelersError(err.message);
    } finally {
      setTravelersBusy(false);
    }
  }

  async function handleRemoveTraveler(tripTravelerId) {
    setTravelersError(null);
    setTravelersBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        removeTravelerId: tripTravelerId,
      });
      setTrip(updated);
    } catch (err) {
      setTravelersError(err.message);
    } finally {
      setTravelersBusy(false);
    }
  }

  async function handleAddTripOnlyTraveler(event) {
    event.preventDefault();
    setTravelersError(null);
    setTravelersBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        addTripOnlyTraveler: tripOnlyForm,
      });
      setTrip(updated);
      setTripOnlyForm({ travelerName: '', ageGroup: '' });
    } catch (err) {
      setTravelersError(err.message);
    } finally {
      setTravelersBusy(false);
    }
  }

  async function handleAddChild(event) {
    event.preventDefault();
    setTravelersError(null);
    setTravelersBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        addChildAge: Number(childAge),
      });
      setTrip(updated);
      setChildAge('');
    } catch (err) {
      setTravelersError(err.message);
    } finally {
      setTravelersBusy(false);
    }
  }

  async function handleRemoveChild(childId) {
    setTravelersError(null);
    setTravelersBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, { removeChildId: childId });
      setTrip(updated);
    } catch (err) {
      setTravelersError(err.message);
    } finally {
      setTravelersBusy(false);
    }
  }

  async function handleContinueTravelers() {
    setTravelersError(null);
    setTravelersBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        wizardStep: TRAVELERS_COMPLETE_STEP,
      });
      setTrip(updated);
      setEditingTravelers(false);
    } catch (err) {
      setTravelersError(err.message);
    } finally {
      setTravelersBusy(false);
    }
  }

  function startEditQuestionnaire() {
    setQuestionnaireForm(toQuestionnaireForm(trip.tripProfile));
    setQuestionnaireError(null);
    setEditingQuestionnaire(true);
  }

  function handlePreferenceChange(category, value) {
    setQuestionnaireForm((current) => ({
      ...current,
      preferences: { ...current.preferences, [category]: value },
    }));
  }

  async function handleSaveQuestionnaire(event) {
    event.preventDefault();
    setQuestionnaireError(null);
    setQuestionnaireBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        accommodation: {
          hotelBooked:
            questionnaireForm.hotelBooked === ''
              ? undefined
              : questionnaireForm.hotelBooked === 'yes',
          hotelName: questionnaireForm.hotelBooked === 'yes' ? questionnaireForm.hotelName : null,
          hotelArea: questionnaireForm.hotelArea,
        },
        budgetLevel: questionnaireForm.budgetLevel || null,
        paceOverride: questionnaireForm.paceOverride || null,
        preferences: questionnaireForm.preferences,
        hardConstraints: questionnaireForm.hardConstraints,
        notes: questionnaireForm.notes,
      });
      setTrip(updated);
    } catch (err) {
      setQuestionnaireError(err.message);
    } finally {
      setQuestionnaireBusy(false);
    }
  }

  async function handleContinueQuestionnaire() {
    setQuestionnaireError(null);
    setQuestionnaireBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        wizardStep: QUESTIONNAIRE_COMPLETE_STEP,
      });
      setTrip(updated);
      setEditingQuestionnaire(false);
    } catch (err) {
      setQuestionnaireError(err.message);
    } finally {
      setQuestionnaireBusy(false);
    }
  }

  async function handleAddMustDo(event) {
    event.preventDefault();
    setQuestionnaireError(null);
    setQuestionnaireBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        mustDo: [...(trip.tripProfile?.mustDo ?? []), mustDoInput.trim()],
      });
      setTrip(updated);
      setMustDoInput('');
    } catch (err) {
      setQuestionnaireError(err.message);
    } finally {
      setQuestionnaireBusy(false);
    }
  }

  async function handleRemoveMustDo(index) {
    setQuestionnaireError(null);
    setQuestionnaireBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        mustDo: (trip.tripProfile?.mustDo ?? []).filter((_, existingIndex) => existingIndex !== index),
      });
      setTrip(updated);
    } catch (err) {
      setQuestionnaireError(err.message);
    } finally {
      setQuestionnaireBusy(false);
    }
  }

  async function handleMarkReady() {
    setReadinessError(null);
    setReadinessBusy(true);
    try {
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        markReadyForGeneration: true,
      });
      setTrip(updated);
    } catch (err) {
      setReadinessError(err.message);
    } finally {
      setReadinessBusy(false);
    }
  }

  async function handleGenerateItinerary() {
    if (generationBusy) return;
    setGenerationError(null);
    setGenerationBusy(true);
    try {
      const { trip: updated } = await apiClient.post(`/trips/${id}/generate-itinerary`);
      setTrip(updated);
    } catch (err) {
      setGenerationError(err.message);
    } finally {
      setGenerationBusy(false);
    }
  }

  async function handleReplanItinerary(event) {
    event.preventDefault();
    if (replanBusy || !replanInstruction.trim()) return;
    setReplanError(null);
    setReplanBusy(true);
    try {
      const { trip: updated } = await apiClient.post(`/trips/${id}/replan-itinerary`, {
        replanInstruction: replanInstruction.trim(),
      });
      setTrip(updated);
      setReplanInstruction('');
    } catch (err) {
      setReplanError(err.message);
    } finally {
      setReplanBusy(false);
    }
  }

  function startEditBasics() {
    setForm(toFormState(trip));
    setFormError(null);
    setEditingBasics(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      // Only advance wizardStep the first time basics are completed — a
      // later re-edit (e.g. from the Review & readiness step) must not
      // regress progress already made on later steps.
      const { trip: updated } = await apiClient.patch(`/trips/${id}`, {
        ...form,
        ...(trip.wizardStep < BASICS_COMPLETE_STEP ? { wizardStep: BASICS_COMPLETE_STEP } : {}),
      });
      setTrip(updated);
      setEditingBasics(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Delete this trip? This can’t be undone.');
    if (!confirmed) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      await apiClient.delete(`/trips/${id}`);
      navigate('/trips');
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  if (loadStatus === 'loading') return <p className="page">Loading…</p>;
  if (loadStatus === 'error')
    return (
      <p role="alert" className="page form-error">
        Couldn&rsquo;t load this trip.
      </p>
    );

  const showForm = editingBasics || trip.wizardStep < BASICS_COMPLETE_STEP;
  const tripTravelers = trip.tripProfile?.travelers ?? [];
  const tripChildren = trip.tripProfile?.children ?? [];
  const showTravelersForm = editingTravelers || trip.wizardStep < TRAVELERS_COMPLETE_STEP;
  const questionnaireUnlocked = trip.wizardStep >= TRAVELERS_COMPLETE_STEP;
  const showQuestionnaireForm =
    questionnaireUnlocked &&
    (editingQuestionnaire || trip.wizardStep < QUESTIONNAIRE_COMPLETE_STEP);
  const mustDoItems = trip.tripProfile?.mustDo ?? [];
  const addedProfileIds = new Set(
    tripTravelers.map((traveler) => traveler.sourceTravelerProfileId),
  );
  const availableProfiles = profiles.filter((profile) => !addedProfileIds.has(profile.id));

  return (
    <main className="page">
      <h1>{trip.tripTitle || trip.destination || 'New trip'}</h1>

      {!showForm && (
        <section aria-labelledby="trip-summary-heading" className="card">
          <h2 id="trip-summary-heading">Trip basics</h2>
          <dl className="summary-list">
            <dt>Destination</dt>
            <dd>{trip.destination}</dd>
            <dt>Dates</dt>
            <dd>
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              {trip.duration ? ` (${trip.duration} days)` : ''}
            </dd>
            {trip.tripTitle && (
              <>
                <dt>Trip title</dt>
                <dd>{trip.tripTitle}</dd>
              </>
            )}
          </dl>
          <div className="form-actions">
            <button type="button" className="btn" onClick={startEditBasics}>
              Edit
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete trip'}
            </button>
          </div>
          {deleteError && (
            <p role="alert" className="form-error">
              {deleteError}
            </p>
          )}
        </section>
      )}

      {!showForm && (
        <section aria-labelledby="trip-travelers-heading" className="card">
          <h2 id="trip-travelers-heading">Travelers</h2>

          {tripTravelers.length > 0 && (
            <ul className="list-reset">
              {tripTravelers.map((traveler) => (
                <li key={traveler.id} className="item-row">
                  <span className="item-row-label">
                    {traveler.travelerName || 'Unnamed traveler'}
                    {traveler.ageGroup ? ` (${traveler.ageGroup})` : ''}
                  </span>
                  {showTravelersForm && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveTraveler(traveler.id)}
                      disabled={travelersBusy}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {tripTravelers.length === 0 && <p>No travelers added yet.</p>}

          {showTravelersForm && (
            <>
              {availableProfiles.length > 0 && (
                <ul className="list-reset">
                  {availableProfiles.map((profile) => (
                    <li key={profile.id} className="item-row">
                      <span className="item-row-label">{profile.profileName}</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleAddTraveler(profile.id)}
                        disabled={travelersBusy}
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleAddTripOnlyTraveler}>
                <div className="field">
                  <label htmlFor="trip-only-traveler-name">
                    Add a traveler without a saved profile
                  </label>
                  <input
                    id="trip-only-traveler-name"
                    className="input"
                    placeholder="Name"
                    maxLength={100}
                    value={tripOnlyForm.travelerName}
                    onChange={(event) =>
                      setTripOnlyForm((current) => ({ ...current, travelerName: event.target.value }))
                    }
                  />
                </div>
                <select
                  aria-label="Age group"
                  className="input"
                  style={{ marginBottom: 'var(--space-4)' }}
                  value={tripOnlyForm.ageGroup}
                  onChange={(event) =>
                    setTripOnlyForm((current) => ({ ...current, ageGroup: event.target.value }))
                  }
                >
                  <option value="">Not specified</option>
                  {AGE_GROUPS.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn"
                  disabled={travelersBusy || !tripOnlyForm.travelerName.trim()}
                >
                  Add traveler
                </button>
              </form>

              {travelersError && (
                <p role="alert" className="form-error">
                  {travelersError}
                </p>
              )}
              <div className="form-actions">
                {trip.wizardStep >= TRAVELERS_COMPLETE_STEP ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEditingTravelers(false)}
                    disabled={travelersBusy}
                  >
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleContinueTravelers}
                    disabled={travelersBusy}
                  >
                    Continue
                  </button>
                )}
              </div>
            </>
          )}
          {!showTravelersForm && (
            <button type="button" className="btn" onClick={() => setEditingTravelers(true)}>
              Edit travelers
            </button>
          )}
        </section>
      )}

      {!showForm && (
        <section aria-labelledby="trip-children-heading" className="card">
          <h2 id="trip-children-heading">Children</h2>

          {tripChildren.length > 0 && (
            <ul className="list-reset">
              {tripChildren.map((child) => (
                <li key={child.id} className="item-row">
                  <span className="item-row-label">Age {child.age}</span>
                  {showTravelersForm && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveChild(child.id)}
                      disabled={travelersBusy}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {tripChildren.length === 0 && <p>Not traveling with children.</p>}

          {showTravelersForm && (
            <form onSubmit={handleAddChild} style={{ marginTop: 'var(--space-4)' }}>
              <div className="field">
                <label htmlFor="child-age">Add a child&rsquo;s age</label>
                <input
                  id="child-age"
                  type="number"
                  className="input"
                  min={CHILD_MIN_AGE}
                  max={CHILD_MAX_AGE}
                  value={childAge}
                  onChange={(event) => setChildAge(event.target.value)}
                />
              </div>
              <button type="submit" className="btn" disabled={travelersBusy || childAge === ''}>
                Add child
              </button>
            </form>
          )}
        </section>
      )}

      {!showForm && questionnaireUnlocked && (
        <section aria-labelledby="trip-questionnaire-heading" className="card">
          <h2 id="trip-questionnaire-heading">Trip details</h2>

          {!showQuestionnaireForm && (
            <>
              <dl className="summary-list">
                <dt>Hotel booked</dt>
                <dd>
                  {trip.tripProfile?.accommodation?.hotelBooked === true
                    ? `Yes${trip.tripProfile.accommodation.hotelName ? ` — ${trip.tripProfile.accommodation.hotelName}` : ''}`
                    : trip.tripProfile?.accommodation?.hotelBooked === false
                      ? 'No'
                      : 'Not specified'}
                </dd>
                <dt>
                  {trip.tripProfile?.accommodation?.hotelBooked === true
                    ? 'Hotel address/area'
                    : 'Preferred area/neighborhood'}
                </dt>
                <dd>{trip.tripProfile?.accommodation?.hotelArea || 'Not specified'}</dd>
                <dt>Budget level</dt>
                <dd>{trip.tripProfile?.budgetLevel || 'Not specified'}</dd>
                <dt>Pace override</dt>
                <dd>{trip.tripProfile?.paceOverride || "Use each traveler's own pace"}</dd>
                <dt>Trip preferences</dt>
                <dd>{formatPreferencesSummary(trip.tripProfile?.preferences)}</dd>
                <dt>Trip-specific constraints</dt>
                <dd>{trip.tripProfile?.hardConstraints || 'None specified.'}</dd>
                <dt>Notes</dt>
                <dd>{trip.tripProfile?.notes || 'None specified.'}</dd>
              </dl>
              <p style={{ marginBottom: 'var(--space-4)' }}>
                Must-do: {mustDoItems.length > 0 ? mustDoItems.join(', ') : 'None specified.'}
              </p>
              <button type="button" className="btn" onClick={startEditQuestionnaire}>
                Edit trip details
              </button>
            </>
          )}

          {showQuestionnaireForm && questionnaireForm && (
            <>
              <form onSubmit={handleSaveQuestionnaire}>
                <fieldset>
                  <legend>Hotel already booked?</legend>
                  <select
                    id="hotel-booked"
                    aria-label="Hotel already booked?"
                    className="input"
                    value={questionnaireForm.hotelBooked}
                    onChange={(event) =>
                      setQuestionnaireForm((current) => ({
                        ...current,
                        hotelBooked: event.target.value,
                      }))
                    }
                  >
                    <option value="">Not specified</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  {questionnaireForm.hotelBooked === 'yes' && (
                    <div className="field">
                      <label htmlFor="hotel-name">Hotel name</label>
                      <input
                        id="hotel-name"
                        className="input"
                        maxLength={200}
                        value={questionnaireForm.hotelName}
                        onChange={(event) =>
                          setQuestionnaireForm((current) => ({
                            ...current,
                            hotelName: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="hotel-area">
                      {questionnaireForm.hotelBooked === 'yes'
                        ? 'Hotel address/area (optional)'
                        : 'Preferred area/neighborhood (optional)'}
                    </label>
                    <input
                      id="hotel-area"
                      className="input"
                      maxLength={200}
                      value={questionnaireForm.hotelArea}
                      onChange={(event) =>
                        setQuestionnaireForm((current) => ({
                          ...current,
                          hotelArea: event.target.value,
                        }))
                      }
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Budget level</legend>
                  {BUDGET_LEVELS.map((level) => (
                    <div key={level.value} className="pref-option" style={{ marginBottom: 'var(--space-2)' }}>
                      <input
                        type="radio"
                        id={`budget-${level.value}`}
                        name="budget-level"
                        value={level.value}
                        checked={questionnaireForm.budgetLevel === level.value}
                        onChange={() =>
                          setQuestionnaireForm((current) => ({
                            ...current,
                            budgetLevel: level.value,
                          }))
                        }
                      />
                      <label htmlFor={`budget-${level.value}`}>
                        {level.label} — {level.description}
                      </label>
                    </div>
                  ))}
                </fieldset>

                <div className="field">
                  <label htmlFor="pace-override">Pace override</label>
                  <select
                    id="pace-override"
                    className="input"
                    value={questionnaireForm.paceOverride}
                    onChange={(event) =>
                      setQuestionnaireForm((current) => ({
                        ...current,
                        paceOverride: event.target.value,
                      }))
                    }
                  >
                    <option value="">Use each traveler&rsquo;s own pace</option>
                    {PACE_OPTIONS.map((pace) => (
                      <option key={pace} value={pace}>
                        {pace}
                      </option>
                    ))}
                  </select>
                </div>

                <GroupedPreferenceSelector
                  idPrefix="trip-pref"
                  groups={PREFERENCE_GROUPS}
                  values={questionnaireForm.preferences}
                  onChange={handlePreferenceChange}
                />

                <div className="field">
                  <label htmlFor="trip-hard-constraints">Trip-specific constraints</label>
                  <textarea
                    id="trip-hard-constraints"
                    className="input"
                    rows={3}
                    maxLength={500}
                    value={questionnaireForm.hardConstraints}
                    onChange={(event) =>
                      setQuestionnaireForm((current) => ({
                        ...current,
                        hardConstraints: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="trip-notes">Anything else for this trip?</label>
                  <textarea
                    id="trip-notes"
                    className="input"
                    rows={3}
                    maxLength={1000}
                    value={questionnaireForm.notes}
                    onChange={(event) =>
                      setQuestionnaireForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </div>

                {questionnaireError && (
                  <p role="alert" className="form-error">
                    {questionnaireError}
                  </p>
                )}
                <button type="submit" className="btn btn-primary" disabled={questionnaireBusy}>
                  Save trip details
                </button>
              </form>

              <div style={{ marginTop: 'var(--space-6)' }}>
                <h3 style={{ marginBottom: 'var(--space-1)' }}>Must-do items</h3>
                {mustDoItems.length > 0 && (
                  <div className="chip-row">
                    {mustDoItems.map((item, index) => (
                      <span key={`${index}-${item}`} className="chip">
                        {item}
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() => handleRemoveMustDo(index)}
                          disabled={questionnaireBusy}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {mustDoItems.length === 0 && <p>No must-do items yet.</p>}
                <form onSubmit={handleAddMustDo} className="chip-add-row">
                  <input
                    id="must-do-item"
                    aria-label="Add a must-do item"
                    className="input"
                    placeholder="Add a must-do…"
                    maxLength={MUST_DO_MAX_LENGTH}
                    value={mustDoInput}
                    onChange={(event) => setMustDoInput(event.target.value)}
                  />
                  <button type="submit" className="btn" disabled={questionnaireBusy || !mustDoInput.trim()}>
                    Add must-do
                  </button>
                </form>
              </div>

              <div className="form-actions" style={{ marginTop: 'var(--space-6)' }}>
                {trip.wizardStep >= QUESTIONNAIRE_COMPLETE_STEP ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEditingQuestionnaire(false)}
                    disabled={questionnaireBusy}
                  >
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleContinueQuestionnaire}
                    disabled={questionnaireBusy}
                  >
                    Continue
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {!showForm &&
        !showTravelersForm &&
        !showQuestionnaireForm &&
        trip.wizardStep >= QUESTIONNAIRE_COMPLETE_STEP && (
          <section aria-labelledby="trip-readiness-heading" className="card">
            <h2 id="trip-readiness-heading">Review &amp; readiness</h2>
            <p className="status-pill" style={{ marginBottom: 'var(--space-3)' }}>
              Status: {trip.status}
            </p>
            {trip.status === 'DRAFT' && (
              <>
                <p style={{ marginBottom: 'var(--space-3)' }}>
                  Review the sections above, then mark this trip ready for generation.
                </p>
                <button type="button" className="btn btn-primary" onClick={handleMarkReady} disabled={readinessBusy}>
                  {readinessBusy ? 'Marking ready…' : 'Mark ready for generation'}
                </button>
              </>
            )}
            {trip.status === 'READY_FOR_GENERATION' && (
              <>
                <p style={{ marginBottom: 'var(--space-3)' }}>This trip is ready for itinerary generation.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGenerateItinerary}
                  disabled={generationBusy}
                >
                  {generationBusy ? 'Generating itinerary…' : 'Generate itinerary'}
                </button>
                {generationError && (
                  <p role="alert" className="form-error">
                    {generationError}
                  </p>
                )}
              </>
            )}
            {readinessError && (
              <p role="alert" className="form-error">
                {readinessError}
              </p>
            )}
          </section>
        )}

      {!showForm && trip.status === 'PLANNED' && trip.currentItinerary && (
        <section aria-labelledby="trip-replan-heading" className="card">
          <h2 id="trip-replan-heading">Replan with AI</h2>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            Describe a change in your own words and get a complete revised itinerary.
          </p>
          <form onSubmit={handleReplanItinerary} noValidate>
            <div className="field">
              <label htmlFor="replanInstruction">What would you like to change?</label>
              <textarea
                id="replanInstruction"
                value={replanInstruction}
                onChange={(event) => setReplanInstruction(event.target.value)}
                maxLength={REPLAN_INSTRUCTION_MAX_LENGTH}
                rows={3}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={replanBusy || !replanInstruction.trim()}
            >
              {replanBusy ? 'Replanning…' : 'Replan itinerary'}
            </button>
            {replanError && (
              <p role="alert" className="form-error">
                {replanError}
              </p>
            )}
          </form>
        </section>
      )}

      {!showForm && trip.currentItinerary && (
        <ItineraryView tripId={id} itinerary={trip.currentItinerary} onUpdate={setTrip} />
      )}

      {showForm && (
        <section aria-labelledby="trip-basics-heading" className="card">
          <h2 id="trip-basics-heading">Trip basics</h2>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="destination">Destination</label>
              <input
                id="destination"
                className="input"
                required
                maxLength={200}
                value={form?.destination ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, destination: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="start-date">Start date</label>
              <input
                id="start-date"
                type="date"
                className="input"
                required
                value={form?.startDate ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="end-date">End date</label>
              <input
                id="end-date"
                type="date"
                className="input"
                required
                value={form?.endDate ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="trip-title">Trip title (optional)</label>
              <input
                id="trip-title"
                className="input"
                maxLength={100}
                value={form?.tripTitle ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, tripTitle: event.target.value }))
                }
              />
            </div>
            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save and continue'}
              </button>
              {trip.wizardStep >= BASICS_COMPLETE_STEP && (
                <button type="button" className="btn" onClick={() => setEditingBasics(false)} disabled={submitting}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
