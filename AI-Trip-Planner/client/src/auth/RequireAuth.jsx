import { useAuth } from './useAuth';

export function RequireAuth({ children, fallback = null }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <p className="page-loading" role="status" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (status !== 'authenticated') return fallback;

  return children;
}
