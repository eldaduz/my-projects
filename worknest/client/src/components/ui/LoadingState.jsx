export default function LoadingState({ message = 'טוען נתונים...' }) {
  return (
    <div className="ui-state-card">
      <p className="ui-state-text">{message}</p>
    </div>
  );
}
