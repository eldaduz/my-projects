import { getBranchDisplayName, getReservationStatusLabel } from '../../utils/displayLabels.js';

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

export default function ReservationCard({
  reservation,
  onOpenCancel,
  isCancelling,
  actionErrorMessage,
}) {
  const statusLabel = getReservationStatusLabel(reservation.status);

  return (
    <article className="data-card reservation-card">
      <div className="card-content">
        <div className="card-header">
          <h3 className="card-title">
            מספר הזמנה: {formatFriendlyReservationNumber(reservation.id)}
          </h3>
          <span className="card-rating">{statusLabel}</span>
        </div>

        <p className="card-meta">מיקום: {getBranchDisplayName(reservation.branchName)}</p>
        <p className="card-meta">חלל עבודה: {reservation.workspaceName}</p>
        <p className="card-meta">תאריך התחלה: {formatDisplayDate(reservation.startDate)}</p>
        <p className="card-meta">תאריך סיום: {formatDisplayDate(reservation.endDate)}</p>
        <p className="card-meta">מחיר ליום: ₪{reservation.pricePerDayAtBooking}</p>
        <p className="card-meta">סה״כ לתשלום: ₪{reservation.totalPrice}</p>

        {actionErrorMessage ? <p className="auth-error-message">{actionErrorMessage}</p> : null}

        {reservation.status === 'confirmed' ? (
          <div className="card-actions">
            <button
              type="button"
              className="button-link-secondary"
              onClick={() => onOpenCancel(reservation)}
              disabled={isCancelling}
            >
              {isCancelling ? 'מבטל...' : 'ביטול הזמנה'}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
