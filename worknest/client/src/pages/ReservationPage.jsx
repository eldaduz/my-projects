import EmptyState from '../components/ui/EmptyState.jsx';
import { ReservationFormPanel } from '../components/modals/ReservationModal.jsx';

export default function ReservationPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const branchId = searchParams.get('branchId');
  const workspaceId = searchParams.get('workspaceId');

  return (
    <section className="page-section section-stack">
      <div className="page-header compact-page-header">
        <span className="eyebrow">הזמנה</span>
        <h1 className="page-title">יצירת הזמנה</h1>
        <p className="page-description">
          כאן בוחרים תאריכים עבור הסניף וחלל העבודה שנבחרו. זמינות ומחיר סופי יאושרו על ידי המערכת
          בשלב הבא.
        </p>
      </div>

      {!branchId || !workspaceId ? (
        <EmptyState message="יש לבחור חלל עבודה לפני המעבר לעמוד ההזמנה." />
      ) : (
        <article className="hero-card reservation-route-card">
          <ReservationFormPanel branchId={branchId} workspaceId={workspaceId} />
        </article>
      )}
    </section>
  );
}
