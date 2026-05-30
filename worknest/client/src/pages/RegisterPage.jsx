export default function RegisterPage() {
  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">הרשמה</span>
        <h1 className="page-title">עמוד הרשמה</h1>
        <p className="page-description">
          בהמשך יופיע כאן טופס הרשמה המחובר ל-`/api/auth/register` עם כללי הסיסמה המאושרים. כרגע
          המסך מיועד למבנה ולשפה בלבד.
        </p>
      </div>

      <article className="placeholder-card">
        <p className="placeholder-label">תוכן זמני</p>
        <p className="placeholder-copy">שדות שם מלא, אימייל וסיסמה יוטמעו בפרוסת האימות.</p>
      </article>
    </section>
  );
}
