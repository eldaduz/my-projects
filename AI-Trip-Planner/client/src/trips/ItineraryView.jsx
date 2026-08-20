import { useState } from 'react';
import { apiClient } from '../api/apiClient';
import { formatDate } from '../shared/dateFormat';
import { ACTIVITY_TYPES, PERIODS } from '../shared/activityTypes';

const PERIOD_LABELS = { MORNING: 'Morning', AFTERNOON: 'Afternoon', EVENING: 'Evening' };

// Nominal start-of-period times (minutes from midnight) used only to seed
// the first activity entering that period — not a claim about real hours.
const PERIOD_ANCHOR_MINUTES = { MORNING: 8 * 60, AFTERNOON: 13 * 60, EVENING: 18 * 60 };

function formatClock(minutes) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Estimated time windows, computed here, not stored or AI-generated: chains each
// activity's transferBeforeMinutes + durationMinutes sequentially through the day,
// anchored to a nominal start the first time each period is entered. SYSTEM_DESIGN
// deliberately has the AI not promise exact times (it can't know real opening
// hours/travel times) — this is our own arithmetic on data it already supplied,
// surfaced as an estimate, not a new claim of precision.
function computeActivityWindows(activities) {
  let clock = null;
  let lastPeriod = null;
  return activities.map((activity) => {
    const anchor = PERIOD_ANCHOR_MINUTES[activity.period] ?? PERIOD_ANCHOR_MINUTES.MORNING;
    if (clock === null || activity.period !== lastPeriod) {
      clock = Math.max(clock ?? -Infinity, anchor);
    }
    const start = clock + (activity.transferBeforeMinutes ?? 0);
    const end = start + (activity.durationMinutes ?? 0);
    clock = end;
    lastPeriod = activity.period;
    return { start, end };
  });
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDuration(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const EMPTY_ACTIVITY_FORM = {
  title: '',
  description: '',
  location: '',
  type: '',
  durationMinutes: '',
  period: '',
};

function ActivityForm({
  idPrefix,
  form,
  setForm,
  showPeriod,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
  error,
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="activity-form"
    >
      <div className="field">
        <label htmlFor={`${idPrefix}-title`}>Title</label>
        <input
          id={`${idPrefix}-title`}
          className="input"
          maxLength={200}
          required
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-description`}>Description</label>
        <textarea
          id={`${idPrefix}-description`}
          className="input"
          rows={2}
          maxLength={1000}
          required
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-location`}>Location</label>
        <input
          id={`${idPrefix}-location`}
          className="input"
          maxLength={200}
          required
          value={form.location}
          onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-type`}>Type</label>
        <select
          id={`${idPrefix}-type`}
          className="input"
          required
          value={form.type}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
        >
          <option value="" disabled>
            Choose a type
          </option>
          {ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {titleCase(type)}
            </option>
          ))}
        </select>
      </div>
      {showPeriod && (
        <div className="field">
          <label htmlFor={`${idPrefix}-period`}>Time of day</label>
          <select
            id={`${idPrefix}-period`}
            className="input"
            required
            value={form.period}
            onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
          >
            <option value="" disabled>
              Choose morning, afternoon or evening
            </option>
            {PERIODS.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor={`${idPrefix}-duration`}>Duration (minutes)</label>
        <input
          id={`${idPrefix}-duration`}
          type="number"
          className="input"
          min={10}
          max={720}
          required
          value={form.durationMinutes}
          onChange={(event) =>
            setForm((current) => ({ ...current, durationMinutes: event.target.value }))
          }
        />
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Itinerary display + manual editing (design/Itinerary.dc.html; F15 view, F16 editing).
export function ItineraryView({ tripId, itinerary, onUpdate }) {
  const days = itinerary.days ?? [];
  const [activeDay, setActiveDay] = useState(days[0]?.dayNumber ?? 1);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_ACTIVITY_FORM);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ACTIVITY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const day = days.find((d) => d.dayNumber === activeDay) ?? days[0];
  if (!day) return null;

  async function editItinerary(body) {
    setBusy(true);
    setError(null);
    try {
      const { trip } = await apiClient.patch(`/trips/${tripId}/itinerary`, body);
      onUpdate(trip);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEdit(activity) {
    setEditingId(activity.id);
    setEditForm({
      title: activity.title,
      description: activity.description,
      location: activity.location,
      type: activity.type,
      durationMinutes: activity.durationMinutes,
    });
    setError(null);
  }

  async function saveEdit() {
    const ok = await editItinerary({
      op: 'edit',
      activityId: editingId,
      updates: { ...editForm, durationMinutes: Number(editForm.durationMinutes) },
    });
    if (ok) setEditingId(null);
  }

  async function handleDelete(activity) {
    const confirmed = window.confirm(`Delete "${activity.title}"? This can't be undone.`);
    if (!confirmed) return;
    await editItinerary({ op: 'delete', activityId: activity.id });
  }

  async function handleReorder(activity, direction) {
    await editItinerary({ op: 'reorder', activityId: activity.id, direction });
  }

  async function handleMove(activity, toDayNumber) {
    if (!toDayNumber || Number(toDayNumber) === activeDay) return;
    await editItinerary({ op: 'move', activityId: activity.id, toDayNumber: Number(toDayNumber) });
  }

  async function saveAdd() {
    const ok = await editItinerary({
      op: 'add',
      dayNumber: activeDay,
      activity: { ...addForm, durationMinutes: Number(addForm.durationMinutes) },
    });
    if (ok) {
      setAdding(false);
      setAddForm(EMPTY_ACTIVITY_FORM);
    }
  }

  return (
    <section aria-labelledby="itinerary-heading" className="card">
      <h2 id="itinerary-heading">Itinerary</h2>

      <div role="tablist" aria-label="Trip days" className="day-tabs">
        {days.map((d) => (
          <button
            key={d.dayNumber}
            type="button"
            role="tab"
            aria-selected={d.dayNumber === activeDay}
            className={`day-tab${d.dayNumber === activeDay ? ' is-active' : ''}`}
            onClick={() => {
              setActiveDay(d.dayNumber);
              setEditingId(null);
              setAdding(false);
              setError(null);
            }}
          >
            <span className="day-tab-num">Day {d.dayNumber}</span>
            <span className="day-tab-date">{formatDate(d.date, { year: undefined })}</span>
          </button>
        ))}
      </div>

      <h3 style={{ marginBottom: '2px' }}>{day.title}</h3>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>{day.summary}</p>
      <p className="activity-transfer" style={{ marginBottom: 'var(--space-4)' }}>
        Times below are estimated from planned durations, not confirmed schedules.
      </p>

      <div className="activity-list">
        {computeActivityWindows(day.activities).map((window, index) => {
          const activity = day.activities[index];

          if (editingId === activity.id) {
            return (
              <div key={activity.id} className="activity-card">
                <ActivityForm
                  idPrefix={`edit-${activity.id}`}
                  form={editForm}
                  setForm={setEditForm}
                  showPeriod={false}
                  onSubmit={saveEdit}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save changes"
                  busy={busy}
                  error={error}
                />
              </div>
            );
          }

          return (
            <div key={activity.id} className="activity-card">
              <div className="activity-badge">{PERIOD_LABELS[activity.period] ?? activity.period}</div>
              <div className="activity-body">
                <div className="activity-title-row">
                  <h4>{activity.title}</h4>
                  <span className="activity-duration">
                    Est. {formatClock(window.start)}–{formatClock(window.end)}
                  </span>
                </div>
                <p className="activity-meta">
                  {activity.location} · {titleCase(activity.type)} · {formatDuration(activity.durationMinutes)}
                </p>
                <p className="activity-description">{activity.description}</p>
                {activity.transferBeforeMinutes > 0 && (
                  <p className="activity-transfer">
                    {formatDuration(activity.transferBeforeMinutes)} travel before this
                  </p>
                )}
              </div>
              <div className="activity-actions">
                <div className="activity-reorder">
                  <button
                    type="button"
                    aria-label={`Move ${activity.title} earlier`}
                    onClick={() => handleReorder(activity, 'earlier')}
                    disabled={busy || index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${activity.title} later`}
                    onClick={() => handleReorder(activity, 'later')}
                    disabled={busy || index === day.activities.length - 1}
                  >
                    ↓
                  </button>
                </div>
                {days.length > 1 && (
                  <label className="activity-move">
                    <span className="sr-only">Move {activity.title} to a different day</span>
                    <select
                      className="input"
                      value=""
                      disabled={busy}
                      onChange={(event) => handleMove(activity, event.target.value)}
                    >
                      <option value="">Move to day…</option>
                      {days
                        .filter((d) => d.dayNumber !== activeDay)
                        .map((d) => (
                          <option key={d.dayNumber} value={d.dayNumber}>
                            Day {d.dayNumber}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => startEdit(activity)}
                  disabled={busy}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(activity)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="activity-card" style={{ marginTop: 'var(--space-3)' }}>
          <ActivityForm
            idPrefix={`add-${activeDay}`}
            form={addForm}
            setForm={setAddForm}
            showPeriod
            onSubmit={saveAdd}
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
            submitLabel="Add activity"
            busy={busy}
            error={error}
          />
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-dashed"
          style={{ marginTop: 'var(--space-3)', width: '100%' }}
          onClick={() => setAdding(true)}
        >
          + Add activity to this day
        </button>
      )}
    </section>
  );
}
