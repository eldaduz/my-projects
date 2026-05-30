export default function AccessDeniedPage() {
  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">גישה חסומה</span>
        <h1 className="page-title">אין לך הרשאה לצפות בעמוד זה</h1>
        <p className="page-description">
          עמוד זה זמין למנהלי מערכת בלבד. אפשר להמשיך לגלוש בשאר חלקי האתר הציבוריים.
        </p>
      </div>

      <a className="button-link" href="/" data-link>
        חזרה לעמוד הבית
      </a>
    </section>
  );
}
