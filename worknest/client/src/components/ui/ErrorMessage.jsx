export default function ErrorMessage({ message = 'משהו השתבש. נסו שוב בעוד רגע.' }) {
  return (
    <div className="ui-state-card ui-state-card-error">
      <p className="ui-state-text">{message}</p>
    </div>
  );
}
