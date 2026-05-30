import { useEffect, useState } from 'react';
import { cancelReservation, getMyReservations } from '../api/reservationsApi.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import Modal from '../components/modals/Modal.jsx';
import { isSessionErrorMessage, mapReservationErrorMessage } from '../utils/errorMessages.js';
import { getBranchDisplayName, getReservationStatusLabel } from '../utils/displayLabels.js';

const TOKEN_STORAGE_KEY = 'worknestToken';
const CANCEL_RESERVATION_ERROR_MESSAGE = 'לא ניתן לבטל את ההזמנה כרגע. נסו שוב בעוד רגע.';
const CANCEL_RESERVATION_SESSION_EXPIRED_MESSAGE =
  'פג תוקף ההתחברות. יש להתחבר מחדש כדי להשלים את הביטול.';

function formatDisplayDate(dateString) {
  if (!dateString || !dateString.includes('-')) {
    return dateString;
  }

  const [year, month, day] = dateString.split('-');
  return `${day}-${month}-${year}`;
}

function formatFriendlyReservationNumber(reservationId) {
  return `WN-${reservationId.slice(-6)}`;
}

function getReservationStatusPriority(status) {
  return status === 'cancelled' ? 1 : 0;
}

function compareReservationDates(firstDate, secondDate) {
  if (!firstDate && !secondDate) {
    return 0;
  }

  if (!firstDate) {
    return 1;
  }

  if (!secondDate) {
    return -1;
  }

  return firstDate.localeCompare(secondDate);
}

function matchesStatusFilter(reservation, statusFilter) {
  return statusFilter === 'all' || reservation.status === statusFilter;
}

export default function MyReservationsPage({
  currentUser,
  pendingInlineProtectedAction,
  onInlineProtectedActionSessionExpired,
  onPendingInlineProtectedActionHandled,
}) {
  const [reservations, setReservations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [cancelErrorMessage, setCancelErrorMessage] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  async function loadReservations(nextStatusFilter = statusFilter) {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const apiStatus = nextStatusFilter === 'all' ? undefined : nextStatusFilter;
      const response = await getMyReservations(token, apiStatus);
      setReservations(response.data.reservations);
    } catch (error) {
      setErrorMessage(mapReservationErrorMessage(error.message));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReservations(statusFilter);
  }, [statusFilter]);

  function openCancelModal(reservation) {
    setCancelErrorMessage('');
    setSelectedReservation(reservation);
  }

  function closeCancelModal() {
    if (isCancelling) {
      return;
    }

    setCancelErrorMessage('');
    setSelectedReservation(null);
    onPendingInlineProtectedActionHandled?.();
  }

  function applyCancelledReservationUpdate(reservationToCancel, cancelledReservation) {
    setReservations((currentReservations) =>
      currentReservations.map((reservation) => {
        if (reservation.id !== reservationToCancel.id) {
          return reservation;
        }

        return cancelledReservation
          ? {
              ...reservation,
              ...cancelledReservation,
            }
          : {
              ...reservation,
              status: 'cancelled',
            };
      }),
    );
  }

  async function performCancellation(reservationToCancel, options = {}) {
    const { shouldRetryAfterLogin = false, retryCount = 0 } = options;

    if (!reservationToCancel?.id) {
      return;
    }

    setCancelErrorMessage('');
    setSelectedReservation(reservationToCancel);
    setIsCancelling(true);

    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const response = await cancelReservation(reservationToCancel.id, token);
      const cancelledReservation = response.data?.reservation;

      applyCancelledReservationUpdate(reservationToCancel, cancelledReservation);
      setCancelErrorMessage('');
      setSelectedReservation(null);
      onPendingInlineProtectedActionHandled?.();
    } catch (error) {
      if (error.status === 401 || isSessionErrorMessage(error.message)) {
        setCancelErrorMessage(CANCEL_RESERVATION_SESSION_EXPIRED_MESSAGE);
        onInlineProtectedActionSessionExpired?.({
          type: 'reservation-cancel',
          path: '/my-reservations',
          reservation: reservationToCancel,
          message: CANCEL_RESERVATION_SESSION_EXPIRED_MESSAGE,
          retryCount,
        });
        return;
      }

      const mappedErrorMessage = mapReservationErrorMessage(error.message);
      setCancelErrorMessage(
        mappedErrorMessage === 'משהו השתבש. נסו שוב בעוד רגע.'
          ? CANCEL_RESERVATION_ERROR_MESSAGE
          : mappedErrorMessage,
      );

      if (shouldRetryAfterLogin) {
        onPendingInlineProtectedActionHandled?.();
      }
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleConfirmCancel() {
    await performCancellation(selectedReservation);
  }

  useEffect(() => {
    if (
      !currentUser ||
      pendingInlineProtectedAction?.type !== 'reservation-cancel' ||
      !pendingInlineProtectedAction.reservation ||
      isLoading ||
      isCancelling
    ) {
      return;
    }

    const reservationToCancel =
      reservations.find(
        (reservation) => reservation.id === pendingInlineProtectedAction.reservation.id,
      ) || pendingInlineProtectedAction.reservation;

    void performCancellation(reservationToCancel, {
      shouldRetryAfterLogin: true,
      retryCount: pendingInlineProtectedAction.retryCount ?? 0,
    });
  }, [currentUser, pendingInlineProtectedAction, isLoading, isCancelling, reservations]);

  const sortedReservations = [...reservations].sort((firstReservation, secondReservation) => {
    const statusPriorityDifference =
      getReservationStatusPriority(firstReservation.status) -
      getReservationStatusPriority(secondReservation.status);

    if (statusPriorityDifference !== 0) {
      return statusPriorityDifference;
    }

    const firstBranchName = getBranchDisplayName(firstReservation.branchName || '');
    const secondBranchName = getBranchDisplayName(secondReservation.branchName || '');
    const branchComparison = firstBranchName.localeCompare(secondBranchName, 'he');

    if (branchComparison !== 0) {
      return branchComparison;
    }

    return compareReservationDates(firstReservation.startDate, secondReservation.startDate);
  });
  const visibleReservations = sortedReservations.filter((reservation) =>
    matchesStatusFilter(reservation, statusFilter),
  );

  return (
    <section className="page-section section-stack reservations-page reservations-page-layout">
      <div className="page-header">
        <span className="eyebrow">ההזמנות שלי</span>
        <h1 className="page-title">עמוד ההזמנות שלי</h1>
        <p className="page-description">
          כאן מוצגות ההזמנות שבוצעו על ידי המשתמש המחובר, כולל אפשרות לבטל הזמנה מאושרת.
        </p>
      </div>

      <div className="filter-row">
        <button
          type="button"
          className={statusFilter === 'all' ? 'filter-chip filter-chip-active' : 'filter-chip'}
          onClick={() => setStatusFilter('all')}
        >
          כל ההזמנות
        </button>
        <button
          type="button"
          className={
            statusFilter === 'confirmed' ? 'filter-chip filter-chip-active' : 'filter-chip'
          }
          onClick={() => setStatusFilter('confirmed')}
        >
          מאושרות
        </button>
        <button
          type="button"
          className={
            statusFilter === 'cancelled' ? 'filter-chip filter-chip-active' : 'filter-chip'
          }
          onClick={() => setStatusFilter('cancelled')}
        >
          מבוטלות
        </button>
      </div>

      {!isLoading && errorMessage ? <ErrorMessage message={errorMessage} /> : null}
      {!isLoading && !errorMessage && visibleReservations.length === 0 ? (
        <EmptyState message="אין כרגע הזמנות להצגה." />
      ) : null}

      <div
        className={`data-grid reservations-grid${isLoading ? ' reservations-grid-loading' : ''}`}
      >
        {!isLoading && !errorMessage
          ? visibleReservations.map((reservation) => (
              <article
                key={reservation.id}
                className="data-card reservation-card reservation-card-compact"
              >
                <div className="card-content">
                  <div className="card-header reservation-card-header">
                    <h3 className="card-title reservation-card-title">
                      מספר הזמנה: {formatFriendlyReservationNumber(reservation.id)}
                    </h3>
                    <span
                      className={`reservation-status-badge reservation-status-badge-${reservation.status}`}
                    >
                      {getReservationStatusLabel(reservation.status)}
                    </span>
                  </div>

                  <div className="reservation-summary-list">
                    <p className="reservation-summary-row">
                      <span className="reservation-summary-label">מיקום</span>
                      <span className="reservation-summary-value">
                        {getBranchDisplayName(reservation.branchName)}
                      </span>
                    </p>
                    <p className="reservation-summary-row">
                      <span className="reservation-summary-label">חלל עבודה</span>
                      <span className="reservation-summary-value">{reservation.workspaceName}</span>
                    </p>
                    <p className="reservation-summary-row">
                      <span className="reservation-summary-label">תאריכים</span>
                      <span className="reservation-summary-value">
                        {formatDisplayDate(reservation.startDate)} עד{' '}
                        {formatDisplayDate(reservation.endDate)}
                      </span>
                    </p>
                    <p className="reservation-summary-row">
                      <span className="reservation-summary-label">מחיר ליום ללא מע״מ</span>
                      <span className="reservation-summary-value">
                        ₪{reservation.pricePerDayAtBooking}
                      </span>
                    </p>
                    <p className="reservation-summary-row">
                      <span className="reservation-summary-label">סה״כ לתשלום כולל מע״מ</span>
                      <span className="reservation-summary-value">₪{reservation.totalPrice}</span>
                    </p>
                  </div>

                  {cancelErrorMessage && selectedReservation?.id === reservation.id ? (
                    <p className="auth-error-message reservation-card-error">
                      {cancelErrorMessage}
                    </p>
                  ) : null}

                  {reservation.status === 'confirmed' ? (
                    <div className="card-actions reservation-card-actions">
                      <button
                        type="button"
                        className="button-link-secondary reservation-cancel-button"
                        onClick={() => openCancelModal(reservation)}
                        disabled={isCancelling && selectedReservation?.id === reservation.id}
                      >
                        {isCancelling && selectedReservation?.id === reservation.id
                          ? 'מבטל...'
                          : 'ביטול הזמנה'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          : null}
      </div>

      {isLoading ? (
        <div className="page-buffer-overlay" aria-live="polite" aria-label="טוען את ההזמנות">
          <div className="page-buffer-loader">
            <span className="page-buffer-dot" />
            <span className="page-buffer-dot" />
            <span className="page-buffer-dot" />
          </div>
        </div>
      ) : null}

      <Modal isOpen={Boolean(selectedReservation)} title="ביטול הזמנה" onClose={closeCancelModal}>
        <div className="section-stack compact-stack">
          <p className="placeholder-copy">האם לבטל את ההזמנה?</p>
          <p className="placeholder-copy confirm-modal-helper">
            לאחר הביטול לא ניתן יהיה להשתמש בהזמנה.
          </p>

          {cancelErrorMessage ? <p className="auth-error-message">{cancelErrorMessage}</p> : null}

          <div className="card-actions confirm-modal-actions">
            <button
              type="button"
              className="button-link-secondary"
              onClick={closeCancelModal}
              disabled={isCancelling}
            >
              לא, חזרה
            </button>
            <button
              type="button"
              className="button-link"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? 'מבטל...' : 'כן, בטל הזמנה'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
