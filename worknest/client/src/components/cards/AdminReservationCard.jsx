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

export default function AdminReservationCard({ reservation }) {
  const statusLabel = getReservationStatusLabel(reservation.status);
  const statusClassName =
    reservation.status === 'cancelled'
      ? 'reservation-status-badge reservation-status-badge-cancelled'
      : 'reservation-status-badge reservation-status-badge-confirmed';

  return (
    <article className="data-card admin-reservation-card">
      <div className="card-content admin-reservation-card-content">
        <div className="card-header admin-reservation-card-header">
          <div className="section-stack compact-stack">
            <span className="eyebrow">הזמנה</span>
            <h3 className="card-title admin-reservation-card-title">
              {formatFriendlyReservationNumber(reservation.id)}
            </h3>
          </div>
          <span className={statusClassName}>{statusLabel}</span>
        </div>

        <div className="admin-reservation-card-grid">
          <p className="card-meta">
            <strong>משתמש:</strong> {reservation.userFullName || 'לא זמין'}
          </p>
          <p className="card-meta">
            <strong>מיקום:</strong> {getBranchDisplayName(reservation.branchName)}
          </p>
          <p className="card-meta">
            <strong>חלל עבודה:</strong> {reservation.workspaceName}
          </p>
          <p className="card-meta">
            <strong>טווח תאריכים:</strong> {formatDisplayDate(reservation.startDate)} -{' '}
            {formatDisplayDate(reservation.endDate)}
          </p>
          <p className="card-meta">
            <strong>מחיר ליום:</strong> ₪{reservation.pricePerDayAtBooking}
          </p>
          <p className="card-meta">
            <strong>סה״כ לתשלום:</strong> ₪{reservation.totalPrice}
          </p>
        </div>
      </div>
    </article>
  );
}
