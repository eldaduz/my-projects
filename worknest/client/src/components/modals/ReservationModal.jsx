import { useEffect, useRef, useState } from 'react';
import { getBranchById } from '../../api/branchesApi.js';
import { createReservation } from '../../api/reservationsApi.js';
import { getWorkspaceById } from '../../api/workspacesApi.js';
import {
  getBranchDisplayName,
  getWorkspaceDisplayName,
  getWorkspaceImagePaths,
} from '../../utils/displayLabels.js';
import { isSessionErrorMessage, mapReservationErrorMessage } from '../../utils/errorMessages.js';
import Modal from './Modal.jsx';

const TOKEN_STORAGE_KEY = 'worknestToken';
const RESERVATION_SESSION_EXPIRED_MESSAGE =
  'פג תוקף ההתחברות. יש להתחבר מחדש כדי להשלים את ההזמנה.';

// ── Date Helpers ────────────────────────────────────────────────────────

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isBeforeToday(dateValue, todayDateString) {
  return Boolean(dateValue) && dateValue < todayDateString;
}

function isEndDateInvalid(startValue, endValue) {
  return Boolean(startValue && endValue) && endValue <= startValue;
}

function formatDisplayDate(dateString) {
  if (!dateString || !dateString.includes('-')) {
    return dateString;
  }

  const [year, month, day] = dateString.split('-');
  return `${day}-${month}-${year}`;
}

function formatFriendlyReservationNumber(reservationId) {
  return reservationId ? `WN-${reservationId.slice(-6)}` : '';
}

function getReservationDayCount(startDate, endDate) {
  if (!startDate || !endDate) {
    return '';
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const differenceInMilliseconds = end.getTime() - start.getTime();
  const dayCount = differenceInMilliseconds / (1000 * 60 * 60 * 24);

  return Number.isFinite(dayCount) && dayCount > 0 ? dayCount : '';
}

// ── Main Modal Component ────────────────────────────────────────────────
// Two-panel structure: form panel (date selection + booking) or success panel (confirmation).
// createdReservation state drives which panel is visible.
export default function ReservationModal({
  isOpen,
  branchId,
  workspaceId,
  currentPath,
  currentUser,
  pendingInlineProtectedAction,
  onInlineProtectedActionSessionExpired,
  onPendingInlineProtectedActionHandled,
  onClose,
}) {
  const [createdReservation, setCreatedReservation] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setCreatedReservation(null);
    }
  }, [isOpen]);

  function navigateTo(path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function handleClose() {
    setCreatedReservation(null);
    onClose?.();
  }

  function handleSuccessNavigation(path) {
    setCreatedReservation(null);
    onClose?.();
    navigateTo(path);
  }

  return (
    <Modal
      isOpen={isOpen}
      title={createdReservation ? 'ההזמנה נשמרה בהצלחה' : 'הזמנה מהירה'}
      onClose={handleClose}
    >
      <div className="reservation-modal-content">
        {createdReservation ? (
          <ReservationSuccessPanel
            reservationDetails={createdReservation}
            onGoToMyReservations={() => handleSuccessNavigation('/my-reservations')}
          />
        ) : (
          <ReservationFormPanel
            branchId={branchId}
            workspaceId={workspaceId}
            currentPath={currentPath}
            currentUser={currentUser}
            pendingInlineProtectedAction={pendingInlineProtectedAction}
            onInlineProtectedActionSessionExpired={onInlineProtectedActionSessionExpired}
            onPendingInlineProtectedActionHandled={onPendingInlineProtectedActionHandled}
            onReservationCreated={setCreatedReservation}
          />
        )}
      </div>
    </Modal>
  );
}

// ── Custom Date Input ─────────────────────────────────────────────────────
// Wraps a native <input type="date"> with a styled button shell.
// The native input is hidden; clicking the button opens the browser date picker.
function DateField({ id, label, value, min, onChange }) {
  const inputRef = useRef(null);

  function formatDisplayDate(dateValue) {
    if (!dateValue) {
      return '';
    }

    const [year, month, day] = dateValue.split('-');
    if (!year || !month || !day) {
      return dateValue;
    }

    return `${day}/${month}/${year}`;
  }

  function openNativePicker() {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openNativePicker();
  }

  return (
    <div className="auth-field">
      <label className="auth-field-label" htmlFor={id}>
        {label}
      </label>
      <button
        type="button"
        className="date-input-shell"
        onClick={openNativePicker}
        onKeyDown={handleKeyDown}
        aria-label={label}
      >
        <span className={`date-input-value${value ? '' : ' date-input-value-empty'}`}>
          {formatDisplayDate(value)}
        </span>
        <span className="date-input-icon" aria-hidden="true">
          ⌄
        </span>
      </button>
      <input
        ref={inputRef}
        className="date-input-native"
        id={id}
        type="date"
        lang="he-IL"
        value={value}
        min={min}
        onChange={onChange}
        required
        tabIndex={-1}
        aria-hidden="true"
      />
      <span className="date-input-hint">יום / חודש / שנה</span>
    </div>
  );
}

// ── Reservation Form Panel ────────────────────────────────────────────────
// Flow: load branch+workspace data → user picks dates → submit to server.
// If the session expires mid-flow, the action is saved for retry after re-login.
export function ReservationFormPanel({
  branchId,
  workspaceId,
  currentPath,
  currentUser,
  pendingInlineProtectedAction,
  onInlineProtectedActionSessionExpired,
  onPendingInlineProtectedActionHandled,
  onReservationCreated,
}) {
  const [branch, setBranch] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pageErrorMessage, setPageErrorMessage] = useState('');
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const todayDateString = getTodayDateString();

  useEffect(() => {
    if (!branchId || !workspaceId) {
      setBranch(null);
      setWorkspace(null);
      setPageErrorMessage('יש לבחור חלל עבודה לפני יצירת הזמנה.');
      setIsLoading(false);
      return;
    }

    async function loadReservationSelection() {
      setIsLoading(true);
      setPageErrorMessage('');
      setSubmitErrorMessage('');
      setStartDate('');
      setEndDate('');

      // Load branch and workspace details in parallel for the reservation summary.
      try {
        const [branchResponse, workspaceResponse] = await Promise.all([
          getBranchById(branchId),
          getWorkspaceById(workspaceId),
        ]);

        setBranch(branchResponse.data.branch);
        setWorkspace(workspaceResponse.data.workspace);
      } catch (error) {
        setBranch(null);
        setWorkspace(null);
        setPageErrorMessage('משהו השתבש. נסו שוב בעוד רגע.');
      } finally {
        setIsLoading(false);
      }
    }

    loadReservationSelection();
  }, [branchId, workspaceId]);

  // Core booking function. Validates dates client-side, then sends to server.
  // On 401 (session expired), triggers the re-login flow instead of showing a generic error.
  async function performReservationCreate(options = {}) {
    const { shouldRetryAfterLogin = false, retryCount = 0 } = options;

    setSubmitErrorMessage('');
    setIsSubmitting(true);

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (isBeforeToday(startDate, todayDateString)) {
      setSubmitErrorMessage('יש לבחור תאריך התחלה מהיום ואילך.');
      setIsSubmitting(false);
      return;
    }

    if (isEndDateInvalid(startDate, endDate)) {
      setSubmitErrorMessage('תאריך הסיום חייב להיות אחרי תאריך ההתחלה.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await createReservation(
        {
          branchId,
          workspaceId,
          startDate,
          endDate,
        },
        token,
      );

      onPendingInlineProtectedActionHandled?.();
      onReservationCreated?.({
        reservation: response.data.reservation,
        branchName: getBranchDisplayName(branch.name),
        workspaceName: getWorkspaceDisplayName(workspace.name),
        suitablePeopleCount: workspace.capacity,
        workspaceImageUrl: workspace.imageUrl || '',
        branchImageUrl: branch.imageUrl || '',
      });
    } catch (error) {
      // Session expired during booking — notify App to open the login modal
      // and store this action so it can be retried after re-login.
      if (error.status === 401 || isSessionErrorMessage(error.message)) {
        setSubmitErrorMessage(RESERVATION_SESSION_EXPIRED_MESSAGE);
        onInlineProtectedActionSessionExpired?.({
          type: 'reservation-create',
          path: currentPath,
          branchId,
          workspaceId,
          message: RESERVATION_SESSION_EXPIRED_MESSAGE,
          retryCount,
        });
        return;
      }

      setSubmitErrorMessage(mapReservationErrorMessage(error.message));

      if (shouldRetryAfterLogin) {
        onPendingInlineProtectedActionHandled?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await performReservationCreate();
  }

  // Auto-retry effect: after the user re-logs in, this effect detects the pending action
  // and re-submits the reservation automatically (once).
  useEffect(() => {
    if (
      !currentUser ||
      pendingInlineProtectedAction?.type !== 'reservation-create' ||
      pendingInlineProtectedAction.branchId !== branchId ||
      pendingInlineProtectedAction.workspaceId !== workspaceId ||
      !startDate ||
      !endDate ||
      isLoading ||
      isSubmitting
    ) {
      return;
    }

    void performReservationCreate({
      shouldRetryAfterLogin: true,
      retryCount: pendingInlineProtectedAction.retryCount ?? 0,
    });
  }, [
    branchId,
    currentUser,
    endDate,
    isLoading,
    isSubmitting,
    pendingInlineProtectedAction,
    startDate,
    workspaceId,
  ]);

  if (isLoading) {
    return <p className="modal-status-text">טוען את פרטי ההזמנה...</p>;
  }

  if (pageErrorMessage || !branch || !workspace) {
    return (
      <p className="auth-error-message">{pageErrorMessage || 'לא ניתן לטעון את טופס ההזמנה.'}</p>
    );
  }

  return (
    <form className="reservation-panel" onSubmit={handleSubmit}>
      <div className="reservation-panel-main">
        <div className="reservation-summary-card">
          <p className="placeholder-label">סיכום בחירה</p>
          <p className="info-copy">סניף: {getBranchDisplayName(branch.name)}</p>
          <p className="info-copy">חלל עבודה: {getWorkspaceDisplayName(workspace.name)}</p>
          <p className="info-copy">מתאים ל־{workspace.capacity} אנשים</p>
          <p className="info-copy">מחיר ליום ללא מע״מ: ₪{workspace.pricePerDay}</p>
        </div>

        <div className="auth-modal-form reservation-form-fields">
          <DateField
            id="reservation-start-date"
            label="תאריך התחלה"
            value={startDate}
            min={todayDateString}
            onChange={(event) => {
              const nextStartDate = event.target.value;
              setStartDate(nextStartDate);

              if (isEndDateInvalid(nextStartDate, endDate)) {
                setEndDate('');
              }
            }}
          />

          <DateField
            id="reservation-end-date"
            label="תאריך סיום (לא כולל)"
            value={endDate}
            min={startDate || todayDateString}
            onChange={(event) => setEndDate(event.target.value)}
          />

          <p className="auth-modal-note">
            להזמנה של יום אחד, בחרו תאריך התחלה היום ותאריך סיום מחר.
          </p>

          <p className="status-note">הזמינות והמחיר הסופי יאושרו על ידי המערכת לאחר שליחת הבקשה.</p>

          {submitErrorMessage ? <p className="auth-error-message">{submitErrorMessage}</p> : null}
        </div>
      </div>

      <div className="reservation-panel-footer">
        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? 'שולח הזמנה...' : 'שליחת הזמנה'}
        </button>
      </div>
    </form>
  );
}

// ── Success Panel ─────────────────────────────────────────────────────────
// Shown after a successful booking. Displays confirmation details and a navigation link.
function ReservationSuccessPanel({ reservationDetails, onGoToMyReservations }) {
  const {
    reservation,
    branchName,
    workspaceName,
    suitablePeopleCount,
    workspaceImageUrl,
    branchImageUrl,
  } = reservationDetails;
  const reservationDayCount = getReservationDayCount(reservation.startDate, reservation.endDate);
  const imageCandidates = [
    ...getWorkspaceImagePaths(workspaceName),
    workspaceImageUrl,
    branchImageUrl,
  ].filter(Boolean);
  const uniqueImageCandidates = [...new Set(imageCandidates)];
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [workspaceImageUrl, branchImageUrl, reservation.id]);

  const activeImageUrl = uniqueImageCandidates[activeImageIndex] || '';

  function handleImageError() {
    setActiveImageIndex((currentIndex) => {
      if (currentIndex >= uniqueImageCandidates.length - 1) {
        return uniqueImageCandidates.length;
      }

      return currentIndex + 1;
    });
  }

  return (
    <div className="reservation-panel reservation-success-panel">
      <div className="reservation-panel-main">
        {activeImageUrl ? (
          <div className="reservation-success-image-strip">
            <img
              className="reservation-success-image"
              src={activeImageUrl}
              alt={workspaceName || branchName}
              onError={handleImageError}
            />
          </div>
        ) : null}

        <div className="reservation-summary-card reservation-success-card">
          <p className="placeholder-label">
            מספר הזמנה: {formatFriendlyReservationNumber(reservation.id)}
          </p>
          <p className="info-copy">סניף: {branchName}</p>
          <p className="info-copy">חלל עבודה: {workspaceName}</p>
          {suitablePeopleCount ? (
            <p className="info-copy">מתאים ל־{suitablePeopleCount} אנשים</p>
          ) : null}
          <p className="info-copy">תאריך התחלה: {formatDisplayDate(reservation.startDate)}</p>
          <p className="info-copy">תאריך סיום: {formatDisplayDate(reservation.endDate)}</p>
          {reservationDayCount ? (
            <p className="info-copy">מספר ימי הזמנה: {reservationDayCount}</p>
          ) : null}
          <p className="info-copy">מחיר ליום ללא מע״מ: ₪{reservation.pricePerDayAtBooking}</p>
          <p className="info-copy">סה״כ לתשלום כולל מע״מ: ₪{reservation.totalPrice}</p>
        </div>
      </div>

      <div className="reservation-panel-footer reservation-success-actions">
        <button type="button" className="button-link" onClick={onGoToMyReservations}>
          ההזמנות שלי
        </button>
      </div>
    </div>
  );
}
