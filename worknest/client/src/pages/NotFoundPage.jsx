export default function NotFoundPage() {
  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">404</span>
        <h1 className="page-title">העמוד לא נמצא</h1>
        <p className="page-description">הנתיב שביקשת אינו קיים במעטפת הנוכחית של WorkNest.</p>
      </div>

      <div className="route-chip-row">
        <a className="route-chip" href="/" data-link>
          חזרה לבית
        </a>
        <a className="route-chip" href="/locations" data-link>
          מעבר למיקומים
        </a>
      </div>
    </section>
  );
}
