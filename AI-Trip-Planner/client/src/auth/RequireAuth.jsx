import { useAuth } from './useAuth';

export function RequireAuth({ children, fallback = null }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        Loading…
      </div>
    );
  }
  if (status !== 'authenticated') return fallback;

  return children;
}
