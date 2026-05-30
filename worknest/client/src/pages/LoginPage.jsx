export default function LoginPage() {
  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">התחברות</span>
        <h1 className="page-title">עמוד התחברות</h1>
        <p className="page-description">
          בהמשך יופיע כאן טופס התחברות המחובר ל-`/api/auth/login`. כרגע זהו מסך דמה עם כיוון RTL
          ועיצוב בסיסי בלבד.
        </p>
      </div>

      <article className="placeholder-card">
        <p className="placeholder-label">תוכן זמני</p>
        <p className="placeholder-copy">שדות אימייל וסיסמה והודעות שגיאה יתווספו בפרוסה הבאה.</p>
      </article>
    </section>
  );
}
