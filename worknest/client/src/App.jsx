import { useEffect, useState } from 'react';
import './index.css';
import './App.css';
import { getCurrentUser } from './api/authApi.js';
import AppLayout from './components/layout/AppLayout.jsx';
import LoginModal from './components/modals/LoginModal.jsx';
import ReservationModal from './components/modals/ReservationModal.jsx';
import RegisterModal from './components/modals/RegisterModal.jsx';
import { isSessionErrorMessage } from './utils/errorMessages.js';
import HomePage from './pages/HomePage.jsx';
import LocationsPage from './pages/LocationsPage.jsx';
import LocationDetailsPage from './pages/LocationDetailsPage.jsx';
import WorkspaceDetailsPage from './pages/WorkspaceDetailsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ReservationPage from './pages/ReservationPage.jsx';
import ReservationConfirmationPage from './pages/ReservationConfirmationPage.jsx';
import MyReservationsPage from './pages/MyReservationsPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AccessDeniedPage from './pages/AccessDeniedPage.jsx';

const TOKEN_STORAGE_KEY = 'worknestToken';
const RESERVATION_REQUEST_EVENT = 'worknest:reservation-request';

// Keep paths consistent so `/locations/` and `/locations` behave the same.
function normalizePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

// Dynamic routes let placeholder pages receive the ID from the URL.
function getDynamicParam(pathname, routeStart) {
  if (!pathname.startsWith(routeStart)) {
    return null;
  }

  const value = pathname.slice(routeStart.length);
  return value && !value.includes('/') ? value : null;
}

function getCurrentRoute(pathname) {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === '/') {
    return { component: HomePage, params: {} };
  }

  if (normalizedPath === '/locations') {
    return { component: LocationsPage, params: {} };
  }

  const branchId = getDynamicParam(normalizedPath, '/locations/');
  if (branchId) {
    return { component: LocationDetailsPage, params: { branchId } };
  }

  const workspaceId = getDynamicParam(normalizedPath, '/workspaces/');
  if (workspaceId) {
    return { component: WorkspaceDetailsPage, params: { workspaceId } };
  }

  if (normalizedPath === '/login') {
    return { component: LoginPage, params: {} };
  }

  if (normalizedPath === '/register') {
    return { component: RegisterPage, params: {} };
  }

  if (normalizedPath === '/reservation') {
    return { component: ReservationPage, params: {} };
  }

  const reservationId = getDynamicParam(normalizedPath, '/reservation-confirmation/');
  if (reservationId) {
    return { component: ReservationConfirmationPage, params: { reservationId } };
  }

  if (normalizedPath === '/my-reservations') {
    return { component: MyReservationsPage, params: {} };
  }

  if (normalizedPath === '/admin') {
    return { component: AdminDashboardPage, params: {} };
  }

  if (normalizedPath === '/access-denied') {
    return { component: AccessDeniedPage, params: {} };
  }

  return { component: NotFoundPage, params: {} };
}

function isProtectedPath(pathname) {
  return pathname === '/reservation' || pathname === '/my-reservations' || pathname === '/admin';
}

// This small router is temporary until the app uses a full routing library.
function navigateTo(path) {
  const targetPath = normalizePath(path);

  if (targetPath !== normalizePath(window.location.pathname)) {
    window.history.pushState({}, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));
  const [activeAuthModal, setActiveAuthModal] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [lastPromptedProtectedPath, setLastPromptedProtectedPath] = useState(null);
  const [authModalMessage, setAuthModalMessage] = useState('');
  const [activeReservationSelection, setActiveReservationSelection] = useState(null);
  const [pendingReservationSelection, setPendingReservationSelection] = useState(null);
  const [pendingInlineProtectedAction, setPendingInlineProtectedAction] = useState(null);
  const isInlineProtectedActionRecovery =
    currentPath === pendingInlineProtectedAction?.path && Boolean(pendingInlineProtectedAction);

  useEffect(() => {
    const handleRouteChange = () => {
      setCurrentPath(normalizePath(window.location.pathname));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  useEffect(() => {
    // Intercept in-app links so the browser stays inside the single-page app.
    const handleDocumentClick = (event) => {
      const link = event.target.closest('a[data-link]');

      if (!link) {
        return;
      }

      const href = link.getAttribute('href');
      const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

      if (!href || isModifiedClick || link.target === '_blank') {
        return;
      }

      event.preventDefault();
      navigateTo(href);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  useEffect(() => {
    function handleReservationRequest(event) {
      const selection = event.detail;

      if (!selection?.branchId || !selection?.workspaceId) {
        return;
      }

      if (currentUser) {
        setAuthModalMessage('');
        setActiveAuthModal(null);
        setPendingReservationSelection(null);
        setActiveReservationSelection(selection);
        return;
      }

      setPendingReservationSelection(selection);
      if (isRestoringSession) {
        return;
      }

      setAuthModalMessage('יש להתחבר כדי לבצע הזמנה.');
      setActiveAuthModal('login');
    }

    window.addEventListener(RESERVATION_REQUEST_EVENT, handleReservationRequest);
    return () => window.removeEventListener(RESERVATION_REQUEST_EVENT, handleReservationRequest);
  }, [currentUser, isRestoringSession]);

  useEffect(() => {
    if (isRestoringSession || !pendingReservationSelection) {
      return;
    }

    if (currentUser) {
      setAuthModalMessage('');
      setActiveReservationSelection(pendingReservationSelection);
      setPendingReservationSelection(null);
      return;
    }

    setAuthModalMessage('יש להתחבר כדי לבצע הזמנה.');
    setActiveAuthModal('login');
  }, [currentUser, isRestoringSession, pendingReservationSelection]);

  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

      if (!savedToken) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const response = await getCurrentUser(savedToken);
        setCurrentUser(response.data.user);
      } catch (error) {
        if (isSessionErrorMessage(error.message)) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }

        setCurrentUser(null);
      } finally {
        setIsRestoringSession(false);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    const protectedPath = isProtectedPath(currentPath);

    if (protectedPath && !isRestoringSession && !currentUser) {
      if (isInlineProtectedActionRecovery) {
        setLastPromptedProtectedPath(null);
        return;
      }

      if (lastPromptedProtectedPath !== currentPath) {
        setActiveAuthModal('login');
        setLastPromptedProtectedPath(currentPath);
      }

      return;
    }

    setLastPromptedProtectedPath(null);
  }, [
    currentPath,
    currentUser,
    isInlineProtectedActionRecovery,
    isRestoringSession,
    lastPromptedProtectedPath,
  ]);

  function openLoginModal() {
    setAuthModalMessage('');
    setActiveAuthModal('login');
  }

  function openRegisterModal() {
    setActiveAuthModal('register');
  }

  function closeAuthModal() {
    setAuthModalMessage('');
    setPendingReservationSelection(null);
    setPendingInlineProtectedAction(null);
    setActiveAuthModal(null);
  }

  function handleAuthSuccess(user, token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setCurrentUser(user);
    setActiveAuthModal(null);
    setAuthModalMessage('');

    if (pendingReservationSelection) {
      setActiveReservationSelection(pendingReservationSelection);
      setPendingReservationSelection(null);
    }
  }

  function handleInlineProtectedActionSessionExpired(nextAction) {
    if (!nextAction?.type) {
      return;
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setCurrentUser(null);
    setPendingReservationSelection(null);
    setPendingInlineProtectedAction(
      (nextAction.retryCount ?? 0) < 1
        ? {
            ...nextAction,
            path: nextAction.path || currentPath,
            retryCount: (nextAction.retryCount ?? 0) + 1,
          }
        : null,
    );
    setAuthModalMessage(nextAction.message || 'פג תוקף ההתחברות. יש להתחבר מחדש.');
    setActiveAuthModal('login');
  }

  function clearPendingInlineProtectedAction() {
    setPendingInlineProtectedAction(null);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setCurrentUser(null);
    setActiveReservationSelection(null);
    setPendingReservationSelection(null);
    setPendingInlineProtectedAction(null);
    closeAuthModal();
  }

  let activeRoute = getCurrentRoute(currentPath);
  let pageMessage = '';

  if (isProtectedPath(currentPath)) {
    if (isRestoringSession) {
      activeRoute = {
        component: ProtectedRouteLoadingState,
        params: {},
      };
    } else if (!currentUser && !isInlineProtectedActionRecovery) {
      activeRoute = {
        component: ProtectedRouteFallbackState,
        params: {},
      };
      pageMessage = 'יש להתחבר כדי להמשיך.';
    } else if (currentPath === '/admin' && currentUser.role !== 'admin') {
      activeRoute = {
        component: AccessDeniedPage,
        params: {},
      };
    }
  }

  const PageComponent = activeRoute.component;

  return (
    <>
      <AppLayout
        currentPath={currentPath}
        currentUser={currentUser}
        isRestoringSession={isRestoringSession}
        onOpenLogin={openLoginModal}
        onOpenRegister={openRegisterModal}
        onLogout={handleLogout}
      >
        <PageComponent
          message={pageMessage}
          currentUser={currentUser}
          isRestoringSession={isRestoringSession}
          pendingInlineProtectedAction={pendingInlineProtectedAction}
          onInlineProtectedActionSessionExpired={handleInlineProtectedActionSessionExpired}
          onPendingInlineProtectedActionHandled={clearPendingInlineProtectedAction}
          {...activeRoute.params}
        />
      </AppLayout>

      {/* One shared state keeps the auth modal flow easy to follow. */}
      <LoginModal
        isOpen={activeAuthModal === 'login'}
        onClose={closeAuthModal}
        onAuthSuccess={handleAuthSuccess}
        onSwitchToRegister={openRegisterModal}
        promptMessage={authModalMessage}
      />
      <RegisterModal
        isOpen={activeAuthModal === 'register'}
        onClose={closeAuthModal}
        onAuthSuccess={handleAuthSuccess}
        onSwitchToLogin={openLoginModal}
      />
      <ReservationModal
        isOpen={Boolean(activeReservationSelection)}
        branchId={activeReservationSelection?.branchId}
        workspaceId={activeReservationSelection?.workspaceId}
        currentPath={currentPath}
        currentUser={currentUser}
        pendingInlineProtectedAction={pendingInlineProtectedAction}
        onInlineProtectedActionSessionExpired={handleInlineProtectedActionSessionExpired}
        onPendingInlineProtectedActionHandled={clearPendingInlineProtectedAction}
        onClose={() => {
          setActiveReservationSelection(null);

          if (pendingInlineProtectedAction?.type === 'reservation-create') {
            clearPendingInlineProtectedAction();
          }
        }}
      />
    </>
  );
}

function ProtectedRouteLoadingState() {
  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">טוען</span>
        <h1 className="page-title">בודקים את מצב ההתחברות</h1>
        <p className="page-description">אנא המתינו רגע בזמן שהמערכת משחזרת את ההתחברות שלכם.</p>
      </div>
    </section>
  );
}

function ProtectedRouteFallbackState({ message }) {
  return (
    <section className="page-section section-stack">
      <div className="page-header">
        <span className="eyebrow">נדרשת התחברות</span>
        <h1 className="page-title">לא ניתן לפתוח את העמוד הזה כרגע</h1>
        <p className="page-description">התחברו דרך החלון שנפתח כדי להמשיך לעמוד המבוקש.</p>
      </div>

      <div className="auth-guard-message">{message}</div>
    </section>
  );
}
