import { useEffect, useState } from 'react';
import { getReservationById } from '../api/reservationsApi.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import LoadingState from '../components/ui/LoadingState.jsx';
import { getBranchDisplayName, getReservationStatusLabel } from '../utils/displayLabels.js';
import { mapReservationErrorMessage } from '../utils/errorMessages.js';

const TOKEN_STORAGE_KEY = 'worknestToken';

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

export default function ReservationConfirmationPage({ reservationId }) {
  const [reservation, setReservation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadReservation() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const response = await getReservationById(reservationId, token);
        setReservation(response.data.reservation);
      } catch (error) {
        setErrorMessage(mapReservationErrorMessage(error.message));
      } finally {
        setIsLoading(false);
      }
    }

    loadReservation();
  }, [reservationId]);

  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">אישור הזמנה</span>
        <h1 className="page-title">פרטי ההזמנה נשמרו בהצלחה</h1>
        <p className="page-description">כאן מוצגים פרטי ההזמנה בפועל כפי שחזרו מהשרת.</p>
      </div>

      {isLoading ? <LoadingState message="טוען את פרטי ההזמנה..." /> : null}
      {!isLoading && errorMessage ? <ErrorMessage message={errorMessage} /> : null}
      {!isLoading && !errorMessage && !reservation ? (
        <EmptyState message="ההזמנה לא נמצאה." />
      ) : null}

      {!isLoading && !errorMessage && reservation ? (
        <>
          <article className="hero-card location-summary-card">
            <div className="section-stack compact-stack">
              <p className="placeholder-label">
                מספר הזמנה: {formatFriendlyReservationNumber(reservation.id)}
              </p>
              <p className="info-copy">
                מיקום: {getBranchDisplayName(reservation.branchName) || reservation.branchId}
              </p>
              <p className="info-copy">
                חלל עבודה: {reservation.workspaceName || reservation.workspaceId}
              </p>
              <p className="info-copy">תאריך התחלה: {formatDisplayDate(reservation.startDate)}</p>
              <p className="info-copy">תאריך סיום: {formatDisplayDate(reservation.endDate)}</p>
              <p className="info-copy">סטטוס: {getReservationStatusLabel(reservation.status)}</p>
              <p className="info-copy">מחיר ליום: ₪{reservation.pricePerDayAtBooking}</p>
              <p className="info-copy">סה״כ לתשלום: ₪{reservation.totalPrice}</p>
            </div>
          </article>

          <div className="card-actions">
            <a className="button-link" href="/my-reservations" data-link>
              להזמנות שלי
            </a>
            <a className="button-link-secondary" href="/locations" data-link>
              חזרה למיקומים
            </a>
          </div>
        </>
      ) : null}
    </section>
  );
}
