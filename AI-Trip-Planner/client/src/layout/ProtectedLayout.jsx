import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { RequireAuth } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';

function AppNav() {
  const { user, logout } = useAuth();
  const location = useLocation();

  function navClass(path) {
    return `app-nav-link${location.pathname === path ? ' is-active' : ''}`;
  }

  return (
    <>
      <header className="app-header">
        <div className="app-brand">AI Trip Planner</div>
        <nav className="app-nav">
          <Link to="/trips" className={navClass('/trips')}>
            Trips
          </Link>
          <Link to="/traveler-profiles" className={navClass('/traveler-profiles')}>
            Traveler Profiles
          </Link>
        </nav>
        <div className="app-user">
          <span>{user?.email}</span>
          <button type="button" className="btn" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="disclaimer-bar" role="note">
        <p>
          AI-generated itineraries are planning estimates. Verify current opening hours,
          availability, prices, and travel information independently.
        </p>
      </div>
    </>
  );
}

export function ProtectedLayout() {
  const location = useLocation();

  return (
    <RequireAuth fallback={<Navigate to="/login" replace state={{ from: location.pathname }} />}>
      <AppNav />
      <Outlet />
    </RequireAuth>
  );
}
